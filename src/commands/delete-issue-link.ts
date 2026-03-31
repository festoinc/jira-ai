import { getIssueLinks, deleteIssueLink, validateIssuePermissions } from '../lib/jira-client.js';
import { CommandError } from '../lib/errors.js';
import { validateOptions, IssueKeySchema } from '../lib/validation.js';
import { outputResult } from '../lib/json-mode.js';

export async function deleteIssueLinkCommand(
  sourceKey: string,
  targetKey: string
): Promise<void> {
  validateOptions(IssueKeySchema, sourceKey);
  validateOptions(IssueKeySchema, targetKey);

  await validateIssuePermissions(sourceKey, 'issue.link.delete');

  try {
    const links = await getIssueLinks(sourceKey);

    const matchingLinks = links.filter(
      link =>
        link.inwardIssue?.key === targetKey ||
        link.outwardIssue?.key === targetKey
    );

    if (matchingLinks.length === 0) {
      throw new CommandError(
        `No link found between ${sourceKey} and ${targetKey}`,
        { hints: ['Run \'issue link list\' to see all links for an issue'] }
      );
    }

    if (matchingLinks.length > 1) {
      const details = matchingLinks
        .map(l => `  - [${l.id}] ${l.type.name} (${l.inwardIssue?.key ?? '?'} ← → ${l.outwardIssue?.key ?? '?'})`)
        .join('\n');
      throw new CommandError(
        `Multiple links found between ${sourceKey} and ${targetKey}:\n${details}`,
        { hints: ['Use --link-id <id> to specify the exact link to delete (not yet supported — delete individually)'] }
      );
    }

    const linkId = matchingLinks[0].id;
    await deleteIssueLink(linkId);
    outputResult({ success: true, sourceKey, targetKey, linkType: matchingLinks[0].type.name });
  } catch (error: any) {
    if (error instanceof CommandError) throw error;

    const errorMsg = error.message?.toLowerCase() || '';
    const hints: string[] = [];

    if (errorMsg.includes('404')) {
      hints.push('Check that both issue keys are correct');
    } else if (errorMsg.includes('403')) {
      hints.push('You may not have permission to delete links in this project');
    }

    throw new CommandError(`Failed to delete issue link: ${error.message}`, { hints });
  }
}
