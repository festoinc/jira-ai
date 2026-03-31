import { moveIssuesToBacklog } from '../lib/agile-client.js';
import { requirePermission } from '../lib/permissions.js';
import { CommandError } from '../lib/errors.js';

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

  await moveIssuesToBacklog(options.issues);
  console.log(`Moved ${options.issues.length} issue(s) to backlog.`);
}
