import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getIssueStatisticsCommand } from '../src/commands/get-issue-statistics.js';
import * as jiraClient from '../src/lib/jira-client.js';
import * as formatters from '../src/lib/formatters.js';
import * as ui from '../src/lib/ui.js';
import chalk from 'chalk';

vi.mock('../src/lib/jira-client.js');
vi.mock('../src/lib/formatters.js');
vi.mock('../src/lib/ui.js');

describe('getIssueStatisticsCommand', () => {
  let consoleErrorSpy: any;
  let consoleLogSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(ui.ui.startSpinner).mockImplementation(() => {});
    vi.mocked(ui.ui.succeedSpinner).mockImplementation(() => {});
    vi.mocked(ui.ui.failSpinner).mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  it('should display error when no issue IDs are provided', async () => {
    await getIssueStatisticsCommand('');

    expect(consoleErrorSpy).toHaveBeenCalledWith(chalk.red('Please provide at least one issue ID.'));
    expect(vi.mocked(jiraClient.getIssueStatistics)).not.toHaveBeenCalled();
  });

  it('should display error when only whitespace is provided', async () => {
    await getIssueStatisticsCommand('   ,  , ');

    expect(consoleErrorSpy).toHaveBeenCalledWith(chalk.red('Please provide at least one issue ID.'));
    expect(vi.mocked(jiraClient.getIssueStatistics)).not.toHaveBeenCalled();
  });

  it('should fetch statistics for a single issue', async () => {
    const mockStats = {
      key: 'TEST-123',
      summary: 'Test issue',
      statusDurations: { 'To Do': 3600, 'In Progress': 7200 }
    };

    vi.mocked(jiraClient.getIssueStatistics).mockResolvedValue(mockStats);
    vi.mocked(formatters.formatIssueStatistics).mockReturnValue('Formatted stats');

    await getIssueStatisticsCommand('TEST-123');

    expect(ui.ui.startSpinner).toHaveBeenCalledWith('Fetching statistics for 1 issue(s)...');
    expect(jiraClient.getIssueStatistics).toHaveBeenCalledWith('TEST-123');
    expect(formatters.formatIssueStatistics).toHaveBeenCalledWith([mockStats]);
    expect(ui.ui.succeedSpinner).toHaveBeenCalledWith(chalk.green('Statistics retrieved'));
    expect(consoleLogSpy).toHaveBeenCalledWith('Formatted stats');
  });

  it('should fetch statistics for multiple issues', async () => {
    const mockStats1 = {
      key: 'TEST-123',
      summary: 'Test issue 1',
      statusDurations: { 'To Do': 3600 }
    };
    const mockStats2 = {
      key: 'TEST-456',
      summary: 'Test issue 2',
      statusDurations: { 'In Progress': 7200 }
    };

    vi.mocked(jiraClient.getIssueStatistics).mockResolvedValueOnce(mockStats1).mockResolvedValueOnce(mockStats2);
    vi.mocked(formatters.formatIssueStatistics).mockReturnValue('Formatted stats');

    await getIssueStatisticsCommand('TEST-123, TEST-456');

    expect(ui.ui.startSpinner).toHaveBeenCalledWith('Fetching statistics for 2 issue(s)...');
    expect(jiraClient.getIssueStatistics).toHaveBeenCalledWith('TEST-123');
    expect(jiraClient.getIssueStatistics).toHaveBeenCalledWith('TEST-456');
    expect(formatters.formatIssueStatistics).toHaveBeenCalledWith([mockStats1, mockStats2]);
    expect(ui.ui.succeedSpinner).toHaveBeenCalledWith(chalk.green('Statistics retrieved'));
  });

  it('should handle errors for individual issues and continue', async () => {
    const mockStats1 = {
      key: 'TEST-123',
      summary: 'Test issue 1',
      statusDurations: { 'To Do': 3600 }
    };

    vi.mocked(jiraClient.getIssueStatistics)
      .mockResolvedValueOnce(mockStats1)
      .mockRejectedValueOnce(new Error('Issue not found'));
    vi.mocked(formatters.formatIssueStatistics).mockReturnValue('Formatted stats');

    await getIssueStatisticsCommand('TEST-123, TEST-999');

    expect(jiraClient.getIssueStatistics).toHaveBeenCalledWith('TEST-123');
    expect(jiraClient.getIssueStatistics).toHaveBeenCalledWith('TEST-999');
    expect(consoleErrorSpy).toHaveBeenCalledWith(chalk.red('\nFailed to fetch statistics for TEST-999: Issue not found'));
    expect(formatters.formatIssueStatistics).toHaveBeenCalledWith([mockStats1]);
    expect(ui.ui.succeedSpinner).toHaveBeenCalled();
  });

  it('should fail spinner when all issues fail to fetch', async () => {
    vi.mocked(jiraClient.getIssueStatistics).mockRejectedValue(new Error('Network error'));

    await getIssueStatisticsCommand('TEST-123');

    expect(ui.ui.failSpinner).toHaveBeenCalledWith('Failed to retrieve statistics');
    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it('should trim whitespace from issue IDs', async () => {
    const mockStats = {
      key: 'TEST-123',
      summary: 'Test issue',
      statusDurations: {}
    };

    vi.mocked(jiraClient.getIssueStatistics).mockResolvedValue(mockStats);
    vi.mocked(formatters.formatIssueStatistics).mockReturnValue('Formatted stats');

    await getIssueStatisticsCommand('  TEST-123  ,  TEST-456  ');

    expect(jiraClient.getIssueStatistics).toHaveBeenCalledWith('TEST-123');
    expect(jiraClient.getIssueStatistics).toHaveBeenCalledWith('TEST-456');
  });
});
