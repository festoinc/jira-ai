import chalk from 'chalk';
import ora from 'ora';
import { addIssueLabels } from '../lib/jira-client.js';

export async function addLabelCommand(
  taskId: string,
  labelsString: string
): Promise<void> {
  // Validate input
  if (!taskId || taskId.trim() === '') {
    console.error(chalk.red('\nError: Task ID is required'));
    process.exit(1);
  }

  if (!labelsString || labelsString.trim() === '') {
    console.error(chalk.red('\nError: Labels are required (comma-separated)'));
    process.exit(1);
  }

  // Parse labels
  const labels = labelsString.split(',').map(l => l.trim()).filter(l => l !== '');

  if (labels.length === 0) {
    console.error(chalk.red('\nError: No valid labels provided'));
    process.exit(1);
  }

  const spinner = ora(`Adding labels to ${taskId}...`).start();

  try {
    await addIssueLabels(taskId, labels);
    spinner.succeed(chalk.green(`Labels added successfully to ${taskId}`));
    console.log(chalk.gray(`\nLabels: ${labels.join(', ')}`));
  } catch (error) {
    spinner.fail(chalk.red('Failed to add labels'));
    console.error(
      chalk.red(
        '\nError: ' + (error instanceof Error ? error.message : 'Unknown error')
      )
    );

    if (error instanceof Error && error.message.includes('404')) {
      console.log(chalk.yellow('\nHint: Check that the issue ID/key is correct'));
    }

    process.exit(1);
  }
}
