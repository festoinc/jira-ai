import chalk from 'chalk';
import ora from 'ora';
import { removeIssueLabels } from '../lib/jira-client.js';
import { CliError } from '../types/errors.js';
import { validateOptions, IssueKeySchema } from '../lib/validation.js';

export async function deleteLabelCommand(
  taskId: string,
  labelsString: string
): Promise<void> {
  // Validate input
  validateOptions(IssueKeySchema, taskId);
  if (!labelsString || labelsString.trim() === '') {
    throw new CliError('Labels are required (comma-separated)');
  }

  // Parse labels
  const labels = labelsString.split(',').map(l => l.trim()).filter(l => l !== '');

  if (labels.length === 0) {
    throw new CliError('No valid labels provided');
  }


  const spinner = ora(`Removing labels from ${taskId}...`).start();

  try {
    await removeIssueLabels(taskId, labels);
    spinner.succeed(chalk.green(`Labels removed successfully from ${taskId}`));
    console.log(chalk.gray(`\nLabels: ${labels.join(', ')}`));
  } catch (error) {
    spinner.fail(chalk.red('Failed to remove labels'));

    if (error instanceof Error && error.message.includes('404')) {
      console.log(chalk.yellow('\nHint: Check that the issue ID/key is correct'));
    }

    throw error;
  }
}
