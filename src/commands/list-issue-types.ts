import chalk from 'chalk';
import ora from 'ora';
import { getProjectIssueTypes } from '../lib/jira-client.js';
import { formatProjectIssueTypes } from '../lib/formatters.js';

export async function listIssueTypesCommand(projectKey: string): Promise<void> {
  const spinner = ora(`Fetching issue types for project ${projectKey}...`).start();

  try {
    const issueTypes = await getProjectIssueTypes(projectKey);
    spinner.succeed(chalk.green('Issue types retrieved'));
    console.log(formatProjectIssueTypes(projectKey, issueTypes));
  } catch (error) {
    spinner.fail(chalk.red('Failed to fetch issue types'));
    console.error(chalk.red('\nError: ' + (error instanceof Error ? error.message : 'Unknown error')));
    process.exit(1);
  }
}
