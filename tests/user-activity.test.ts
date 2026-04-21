import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { userActivityCommand } from '../src/commands/user-activity.js';
import * as jiraClient from '../src/lib/jira-client.js';
import * as utils from '../src/lib/utils.js';

vi.mock('../src/lib/jira-client.js', async (importActual) => {
  const actual = await importActual<typeof jiraClient>();
  return {
    ...actual,
    resolveUserByName: vi.fn(),
    searchIssuesByJql: vi.fn(),
    getIssueActivityFeed: vi.fn(),
    getUserActivity: vi.fn(),
  };
});
vi.mock('../src/lib/utils.js');

const makeActivityEntry = (overrides: Partial<jiraClient.ActivityEntry> = {}): jiraClient.ActivityEntry => ({
  id: 'act-1',
  type: 'comment_added',
  timestamp: '2023-01-15T10:00:00.000Z',
  author: { accountId: 'user-abc', displayName: 'Alice', emailAddress: 'alice@example.com' },
  ...overrides,
});

describe('userActivityCommand', () => {
  let consoleLogSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const startDate = new Date('2023-01-01T00:00:00Z');
    const endDate = new Date('2023-01-31T23:59:59Z');
    vi.mocked(utils.parseTimeframe).mockReturnValue({ startDate, endDate });
    vi.mocked(utils.formatDateForJql).mockReturnValue('2023-01-01');
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('resolves user and fetches activity across issues', async () => {
    vi.mocked(jiraClient.resolveUserByName).mockResolvedValue('user-abc');
    vi.mocked(jiraClient.searchIssuesByJql).mockResolvedValue([
      { key: 'TEST-1', summary: 'Issue 1', status: { name: 'Done' }, assignee: null, priority: null },
    ]);
    vi.mocked(jiraClient.getIssueActivityFeed).mockResolvedValue({
      issueKey: 'TEST-1',
      activities: [makeActivityEntry()],
      totalChanges: 1,
      hasMore: false,
    });

    await userActivityCommand('Alice', '30d', {});

    expect(jiraClient.resolveUserByName).toHaveBeenCalledWith('Alice');
    expect(jiraClient.searchIssuesByJql).toHaveBeenCalled();
    expect(jiraClient.getIssueActivityFeed).toHaveBeenCalledWith('TEST-1', expect.objectContaining({ author: 'user-abc' }));
    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(Array.isArray(output)).toBe(true);
    expect(output.length).toBeGreaterThan(0);
    expect(output[0]).toHaveProperty('issueKey', 'TEST-1');
  });

  it('falls back to raw string when resolveUserByName returns null', async () => {
    vi.mocked(jiraClient.resolveUserByName).mockResolvedValue(null);
    vi.mocked(jiraClient.searchIssuesByJql).mockResolvedValue([]);

    await userActivityCommand('unknown-person', '7d', {});

    expect(jiraClient.searchIssuesByJql).toHaveBeenCalled();
    const jqlArg = vi.mocked(jiraClient.searchIssuesByJql).mock.calls[0][0];
    expect(jqlArg).toContain('unknown-person');
  });

  it('returns empty array when no issues found', async () => {
    vi.mocked(jiraClient.resolveUserByName).mockResolvedValue('user-abc');
    vi.mocked(jiraClient.searchIssuesByJql).mockResolvedValue([]);

    await userActivityCommand('Alice', '7d', {});

    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(output).toEqual([]);
    expect(jiraClient.getIssueActivityFeed).not.toHaveBeenCalled();
  });

  it('applies --limit to activities', async () => {
    vi.mocked(jiraClient.resolveUserByName).mockResolvedValue('user-abc');
    vi.mocked(jiraClient.searchIssuesByJql).mockResolvedValue([
      { key: 'TEST-1', summary: 'Issue 1', status: { name: 'Open' }, assignee: null, priority: null },
      { key: 'TEST-2', summary: 'Issue 2', status: { name: 'Open' }, assignee: null, priority: null },
    ]);
    vi.mocked(jiraClient.getIssueActivityFeed).mockImplementation(async (key) => ({
      issueKey: key,
      activities: [
        makeActivityEntry({ id: `${key}-1`, timestamp: '2023-01-15T10:00:00Z' }),
        makeActivityEntry({ id: `${key}-2`, timestamp: '2023-01-16T10:00:00Z' }),
      ],
      totalChanges: 2,
      hasMore: false,
    }));

    await userActivityCommand('Alice', '30d', { limit: 2 });

    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(output.length).toBe(2);
  });

  it('groups activities by issue with --group-by-issue', async () => {
    vi.mocked(jiraClient.resolveUserByName).mockResolvedValue('user-abc');
    vi.mocked(jiraClient.searchIssuesByJql).mockResolvedValue([
      { key: 'TEST-1', summary: 'Issue 1', status: { name: 'Open' }, assignee: null, priority: null },
      { key: 'TEST-2', summary: 'Issue 2', status: { name: 'Open' }, assignee: null, priority: null },
    ]);
    vi.mocked(jiraClient.getIssueActivityFeed).mockImplementation(async (key) => ({
      issueKey: key,
      activities: [makeActivityEntry({ id: `${key}-1` })],
      totalChanges: 1,
      hasMore: false,
    }));

    await userActivityCommand('Alice', '30d', { groupByIssue: true });

    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(Array.isArray(output)).toBe(true);
    expect(output.length).toBe(2);
    expect(output[0]).toHaveProperty('issueKey');
    expect(output[0]).toHaveProperty('summary');
    expect(output[0]).toHaveProperty('activities');
  });

  it('filters by --project in the JQL query', async () => {
    vi.mocked(jiraClient.resolveUserByName).mockResolvedValue('user-abc');
    vi.mocked(jiraClient.searchIssuesByJql).mockResolvedValue([]);

    await userActivityCommand('Alice', '7d', { project: 'MYPROJ' });

    const jqlArg = vi.mocked(jiraClient.searchIssuesByJql).mock.calls[0][0];
    expect(jqlArg).toContain('MYPROJ');
  });

  it('filters by --types when fetching activity feed', async () => {
    vi.mocked(jiraClient.resolveUserByName).mockResolvedValue('user-abc');
    vi.mocked(jiraClient.searchIssuesByJql).mockResolvedValue([
      { key: 'TEST-1', summary: 'Issue 1', status: { name: 'Open' }, assignee: null, priority: null },
    ]);
    vi.mocked(jiraClient.getIssueActivityFeed).mockResolvedValue({
      issueKey: 'TEST-1',
      activities: [makeActivityEntry()],
      totalChanges: 1,
      hasMore: false,
    });

    await userActivityCommand('Alice', '7d', { types: 'comment_added,status_change' });

    expect(jiraClient.getIssueActivityFeed).toHaveBeenCalledWith(
      'TEST-1',
      expect.objectContaining({ types: 'comment_added,status_change' })
    );
  });

  it('skips failed issues and continues with others', async () => {
    vi.mocked(jiraClient.resolveUserByName).mockResolvedValue('user-abc');
    vi.mocked(jiraClient.searchIssuesByJql).mockResolvedValue([
      { key: 'TEST-1', summary: 'Issue 1', status: { name: 'Open' }, assignee: null, priority: null },
      { key: 'TEST-2', summary: 'Issue 2', status: { name: 'Open' }, assignee: null, priority: null },
    ]);
    vi.mocked(jiraClient.getIssueActivityFeed)
      .mockRejectedValueOnce(new Error('Forbidden'))
      .mockResolvedValueOnce({
        issueKey: 'TEST-2',
        activities: [makeActivityEntry({ id: 'act-2', timestamp: '2023-01-10T00:00:00Z' })],
        totalChanges: 1,
        hasMore: false,
      });

    await userActivityCommand('Alice', '7d', {});

    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(Array.isArray(output)).toBe(true);
    expect(output.length).toBe(1);
    expect(output[0].issueKey).toBe('TEST-2');
  });

  it('throws CommandError when --limit is 0', async () => {
    vi.mocked(jiraClient.resolveUserByName).mockResolvedValue('user-abc');
    await expect(userActivityCommand('Alice', '7d', { limit: 0 })).rejects.toThrow();
  });

  it('throws error for invalid --types value', async () => {
    vi.mocked(jiraClient.resolveUserByName).mockResolvedValue('user-abc');
    vi.mocked(jiraClient.searchIssuesByJql).mockResolvedValue([
      { key: 'TEST-1', summary: 'Issue 1', status: { name: 'Open' }, assignee: null, priority: null },
    ]);
    await expect(userActivityCommand('Alice', '7d', { types: 'invalid_type' })).rejects.toThrow();
  });

  it('caps JQL search at 100 issues', async () => {
    vi.mocked(jiraClient.resolveUserByName).mockResolvedValue('user-abc');
    vi.mocked(jiraClient.searchIssuesByJql).mockResolvedValue([]);

    await userActivityCommand('Alice', '7d', {});

    const maxResultsArg = vi.mocked(jiraClient.searchIssuesByJql).mock.calls[0][1];
    expect(maxResultsArg).toBe(100);
  });

  it('uses batch parallelism (max 5 concurrent) for activity fetching', async () => {
    vi.mocked(jiraClient.resolveUserByName).mockResolvedValue('user-abc');
    const issues = Array.from({ length: 10 }, (_, i) => ({
      key: `TEST-${i + 1}`,
      summary: `Issue ${i + 1}`,
      status: { name: 'Open' },
      assignee: null,
      priority: null,
    }));
    vi.mocked(jiraClient.searchIssuesByJql).mockResolvedValue(issues);

    let maxConcurrent = 0;
    let currentConcurrent = 0;
    vi.mocked(jiraClient.getIssueActivityFeed).mockImplementation(async (key) => {
      currentConcurrent++;
      maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
      await new Promise((r) => setTimeout(r, 5));
      currentConcurrent--;
      return { issueKey: key, activities: [], totalChanges: 0, hasMore: false };
    });

    await userActivityCommand('Alice', '7d', {});

    expect(maxConcurrent).toBeLessThanOrEqual(5);
    expect(jiraClient.getIssueActivityFeed).toHaveBeenCalledTimes(10);
  });
});

describe('buildUserActivityJql', () => {
  it('builds JQL with accountId', () => {
    const jql = jiraClient.buildUserActivityJql('acc-123', '2023-01-01', '2023-01-31');
    expect(jql).toContain('acc-123');
    expect(jql).toContain('2023-01-01');
  });

  it('appends project filter when provided', () => {
    const jql = jiraClient.buildUserActivityJql('acc-123', '2023-01-01', '2023-01-31', 'MYPROJ');
    expect(jql).toContain('MYPROJ');
  });

  it('uses commentAuthor for comment-based searching', () => {
    const jql = jiraClient.buildUserActivityJql('acc-123', '2023-01-01', '2023-01-31');
    expect(jql).toContain('commentAuthor');
  });
});
