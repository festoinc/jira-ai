import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { runJqlCommand } from '../src/commands/run-jql.js';
import * as jiraClient from '../src/lib/jira-client.js';
import * as formatters from '../src/lib/formatters.js';
import * as ui from '../src/lib/ui.js';
import chalk from 'chalk';

vi.mock('../src/lib/jira-client.js');
vi.mock('../src/lib/formatters.js');
vi.mock('../src/lib/ui.js');

describe('runJqlCommand', () => {
  let consoleLogSpy: any;
  let consoleWarnSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(ui.ui.startSpinner).mockImplementation(() => {});
    vi.mocked(ui.ui.succeedSpinner).mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it('should execute JQL query with default limit', async () => {
    const mockIssues = [
      { key: 'TEST-1', fields: { summary: 'Issue 1' } },
      { key: 'TEST-2', fields: { summary: 'Issue 2' } }
    ];

    vi.mocked(jiraClient.searchIssuesByJql).mockResolvedValue(mockIssues);
    vi.mocked(formatters.formatJqlResults).mockReturnValue('Formatted results');

    await runJqlCommand('project = TEST', {});

    expect(ui.ui.startSpinner).toHaveBeenCalledWith('Executing JQL query...');
    expect(jiraClient.searchIssuesByJql).toHaveBeenCalledWith('project = TEST', 50);
    expect(ui.ui.succeedSpinner).toHaveBeenCalledWith(chalk.green('Query executed successfully'));
    expect(formatters.formatJqlResults).toHaveBeenCalledWith(mockIssues);
    expect(consoleLogSpy).toHaveBeenCalledWith('Formatted results');
  });

  it('should execute JQL query with custom limit', async () => {
    const mockIssues = [{ key: 'TEST-1', fields: { summary: 'Issue 1' } }];

    vi.mocked(jiraClient.searchIssuesByJql).mockResolvedValue(mockIssues);
    vi.mocked(formatters.formatJqlResults).mockReturnValue('Formatted results');

    await runJqlCommand('assignee = currentUser()', { limit: 100 });

    expect(jiraClient.searchIssuesByJql).toHaveBeenCalledWith('assignee = currentUser()', 100);
    expect(ui.ui.succeedSpinner).toHaveBeenCalledWith(chalk.green('Query executed successfully'));
  });

  it('should cap limit at 1000 and show warning', async () => {
    const mockIssues: any[] = [];

    vi.mocked(jiraClient.searchIssuesByJql).mockResolvedValue(mockIssues);
    vi.mocked(formatters.formatJqlResults).mockReturnValue('Formatted results');

    await runJqlCommand('project = TEST', { limit: 5000 });

    expect(consoleWarnSpy).toHaveBeenCalledWith(chalk.yellow('\nWarning: Limit is very high. Using 1000 as maximum.'));
    expect(jiraClient.searchIssuesByJql).toHaveBeenCalledWith('project = TEST', 1000);
  });

  it('should handle limit of exactly 1000', async () => {
    const mockIssues: any[] = [];

    vi.mocked(jiraClient.searchIssuesByJql).mockResolvedValue(mockIssues);
    vi.mocked(formatters.formatJqlResults).mockReturnValue('Formatted results');

    await runJqlCommand('project = TEST', { limit: 1000 });

    expect(consoleWarnSpy).not.toHaveBeenCalled();
    expect(jiraClient.searchIssuesByJql).toHaveBeenCalledWith('project = TEST', 1000);
  });

  it('should handle errors when executing query', async () => {
    const error = new Error('Invalid JQL syntax');
    vi.mocked(jiraClient.searchIssuesByJql).mockRejectedValue(error);

    await expect(runJqlCommand('invalid jql', {})).rejects.toThrow('Invalid JQL syntax');

    expect(ui.ui.startSpinner).toHaveBeenCalledWith('Executing JQL query...');
    expect(jiraClient.searchIssuesByJql).toHaveBeenCalledWith('invalid jql', 50);
  });

  it('should handle empty results', async () => {
    vi.mocked(jiraClient.searchIssuesByJql).mockResolvedValue([]);
    vi.mocked(formatters.formatJqlResults).mockReturnValue('No results');

    await runJqlCommand('project = EMPTY', {});

    expect(ui.ui.succeedSpinner).toHaveBeenCalledWith(chalk.green('Query executed successfully'));
    expect(consoleLogSpy).toHaveBeenCalledWith('No results');
  });
});
