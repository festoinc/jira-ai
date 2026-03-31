import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getPersonWorklogCommand } from '../src/commands/get-person-worklog.js';
import * as jiraClient from '../src/lib/jira-client.js';
import * as utils from '../src/lib/utils.js';

vi.mock('../src/lib/jira-client.js');
vi.mock('../src/lib/utils.js');

describe('getPersonWorklogCommand', () => {
  let consoleLogSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('should successfully fetch and display worklogs', async () => {
    const startDate = new Date('2023-01-01T00:00:00Z');
    const endDate = new Date('2023-01-31T23:59:59Z');
    vi.mocked(utils.parseTimeframe).mockReturnValue({ startDate, endDate });
    vi.mocked(utils.formatDateForJql).mockReturnValue('2023-01-01');

    vi.mocked(jiraClient.searchIssuesByJql).mockResolvedValue([
      { key: 'TEST-1', summary: 'Issue 1', status: { name: 'Done' }, assignee: null, priority: null }
    ]);

    const mockWorklogs = [
      {
        id: '1',
        author: { accountId: 'user1', emailAddress: 'user1@example.com' },
        started: '2023-01-15T10:00:00.000+0000',
        timeSpentSeconds: 3600,
        timeSpent: '1h',
        comment: '',
        created: '2023-01-15T10:00:00.000Z',
        updated: '2023-01-15T10:00:00.000Z',
        issueKey: 'TEST-1',
        summary: 'Issue 1'
      }
    ];
    vi.mocked(jiraClient.getIssueWorklogs).mockResolvedValue(mockWorklogs as any);

    await getPersonWorklogCommand('user1', 'january', {});

    expect(utils.parseTimeframe).toHaveBeenCalledWith('january');
    expect(jiraClient.searchIssuesByJql).toHaveBeenCalled();
    expect(jiraClient.getIssueWorklogs).toHaveBeenCalledWith('TEST-1');
    const output = consoleLogSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(1);
  });

  it('should handle no issues found', async () => {
    const startDate = new Date('2023-01-01');
    const endDate = new Date('2023-01-31');
    vi.mocked(utils.parseTimeframe).mockReturnValue({ startDate, endDate });
    vi.mocked(utils.formatDateForJql).mockReturnValue('2023-01-01');

    vi.mocked(jiraClient.searchIssuesByJql).mockResolvedValue([]);

    await getPersonWorklogCommand('user1', 'january', {});

    const output = consoleLogSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(0);
  });

  it('should handle no worklogs found after filtering', async () => {
    const startDate = new Date('2023-01-01');
    const endDate = new Date('2023-01-31');
    vi.mocked(utils.parseTimeframe).mockReturnValue({ startDate, endDate });
    vi.mocked(utils.formatDateForJql).mockReturnValue('2023-01-01');

    vi.mocked(jiraClient.searchIssuesByJql).mockResolvedValue([
      { key: 'TEST-1', summary: 'Issue 1', status: { name: 'Done' }, assignee: null, priority: null }
    ]);

    // Worklog from different user
    const mockWorklogs = [
      {
        id: '1',
        author: { accountId: 'user2', emailAddress: 'user2@example.com' },
        started: '2023-01-15T10:00:00.000+0000',
        timeSpentSeconds: 3600
      }
    ];
    vi.mocked(jiraClient.getIssueWorklogs).mockResolvedValue(mockWorklogs as any);

    await getPersonWorklogCommand('user1', 'january', {});

    const output = consoleLogSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(0);
  });

  it('should handle errors', async () => {
    vi.mocked(utils.parseTimeframe).mockImplementation(() => {
      throw new Error('Parse error');
    });

    await expect(getPersonWorklogCommand('user1', 'invalid', {})).rejects.toThrow('Parse error');
  });

  it('should match person by emailAddress', async () => {
    const startDate = new Date('2023-01-01T00:00:00Z');
    const endDate = new Date('2023-01-31T23:59:59Z');
    vi.mocked(utils.parseTimeframe).mockReturnValue({ startDate, endDate });
    vi.mocked(utils.formatDateForJql).mockReturnValue('2023-01-01');

    vi.mocked(jiraClient.searchIssuesByJql).mockResolvedValue([
      { key: 'TEST-1', summary: 'Issue 1', status: { name: 'Done' }, assignee: null, priority: null }
    ]);

    const mockWorklogs = [
      {
        id: '1',
        author: { accountId: 'other-id', emailAddress: 'user1@example.com' },
        started: '2023-01-15T10:00:00.000+0000',
        timeSpentSeconds: 3600,
        timeSpent: '1h',
        comment: '',
        created: '2023-01-15T10:00:00.000Z',
        updated: '2023-01-15T10:00:00.000Z',
        issueKey: 'TEST-1',
        summary: 'Issue 1'
      }
    ];
    vi.mocked(jiraClient.getIssueWorklogs).mockResolvedValue(mockWorklogs as any);

    await getPersonWorklogCommand('user1@example.com', 'january', {});

    const output = consoleLogSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(1);
  });

  it('should handle issues being undefined in response', async () => {
    const startDate = new Date('2023-01-01');
    const endDate = new Date('2023-01-31');
    vi.mocked(utils.parseTimeframe).mockReturnValue({ startDate, endDate });
    vi.mocked(utils.formatDateForJql).mockReturnValue('2023-01-01');

    vi.mocked(jiraClient.searchIssuesByJql).mockResolvedValue([]);

    await getPersonWorklogCommand('user1', 'january', {});

    const output = consoleLogSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(0);
  });

  it('should handle missing summary in issue fields', async () => {
    const startDate = new Date('2023-01-01T00:00:00Z');
    const endDate = new Date('2023-01-31T23:59:59Z');
    vi.mocked(utils.parseTimeframe).mockReturnValue({ startDate, endDate });
    vi.mocked(utils.formatDateForJql).mockReturnValue('2023-01-01');

    vi.mocked(jiraClient.searchIssuesByJql).mockResolvedValue([
      { key: 'TEST-1', summary: '', status: { name: 'Done' }, assignee: null, priority: null }
    ]);

    const mockWorklogs = [
      {
        id: '1',
        author: { accountId: 'user1', emailAddress: 'user1@example.com' },
        started: '2023-01-15T10:00:00.000+0000',
        timeSpentSeconds: 3600,
        timeSpent: '1h',
        comment: '',
        created: '2023-01-15T10:00:00.000Z',
        updated: '2023-01-15T10:00:00.000Z',
        issueKey: 'TEST-1',
        summary: ''
      }
    ];
    vi.mocked(jiraClient.getIssueWorklogs).mockResolvedValue(mockWorklogs as any);

    await getPersonWorklogCommand('user1', 'january', {});

    const output = consoleLogSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0]).toHaveProperty('summary', '');
  });
});
