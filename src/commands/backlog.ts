import chalk from 'chalk';
import { moveIssuesToBacklog } from '../lib/agile-client.js';
import { isCommandAllowed, getAllowedCommands } from '../lib/settings.js';
import { CommandError } from '../lib/errors.js';
import { ui } from '../lib/ui.js';

function requirePermission(command: string): void {
  if (!isCommandAllowed(command)) {
    throw new CommandError(`Command '${command}' is not allowed.`, {
      hints: [`Allowed commands: ${getAllowedCommands().join(', ')}`, 'Update settings.yaml to enable this command.'],
    });
  }
}

// backlog move --issues <keys>
export async function backlogMoveCommand(options: { issues: string[] }): Promise<void> {
  requirePermission('board.backlog');
  if (!options.issues || options.issues.length === 0) {
    throw new CommandError('At least one issue key is required.', { hints: ['Provide issue keys with --issues'] });
  }
  if (options.issues.length > 50) {
    throw new CommandError('Cannot move more than 50 issues at once.', {
      hints: ['Split your issue list into batches of 50 or fewer'],
    });
  }

  ui.startSpinner(`Moving ${options.issues.length} issue(s) to backlog...`);
  await moveIssuesToBacklog(options.issues);
  ui.succeedSpinner(chalk.green(`Moved ${options.issues.length} issue(s) to backlog.`));
  console.log(`${options.issues.length} issue(s) moved to backlog.`);
}
