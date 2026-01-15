import { describe, it, expect } from 'vitest';
import { formatIssueStatistics } from '../src/lib/formatters.js';
import { IssueStatistics } from '../src/lib/jira-client.js';
import chalk from 'chalk';

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
    // @ts-ignore - fullBreakdown option not yet added to types
    const output = formatIssueStatistics(mockStats, true);

    // Check if dynamic columns are present
    expect(output).toContain('To Do');
    expect(output).toContain('In Progress');
    
    // Check if Review column is omitted from headers (using a regex that looks for it between pipes)
    const headerLine = output.split('\n').find(line => line.includes('Key') && line.includes('Summary'));
    expect(headerLine).not.toContain('Review');

    // Check if Summary rows are present
    expect(output).toContain('Total');
    expect(output).toContain('Mean');
    expect(output).toContain('Median');

    // Check for note about omitted columns
    expect(output).toContain('Note: The following statuses were omitted because they had 0 total time: Review');
  });

  it('should maintain default behavior when option is disabled', () => {
    const output = formatIssueStatistics(mockStats, false);
    
    expect(output).toContain('Status Breakdown');
    expect(output).not.toContain('Total');
    expect(output).not.toContain('Mean');
    expect(output).not.toContain('Median');
  });
});
