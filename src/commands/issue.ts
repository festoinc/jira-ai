import chalk from 'chalk';
import { assignIssue, validateIssuePermissions } from '../lib/jira-client.js';
import { CommandError } from '../lib/errors.js';
import { ui } from '../lib/ui.js';

export async function issueAssignCommand(
  issueKey: string,
  accountId: string
): Promise<void> {
  const actualAccountId = accountId === 'null' ? null : accountId;

  // Check permissions and filters
  ui.startSpinner(`Validating permissions for ${issueKey}...`);
  await validateIssuePermissions(issueKey, 'issue');

  ui.startSpinner(`Assigning ${issueKey} to ${actualAccountId || 'Unassigned'}...`);

  try {
    await assignIssue(issueKey, actualAccountId);
    
    ui.succeedSpinner(
      chalk.green(`Issue ${issueKey} successfully assigned to ${actualAccountId || 'Unassigned'}.`)
    );
  } catch (error: any) {
    if (error instanceof CommandError) {
      throw error;
    }

    const errorMsg = error.message?.toLowerCase() || '';
    const hints: string[] = [];

    if (errorMsg.includes('403')) {
      hints.push('You may not have permission to assign this issue');
    } else if (errorMsg.includes('400')) {
      hints.push('The assignee account ID might be invalid or the user is not assignable to this issue.');
    }

    throw new CommandError(`Failed to assign issue: ${error.message}`, { hints });
  }
}
