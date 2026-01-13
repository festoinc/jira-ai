import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { meCommand } from '../src/commands/me.js';
import * as jiraClient from '../src/lib/jira-client.js';
import * as formatters from '../src/lib/formatters.js';
import * as ui from '../src/lib/ui.js';
import chalk from 'chalk';

vi.mock('../src/lib/jira-client.js');
vi.mock('../src/lib/formatters.js');
vi.mock('../src/lib/ui.js');

describe('meCommand', () => {
  let consoleLogSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(ui.ui.startSpinner).mockImplementation(() => {});
    vi.mocked(ui.ui.succeedSpinner).mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('should fetch and display current user information', async () => {
    const mockUser = {
      accountId: 'abc123',
      displayName: 'John Doe',
      emailAddress: 'john@example.com',
      active: true,
      accountType: 'atlassian'
    };

    vi.mocked(jiraClient.getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(formatters.formatUserInfo).mockReturnValue('Formatted user info');

    await meCommand();

    expect(ui.ui.startSpinner).toHaveBeenCalledWith('Fetching user information...');
    expect(jiraClient.getCurrentUser).toHaveBeenCalled();
    expect(ui.ui.succeedSpinner).toHaveBeenCalledWith(chalk.green('User information retrieved'));
    expect(formatters.formatUserInfo).toHaveBeenCalledWith(mockUser);
    expect(consoleLogSpy).toHaveBeenCalledWith('Formatted user info');
  });

  it('should handle errors when fetching user information', async () => {
    const error = new Error('Unauthorized');
    vi.mocked(jiraClient.getCurrentUser).mockRejectedValue(error);

    await expect(meCommand()).rejects.toThrow('Unauthorized');

    expect(ui.ui.startSpinner).toHaveBeenCalledWith('Fetching user information...');
    expect(jiraClient.getCurrentUser).toHaveBeenCalled();
  });
});
