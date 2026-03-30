import chalk from 'chalk';
import { getUsers } from '../lib/jira-client.js';
import { formatUsers } from '../lib/formatters.js';
import { ui } from '../lib/ui.js';
import { isCommandAllowed, isProjectAllowed } from '../lib/settings.js';
import { CommandError } from '../lib/errors.js';
import { outputResult, isJsonMode } from '../lib/json-mode.js';

export async function listColleaguesCommand(projectKey?: string): Promise<void> {
  if (projectKey) {
    if (!isProjectAllowed(projectKey)) {
      throw new CommandError(`Project '${projectKey}' is not allowed by your settings.`);
    }
    if (!isCommandAllowed('list-colleagues', projectKey)) {
      throw new CommandError(`Command 'list-colleagues' is not allowed for project ${projectKey}.`);
    }
  }

  const message = projectKey 
    ? `Fetching colleagues for project ${projectKey}...`
    : 'Fetching all active colleagues...';
    
  ui.startSpinner(message);

  try {
    const users = await getUsers(projectKey);
    ui.succeedSpinner(chalk.green('Colleagues retrieved'));

    if (users.length === 0) {
      if (!isJsonMode()) {
        console.log(chalk.yellow('\nNo active colleagues found.'));
      } else {
        outputResult(users);
      }
    } else {
      outputResult(users, formatUsers);
    }
  } catch (error: any) {
    ui.failSpinner(chalk.red('Failed to fetch colleagues'));
    throw error;
  }
}
