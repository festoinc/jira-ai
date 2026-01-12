import chalk from 'chalk';
import ora from 'ora';
import { removeIssueLabels } from '../lib/jira-client.js';

export async function deleteLabelCommand(
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

  const spinner = ora(`Removing labels from ${taskId}...`).start();

  try {
    await removeIssueLabels(taskId, labels);
    spinner.succeed(chalk.green(`Labels removed successfully from ${taskId}`));
    console.log(chalk.gray(`\nLabels: ${labels.join(', ')}`));
  } catch (error) {
    spinner.fail(chalk.red('Failed to remove labels'));
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
