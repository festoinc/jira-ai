import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { projectStatusesCommand } from '../src/commands/project-statuses.js';
import * as jiraClient from '../src/lib/jira-client.js';
import * as formatters from '../src/lib/formatters.js';
import * as ui from '../src/lib/ui.js';
import chalk from 'chalk';

vi.mock('../src/lib/jira-client.js');
vi.mock('../src/lib/formatters.js');
vi.mock('../src/lib/ui.js');

describe('projectStatusesCommand', () => {
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

  it('should fetch and display project statuses', async () => {
    const mockStatuses = [
      { id: '1', name: 'To Do', description: 'Work to be done' },
      { id: '2', name: 'In Progress', description: 'Work in progress' },
      { id: '3', name: 'Done', description: 'Completed work' }
    ];

    vi.mocked(jiraClient.getProjectStatuses).mockResolvedValue(mockStatuses);
    vi.mocked(formatters.formatProjectStatuses).mockReturnValue('Formatted statuses');

    await projectStatusesCommand('PROJ');

    expect(ui.ui.startSpinner).toHaveBeenCalledWith('Fetching statuses for project PROJ...');
    expect(jiraClient.getProjectStatuses).toHaveBeenCalledWith('PROJ');
    expect(ui.ui.succeedSpinner).toHaveBeenCalledWith(chalk.green('Project statuses retrieved'));
    expect(formatters.formatProjectStatuses).toHaveBeenCalledWith('PROJ', mockStatuses);
    expect(consoleLogSpy).toHaveBeenCalledWith('Formatted statuses');
  });

  it('should handle empty statuses list', async () => {
    vi.mocked(jiraClient.getProjectStatuses).mockResolvedValue([]);
    vi.mocked(formatters.formatProjectStatuses).mockReturnValue('No statuses');

    await projectStatusesCommand('EMPTY');

    expect(jiraClient.getProjectStatuses).toHaveBeenCalledWith('EMPTY');
    expect(ui.ui.succeedSpinner).toHaveBeenCalledWith(chalk.green('Project statuses retrieved'));
    expect(consoleLogSpy).toHaveBeenCalledWith('No statuses');
  });

  it('should handle errors when fetching statuses', async () => {
    const error = new Error('Project not found');
    vi.mocked(jiraClient.getProjectStatuses).mockRejectedValue(error);

    await expect(projectStatusesCommand('INVALID')).rejects.toThrow('Project not found');

    expect(ui.ui.startSpinner).toHaveBeenCalledWith('Fetching statuses for project INVALID...');
    expect(jiraClient.getProjectStatuses).toHaveBeenCalledWith('INVALID');
  });
});
