import { validateIssuePermissions } from '../lib/jira-client.js';
import { CommandError } from '../lib/errors.js';
import { outputResult } from '../lib/json-mode.js';

export async function taskWithDetailsCommand(taskId: string, options: any = {}): Promise<void> {
  try {
    const task = await validateIssuePermissions(taskId, 'task-with-details', {
      includeHistory: options.includeDetailedHistory,
      historyLimit: options.historyLimit ? parseInt(options.historyLimit, 10) : undefined,
      historyOffset: options.historyOffset ? parseInt(options.historyOffset, 10) : undefined,
    });

    outputResult(task);
  } catch (error: any) {
    if (error instanceof CommandError) throw error;
    
    const errorMsg = error.message?.toLowerCase() || '';
    const hints: string[] = [];

    if (error.response?.status === 404 || errorMsg.includes('404')) {
      hints.push('Check that the task ID is correct');
    } else if (error.response?.status === 403 || errorMsg.includes('403')) {
      hints.push('You may not have permission to view this issue');
    }

    throw new CommandError(`Failed to fetch task details: ${error.message}`, { hints });
  }
}