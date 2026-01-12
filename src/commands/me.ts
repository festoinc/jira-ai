import chalk from 'chalk';
import { getCurrentUser } from '../lib/jira-client.js';
import { formatUserInfo } from '../lib/formatters.js';
import { ui } from '../lib/ui.js';

export async function meCommand(): Promise<void> {
  ui.startSpinner('Fetching user information...');

  const user = await getCurrentUser();
  ui.succeedSpinner(chalk.green('User information retrieved'));
  console.log(formatUserInfo(user));
}
