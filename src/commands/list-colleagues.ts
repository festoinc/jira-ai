import { getUsers } from '../lib/jira-client.js';
import { isCommandAllowed, isProjectAllowed } from '../lib/settings.js';
import { CommandError } from '../lib/errors.js';
import { outputResult } from '../lib/json-mode.js';

export async function listColleaguesCommand(projectKey?: string): Promise<void> {
  if (projectKey) {
    if (!isProjectAllowed(projectKey)) {
      throw new CommandError(`Project '${projectKey}' is not allowed by your settings.`);
    }
    if (!isCommandAllowed('list-colleagues', projectKey)) {
      throw new CommandError(`Command 'list-colleagues' is not allowed for project ${projectKey}.`);
    }
  }

  try {
    const users = await getUsers(projectKey);
    outputResult(users);
  } catch (error: any) {
    throw error;
  }
}
