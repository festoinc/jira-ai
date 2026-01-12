import chalk from 'chalk';
import ora from 'ora';
import { addIssueLabels } from '../lib/jira-client.js';
import { CliError } from '../types/errors.js';
import { validateOptions, IssueKeySchema } from '../lib/validation.js';

export async function addLabelCommand(
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


  const spinner = ora(`Adding labels to ${taskId}...`).start();

  try {
    await addIssueLabels(taskId, labels);
    spinner.succeed(chalk.green(`Labels added successfully to ${taskId}`));
    console.log(chalk.gray(`\nLabels: ${labels.join(', ')}`));
  } catch (error) {
    spinner.fail(chalk.red('Failed to add labels'));

    if (error instanceof Error && error.message.includes('404')) {
      console.log(chalk.yellow('\nHint: Check that the issue ID/key is correct'));
    }

    throw error;
  }
}
