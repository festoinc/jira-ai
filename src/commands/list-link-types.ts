import { getAvailableLinkTypes } from '../lib/jira-client.js';
import { CommandError } from '../lib/errors.js';
import { outputResult } from '../lib/json-mode.js';

export async function listLinkTypesCommand(): Promise<void> {
  try {
    const linkTypes = await getAvailableLinkTypes();
    outputResult(linkTypes);
  } catch (error: any) {
    if (error instanceof CommandError) throw error;

    const errorMsg = error.message?.toLowerCase() || '';
    const hints: string[] = [];

    if (errorMsg.includes('403')) {
      hints.push('You may not have permission to list link types');
    }

    throw new CommandError(`Failed to list link types: ${error.message}`, { hints });
  }
}
