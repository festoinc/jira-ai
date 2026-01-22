import { ConfluenceClient } from 'confluence.js';
import { loadCredentials, getCurrentOrganizationAlias, setOrganizationOverride as setAuthOrgOverride } from './auth-storage.js';
import { convertADFToMarkdown } from './utils.js';
import { CommandError } from './errors.js';

let confluenceClient: ConfluenceClient | null = null;

/**
 * Set a global organization override for the current execution
 */
export function setOrganizationOverride(alias: string): void {
  setAuthOrgOverride(alias);
  confluenceClient = null; // Force client recreation
}

/**
 * Get or create Confluence client instance
 */
export function getConfluenceClient(): ConfluenceClient {
  if (!confluenceClient) {
    const alias = getCurrentOrganizationAlias();
    const storedCreds = loadCredentials(alias);
    if (storedCreds) {
      confluenceClient = new ConfluenceClient({
        host: storedCreds.host.replace(/\/$/, ''),
        authentication: {
          basic: {
            email: storedCreds.email,
            apiToken: storedCreds.apiToken,
          },
        },
      });
    } else {
      const errorMsg = alias 
        ? `Credentials for organization "${alias}" not found.`
        : 'Credentials not found. Please run "jira-ai auth"';
      throw new Error(errorMsg);
    }
  }
  return confluenceClient;
}

export interface ConfluencePage {
  id: string;
  title: string;
  content: string;
  space: string;
  author: string;
  lastUpdated: string;
  url: string;
  shortUrl?: string;
  fullUrl?: string;
}

export interface ConfluenceComment {
  id: string;
  author: string;
  body: string;
  created: string;
}

export interface ConfluenceSpace {
  key: string;
  name: string;
}

export interface ConfluencePageHierarchy {
  id: string;
  title: string;
  children: ConfluencePageHierarchy[];
}

/**
 * Parse Confluence URL to extract page ID and space key
 */
export function parseConfluenceUrl(url: string): { pageId: string; spaceKey?: string } {
  try {
    const parsedUrl = new URL(url);
    
    // Pattern: /wiki/spaces/SPACE/pages/PAGE_ID/TITLE
    const spaceMatch = parsedUrl.pathname.match(/\/spaces\/([^/]+)/);
    const spaceKey = spaceMatch ? spaceMatch[1] : undefined;

    const pagesMatch = parsedUrl.pathname.match(/\/pages\/(\d+)/);
    if (pagesMatch && pagesMatch[1]) {
      return { pageId: pagesMatch[1], spaceKey };
    }

    // Pattern: /wiki/pages/viewpage.action?pageId=PAGE_ID
    const pageIdParam = parsedUrl.searchParams.get('pageId');
    if (pageIdParam) {
      return { pageId: pageIdParam, spaceKey };
    }

    throw new Error('Could not extract Page ID from URL');
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Invalid Confluence URL: ${error.message}`);
    }
    throw new Error('Invalid Confluence URL');
  }
}

/**
 * Helper to construct Confluence page URLs
 */
function formatPageUrl(response: any, host: string, returnBoth: boolean = false): string | { url: string; shortUrl: string } {
  const baseUrl = response._links?.base || host || '';
  const webui = response._links?.webui;
  const shortUrl = `${baseUrl.replace(/\/$/, '')}/pages/${response.id}`;

  if (webui) {
    const fullUrl = `${baseUrl.replace(/\/$/, '')}${webui}`;
    if (returnBoth) {
      return { url: fullUrl, shortUrl };
    }
    return fullUrl;
  }

  if (returnBoth) {
    return { url: shortUrl, shortUrl };
  }
  return shortUrl;
}

/**
 * Get Confluence page details
 */
export async function getPage(url: string, options: { returnBoth?: boolean } = {}): Promise<ConfluencePage> {
  const client = getConfluenceClient();
  const { pageId } = parseConfluenceUrl(url);

  const page = await client.content.getContentById({
    id: pageId,
    expand: ['body.atlas_doc_format', 'body.storage', 'version', 'space', 'history'],
  });

  const adfBody = page.body?.atlas_doc_format?.value;
  const storageBody = page.body?.storage?.value;
  
  const content = adfBody 
    ? convertADFToMarkdown(typeof adfBody === 'string' ? JSON.parse(adfBody) : adfBody) 
    : (storageBody ? convertADFToMarkdown(storageBody) : 'No content available.');

  // @ts-ignore - accessing host to show it in UI
  const host = client.config.host || '';
  const urlResult = formatPageUrl(page, host, options.returnBoth);

  return {
    id: page.id || '',
    title: page.title || '',
    content,
    space: page.space?.name || page.space?.key || 'Unknown',
    author: page.history?.createdBy?.displayName || 
            page.history?.createdBy?.publicName || 
            page.version?.by?.displayName || 
            page.version?.by?.publicName || 
            'Unknown',
    lastUpdated: page.version?.when || 
                 page.history?.lastUpdated?.when || 
                 page.history?.createdDate || 
                 '',
    url: typeof urlResult === 'string' ? urlResult : urlResult.url,
    shortUrl: typeof urlResult === 'object' ? urlResult.shortUrl : undefined,
    fullUrl: typeof urlResult === 'string' ? urlResult : urlResult.url,
  };
}

/**
 * Get Confluence page comments
 */
export async function getPageComments(url: string): Promise<ConfluenceComment[]> {
  const client = getConfluenceClient();
  const { pageId } = parseConfluenceUrl(url);

  let allComments: any[] = [];
  let start = 0;
  const limit = 50;
  let hasMore = true;

  while (hasMore) {
    // Using descendants to get both page and inline comments
    // @ts-ignore - getDescendantsOfType exists in the API but might be missing in types
    const response = await client.contentChildrenAndDescendants.getDescendantsOfType({
      id: pageId,
      type: 'comment',
      expand: ['body.atlas_doc_format', 'body.storage', 'history', 'version'],
      start,
      limit,
    });

    const results = response.results || [];
    allComments = [...allComments, ...results];

    if (results.length < limit) {
      hasMore = false;
    } else {
      start += limit;
    }
  }

  return allComments.map((comment: any) => {
    const adfBody = comment.body?.atlas_doc_format?.value;
    const storageBody = comment.body?.storage?.value;

    const body = adfBody 
      ? convertADFToMarkdown(typeof adfBody === 'string' ? JSON.parse(adfBody) : adfBody) 
      : (storageBody ? convertADFToMarkdown(storageBody) : 'No content available.');

    return {
      id: comment.id,
      author: comment.history?.createdBy?.displayName || 
              comment.history?.createdBy?.publicName || 
              comment.version?.by?.displayName || 
              comment.version?.by?.publicName || 
              'Unknown',
      body,
      created: comment.history?.createdDate || comment.version?.when || '',
    };
  });
}

/**
 * List all available Confluence spaces
 */
export async function listSpaces(): Promise<ConfluenceSpace[]> {
  const client = getConfluenceClient();
  const response = await client.space.getSpaces({ limit: 50 });
  return (response.results || []).map((space: any) => ({
    key: space.key,
    name: space.name,
  }));
}

/**
 * Get page hierarchy for a space
 */
export async function getSpacePagesHierarchy(spaceKey: string, maxDepth: number = 5): Promise<ConfluencePageHierarchy[]> {
  const client = getConfluenceClient();
  
  // Get all pages in the space to identify roots
  // We expand 'ancestors' to check if a page is a root page (no ancestors)
  const allPagesResponse = await client.content.getContent({
    spaceKey,
    type: 'page',
    expand: ['ancestors'],
    limit: 100
  });

  const rootPages = (allPagesResponse.results || []).filter((p: any) => !p.ancestors || p.ancestors.length === 0);

  const fetchChildren = async (parentId: string, currentDepth: number): Promise<ConfluencePageHierarchy[]> => {
    if (currentDepth >= maxDepth) return [];

    const childrenResponse = await client.contentChildrenAndDescendants.getContentChildrenByType({
      id: parentId,
      type: 'page',
    });

    const children = childrenResponse.results || [];
    const result: ConfluencePageHierarchy[] = [];

    for (const child of children) {
      result.push({
        id: child.id,
        title: child.title,
        children: await fetchChildren(child.id, currentDepth + 1),
      });
    }

    return result;
  };

  const hierarchy: ConfluencePageHierarchy[] = [];
  for (const page of rootPages) {
    hierarchy.push({
      id: page.id,
      title: page.title,
      children: await fetchChildren(page.id, 1),
    });
  }

  return hierarchy;
}

/**
 * Add a comment to a Confluence page
 */
export async function addPageComment(url: string, adfContent: any): Promise<void> {
  const client = getConfluenceClient();
  const { pageId } = parseConfluenceUrl(url);

  // @ts-ignore - CreateContent type requires title and space which are not needed for comments
  await client.content.createContent({
    type: 'comment',
    container: { id: pageId, type: 'page' },
    body: { 
      atlas_doc_format: { 
        value: JSON.stringify(adfContent), 
        representation: 'atlas_doc_format' 
      } 
    }
  });
}

/**
 * Create a new Confluence page
 */
export async function createPage(
  spaceKey: string, 
  title: string, 
  parentId?: string, 
  options: { returnBoth?: boolean } = {}
): Promise<string | { url: string; shortUrl: string }> {
  const client = getConfluenceClient();
  
  const response = await client.content.createContent({
    type: 'page',
    title,
    space: { key: spaceKey },
    ancestors: parentId ? [{ id: parentId }] : undefined,
    body: {
      atlas_doc_format: {
        value: JSON.stringify({
          type: 'doc',
          version: 1,
          content: []
        }),
        representation: 'atlas_doc_format'
      }
    }
  });

  // @ts-ignore - accessing host to construct URL
  const host = client.config.host || '';
  return formatPageUrl(response, host, options.returnBoth);
}

/**
 * Update the content of an existing Confluence page
 */
export async function updatePageContent(url: string, adfContent: any): Promise<void> {
  const client = getConfluenceClient();
  const { pageId } = parseConfluenceUrl(url);

  // 1. Fetch current page details to get version and title
  let page;
  try {
    page = await client.content.getContentById({
      id: pageId,
      expand: ['version', 'space'],
    });
  } catch (error: any) {
    throw new Error(`Failed to fetch page details: ${error.message}`);
  }

  const currentVersion = page.version?.number || 0;
  const title = page.title;

  // 2. Update the page content
  try {
    await client.content.updateContent({
      id: pageId,
      version: { number: currentVersion + 1 },
      title,
      type: 'page',
      body: {
        atlas_doc_format: {
          value: JSON.stringify(adfContent),
          representation: 'atlas_doc_format',
        },
      },
    });
  } catch (error: any) {
    if (error.status === 409 || error.message?.includes('409') || error.message?.toLowerCase().includes('conflict')) {
      throw new CommandError('Version mismatch when updating Confluence page. Someone else might have updated it. Please try again.', {
        hints: ['Reload the page content and try your update again.']
      });
    }
    throw new Error(`Failed to update page content: ${error.message}`);
  }
}
