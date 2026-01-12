import chalk from 'chalk';
import { fromADF } from 'mdast-util-from-adf';
import { toMarkdown } from 'mdast-util-to-markdown';
import { hasCredentials } from './auth-storage.js';
import { CliError } from '../types/errors.js';

/**
 * Validate required environment variables or stored credentials
 */
export function validateEnvVars(): void {
  const required = [
    'JIRA_HOST',
    'JIRA_USER_EMAIL',
    'JIRA_API_TOKEN',
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0 && !hasCredentials()) {
    throw new CliError(
      `Jira credentials not found.\n\n` +
      `Please run ${chalk.cyan('jira-ai auth')} to set up your credentials.\n` +
      `Alternatively, you can set the following environment variables:\n` +
      required.map(key => `  - ${key}`).join('\n')
    );
  }
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Truncate text to max length with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Convert Atlassian Document Format (ADF) to Markdown
 * Handles both string content and ADF JSON objects
 */
export function convertADFToMarkdown(content: any): string {
  // If content is already a string, return it as-is
  if (typeof content === 'string') {
    return content;
  }

  // If content is null or undefined, return empty string
  if (!content) {
    return '';
  }

  try {
    // Convert ADF to mdast, then mdast to markdown
    const mdastTree = fromADF(content);
    const markdown = toMarkdown(mdastTree);
    return markdown.trim();
  } catch (error) {
    // If conversion fails, fall back to JSON string representation
    console.error('Failed to convert ADF to Markdown:', error);
    return JSON.stringify(content, null, 2);
  }
}
