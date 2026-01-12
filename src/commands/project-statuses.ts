import chalk from 'chalk';
import { getProjectStatuses } from '../lib/jira-client.js';
import { formatProjectStatuses } from '../lib/formatters.js';
import { ui } from '../lib/ui.js';

export async function projectStatusesCommand(projectId: string): Promise<void> {
  ui.startSpinner(`Fetching statuses for project ${projectId}...`);

  const statuses = await getProjectStatuses(projectId);
  ui.succeedSpinner(chalk.green('Project statuses retrieved'));
  console.log(formatProjectStatuses(projectId, statuses));
}
