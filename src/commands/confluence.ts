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
import { CommandError } from '../lib/errors.js';
import { isConfluenceSpaceAllowed } from '../lib/settings.js';
import { outputResult } from '../lib/json-mode.js';

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

  try {
    const result = await createPage(space, title, parentPage, { returnBoth: options.returnBothUrls });
    outputResult(typeof result === 'object' ? result : { url: result });
  } catch (error: any) {

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

  try {
    await addPageComment(url, adfContent);
    outputResult({ success: true, page: url, file: absolutePath });
  } catch (error: any) {
    
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

  try {
    const [page, comments] = await Promise.all([
      getPage(url, { returnBoth: options.returnBothUrls }),
      getPageComments(url)
    ]);

    // Double check with the actual space name/key from the fetched page
    if (!isConfluenceSpaceAllowed(page.space)) {
      throw new CommandError(`Access to Confluence space '${page.space}' is restricted by your settings.`);
    }

    outputResult({ page, comments });
  } catch (error: any) {
    
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
  try {
    const spaces = await listSpaces();

    // Filter spaces based on settings
    const allowedSpaces = spaces.filter(space => isConfluenceSpaceAllowed(space.key));

    outputResult(allowedSpaces);
  } catch (error: any) {
    throw new CommandError(`Failed to fetch Confluence spaces: ${error.message}`);
  }
}

export async function confluenceGetSpacePagesHierarchyCommand(spaceKey: string): Promise<void> {
  // Validate space key against allowed spaces
  if (!isConfluenceSpaceAllowed(spaceKey)) {
    throw new CommandError(`Access to Confluence space '${spaceKey}' is restricted by your settings.`);
  }

  try {
    const hierarchy = await getSpacePagesHierarchy(spaceKey);
    outputResult(hierarchy);
  } catch (error: any) {
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

  try {
    await updatePageContent(url, adfContent);
    outputResult({ success: true, page: url, file: absolutePath });
  } catch (error: any) {

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

    outputResult(filteredResults);
  } catch (error: any) {
    
    if (error instanceof CommandError) throw error;

    const errorMsg = error.message?.toLowerCase() || '';
    const hints: string[] = [];

    if (errorMsg.includes('401') || errorMsg.includes('403') || errorMsg.includes('unauthorized')) {
      hints.push('Authentication failed. Check your credentials with "jira-ai me".');
    }

    throw new CommandError(`Failed to search Confluence: ${error.message}`, { hints });
  }
}
