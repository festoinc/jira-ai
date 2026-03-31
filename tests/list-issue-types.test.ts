import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { listIssueTypesCommand } from '../src/commands/list-issue-types.js';
import * as jiraClient from '../src/lib/jira-client.js';
import * as settings from '../src/lib/settings.js';

vi.mock('../src/lib/jira-client.js');
vi.mock('../src/lib/settings.js');

describe('listIssueTypesCommand', () => {
  let consoleLogSpy: any;
  const mockSettings = settings as vi.Mocked<typeof settings>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockSettings.isProjectAllowed.mockReturnValue(true);
    mockSettings.isCommandAllowed.mockReturnValue(true);
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

    await listIssueTypesCommand('PROJ');

    expect(jiraClient.getProjectIssueTypes).toHaveBeenCalledWith('PROJ');
    const output = consoleLogSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed).toHaveLength(3);
    expect(parsed[0]).toHaveProperty('name', 'Task');
  });

  it('should handle empty issue types list', async () => {
    vi.mocked(jiraClient.getProjectIssueTypes).mockResolvedValue([]);

    await listIssueTypesCommand('EMPTY');

    expect(jiraClient.getProjectIssueTypes).toHaveBeenCalledWith('EMPTY');
    const output = consoleLogSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed).toHaveLength(0);
  });

  it('should handle errors when fetching issue types', async () => {
    const error = new Error('Project not found');
    vi.mocked(jiraClient.getProjectIssueTypes).mockRejectedValue(error);

    await expect(listIssueTypesCommand('INVALID')).rejects.toThrow('Project not found');

    expect(jiraClient.getProjectIssueTypes).toHaveBeenCalledWith('INVALID');
  });
});
