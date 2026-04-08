import { searchIssuesByJql } from '../lib/jira-client.js';
import { outputResult } from '../lib/json-mode.js';
import { getSavedQuery, listSavedQueries, applyGlobalFilters } from '../lib/settings.js';
import { CliError } from '../types/errors.js';

export async function runJqlCommand(
  jqlQuery: string,
  options: { limit?: number; query?: string; listQueries?: boolean }
): Promise<void> {
  // Handle --list-queries
  if (options.listQueries) {
    const queries = listSavedQueries();
    outputResult({ queries });
    return;
  }

  // Mutual exclusion: can't have both positional JQL and --query
  if (jqlQuery && jqlQuery.trim() !== '' && options.query) {
    throw new CliError('Cannot specify both JQL query and --query. Use one or the other.');
  }

  let resolvedJql: string;

  if (options.query) {
    const savedJql = getSavedQuery(options.query);
    if (savedJql === undefined) {
      const available = listSavedQueries().map((q) => q.name).join(', ');
      const availableMsg = available ? available : '(none)';
      throw new CliError(`Saved query '${options.query}' not found. Available: ${availableMsg}`);
    }
    resolvedJql = applyGlobalFilters(savedJql);
  } else {
    resolvedJql = jqlQuery;
  }

  let maxResults = options.limit || 50;
  if (maxResults > 1000) {
    maxResults = 1000;
  }

  const issues = await searchIssuesByJql(resolvedJql, maxResults);
  outputResult(issues);
}
