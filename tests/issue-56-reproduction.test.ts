import { describe, it, expect } from 'vitest';
import { formatWorklogs } from '../src/lib/formatters.js';
import { WorklogWithIssue } from '../src/lib/jira-client.js';

describe('Issue 56 Reproduction: HTML entities in worklog comments', () => {
  it('should decode HTML entities in worklog comments', () => {
    const mockWorklogs: WorklogWithIssue[] = [
      {
        id: '1',
        author: { accountId: 'acc-1', displayName: 'John Doe' },
        comment: 'Worked on feature &#x20; with spaces &amp; symbols',
        created: '2026-01-13T10:00:00.000Z',
        updated: '2026-01-13T10:00:00.000Z',
        started: '2026-01-13T09:00:00.000Z',
        timeSpent: '1h',
        timeSpentSeconds: 3600,
        issueKey: 'PROJ-123',
        summary: 'Test task summary'
      }
    ];

    const output = formatWorklogs(mockWorklogs);
    
    // It should contain decoded space and ampersand
    expect(output).toContain('Worked on feature   with spaces & symbols');
    expect(output).not.toContain('&#x20;');
    expect(output).not.toContain('&amp;');
  });
});
