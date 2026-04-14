import { vi, describe, it, expect, beforeEach } from 'vitest';
import { issueActivityCommand } from '../src/commands/issue-activity.js';
import * as jiraClient from '../src/lib/jira-client.js';
import { CommandError } from '../src/lib/errors.js';

// Mock dependencies
vi.mock('../src/lib/jira-client.js');
vi.mock('../src/lib/settings.js');
vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
  })),
}));

const mockJiraClient = jiraClient as vi.Mocked<typeof jiraClient>;

const mockActivityResult = {
  issueKey: 'TEST-123',
  activities: [
    {
      id: 'h1',
      type: 'status_change' as const,
      timestamp: '2024-01-03T10:00:00.000Z',
      author: {
        accountId: 'acc1',
        displayName: 'Alice',
        emailAddress: 'alice@example.com',
      },
      field: 'status',
      from: 'To Do',
      to: 'In Progress',
      commentBody: undefined,
    },
    {
      id: 'h2',
      type: 'field_change' as const,
      timestamp: '2024-01-02T10:00:00.000Z',
      author: {
        accountId: 'acc1',
        displayName: 'Alice',
        emailAddress: 'alice@example.com',
      },
      field: 'priority',
      from: 'Medium',
      to: 'High',
      commentBody: undefined,
    },
    {
      id: 'c1',
      type: 'comment_added' as const,
      timestamp: '2024-01-01T10:00:00.000Z',
      author: {
        accountId: 'acc2',
        displayName: 'Bob',
        emailAddress: 'bob@example.com',
      },
      field: undefined,
      from: undefined,
      to: undefined,
      commentBody: 'A comment',
    },
  ],
  totalChanges: 3,
  hasMore: false,
};

describe('Issue Activity Command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    console.log = vi.fn();
    console.error = vi.fn();

    mockJiraClient.getIssueActivityFeed = vi.fn().mockResolvedValue(mockActivityResult);
  });

  it('should merge changelog + comments into unified timeline', async () => {
    await issueActivityCommand({ issueKey: 'TEST-123' });

    expect(mockJiraClient.getIssueActivityFeed).toHaveBeenCalledWith('TEST-123', expect.any(Object));
    const logCall = (console.log as any).mock.calls[0][0];
    const parsed = JSON.parse(logCall);
    expect(parsed.issueKey).toBe('TEST-123');
    expect(parsed.activities).toHaveLength(3);
  });

  it('should classify activity types correctly', async () => {
    await issueActivityCommand({ issueKey: 'TEST-123' });

    const logCall = (console.log as any).mock.calls[0][0];
    const parsed = JSON.parse(logCall);
    const types = parsed.activities.map((a: any) => a.type);
    expect(types).toContain('status_change');
    expect(types).toContain('field_change');
    expect(types).toContain('comment_added');
  });

  it('should sort activities by timestamp descending', async () => {
    await issueActivityCommand({ issueKey: 'TEST-123' });

    const logCall = (console.log as any).mock.calls[0][0];
    const parsed = JSON.parse(logCall);
    const timestamps = parsed.activities.map((a: any) => new Date(a.timestamp).getTime());
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i - 1]).toBeGreaterThanOrEqual(timestamps[i]);
    }
  });

  it('should apply --since filter across both sources', async () => {
    const since = '2024-01-02T00:00:00.000Z';
    await issueActivityCommand({ issueKey: 'TEST-123', since });

    expect(mockJiraClient.getIssueActivityFeed).toHaveBeenCalledWith(
      'TEST-123',
      expect.objectContaining({ since })
    );
  });

  it('should apply --types filter', async () => {
    await issueActivityCommand({ issueKey: 'TEST-123', types: 'status_change,comment_added' });

    expect(mockJiraClient.getIssueActivityFeed).toHaveBeenCalledWith(
      'TEST-123',
      expect.objectContaining({ types: 'status_change,comment_added' })
    );
  });

  it('should apply --author filter by name/email/accountId', async () => {
    await issueActivityCommand({ issueKey: 'TEST-123', author: 'alice@example.com' });

    expect(mockJiraClient.getIssueActivityFeed).toHaveBeenCalledWith(
      'TEST-123',
      expect.objectContaining({ author: 'alice@example.com' })
    );
  });

  it('should respect --limit and sets hasMore accurately', async () => {
    const limitedResult = {
      ...mockActivityResult,
      activities: mockActivityResult.activities.slice(0, 2),
      hasMore: true,
    };
    mockJiraClient.getIssueActivityFeed = vi.fn().mockResolvedValue(limitedResult);

    await issueActivityCommand({ issueKey: 'TEST-123', limit: 2 });

    expect(mockJiraClient.getIssueActivityFeed).toHaveBeenCalledWith(
      'TEST-123',
      expect.objectContaining({ limit: 2 })
    );
    const logCall = (console.log as any).mock.calls[0][0];
    const parsed = JSON.parse(logCall);
    expect(parsed.hasMore).toBe(true);
    expect(parsed.activities).toHaveLength(2);
  });

  it('should return totalChanges count correctly', async () => {
    await issueActivityCommand({ issueKey: 'TEST-123' });

    const logCall = (console.log as any).mock.calls[0][0];
    const parsed = JSON.parse(logCall);
    expect(parsed.totalChanges).toBe(3);
  });

  it('should handle issues with no changelog entries', async () => {
    const noChangelogResult = {
      issueKey: 'TEST-123',
      activities: [mockActivityResult.activities[2]], // only comment
      totalChanges: 1,
      hasMore: false,
    };
    mockJiraClient.getIssueActivityFeed = vi.fn().mockResolvedValue(noChangelogResult);

    await issueActivityCommand({ issueKey: 'TEST-123' });

    const logCall = (console.log as any).mock.calls[0][0];
    const parsed = JSON.parse(logCall);
    expect(parsed.activities.every((a: any) => a.type === 'comment_added')).toBe(true);
  });

  it('should handle issues with changelog but no comments', async () => {
    const noCommentsResult = {
      issueKey: 'TEST-123',
      activities: mockActivityResult.activities.filter(a => a.type !== 'comment_added'),
      totalChanges: 2,
      hasMore: false,
    };
    mockJiraClient.getIssueActivityFeed = vi.fn().mockResolvedValue(noCommentsResult);

    await issueActivityCommand({ issueKey: 'TEST-123' });

    const logCall = (console.log as any).mock.calls[0][0];
    const parsed = JSON.parse(logCall);
    expect(parsed.activities.every((a: any) => a.type !== 'comment_added')).toBe(true);
  });

  it('should handle pagination across both changelog and comments APIs', async () => {
    const paginatedResult = {
      ...mockActivityResult,
      totalChanges: 100,
      hasMore: true,
    };
    mockJiraClient.getIssueActivityFeed = vi.fn().mockResolvedValue(paginatedResult);

    await issueActivityCommand({ issueKey: 'TEST-123', limit: 3 });

    const logCall = (console.log as any).mock.calls[0][0];
    const parsed = JSON.parse(logCall);
    expect(parsed.hasMore).toBe(true);
    expect(parsed.totalChanges).toBe(100);
  });

  it('should detect comment_updated correctly', async () => {
    const updatedCommentResult = {
      issueKey: 'TEST-123',
      activities: [
        {
          id: 'cu1',
          type: 'comment_updated' as const,
          timestamp: '2024-01-04T10:00:00.000Z',
          author: {
            accountId: 'acc1',
            displayName: 'Alice',
            emailAddress: 'alice@example.com',
          },
          field: undefined,
          from: undefined,
          to: undefined,
          commentBody: 'Updated comment text',
        },
      ],
      totalChanges: 1,
      hasMore: false,
    };
    mockJiraClient.getIssueActivityFeed = vi.fn().mockResolvedValue(updatedCommentResult);

    await issueActivityCommand({ issueKey: 'TEST-123' });

    const logCall = (console.log as any).mock.calls[0][0];
    const parsed = JSON.parse(logCall);
    expect(parsed.activities[0].type).toBe('comment_updated');
  });
});
