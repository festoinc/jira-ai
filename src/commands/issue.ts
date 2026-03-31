import { assignIssue, validateIssuePermissions } from '../lib/jira-client.js';
import { CommandError } from '../lib/errors.js';
import { outputResult } from '../lib/json-mode.js';

export async function issueAssignCommand(
  issueKey: string,
  accountId: string
): Promise<void> {
  const actualAccountId = accountId === 'null' ? null : accountId;

  // Check permissions and filters
  await validateIssuePermissions(issueKey, 'issue');

  try {
    await assignIssue(issueKey, actualAccountId);
    outputResult({ success: true, issueKey, assignee: actualAccountId || null });
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
