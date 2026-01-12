import chalk from 'chalk';
import { searchIssuesByJql } from '../lib/jira-client.js';
import { formatJqlResults } from '../lib/formatters.js';
import { ui } from '../lib/ui.js';

export async function runJqlCommand(jqlQuery: string, options: { limit?: number }): Promise<void> {
  // Parse and validate limit parameter
  let maxResults = options.limit || 50;
  if (maxResults > 1000) {
    console.warn(chalk.yellow('\nWarning: Limit is very high. Using 1000 as maximum.'));
    maxResults = 1000;
  }

  ui.startSpinner('Executing JQL query...');

  const issues = await searchIssuesByJql(jqlQuery, maxResults);
  ui.succeedSpinner(chalk.green('Query executed successfully'));
  console.log(formatJqlResults(issues));
}
