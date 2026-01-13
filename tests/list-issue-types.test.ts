import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { listIssueTypesCommand } from '../src/commands/list-issue-types.js';
import * as jiraClient from '../src/lib/jira-client.js';
import * as formatters from '../src/lib/formatters.js';
import * as ui from '../src/lib/ui.js';
import chalk from 'chalk';

vi.mock('../src/lib/jira-client.js');
vi.mock('../src/lib/formatters.js');
vi.mock('../src/lib/ui.js');

describe('listIssueTypesCommand', () => {
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

  it('should fetch and display issue types for a project', async () => {
    const mockIssueTypes = [
      { id: '1', name: 'Task', description: 'A task', subtask: false },
      { id: '2', name: 'Bug', description: 'A bug', subtask: false },
      { id: '3', name: 'Story', description: 'A story', subtask: false }
    ];

    vi.mocked(jiraClient.getProjectIssueTypes).mockResolvedValue(mockIssueTypes);
    vi.mocked(formatters.formatProjectIssueTypes).mockReturnValue('Formatted issue types');

    await listIssueTypesCommand('PROJ');

    expect(ui.ui.startSpinner).toHaveBeenCalledWith('Fetching issue types for project PROJ...');
    expect(jiraClient.getProjectIssueTypes).toHaveBeenCalledWith('PROJ');
    expect(ui.ui.succeedSpinner).toHaveBeenCalledWith(chalk.green('Issue types retrieved'));
    expect(formatters.formatProjectIssueTypes).toHaveBeenCalledWith('PROJ', mockIssueTypes);
    expect(consoleLogSpy).toHaveBeenCalledWith('Formatted issue types');
  });

  it('should handle empty issue types list', async () => {
    vi.mocked(jiraClient.getProjectIssueTypes).mockResolvedValue([]);
    vi.mocked(formatters.formatProjectIssueTypes).mockReturnValue('No issue types');

    await listIssueTypesCommand('EMPTY');

    expect(jiraClient.getProjectIssueTypes).toHaveBeenCalledWith('EMPTY');
    expect(ui.ui.succeedSpinner).toHaveBeenCalledWith(chalk.green('Issue types retrieved'));
    expect(consoleLogSpy).toHaveBeenCalledWith('No issue types');
  });

  it('should handle errors when fetching issue types', async () => {
    const error = new Error('Project not found');
    vi.mocked(jiraClient.getProjectIssueTypes).mockRejectedValue(error);

    await expect(listIssueTypesCommand('INVALID')).rejects.toThrow('Project not found');

    expect(ui.ui.startSpinner).toHaveBeenCalledWith('Fetching issue types for project INVALID...');
    expect(jiraClient.getProjectIssueTypes).toHaveBeenCalledWith('INVALID');
  });
});
