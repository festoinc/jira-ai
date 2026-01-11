import chalk from 'chalk';
import ora from 'ora';
import { getCurrentUser } from '../lib/jira-client';
import { formatUserInfo } from '../lib/formatters';

export async function meCommand(): Promise<void> {
  const spinner = ora('Fetching user information...').start();

  try {
    const user = await getCurrentUser();
    spinner.succeed(chalk.green('User information retrieved'));
    console.log(formatUserInfo(user));
  } catch (error) {
    spinner.fail(chalk.red('Failed to fetch user information'));
    console.error(chalk.red('\nError: ' + (error instanceof Error ? error.message : 'Unknown error')));
    process.exit(1);
  }
}
