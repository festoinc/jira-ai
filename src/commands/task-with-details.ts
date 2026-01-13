import chalk from 'chalk';
import { getTaskWithDetails } from '../lib/jira-client.js';
import { formatTaskDetails } from '../lib/formatters.js';
import { CommandError } from '../lib/errors.js';
import { ui } from '../lib/ui.js';

export async function taskWithDetailsCommand(taskId: string, options: any = {}): Promise<void> {
  ui.startSpinner(`Fetching details for ${taskId}...`);

  try {
    const task = await getTaskWithDetails(taskId, {
      includeHistory: options.includeDetailedHistory,
      historyLimit: options.historyLimit ? parseInt(options.historyLimit, 10) : undefined,
      historyOffset: options.historyOffset ? parseInt(options.historyOffset, 10) : undefined,
    });
    ui.succeedSpinner(chalk.green('Task details retrieved'));
    console.log(formatTaskDetails(task));
  } catch (error: any) {
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
