import chalk from 'chalk';
import { getUsers } from '../lib/jira-client.js';
import { formatUsers } from '../lib/formatters.js';
import { ui } from '../lib/ui.js';

export async function listColleaguesCommand(projectKey?: string): Promise<void> {
  const message = projectKey 
    ? `Fetching colleagues for project ${projectKey}...`
    : 'Fetching all active colleagues...';
    
  ui.startSpinner(message);

  try {
    const users = await getUsers(projectKey);
    ui.succeedSpinner(chalk.green('Colleagues retrieved'));
    
    if (users.length === 0) {
      console.log(chalk.yellow('\nNo active colleagues found.'));
    } else {
      console.log(formatUsers(users));
    }
  } catch (error: any) {
    ui.failSpinner(chalk.red('Failed to fetch colleagues'));
    throw error;
  }
}
