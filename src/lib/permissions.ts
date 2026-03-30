import { isCommandAllowed, getAllowedCommands } from './settings.js';
import { CommandError } from './errors.js';

/**
 * Throws a CommandError if the given command is not allowed by current settings.
 * Shared utility used by board, sprint, backlog, and other command modules.
 */
export function requirePermission(command: string): void {
  if (!isCommandAllowed(command)) {
    throw new CommandError(`Command '${command}' is not allowed.`, {
      hints: [`Allowed commands: ${getAllowedCommands().join(', ')}`, 'Update settings.yaml to enable this command.'],
    });
  }
}
