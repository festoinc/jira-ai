import chalk from 'chalk';
import ora from 'ora';
import { getProjectStatuses } from '../lib/jira-client.js';
import { formatProjectStatuses } from '../lib/formatters.js';

export async function projectStatusesCommand(projectId: string): Promise<void> {
  const spinner = ora(`Fetching statuses for project ${projectId}...`).start();

  try {
    const statuses = await getProjectStatuses(projectId);
    spinner.succeed(chalk.green('Project statuses retrieved'));
    console.log(formatProjectStatuses(projectId, statuses));
  } catch (error) {
    spinner.fail(chalk.red('Failed to fetch project statuses'));
    console.error(chalk.red('\nError: ' + (error instanceof Error ? error.message : 'Unknown error')));
    process.exit(1);
  }
}
