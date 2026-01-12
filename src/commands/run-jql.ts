import chalk from 'chalk';
import ora from 'ora';
import { searchIssuesByJql } from '../lib/jira-client.js';
import { formatJqlResults } from '../lib/formatters.js';
import { CliError } from '../types/errors.js';

export async function runJqlCommand(jqlQuery: string, options: { limit?: number }): Promise<void> {
  // Parse and validate limit parameter
  let maxResults = options.limit || 50;
  if (maxResults > 1000) {
    console.warn(chalk.yellow('\nWarning: Limit is very high. Using 1000 as maximum.'));
    maxResults = 1000;
  }

  const spinner = ora('Executing JQL query...').start();


  try {
    const issues = await searchIssuesByJql(jqlQuery, maxResults);
    spinner.succeed(chalk.green('Query executed successfully'));
    console.log(formatJqlResults(issues));
  } catch (error) {
    spinner.fail(chalk.red('Failed to execute JQL query'));
    throw error;
  }
}
