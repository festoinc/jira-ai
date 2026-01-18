import chalk from 'chalk';
import { getPage, getPageComments } from '../lib/confluence-client.js';
import { formatConfluencePage } from '../lib/formatters.js';
import { ui } from '../lib/ui.js';

export async function confluenceGetPageCommand(url: string): Promise<void> {
  ui.startSpinner(`Fetching Confluence page details for: ${url}`);

  try {
    const [page, comments] = await Promise.all([
      getPage(url),
      getPageComments(url)
    ]);

    ui.succeedSpinner(chalk.green('Confluence page details retrieved'));
    console.log(formatConfluencePage(page, comments));
  } catch (error) {
    ui.failSpinner();
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('An unknown error occurred while fetching Confluence page');
  }
}
