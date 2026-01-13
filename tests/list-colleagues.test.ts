import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { listColleaguesCommand } from '../src/commands/list-colleagues.js';
import * as jiraClient from '../src/lib/jira-client.js';
import * as formatters from '../src/lib/formatters.js';
import * as ui from '../src/lib/ui.js';
import chalk from 'chalk';

vi.mock('../src/lib/jira-client.js');
vi.mock('../src/lib/formatters.js');
vi.mock('../src/lib/ui.js');

describe('listColleaguesCommand', () => {
  let consoleLogSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(ui.ui.startSpinner).mockImplementation(() => {});
    vi.mocked(ui.ui.succeedSpinner).mockImplementation(() => {});
    vi.mocked(ui.ui.failSpinner).mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('should fetch all active colleagues when no project key is provided', async () => {
    const mockUsers = [
      { accountId: '1', displayName: 'User One', emailAddress: 'user1@example.com', active: true },
      { accountId: '2', displayName: 'User Two', emailAddress: 'user2@example.com', active: true }
    ];

    vi.mocked(jiraClient.getUsers).mockResolvedValue(mockUsers);
    vi.mocked(formatters.formatUsers).mockReturnValue('Formatted users');

    await listColleaguesCommand();

    expect(ui.ui.startSpinner).toHaveBeenCalledWith('Fetching all active colleagues...');
    expect(jiraClient.getUsers).toHaveBeenCalledWith(undefined);
    expect(ui.ui.succeedSpinner).toHaveBeenCalledWith(chalk.green('Colleagues retrieved'));
    expect(formatters.formatUsers).toHaveBeenCalledWith(mockUsers);
    expect(consoleLogSpy).toHaveBeenCalledWith('Formatted users');
  });

  it('should fetch colleagues for a specific project when project key is provided', async () => {
    const mockUsers = [
      { accountId: '1', displayName: 'Project User', emailAddress: 'puser@example.com', active: true }
    ];

    vi.mocked(jiraClient.getUsers).mockResolvedValue(mockUsers);
    vi.mocked(formatters.formatUsers).mockReturnValue('Formatted project users');

    await listColleaguesCommand('PROJ');

    expect(ui.ui.startSpinner).toHaveBeenCalledWith('Fetching colleagues for project PROJ...');
    expect(jiraClient.getUsers).toHaveBeenCalledWith('PROJ');
    expect(ui.ui.succeedSpinner).toHaveBeenCalledWith(chalk.green('Colleagues retrieved'));
    expect(formatters.formatUsers).toHaveBeenCalledWith(mockUsers);
    expect(consoleLogSpy).toHaveBeenCalledWith('Formatted project users');
  });

  it('should display message when no colleagues are found', async () => {
    vi.mocked(jiraClient.getUsers).mockResolvedValue([]);

    await listColleaguesCommand();

    expect(ui.ui.succeedSpinner).toHaveBeenCalledWith(chalk.green('Colleagues retrieved'));
    expect(consoleLogSpy).toHaveBeenCalledWith(chalk.yellow('\nNo active colleagues found.'));
    expect(formatters.formatUsers).not.toHaveBeenCalled();
  });

  it('should handle errors and fail spinner', async () => {
    const error = new Error('Network error');
    vi.mocked(jiraClient.getUsers).mockRejectedValue(error);

    await expect(listColleaguesCommand()).rejects.toThrow('Network error');

    expect(ui.ui.failSpinner).toHaveBeenCalledWith(chalk.red('Failed to fetch colleagues'));
  });

  it('should handle errors with project key', async () => {
    const error = new Error('Project not found');
    vi.mocked(jiraClient.getUsers).mockRejectedValue(error);

    await expect(listColleaguesCommand('INVALID')).rejects.toThrow('Project not found');

    expect(ui.ui.startSpinner).toHaveBeenCalledWith('Fetching colleagues for project INVALID...');
    expect(ui.ui.failSpinner).toHaveBeenCalledWith(chalk.red('Failed to fetch colleagues'));
  });
});
