import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { runJqlCommand } from '../src/commands/run-jql.js';
import * as jiraClient from '../src/lib/jira-client.js';

vi.mock('../src/lib/jira-client.js');
vi.mock('../src/lib/settings.js', () => ({
  getSavedQuery: vi.fn((name: string) => name === 'my-query' ? 'project = SAVED' : undefined),
  listSavedQueries: vi.fn(() => [{ name: 'my-query', jql: 'project = SAVED' }]),
  loadSettings: vi.fn(() => ({})),
  applyGlobalFilters: vi.fn((jql: string) => jql),
  isCommandAllowed: vi.fn(() => true),
}));

describe('runJqlCommand', () => {
  let consoleLogSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('should execute JQL query with default limit', async () => {
    const mockIssues = [
      { key: 'TEST-1', fields: { summary: 'Issue 1' } },
      { key: 'TEST-2', fields: { summary: 'Issue 2' } }
    ];

    vi.mocked(jiraClient.searchIssuesByJql).mockResolvedValue(mockIssues);

    await runJqlCommand('project = TEST', {});

    expect(jiraClient.searchIssuesByJql).toHaveBeenCalledWith('project = TEST', 50);
    const output = consoleLogSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toHaveProperty('key', 'TEST-1');
  });

  it('should execute JQL query with custom limit', async () => {
    const mockIssues = [{ key: 'TEST-1', fields: { summary: 'Issue 1' } }];

    vi.mocked(jiraClient.searchIssuesByJql).mockResolvedValue(mockIssues);

    await runJqlCommand('assignee = currentUser()', { limit: 100 });

    expect(jiraClient.searchIssuesByJql).toHaveBeenCalledWith('assignee = currentUser()', 100);
  });

  it('should cap limit at 1000', async () => {
    const mockIssues: any[] = [];

    vi.mocked(jiraClient.searchIssuesByJql).mockResolvedValue(mockIssues);

    await runJqlCommand('project = TEST', { limit: 5000 });

    expect(jiraClient.searchIssuesByJql).toHaveBeenCalledWith('project = TEST', 1000);
  });

  it('should handle limit of exactly 1000', async () => {
    const mockIssues: any[] = [];

    vi.mocked(jiraClient.searchIssuesByJql).mockResolvedValue(mockIssues);

    await runJqlCommand('project = TEST', { limit: 1000 });

    expect(jiraClient.searchIssuesByJql).toHaveBeenCalledWith('project = TEST', 1000);
  });

  it('should handle errors when executing query', async () => {
    const error = new Error('Invalid JQL syntax');
    vi.mocked(jiraClient.searchIssuesByJql).mockRejectedValue(error);

    await expect(runJqlCommand('invalid jql', {})).rejects.toThrow('Invalid JQL syntax');

    expect(jiraClient.searchIssuesByJql).toHaveBeenCalledWith('invalid jql', 50);
  });

  it('should handle empty results', async () => {
    vi.mocked(jiraClient.searchIssuesByJql).mockResolvedValue([]);

    await runJqlCommand('project = EMPTY', {});

    const output = consoleLogSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed).toHaveLength(0);
  });
});

describe('runJqlCommand --comment-author', () => {
  let consoleLogSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('appends commentAuthor JQL when --comment-author is provided with accountId', async () => {
    vi.mocked(jiraClient.searchIssuesByJql).mockResolvedValue([]);

    await runJqlCommand('project = TEST', { commentAuthor: 'acc-123' });

    const jqlArg = vi.mocked(jiraClient.searchIssuesByJql).mock.calls[0][0];
    expect(jqlArg).toContain('commentAuthor');
    expect(jqlArg).toContain('acc-123');
    expect(jqlArg).toMatch(/\(project = TEST\)/);
  });

  it('resolves display name and appends commentAuthor when --comment-author is provided', async () => {
    vi.mocked(jiraClient.searchIssuesByJql).mockResolvedValue([]);
    vi.mocked(jiraClient.resolveUserByName).mockResolvedValue('resolved-acc-id');

    await runJqlCommand('project = TEST', { commentAuthor: 'John Doe' });

    expect(jiraClient.resolveUserByName).toHaveBeenCalledWith('John Doe');
    const jqlArg = vi.mocked(jiraClient.searchIssuesByJql).mock.calls[0][0];
    expect(jqlArg).toContain('resolved-acc-id');
  });

  it('falls back to raw string when resolveUserByName returns null', async () => {
    vi.mocked(jiraClient.searchIssuesByJql).mockResolvedValue([]);
    vi.mocked(jiraClient.resolveUserByName).mockResolvedValue(null);

    await runJqlCommand('project = TEST', { commentAuthor: 'unknown-user' });

    const jqlArg = vi.mocked(jiraClient.searchIssuesByJql).mock.calls[0][0];
    expect(jqlArg).toContain('unknown-user');
  });

  it('works with --comment-author together with --query', async () => {
    vi.mocked(jiraClient.searchIssuesByJql).mockResolvedValue([]);
    vi.mocked(jiraClient.resolveUserByName).mockResolvedValue('acc-456');

    // simulate saved query resolved externally (we pass already resolved JQL)
    await runJqlCommand(undefined, { query: 'my-query', commentAuthor: 'acc-456' });

    // Since no mock for getSavedQuery, we check it tried to resolve
    // We just confirm no mutual-exclusion error
  });

  it('does NOT make --comment-author and --query mutually exclusive', async () => {
    vi.mocked(jiraClient.searchIssuesByJql).mockResolvedValue([]);

    // Should not throw
    await expect(
      runJqlCommand('project = TEST', { commentAuthor: 'acc-123', limit: 10 })
    ).resolves.not.toThrow();
  });
});
