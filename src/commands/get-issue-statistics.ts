import chalk from 'chalk';
import { getIssueStatistics, IssueStatistics } from '../lib/jira-client.js';
import { formatIssueStatistics } from '../lib/formatters.js';
import { ui } from '../lib/ui.js';

export async function getIssueStatisticsCommand(taskIds: string): Promise<void> {
  const ids = taskIds.split(',').map(id => id.trim()).filter(id => id !== '');

  if (ids.length === 0) {
    console.error(chalk.red('Please provide at least one issue ID.'));
    return;
  }

  ui.startSpinner(`Fetching statistics for ${ids.length} issue(s)...`);

  const results: IssueStatistics[] = [];
  for (const id of ids) {
    try {
      const stats = await getIssueStatistics(id);
      results.push(stats);
    } catch (error) {
      console.error(chalk.red(`\nFailed to fetch statistics for ${id}: ${(error as Error).message}`));
    }
  }

  if (results.length > 0) {
    ui.succeedSpinner(chalk.green('Statistics retrieved'));
    console.log(formatIssueStatistics(results));
  } else {
    ui.failSpinner('Failed to retrieve statistics');
  }
}
