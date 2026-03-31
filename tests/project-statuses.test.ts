import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { projectStatusesCommand } from '../src/commands/project-statuses.js';
import * as jiraClient from '../src/lib/jira-client.js';
import * as settings from '../src/lib/settings.js';

vi.mock('../src/lib/jira-client.js');
vi.mock('../src/lib/settings.js');

describe('projectStatusesCommand', () => {
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

  it('should fetch and display project statuses', async () => {
    const mockStatuses = [
      { id: '1', name: 'To Do', description: 'Work to be done' },
      { id: '2', name: 'In Progress', description: 'Work in progress' },
      { id: '3', name: 'Done', description: 'Completed work' }
    ];

    vi.mocked(jiraClient.getProjectStatuses).mockResolvedValue(mockStatuses);

    await projectStatusesCommand('PROJ');

    expect(jiraClient.getProjectStatuses).toHaveBeenCalledWith('PROJ');
    const output = consoleLogSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed).toHaveLength(3);
    expect(parsed[0]).toHaveProperty('name', 'To Do');
  });

  it('should handle empty statuses list', async () => {
    vi.mocked(jiraClient.getProjectStatuses).mockResolvedValue([]);

    await projectStatusesCommand('EMPTY');

    expect(jiraClient.getProjectStatuses).toHaveBeenCalledWith('EMPTY');
    const output = consoleLogSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed).toHaveLength(0);
  });

  it('should handle errors when fetching statuses', async () => {
    const error = new Error('Project not found');
    vi.mocked(jiraClient.getProjectStatuses).mockRejectedValue(error);

    await expect(projectStatusesCommand('INVALID')).rejects.toThrow('Project not found');

    expect(jiraClient.getProjectStatuses).toHaveBeenCalledWith('INVALID');
  });
});
