import { getIssueLinks, validateIssuePermissions } from '../lib/jira-client.js';
import { CommandError } from '../lib/errors.js';
import { validateOptions, IssueKeySchema } from '../lib/validation.js';
import { outputResult } from '../lib/json-mode.js';

export async function listIssueLinksCommand(issueKey: string): Promise<void> {
  validateOptions(IssueKeySchema, issueKey);

  await validateIssuePermissions(issueKey, 'issue.link.list');

  try {
    const links = await getIssueLinks(issueKey);
    outputResult(links);
  } catch (error: any) {
    if (error instanceof CommandError) throw error;

    const errorMsg = error.message?.toLowerCase() || '';
    const hints: string[] = [];

    if (errorMsg.includes('404')) {
      hints.push('Check that the issue key is correct');
    } else if (errorMsg.includes('403')) {
      hints.push('You may not have permission to view links for this issue');
    }

    throw new CommandError(`Failed to list issue links: ${error.message}`, { hints });
  }
}
