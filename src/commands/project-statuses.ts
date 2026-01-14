import chalk from 'chalk';
import { getProjectStatuses } from '../lib/jira-client.js';
import { formatProjectStatuses } from '../lib/formatters.js';
import { ui } from '../lib/ui.js';
import { isCommandAllowed, isProjectAllowed } from '../lib/settings.js';
import { CommandError } from '../lib/errors.js';

export async function projectStatusesCommand(projectIdOrKey: string): Promise<void> {
  // Check if project is allowed
  if (!isProjectAllowed(projectIdOrKey)) {
    throw new CommandError(`Project '${projectIdOrKey}' is not allowed by your settings.`);
  }

  // Check if command is allowed for this project
  if (!isCommandAllowed('project-statuses', projectIdOrKey)) {
    throw new CommandError(`Command 'project-statuses' is not allowed for project ${projectIdOrKey}.`);
  }

  ui.startSpinner(`Fetching statuses for project ${projectIdOrKey}...`);

  try {
    const statuses = await getProjectStatuses(projectIdOrKey);
    ui.succeedSpinner(chalk.green('Project statuses retrieved'));
    console.log(formatProjectStatuses(projectIdOrKey, statuses));
  } catch (error: any) {
    ui.failSpinner(chalk.red('Failed to fetch project statuses'));
    throw error;
  }
}