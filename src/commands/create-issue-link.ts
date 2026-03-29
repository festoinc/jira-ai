import chalk from 'chalk';
import { createIssueLink, validateIssuePermissions } from '../lib/jira-client.js';
import { CommandError } from '../lib/errors.js';
import { ui } from '../lib/ui.js';
import { validateOptions, IssueKeySchema } from '../lib/validation.js';

export async function createIssueLinkCommand(
  inwardKey: string,
  linkType: string,
  outwardKey: string
): Promise<void> {
  validateOptions(IssueKeySchema, inwardKey);
  validateOptions(IssueKeySchema, outwardKey);

  if (!linkType || linkType.trim() === '') {
    throw new CommandError('Link type is required. Run \'issue link types\' to see available types.');
  }

  ui.startSpinner(`Validating permissions for ${inwardKey}...`);
  await validateIssuePermissions(inwardKey, 'issue.link.create');

  ui.startSpinner(`Creating link between ${inwardKey} and ${outwardKey}...`);

  try {
    await createIssueLink(inwardKey, outwardKey, linkType.trim());
    ui.succeedSpinner(chalk.green(`Link created successfully`));
    console.log(chalk.gray(`
${inwardKey} --[${linkType.trim()}]--> ${outwardKey}`));
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
