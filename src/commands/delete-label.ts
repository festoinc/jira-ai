import { removeIssueLabels, validateIssuePermissions } from '../lib/jira-client.js';
import { CommandError } from '../lib/errors.js';
import { validateOptions, IssueKeySchema } from '../lib/validation.js';
import { outputResult } from '../lib/json-mode.js';

export async function deleteLabelCommand(
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
  await validateIssuePermissions(taskId, 'delete-label-from-issue');

  try {
    await removeIssueLabels(taskId, labels);
    outputResult({ success: true, issueKey: taskId, labels });
  } catch (error: any) {
    if (error instanceof CommandError) throw error;

    const errorMsg = error.message?.toLowerCase() || '';
    const hints: string[] = [];

    if (errorMsg.includes('404')) {
      hints.push('Check that the issue ID/key is correct');
    }

    throw new CommandError(`Failed to remove labels: ${error.message}`, { hints });
  }
}