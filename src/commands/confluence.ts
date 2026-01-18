import chalk from 'chalk';
import { getPage, getPageComments } from '../lib/confluence-client.js';
import { formatConfluencePage } from '../lib/formatters.js';
import { ui } from '../lib/ui.js';
import { CommandError } from '../lib/errors.js';

export async function confluenceGetPageCommand(url: string): Promise<void> {
  ui.startSpinner(`Fetching Confluence page details for: ${url}`);

  try {
    const [page, comments] = await Promise.all([
      getPage(url),
      getPageComments(url)
    ]);

    ui.succeedSpinner(chalk.green('Confluence page details retrieved'));
    console.log(formatConfluencePage(page, comments));
  } catch (error: any) {
    ui.failSpinner();
    
    if (error instanceof CommandError) throw error;

    const errorMsg = error.message?.toLowerCase() || '';
    const hints: string[] = [];

    if (errorMsg.includes('404') || errorMsg.includes('not found')) {
      hints.push('The Confluence page was not found. Check if the URL is correct and you have access.');
    } else if (errorMsg.includes('401') || errorMsg.includes('403') || errorMsg.includes('unauthorized')) {
      hints.push('Authentication failed. Check your credentials with "jira-ai me".');
    } else if (errorMsg.includes('invalid confluence url')) {
      hints.push('Make sure the URL is a valid Confluence page URL.');
      hints.push('Example: https://your-domain.atlassian.net/wiki/spaces/SPACE/pages/12345/Page+Title');
    }

    throw new CommandError(`Failed to fetch Confluence page: ${error.message}`, { hints });
  }
}
