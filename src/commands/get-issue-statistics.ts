import { getIssueStatistics, validateIssuePermissions, IssueStatistics } from '../lib/jira-client.js';
import { outputResult } from '../lib/json-mode.js';

export interface GetIssueStatisticsOptions {
  fullBreakdown?: boolean;
}

export async function getIssueStatisticsCommand(taskIds: string, options: GetIssueStatisticsOptions = {}): Promise<void> {
  const ids = taskIds.split(',').map(id => id.trim()).filter(id => id !== '');

  if (ids.length === 0) {
    outputResult({ error: true, message: 'Please provide at least one issue ID.' });
    return;
  }

  const results: IssueStatistics[] = [];
  for (const id of ids) {
    try {
      // Validate permissions for each issue
      await validateIssuePermissions(id, 'get-issue-statistics');
      const stats = await getIssueStatistics(id);
      results.push(stats);
    } catch (error) {
      // Skip unauthorized or not found issues
      if (!(error instanceof Error)) continue;
    }
  }

  outputResult(results);
}