import chalk from 'chalk';
import { addIssueLabels, validateIssuePermissions } from '../lib/jira-client.js';
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

  // Check permissions and filters
  ui.startSpinner(`Validating permissions for ${taskId}...`);
  await validateIssuePermissions(taskId, 'add-label-to-issue');

  ui.startSpinner(`Adding labels to ${taskId}...`);

  try {
    await addIssueLabels(taskId, labels);
    ui.succeedSpinner(chalk.green(`Labels added successfully to ${taskId}`));
    console.log(chalk.gray(`
Labels: ${labels.join(', ')}`));
  } catch (error: any) {
    if (error instanceof CommandError) throw error;

    const errorMsg = error.message?.toLowerCase() || '';
    const hints: string[] = [];

    if (errorMsg.includes('404')) {
      hints.push('Check that the issue ID/key is correct');
    }

    throw new CommandError(`Failed to add labels: ${error.message}`, { hints });
  }
}