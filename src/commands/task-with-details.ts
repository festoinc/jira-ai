import chalk from 'chalk';
import ora from 'ora';
import { getTaskWithDetails } from '../lib/jira-client.js';
import { formatTaskDetails } from '../lib/formatters.js';

export async function taskWithDetailsCommand(taskId: string): Promise<void> {
  const spinner = ora(`Fetching details for ${taskId}...`).start();

  try {
    const task = await getTaskWithDetails(taskId);
    spinner.succeed(chalk.green('Task details retrieved'));
    console.log(formatTaskDetails(task));
  } catch (error) {
    spinner.fail(chalk.red('Failed to fetch task details'));
    console.error(chalk.red('\nError: ' + (error instanceof Error ? error.message : 'Unknown error')));
    process.exit(1);
  }
}
