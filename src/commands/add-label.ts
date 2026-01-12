import chalk from 'chalk';
import { addIssueLabels } from '../lib/jira-client.js';
import { CommandError } from '../lib/errors.js';
import { ui } from '../lib/ui.js';
import { validateOptions, IssueKeySchema } from '../lib/validation.js';

export async function addLabelCommand(
  taskId: string,
  labelsString: string
): Promise<void> {
  // Validate input
  validateOptions(IssueKeySchema, taskId);
  if (!labelsString || labelsString.trim() === '') {
    throw new CommandError('Labels are required (comma-separated)');
  }

  // Parse labels
  const labels = labelsString.split(',').map(l => l.trim()).filter(l => l !== '');

  if (labels.length === 0) {
    throw new CommandError('No valid labels provided');
  }


  ui.startSpinner(`Adding labels to ${taskId}...`);

  try {
    await addIssueLabels(taskId, labels);
    ui.succeedSpinner(chalk.green(`Labels added successfully to ${taskId}`));
    console.log(chalk.gray(`\nLabels: ${labels.join(', ')}`));
  } catch (error: any) {
    const hints: string[] = [];
    if (error.message?.includes('404')) {
      hints.push('Check that the issue ID/key is correct');
    }

    throw new CommandError(`Failed to add labels: ${error.message}`, { hints });
  }
}
