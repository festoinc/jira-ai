import { searchIssuesByJql, getIssueWorklogs, WorklogWithIssue, resolveUserByName } from '../lib/jira-client.js';
import { parseTimeframe, formatDateForJql } from '../lib/utils.js';
import { CommandError } from '../lib/errors.js';
import { outputResult } from '../lib/json-mode.js';

export interface GetPersonWorklogOptions {
  groupByIssue?: boolean;
  project?: string;
}

export async function getPersonWorklogCommand(
  person: string,
  timeframe: string,
  options: GetPersonWorklogOptions
): Promise<void> {
  try {
    const { startDate, endDate } = parseTimeframe(timeframe);
    const startJql = formatDateForJql(startDate);
    const endJql = formatDateForJql(endDate);

    // Resolve person to accountId when a project filter is provided for better JQL accuracy
    let worklogAuthor = person;
    if (options.project) {
      const resolved = await resolveUserByName(person);
      worklogAuthor = resolved ?? person;
    }

    // 1. Search for issues where the person has tracked time in the timeframe
    // We use a broader search first to find relevant issues
    const projectClause = options.project ? ` AND project = "${options.project}"` : '';
    const jql = `worklogAuthor = "${worklogAuthor}" AND worklogDate >= "${startJql}" AND worklogDate <= "${endJql}"${projectClause}`;

    const issues = await searchIssuesByJql(jql, 100);

    if (issues.length === 0) {
      outputResult([]);
      return;
    }

    const allWorklogs: WorklogWithIssue[] = [];

    // 2. For each issue, fetch all worklogs and filter in-memory
    for (const issue of issues) {
      const worklogs = await getIssueWorklogs(issue.key);
      
      const filteredWorklogs = worklogs.filter(w => {
        const matchesPerson = w.author.accountId === person || w.author.emailAddress === person;
        const worklogDate = new Date(w.started);
        const matchesDate = worklogDate >= startDate && worklogDate <= endDate;
        return matchesPerson && matchesDate;
      });

      filteredWorklogs.forEach(w => {
        allWorklogs.push({
          ...w,
          summary: issue.summary || '',
        });
      });
    }

    if (allWorklogs.length === 0) {
      outputResult([]);
      return;
    }

    outputResult(allWorklogs);

  } catch (error: any) {
    throw new CommandError(error.message);
  }
}
