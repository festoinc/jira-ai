import chalk from 'chalk';
import { getTaskWithDetails, getCurrentUser } from '../lib/jira-client.js';
import { formatTaskDetails } from '../lib/formatters.js';
import { CommandError } from '../lib/errors.js';
import { ui } from '../lib/ui.js';
import { isCommandAllowed, validateIssueAgainstFilters } from '../lib/settings.js';

export async function taskWithDetailsCommand(taskId: string, options: any = {}): Promise<void> {
  ui.startSpinner(`Fetching details for ${taskId}...`);

  try {
    const task = await getTaskWithDetails(taskId, {
      includeHistory: options.includeDetailedHistory,
      historyLimit: options.historyLimit ? parseInt(options.historyLimit, 10) : undefined,
      historyOffset: options.historyOffset ? parseInt(options.historyOffset, 10) : undefined,
    });

    const projectKey = task.key.split('-')[0];

    // Check if command is allowed for this project
    if (!isCommandAllowed('task-with-details', projectKey)) {
      ui.failSpinner(chalk.red('Command not allowed for this project'));
      throw new CommandError(
        `Command 'task-with-details' is not allowed for project ${projectKey}.`,
        {
          hints: [
            `Update settings.yaml to enable this command for this project.`
          ]
        }
      );
    }

    // Check granular filters
    const currentUser = await getCurrentUser();
    if (!validateIssueAgainstFilters(task, currentUser.accountId)) {
      ui.failSpinner(chalk.red('Access denied by project filters'));
      throw new CommandError(
        `Access to issue ${taskId} is restricted by project filters.`,
        {
          hints: [
            `This project has filters that you do not meet (e.g., participated roles).`
          ]
        }
      );
    }

    ui.succeedSpinner(chalk.green('Task details retrieved'));
    console.log(formatTaskDetails(task));
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