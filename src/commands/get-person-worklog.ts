import chalk from 'chalk';
import { ui } from '../lib/ui.js';
import { searchIssuesByJql, getIssueWorklogs, WorklogWithIssue, getJiraClient } from '../lib/jira-client.js';
import { parseTimeframe, formatDateForJql } from '../lib/utils.js';
import { formatWorklogs } from '../lib/formatters.js';
import { CommandError } from '../lib/errors.js';

export interface GetPersonWorklogOptions {
  groupByIssue?: boolean;
}

export async function getPersonWorklogCommand(
  person: string,
  timeframe: string,
  options: GetPersonWorklogOptions
): Promise<void> {
  ui.startSpinner(`Fetching worklogs for ${person}...`);

  try {
    const { startDate, endDate } = parseTimeframe(timeframe);
    const startJql = formatDateForJql(startDate);
    const endJql = formatDateForJql(endDate);

    // 1. Search for issues where the person has tracked time in the timeframe
    // We use a broader search first to find relevant issues
    const jql = `worklogAuthor = "${person}" AND worklogDate >= "${startJql}" AND worklogDate <= "${endJql}"`;
    
    // We need to fetch issues with their summaries
    const client = getJiraClient();
    const issueResponse = await client.issueSearch.searchForIssuesUsingJqlEnhancedSearch({
      jql,
      fields: ['summary'],
      maxResults: 100,
    });

    const issues = issueResponse.issues || [];
    
    if (issues.length === 0) {
      ui.stopSpinner();
      console.log(chalk.yellow(`
No worklogs found for ${person} between ${startJql} and ${endJql}.
`));
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
          summary: issue.fields?.summary || '',
        });
      });
    }

    ui.stopSpinner();

    if (allWorklogs.length === 0) {
      console.log(chalk.yellow(`
No worklogs found for ${person} after detailed filtering.
`));
      return;
    }

    console.log(formatWorklogs(allWorklogs, options.groupByIssue));

  } catch (error: any) {
    ui.failSpinner(`Failed to fetch worklogs: ${error.message}`);
    throw new CommandError(error.message);
  }
}
