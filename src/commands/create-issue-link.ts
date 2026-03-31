import { createIssueLink, validateIssuePermissions } from '../lib/jira-client.js';
import { CommandError } from '../lib/errors.js';
import { validateOptions, IssueKeySchema } from '../lib/validation.js';
import { outputResult } from '../lib/json-mode.js';

export async function createIssueLinkCommand(
  inwardKey: string,
  linkType: string,
  outwardKey: string
): Promise<void> {
  validateOptions(IssueKeySchema, inwardKey);
  validateOptions(IssueKeySchema, outwardKey);

  await validateIssuePermissions(inwardKey, 'issue.link.create');

  try {
    await createIssueLink(inwardKey, outwardKey, linkType.trim());
    outputResult({ success: true, inwardKey, linkType: linkType.trim(), outwardKey });
  } catch (error: any) {
    if (error instanceof CommandError) throw error;

    const errorMsg = error.message?.toLowerCase() || '';
    const hints: string[] = [];

    if (errorMsg.includes('404')) {
      hints.push('Check that both issue keys are correct');
    } else if (errorMsg.includes('403')) {
      hints.push('You may not have permission to link issues in this project');
    } else if (errorMsg.includes('400')) {
      hints.push('The link type may not exist. Run \'issue link types\' to see available types.');
    }

    throw new CommandError(`Failed to create issue link: ${error.message}`, { hints });
  }
}
