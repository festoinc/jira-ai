import chalk from 'chalk';
import { getAvailableLinkTypes } from '../lib/jira-client.js';
import { formatLinkTypes } from '../lib/formatters.js';
import { CommandError } from '../lib/errors.js';
import { ui } from '../lib/ui.js';
import { outputResult } from '../lib/json-mode.js';

export async function listLinkTypesCommand(): Promise<void> {
  ui.startSpinner('Fetching available link types...');

  try {
    const linkTypes = await getAvailableLinkTypes();
    ui.succeedSpinner(chalk.green('Link types retrieved'));
    outputResult(linkTypes, formatLinkTypes);
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
