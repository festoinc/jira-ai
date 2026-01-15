import chalk from 'chalk';
import { getIssueStatistics, validateIssuePermissions, IssueStatistics } from '../lib/jira-client.js';
import { formatIssueStatistics } from '../lib/formatters.js';
import { ui } from '../lib/ui.js';

export interface GetIssueStatisticsOptions {
  fullBreakdown?: boolean;
}

export async function getIssueStatisticsCommand(taskIds: string, options: GetIssueStatisticsOptions = {}): Promise<void> {
  const ids = taskIds.split(',').map(id => id.trim()).filter(id => id !== '');

  if (ids.length === 0) {
    console.error(chalk.red('Please provide at least one issue ID.'));
    return;
  }

  ui.startSpinner(`Fetching statistics for ${ids.length} issue(s)...`);

  const results: IssueStatistics[] = [];
  for (const id of ids) {
    try {
      // Validate permissions for each issue
      await validateIssuePermissions(id, 'get-issue-statistics');
      const stats = await getIssueStatistics(id);
      results.push(stats);
    } catch (error) {
      // Skip unauthorized or not found issues, but log a message if not already handled
      if (!(error instanceof Error)) continue;
      
      const isPermissionError = error.message.includes('not allowed') || error.message.includes('restricted');
      if (isPermissionError) {
        console.warn(chalk.yellow(`
Skipping ${id}: ${error.message}`));
      } else {
        console.error(chalk.red(`
Failed to fetch statistics for ${id}: ${error.message}`));
      }
    }
  }

  if (results.length > 0) {
    ui.succeedSpinner(chalk.green('Statistics retrieved'));
    console.log(formatIssueStatistics(results, options.fullBreakdown));
  } else {
    ui.failSpinner('Failed to retrieve statistics or all issues were filtered out');
  }
}