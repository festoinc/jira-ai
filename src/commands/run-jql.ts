import { searchIssuesByJql } from '../lib/jira-client.js';
import { outputResult } from '../lib/json-mode.js';

export async function runJqlCommand(jqlQuery: string, options: { limit?: number }): Promise<void> {
  // Parse and validate limit parameter
  let maxResults = options.limit || 50;
  if (maxResults > 1000) {
    maxResults = 1000;
  }

  const issues = await searchIssuesByJql(jqlQuery, maxResults);
  outputResult(issues);
}
