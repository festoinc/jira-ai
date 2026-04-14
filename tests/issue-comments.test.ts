import { vi, describe, it, expect, beforeEach } from 'vitest';
import { issueCommentsCommand } from '../src/commands/issue-comments.js';
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

const mockCommentsResult = {
  issueKey: 'TEST-123',
  comments: [
    {
      id: 'c1',
      author: {
        accountId: 'acc1',
        displayName: 'Alice',
        emailAddress: 'alice@example.com',
      },
      body: 'First comment',
      created: '2024-01-01T10:00:00.000Z',
      updated: '2024-01-01T10:00:00.000Z',
    },
    {
      id: 'c2',
      author: {
        accountId: 'acc2',
        displayName: 'Bob',
        emailAddress: 'bob@example.com',
      },
      body: 'Second comment',
      created: '2024-01-02T10:00:00.000Z',
      updated: '2024-01-02T10:00:00.000Z',
    },
  ],
  total: 2,
  hasMore: false,
};

describe('Issue Comments Command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    console.log = vi.fn();
    console.error = vi.fn();

    mockJiraClient.getIssueCommentsList = vi.fn().mockResolvedValue(mockCommentsResult);
  });

  it('should return comments for a valid issue key', async () => {
    await issueCommentsCommand({ issueKey: 'TEST-123' });

    expect(mockJiraClient.getIssueCommentsList).toHaveBeenCalledWith('TEST-123', expect.any(Object));
    const logCall = (console.log as any).mock.calls[0][0];
    const parsed = JSON.parse(logCall);
    expect(parsed.issueKey).toBe('TEST-123');
    expect(parsed.comments).toHaveLength(2);
  });

  it('should apply --limit correctly', async () => {
    await issueCommentsCommand({ issueKey: 'TEST-123', limit: 1 });

    expect(mockJiraClient.getIssueCommentsList).toHaveBeenCalledWith(
      'TEST-123',
      expect.objectContaining({ limit: 1 })
    );
  });

  it('should filter by --since timestamp', async () => {
    const since = '2024-01-02T00:00:00.000Z';
    await issueCommentsCommand({ issueKey: 'TEST-123', since });

    expect(mockJiraClient.getIssueCommentsList).toHaveBeenCalledWith(
      'TEST-123',
      expect.objectContaining({ since })
    );
  });

  it('should reverse order with --reverse', async () => {
    await issueCommentsCommand({ issueKey: 'TEST-123', reverse: true });

    expect(mockJiraClient.getIssueCommentsList).toHaveBeenCalledWith(
      'TEST-123',
      expect.objectContaining({ reverse: true })
    );
  });

  it('should handle empty comment list', async () => {
    mockJiraClient.getIssueCommentsList = vi.fn().mockResolvedValue({
      issueKey: 'TEST-123',
      comments: [],
      total: 0,
      hasMore: false,
    });

    await issueCommentsCommand({ issueKey: 'TEST-123' });

    const logCall = (console.log as any).mock.calls[0][0];
    const parsed = JSON.parse(logCall);
    expect(parsed.comments).toHaveLength(0);
    expect(parsed.total).toBe(0);
  });

  it('should handle 404 (issue not found)', async () => {
    mockJiraClient.getIssueCommentsList = vi.fn().mockRejectedValue(
      new Error('Issue not found (404)')
    );

    const promise = issueCommentsCommand({ issueKey: 'TEST-999' });
    await expect(promise).rejects.toThrow(CommandError);
    const error = await promise.catch(e => e);
    expect(error.hints).toContain('Check that the issue key is correct');
  });

  it('should handle 403 (no permission)', async () => {
    mockJiraClient.getIssueCommentsList = vi.fn().mockRejectedValue(
      new Error('Permission denied (403)')
    );

    const promise = issueCommentsCommand({ issueKey: 'TEST-123' });
    await expect(promise).rejects.toThrow(CommandError);
    const error = await promise.catch(e => e);
    expect(error.hints).toContain('You may not have permission to view comments on this issue');
  });

  it('should paginate correctly when comments exceed maxResults', async () => {
    const paginatedResult = {
      issueKey: 'TEST-123',
      comments: mockCommentsResult.comments,
      total: 10,
      hasMore: true,
    };
    mockJiraClient.getIssueCommentsList = vi.fn().mockResolvedValue(paginatedResult);

    await issueCommentsCommand({ issueKey: 'TEST-123', limit: 2 });

    const logCall = (console.log as any).mock.calls[0][0];
    const parsed = JSON.parse(logCall);
    expect(parsed.hasMore).toBe(true);
    expect(parsed.total).toBe(10);
  });
});
