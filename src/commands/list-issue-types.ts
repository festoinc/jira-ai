import chalk from 'chalk';
import { getProjectIssueTypes } from '../lib/jira-client.js';
import { formatProjectIssueTypes } from '../lib/formatters.js';
import { ui } from '../lib/ui.js';

export async function listIssueTypesCommand(projectKey: string): Promise<void> {
  ui.startSpinner(`Fetching issue types for project ${projectKey}...`);

  const issueTypes = await getProjectIssueTypes(projectKey);
  ui.succeedSpinner(chalk.green('Issue types retrieved'));
  console.log(formatProjectIssueTypes(projectKey, issueTypes));
}
