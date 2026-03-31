import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { runJqlCommand } from '../src/commands/run-jql.js';
import * as jiraClient from '../src/lib/jira-client.js';

vi.mock('../src/lib/jira-client.js');

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
