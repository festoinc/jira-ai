import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  issueWorklogListCommand,
  issueWorklogAddCommand,
  issueWorklogUpdateCommand,
  issueWorklogDeleteCommand,
} from '../src/commands/issue-worklog.js';
import * as jiraClient from '../src/lib/jira-client.js';
import * as dryRun from '../src/lib/dry-run.js';
import { CommandError } from '../src/lib/errors.js';
import { parseDuration } from '../src/lib/utils.js';

// Mock dependencies
vi.mock('../src/lib/jira-client.js');
vi.mock('../src/lib/settings.js');
vi.mock('../src/lib/dry-run.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/dry-run.js')>();
  return {
    ...actual,
    isDryRun: vi.fn().mockReturnValue(false),
    formatDryRunResult: vi.fn(),
  };
});
vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
  })),
}));

const mockJiraClient = jiraClient as vi.Mocked<typeof jiraClient>;
const mockDryRun = dryRun as vi.Mocked<typeof dryRun>;

const mockWorklogs = [
  {
    id: 'w1',
    author: {
      accountId: 'acc1',
      displayName: 'Alice',
      emailAddress: 'alice@example.com',
    },
    comment: 'Worked on feature',
    created: '2024-01-01T10:00:00.000Z',
    updated: '2024-01-01T10:00:00.000Z',
    started: '2024-01-01T09:00:00.000Z',
    timeSpent: '2h',
    timeSpentSeconds: 7200,
    issueKey: 'TEST-123',
  },
  {
    id: 'w2',
    author: {
      accountId: 'acc2',
      displayName: 'Bob',
      emailAddress: 'bob@example.com',
    },
    comment: 'Code review',
    created: '2024-01-02T10:00:00.000Z',
    updated: '2024-01-02T10:00:00.000Z',
    started: '2024-01-02T09:00:00.000Z',
    timeSpent: '1h',
    timeSpentSeconds: 3600,
    issueKey: 'TEST-123',
  },
];

// ============================================================================
// parseDuration helper tests
// ============================================================================

describe('parseDuration', () => {
  it('should parse minutes (30m)', () => {
    expect(parseDuration('30m')).toBe(1800);
  });

  it('should parse hours (1h)', () => {
    expect(parseDuration('1h')).toBe(3600);
  });

  it('should parse days (1d)', () => {
    // 8 hours per day
    expect(parseDuration('1d')).toBe(28800);
  });

  it('should parse weeks (1w)', () => {
    // 5 days per week, 8 hours per day
    expect(parseDuration('1w')).toBe(144000);
  });

  it('should parse combined (1d2h30m)', () => {
    // 1d = 28800, 2h = 7200, 30m = 1800 => 37800
    expect(parseDuration('1d2h30m')).toBe(37800);
  });

  it('should parse full combination (1w2d3h15m)', () => {
    // 1w=144000, 2d=57600, 3h=10800, 15m=900 => 213300
    expect(parseDuration('1w2d3h15m')).toBe(213300);
  });

  it('should return null for invalid duration', () => {
    expect(parseDuration('invalid')).toBeNull();
  });

  it('should return null for empty string', () => {
    expect(parseDuration('')).toBeNull();
  });

  it('should parse 2h30m', () => {
    expect(parseDuration('2h30m')).toBe(9000);
  });
});

// ============================================================================
// issue worklog list tests
// ============================================================================

describe('issue worklog list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    console.log = vi.fn();
    console.error = vi.fn();

    mockJiraClient.getIssueWorklogsList = vi.fn().mockResolvedValue({
      issueKey: 'TEST-123',
      worklogs: mockWorklogs,
      total: 2,
    });
  });

  it('should list worklogs for a valid issue key', async () => {
    await issueWorklogListCommand({ issueKey: 'TEST-123' });

    expect(mockJiraClient.getIssueWorklogsList).toHaveBeenCalledWith('TEST-123', expect.any(Object));
    const logCall = (console.log as any).mock.calls[0][0];
    const parsed = JSON.parse(logCall);
    expect(parsed.issueKey).toBe('TEST-123');
    expect(parsed.worklogs).toHaveLength(2);
    expect(parsed.total).toBe(2);
  });

  it('should handle empty worklog list', async () => {
    mockJiraClient.getIssueWorklogsList = vi.fn().mockResolvedValue({
      issueKey: 'TEST-123',
      worklogs: [],
      total: 0,
    });

    await issueWorklogListCommand({ issueKey: 'TEST-123' });

    const logCall = (console.log as any).mock.calls[0][0];
    const parsed = JSON.parse(logCall);
    expect(parsed.worklogs).toHaveLength(0);
  });

  it('should throw CommandError on 404', async () => {
    mockJiraClient.getIssueWorklogsList = vi.fn().mockRejectedValue(new Error('Issue not found (404)'));

    await expect(issueWorklogListCommand({ issueKey: 'BAD-999' })).rejects.toThrow(CommandError);
    const err = await issueWorklogListCommand({ issueKey: 'BAD-999' }).catch(e => e);
    expect(err.hints).toContain('Check that the issue key is correct');
  });

  it('should throw CommandError on 403', async () => {
    mockJiraClient.getIssueWorklogsList = vi.fn().mockRejectedValue(new Error('Permission denied (403)'));

    const err = await issueWorklogListCommand({ issueKey: 'TEST-123' }).catch(e => e);
    expect(err).toBeInstanceOf(CommandError);
    expect(err.hints).toContain('You may not have permission to view worklogs on this issue');
  });
});

// ============================================================================
// issue worklog add tests
// ============================================================================

describe('issue worklog add', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    console.log = vi.fn();
    mockDryRun.isDryRun = vi.fn().mockReturnValue(false);

    mockJiraClient.addWorklogEntry = vi.fn().mockResolvedValue({
      id: 'w3',
      author: { accountId: 'acc1', displayName: 'Alice' },
      comment: 'New work',
      created: '2024-01-03T10:00:00.000Z',
      updated: '2024-01-03T10:00:00.000Z',
      started: '2024-01-03T09:00:00.000Z',
      timeSpent: '1h',
      timeSpentSeconds: 3600,
      issueKey: 'TEST-123',
    });
  });

  it('should add a worklog entry', async () => {
    await issueWorklogAddCommand({ issueKey: 'TEST-123', time: '1h' });

    expect(mockJiraClient.addWorklogEntry).toHaveBeenCalledWith(
      'TEST-123',
      expect.objectContaining({ timeSpentSeconds: 3600 })
    );
  });

  it('should add a worklog with comment', async () => {
    await issueWorklogAddCommand({ issueKey: 'TEST-123', time: '30m', comment: 'Bug fix' });

    expect(mockJiraClient.addWorklogEntry).toHaveBeenCalledWith(
      'TEST-123',
      expect.objectContaining({ timeSpentSeconds: 1800, comment: 'Bug fix' })
    );
  });

  it('should support dry-run mode', async () => {
    mockDryRun.isDryRun = vi.fn().mockReturnValue(true);

    await issueWorklogAddCommand({ issueKey: 'TEST-123', time: '2h' });

    expect(mockDryRun.formatDryRunResult).toHaveBeenCalled();
    expect(mockJiraClient.addWorklogEntry).not.toHaveBeenCalled();
  });

  it('should throw CommandError for invalid duration', async () => {
    await expect(
      issueWorklogAddCommand({ issueKey: 'TEST-123', time: 'invalid' })
    ).rejects.toThrow(CommandError);
  });

  it('should throw CommandError on 404', async () => {
    mockJiraClient.addWorklogEntry = vi.fn().mockRejectedValue(new Error('Issue not found (404)'));

    const err = await issueWorklogAddCommand({ issueKey: 'BAD-999', time: '1h' }).catch(e => e);
    expect(err).toBeInstanceOf(CommandError);
    expect(err.hints).toContain('Check that the issue key is correct');
  });

  it('should support estimate adjustment options', async () => {
    await issueWorklogAddCommand({
      issueKey: 'TEST-123',
      time: '1h',
      adjustEstimate: 'manual',
      newEstimate: '5h',
    });

    expect(mockJiraClient.addWorklogEntry).toHaveBeenCalledWith(
      'TEST-123',
      expect.objectContaining({ adjustEstimate: 'manual', newEstimate: '5h' })
    );
  });
});

// ============================================================================
// issue worklog update tests
// ============================================================================

describe('issue worklog update', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    console.log = vi.fn();
    mockDryRun.isDryRun = vi.fn().mockReturnValue(false);

    mockJiraClient.updateWorklogEntry = vi.fn().mockResolvedValue({
      id: 'w1',
      author: { accountId: 'acc1', displayName: 'Alice' },
      comment: 'Updated work',
      created: '2024-01-01T10:00:00.000Z',
      updated: '2024-01-01T11:00:00.000Z',
      started: '2024-01-01T09:00:00.000Z',
      timeSpent: '3h',
      timeSpentSeconds: 10800,
      issueKey: 'TEST-123',
    });
  });

  it('should update worklog time', async () => {
    await issueWorklogUpdateCommand({ issueKey: 'TEST-123', id: 'w1', time: '3h' });

    expect(mockJiraClient.updateWorklogEntry).toHaveBeenCalledWith(
      'TEST-123',
      'w1',
      expect.objectContaining({ timeSpentSeconds: 10800 })
    );
  });

  it('should update worklog comment', async () => {
    await issueWorklogUpdateCommand({ issueKey: 'TEST-123', id: 'w1', comment: 'Updated comment' });

    expect(mockJiraClient.updateWorklogEntry).toHaveBeenCalledWith(
      'TEST-123',
      'w1',
      expect.objectContaining({ comment: 'Updated comment' })
    );
  });

  it('should support dry-run mode', async () => {
    mockDryRun.isDryRun = vi.fn().mockReturnValue(true);

    await issueWorklogUpdateCommand({ issueKey: 'TEST-123', id: 'w1', time: '3h' });

    expect(mockDryRun.formatDryRunResult).toHaveBeenCalled();
    expect(mockJiraClient.updateWorklogEntry).not.toHaveBeenCalled();
  });

  it('should throw CommandError for invalid duration', async () => {
    await expect(
      issueWorklogUpdateCommand({ issueKey: 'TEST-123', id: 'w1', time: 'bad' })
    ).rejects.toThrow(CommandError);
  });

  it('should throw CommandError if neither time nor comment provided', async () => {
    await expect(
      issueWorklogUpdateCommand({ issueKey: 'TEST-123', id: 'w1' })
    ).rejects.toThrow(CommandError);
  });

  it('should throw CommandError on 404', async () => {
    mockJiraClient.updateWorklogEntry = vi.fn().mockRejectedValue(new Error('Worklog not found (404)'));

    const err = await issueWorklogUpdateCommand({ issueKey: 'TEST-123', id: 'bad-id', time: '1h' }).catch(e => e);
    expect(err).toBeInstanceOf(CommandError);
    expect(err.hints).toContain('Check that the issue key and worklog ID are correct');
  });
});

// ============================================================================
// issue worklog delete tests
// ============================================================================

describe('issue worklog delete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    console.log = vi.fn();
    mockDryRun.isDryRun = vi.fn().mockReturnValue(false);

    mockJiraClient.deleteWorklogEntry = vi.fn().mockResolvedValue(undefined);
  });

  it('should delete a worklog', async () => {
    await issueWorklogDeleteCommand({ issueKey: 'TEST-123', id: 'w1' });

    expect(mockJiraClient.deleteWorklogEntry).toHaveBeenCalledWith(
      'TEST-123',
      'w1',
      expect.any(Object)
    );
    const logCall = (console.log as any).mock.calls[0][0];
    const parsed = JSON.parse(logCall);
    expect(parsed.deleted).toBe(true);
    expect(parsed.id).toBe('w1');
  });

  it('should support dry-run mode', async () => {
    mockDryRun.isDryRun = vi.fn().mockReturnValue(true);

    await issueWorklogDeleteCommand({ issueKey: 'TEST-123', id: 'w1' });

    expect(mockDryRun.formatDryRunResult).toHaveBeenCalled();
    expect(mockJiraClient.deleteWorklogEntry).not.toHaveBeenCalled();
  });

  it('should throw CommandError on 404', async () => {
    mockJiraClient.deleteWorklogEntry = vi.fn().mockRejectedValue(new Error('Worklog not found (404)'));

    const err = await issueWorklogDeleteCommand({ issueKey: 'TEST-123', id: 'bad-id' }).catch(e => e);
    expect(err).toBeInstanceOf(CommandError);
    expect(err.hints).toContain('Check that the issue key and worklog ID are correct');
  });

  it('should throw CommandError on 403', async () => {
    mockJiraClient.deleteWorklogEntry = vi.fn().mockRejectedValue(new Error('Forbidden (403)'));

    const err = await issueWorklogDeleteCommand({ issueKey: 'TEST-123', id: 'w1' }).catch(e => e);
    expect(err).toBeInstanceOf(CommandError);
    expect(err.hints).toContain('You may not have permission to delete this worklog');
  });

  it('should support estimate adjustment on delete', async () => {
    await issueWorklogDeleteCommand({ issueKey: 'TEST-123', id: 'w1', adjustEstimate: 'leave' });

    expect(mockJiraClient.deleteWorklogEntry).toHaveBeenCalledWith(
      'TEST-123',
      'w1',
      expect.objectContaining({ adjustEstimate: 'leave' })
    );
  });
});
