import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { markdownToAdf } from 'marklassian';
import { 
  getPage, 
  getPageComments, 
  parseConfluenceUrl, 
  listSpaces, 
  getSpacePagesHierarchy, 
  addPageComment, 
  createPage, 
  updatePageContent,
  searchContent
} from '../lib/confluence-client.js';
import { 
  formatConfluencePage, 
  formatConfluenceSpaces, 
  formatConfluencePageHierarchy,
  formatConfluenceSearchResults
} from '../lib/formatters.js';
import { ui } from '../lib/ui.js';
import { CommandError } from '../lib/errors.js';
import { isConfluenceSpaceAllowed } from '../lib/settings.js';

export async function confluenceCreatePageCommand(
  space: string, 
  title: string, 
  parentPage?: string, 
  options: { returnBothUrls?: boolean } = {}
): Promise<void> {
  // Validate space key
  if (!isConfluenceSpaceAllowed(space)) {
    throw new CommandError(`Access to Confluence space '${space}' is restricted by your settings.`);
  }

  ui.startSpinner(`Creating Confluence page '${title}' in space '${space}'...`);

  try {
    const result = await createPage(space, title, parentPage, { returnBoth: options.returnBothUrls });
    ui.succeedSpinner(chalk.green('Confluence page created successfully'));
    
    if (typeof result === 'object') {
      console.log(chalk.cyan(`\nFull URL:  ${result.url}`));
      console.log(chalk.cyan(`Short URL: ${result.shortUrl}`));
    } else {
      console.log(chalk.cyan(`\nURL: ${result}`));
    }
  } catch (error: any) {
    ui.failSpinner();

    if (error instanceof CommandError) throw error;

    const errorMsg = error.message?.toLowerCase() || '';
    const hints: string[] = [];

    if (errorMsg.includes('401') || errorMsg.includes('403') || errorMsg.includes('unauthorized')) {
      hints.push('Authentication failed or you do not have permission to create pages in this space.');
    } else if (errorMsg.includes('404')) {
      hints.push('Space or parent page not found.');
    }

    throw new CommandError(`Failed to create Confluence page: ${error.message}`, { hints });
  }
}

export async function confluenceAddCommentCommand(url: string, options: { fromFile: string }): Promise<void> {
  const { fromFile } = options;

  // Validate space key before proceeding
  try {
    const { spaceKey } = parseConfluenceUrl(url);
    if (spaceKey && !isConfluenceSpaceAllowed(spaceKey)) {
      throw new CommandError(`Access to Confluence space '${spaceKey}' is restricted by your settings.`);
    }
  } catch (e) {
    if (e instanceof CommandError) throw e;
    // URL parsing errors will be caught during addPageComment
  }

  // Resolve and read file
  const absolutePath = path.resolve(fromFile);
  let markdownContent: string;
  try {
    markdownContent = fs.readFileSync(absolutePath, 'utf-8');
  } catch (error: any) {
    throw new CommandError(`Error reading file: ${error.message}`, {
      hints: ['Make sure the file exists and you have permission to read it.']
    });
  }

  if (markdownContent.trim() === '') {
    throw new CommandError('Markdown file is empty');
  }

  // Convert Markdown to ADF
  let adfContent: any;
  try {
    adfContent = markdownToAdf(markdownContent);
  } catch (error: any) {
    throw new CommandError(`Error converting Markdown to ADF: ${error.message}`, {
      hints: ['Ensure the Markdown content is valid.']
    });
  }

  ui.startSpinner('Adding comment to Confluence page...');

  try {
    await addPageComment(url, adfContent);
    ui.succeedSpinner(chalk.green('Comment added successfully to Confluence page'));
    console.log(chalk.gray(`\nPage: ${url}`));
    console.log(chalk.gray(`File: ${absolutePath}`));
  } catch (error: any) {
    ui.failSpinner();
    
    if (error instanceof CommandError) throw error;

    const errorMsg = error.message?.toLowerCase() || '';
    const hints: string[] = [];

    if (errorMsg.includes('404') || errorMsg.includes('not found')) {
      hints.push('The Confluence page was not found. Check if the URL is correct.');
    } else if (errorMsg.includes('401') || errorMsg.includes('403') || errorMsg.includes('unauthorized')) {
      hints.push('Authentication failed or you do not have permission to comment on this page.');
    }

    throw new CommandError(`Failed to add comment: ${error.message}`, { hints });
  }
}

export async function confluenceGetPageCommand(url: string, options: { returnBothUrls?: boolean } = {}): Promise<void> {
  // Check permission before fetching if space key can be extracted from URL
  try {
    const { spaceKey } = parseConfluenceUrl(url);
    if (spaceKey && !isConfluenceSpaceAllowed(spaceKey)) {
      throw new CommandError(`Access to Confluence space '${spaceKey}' is restricted by your settings.`);
    }
  } catch (e) {
    if (e instanceof CommandError) throw e;
    // If URL parsing fails, let the fetch attempt handle it or catch it later
  }

  ui.startSpinner(`Fetching Confluence page details for: ${url}`);

  try {
    const [page, comments] = await Promise.all([
      getPage(url, { returnBoth: options.returnBothUrls }),
      getPageComments(url)
    ]);

    // Double check with the actual space name/key from the fetched page
    if (!isConfluenceSpaceAllowed(page.space)) {
      throw new CommandError(`Access to Confluence space '${page.space}' is restricted by your settings.`);
    }

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

export async function confluenceListSpacesCommand(): Promise<void> {
  ui.startSpinner('Fetching Confluence spaces...');

  try {
    const spaces = await listSpaces();
    
    // Filter spaces based on settings
    const allowedSpaces = spaces.filter(space => isConfluenceSpaceAllowed(space.key));

    if (allowedSpaces.length === 0) {
      ui.failSpinner('No allowed Confluence spaces found.');
      console.log(chalk.yellow('\nHint: Add allowed spaces to your settings.yaml under "allowed-confluence-spaces".'));
      console.log(chalk.gray('Example:'));
      console.log(chalk.gray('  allowed-confluence-spaces:'));
      console.log(chalk.gray('    - SPACE1'));
      console.log(chalk.gray('    - SPACE2'));
      return;
    }

    ui.succeedSpinner(chalk.green('Confluence spaces retrieved'));
    console.log(formatConfluenceSpaces(allowedSpaces));
  } catch (error: any) {
    ui.failSpinner();
    throw new CommandError(`Failed to fetch Confluence spaces: ${error.message}`);
  }
}

export async function confluenceGetSpacePagesHierarchyCommand(spaceKey: string): Promise<void> {
  // Validate space key against allowed spaces
  if (!isConfluenceSpaceAllowed(spaceKey)) {
    throw new CommandError(`Access to Confluence space '${spaceKey}' is restricted by your settings.`);
  }

  ui.startSpinner(`Fetching page hierarchy for space: ${spaceKey}`);

  try {
    const hierarchy = await getSpacePagesHierarchy(spaceKey);
    ui.succeedSpinner(chalk.green('Confluence page hierarchy retrieved'));
    console.log(formatConfluencePageHierarchy(hierarchy));
  } catch (error: any) {
    ui.failSpinner();
    throw new CommandError(`Failed to fetch page hierarchy: ${error.message}`);
  }
}

export async function confluenceUpdateDescriptionCommand(url: string, options: { fromFile: string }): Promise<void> {
  const { fromFile } = options;

  // Validate space key before proceeding
  try {
    const { spaceKey } = parseConfluenceUrl(url);
    if (spaceKey && !isConfluenceSpaceAllowed(spaceKey)) {
      throw new CommandError(`Access to Confluence space '${spaceKey}' is restricted by your settings.`);
    }
  } catch (e) {
    if (e instanceof CommandError) throw e;
  }

  // Resolve and read file
  const absolutePath = path.resolve(fromFile);
  let markdownContent: string;
  try {
    markdownContent = fs.readFileSync(absolutePath, 'utf-8');
  } catch (error: any) {
    throw new CommandError(`Error reading file: ${error.message}`, {
      hints: ['Make sure the file exists and you have permission to read it.']
    });
  }

  if (markdownContent.trim() === '') {
    throw new CommandError('Markdown file is empty');
  }

  // Convert Markdown to ADF
  let adfContent: any;
  try {
    adfContent = markdownToAdf(markdownContent);
  } catch (error: any) {
    throw new CommandError(`Error converting Markdown to ADF: ${error.message}`, {
      hints: ['Ensure the Markdown content is valid.']
    });
  }

  ui.startSpinner('Updating Confluence page content...');

  try {
    await updatePageContent(url, adfContent);
    ui.succeedSpinner(chalk.green('Confluence page content updated successfully'));
    console.log(chalk.gray(`\nPage: ${url}`));
    console.log(chalk.gray(`File: ${absolutePath}`));
  } catch (error: any) {
    ui.failSpinner();

    if (error instanceof CommandError) throw error;

    const errorMsg = error.message?.toLowerCase() || '';
    const hints: string[] = [];

    if (errorMsg.includes('404') || errorMsg.includes('not found')) {
      hints.push('The Confluence page was not found. Check if the URL is correct.');
    } else if (errorMsg.includes('401') || errorMsg.includes('403') || errorMsg.includes('unauthorized')) {
      hints.push('Authentication failed or you do not have permission to update this page.');
    }

    throw new CommandError(`Failed to update Confluence page: ${error.message}`, { hints });
  }
}

export async function confluenceSearchCommand(query: string, options: { limit?: number } = {}): Promise<void> {
  const limit = options.limit || 20;

  ui.startSpinner(`Searching Confluence for: "${query}"...`);

  try {
    const results = await searchContent(query, limit);
    
    // Filter results based on allowed spaces
    // We prefer filtering by spaceKey, falling back to space name if key is missing
    const filteredResults = results.filter(result => {
      if (result.spaceKey) {
        return isConfluenceSpaceAllowed(result.spaceKey);
      }
      return isConfluenceSpaceAllowed(result.space);
    });

    ui.succeedSpinner(chalk.green('Confluence search completed'));
    console.log(formatConfluenceSearchResults(filteredResults));
  } catch (error: any) {
    ui.failSpinner();
    
    if (error instanceof CommandError) throw error;

    const errorMsg = error.message?.toLowerCase() || '';
    const hints: string[] = [];

    if (errorMsg.includes('401') || errorMsg.includes('403') || errorMsg.includes('unauthorized')) {
      hints.push('Authentication failed. Check your credentials with "jira-ai me".');
    }

    throw new CommandError(`Failed to search Confluence: ${error.message}`, { hints });
  }
}
