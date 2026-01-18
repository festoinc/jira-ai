import { ConfluenceClient } from 'confluence.js';
import { loadCredentials } from './auth-storage.js';
import { convertADFToMarkdown } from './utils.js';

let confluenceClient: ConfluenceClient | null = null;
let organizationOverride: string | undefined = undefined;

/**
 * Set a global organization override for the current execution
 */
export function setOrganizationOverride(alias: string): void {
  organizationOverride = alias;
  confluenceClient = null; // Force client recreation
}

/**
 * Get or create Confluence client instance
 */
export function getConfluenceClient(): ConfluenceClient {
  if (!confluenceClient) {
    const host = process.env.JIRA_HOST;
    const email = process.env.JIRA_USER_EMAIL;
    const apiToken = process.env.JIRA_API_TOKEN;

    if (host && email && apiToken) {
      confluenceClient = new ConfluenceClient({
        host: host.includes('/wiki') ? host : `${host.replace(/\/$/, '')}/wiki`,
        authentication: {
          basic: {
            email,
            apiToken,
          },
        },
      });
    } else {
      const storedCreds = loadCredentials(organizationOverride);
      if (storedCreds) {
        confluenceClient = new ConfluenceClient({
          host: storedCreds.host.includes('/wiki') ? storedCreds.host : `${storedCreds.host.replace(/\/$/, '')}/wiki`,
          authentication: {
            basic: {
              email: storedCreds.email,
              apiToken: storedCreds.apiToken,
            },
          },
        });
      } else {
        const errorMsg = organizationOverride 
          ? `Credentials for organization "${organizationOverride}" not found.`
          : 'Credentials not found. Please set environment variables or run "jira-ai auth"';
        throw new Error(errorMsg);
      }
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
}

export interface ConfluenceComment {
  id: string;
  author: string;
  body: string;
  created: string;
}

/**
 * Parse Confluence URL to extract page ID
 */
export function parseConfluenceUrl(url: string): string {
  try {
    const parsedUrl = new URL(url);
    
    // Pattern: /wiki/spaces/SPACE/pages/PAGE_ID/TITLE
    const pagesMatch = parsedUrl.pathname.match(/\/pages\/(\d+)/);
    if (pagesMatch && pagesMatch[1]) {
      return pagesMatch[1];
    }

    // Pattern: /wiki/pages/viewpage.action?pageId=PAGE_ID
    const pageIdParam = parsedUrl.searchParams.get('pageId');
    if (pageIdParam) {
      return pageIdParam;
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
 * Get Confluence page details
 */
export async function getPage(url: string): Promise<ConfluencePage> {
  const client = getConfluenceClient();
  const pageId = parseConfluenceUrl(url);

  const page = await client.content.getContentById({
    id: pageId,
    expand: ['body.atlas_doc_format', 'version', 'space', 'history.lastUpdated'],
  });

  const adfBody = page.body?.atlas_doc_format?.value;
  const content = adfBody 
    ? convertADFToMarkdown(typeof adfBody === 'string' ? JSON.parse(adfBody) : adfBody) 
    : 'No content available.';

  // @ts-ignore - accessing host to show it in UI
  const host = client.config.host || '';

  return {
    id: page.id || '',
    title: page.title || '',
    content,
    space: page.space?.name || page.space?.key || 'Unknown',
    author: page.history?.createdBy?.displayName || 'Unknown',
    lastUpdated: page.history?.lastUpdated?.when || page.version?.when || '',
    url: `${host}/pages/${page.id}`,
  };
}

/**
 * Get Confluence page comments
 */
export async function getPageComments(url: string): Promise<ConfluenceComment[]> {
  const client = getConfluenceClient();
  const pageId = parseConfluenceUrl(url);

  const response = await client.contentChildrenAndDescendants.getContentChildrenByType({
    id: pageId,
    type: 'comment',
    expand: ['body.atlas_doc_format', 'history.lastUpdated', 'version'],
  });

  return (response.results || []).map((comment: any) => {
    const adfBody = comment.body?.atlas_doc_format?.value;
    const body = adfBody 
      ? convertADFToMarkdown(typeof adfBody === 'string' ? JSON.parse(adfBody) : adfBody) 
      : 'No content available.';

    return {
      id: comment.id,
      author: comment.history?.createdBy?.displayName || 'Unknown',
      body,
      created: comment.history?.createdDate || comment.version?.when || '',
    };
  });
}
