import chalk from 'chalk';
import ora from 'ora';
import { searchIssuesByJql } from '../lib/jira-client.js';
import { formatJqlResults } from '../lib/formatters.js';

export async function runJqlCommand(jqlQuery: string, options: { limit: string }): Promise<void> {
  // Validate JQL query is not empty
  if (!jqlQuery || jqlQuery.trim() === '') {
    console.error(chalk.red('\nError: JQL query cannot be empty'));
    process.exit(1);
  }

  // Parse and validate limit parameter
  let maxResults = 50; // default
  if (options.limit) {
    const parsedLimit = parseInt(options.limit, 10);
    if (isNaN(parsedLimit) || parsedLimit < 1) {
      console.error(chalk.red('\nError: Limit must be a positive number'));
      process.exit(1);
    }
    if (parsedLimit > 1000) {
      console.warn(chalk.yellow('\nWarning: Limit is very high. Using 1000 as maximum.'));
      maxResults = 1000;
    } else {
      maxResults = parsedLimit;
    }
  }

  const spinner = ora('Executing JQL query...').start();

  try {
    const issues = await searchIssuesByJql(jqlQuery, maxResults);
    spinner.succeed(chalk.green('Query executed successfully'));
    console.log(formatJqlResults(issues));
  } catch (error) {
    spinner.fail(chalk.red('Failed to execute JQL query'));
    console.error(chalk.red('\nError: ' + (error instanceof Error ? error.message : 'Unknown error')));
    process.exit(1);
  }
}
