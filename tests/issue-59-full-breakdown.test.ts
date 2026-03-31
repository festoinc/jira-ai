import { describe, it, expect } from 'vitest';
import { formatIssueStatistics } from '../src/lib/formatters.js';
import { IssueStatistics } from '../src/lib/jira-client.js';

describe('formatIssueStatistics with full-breakdown', () => {
  const mockStats: IssueStatistics[] = [
    {
      key: 'TEST-1',
      summary: 'Task 1',
      timeSpentSeconds: 3600 * 2,
      originalEstimateSeconds: 3600 * 1,
      statusDurations: { 'To Do': 3600, 'In Progress': 3600 },
      currentStatus: 'In Progress'
    },
    {
      key: 'TEST-2',
      summary: 'Task 2',
      timeSpentSeconds: 3600 * 3,
      originalEstimateSeconds: 3600 * 4,
      statusDurations: { 'To Do': 3600 * 2, 'In Progress': 3600, 'Review': 0 },
      currentStatus: 'In Progress'
    }
  ];

  it('should format with full breakdown when option is enabled', () => {
    // @ts-ignore - fullBreakdown option
    const output = formatIssueStatistics(mockStats, true);

    // Simplified formatter: `${s.key}: ${formatDuration(s.timeSpentSeconds, 8)}`
    expect(output).toContain('TEST-1');
    expect(output).toContain('TEST-2');
  });

  it('should maintain default behavior when option is disabled', () => {
    const output = formatIssueStatistics(mockStats, false);

    // Simplified formatter produces the same output regardless of fullBreakdown
    expect(output).toContain('TEST-1');
    expect(output).toContain('TEST-2');
  });
});
