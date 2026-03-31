import { getProjectStatuses } from '../lib/jira-client.js';
import { isCommandAllowed, isProjectAllowed } from '../lib/settings.js';
import { CommandError } from '../lib/errors.js';
import { outputResult } from '../lib/json-mode.js';

export async function projectStatusesCommand(projectIdOrKey: string): Promise<void> {
  // Check if project is allowed
  if (!isProjectAllowed(projectIdOrKey)) {
    throw new CommandError(`Project '${projectIdOrKey}' is not allowed by your settings.`);
  }

  // Check if command is allowed for this project
  if (!isCommandAllowed('project-statuses', projectIdOrKey)) {
    throw new CommandError(`Command 'project-statuses' is not allowed for project ${projectIdOrKey}.`);
  }

  try {
    const statuses = await getProjectStatuses(projectIdOrKey);
    outputResult(statuses);
  } catch (error: any) {
    throw error;
  }
}