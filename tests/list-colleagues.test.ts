import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { listColleaguesCommand } from '../src/commands/list-colleagues.js';
import * as jiraClient from '../src/lib/jira-client.js';
import * as settings from '../src/lib/settings.js';

vi.mock('../src/lib/jira-client.js');
vi.mock('../src/lib/settings.js');

describe('listColleaguesCommand', () => {
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

  it('should fetch all active colleagues when no project key is provided', async () => {
    const mockUsers = [
      { accountId: '1', displayName: 'User One', emailAddress: 'user1@example.com', active: true },
      { accountId: '2', displayName: 'User Two', emailAddress: 'user2@example.com', active: true }
    ];

    vi.mocked(jiraClient.getUsers).mockResolvedValue(mockUsers);

    await listColleaguesCommand();

    expect(jiraClient.getUsers).toHaveBeenCalledWith(undefined);
    const output = consoleLogSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toHaveProperty('displayName', 'User One');
  });

  it('should fetch colleagues for a specific project when project key is provided', async () => {
    const mockUsers = [
      { accountId: '1', displayName: 'Project User', emailAddress: 'puser@example.com', active: true }
    ];

    vi.mocked(jiraClient.getUsers).mockResolvedValue(mockUsers);

    await listColleaguesCommand('PROJ');

    expect(jiraClient.getUsers).toHaveBeenCalledWith('PROJ');
    const output = consoleLogSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed[0]).toHaveProperty('displayName', 'Project User');
  });

  it('should output empty array when no colleagues are found', async () => {
    vi.mocked(jiraClient.getUsers).mockResolvedValue([]);

    await listColleaguesCommand();

    expect(jiraClient.getUsers).toHaveBeenCalledWith(undefined);
    const output = consoleLogSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed).toHaveLength(0);
  });

  it('should handle errors', async () => {
    const error = new Error('Network error');
    vi.mocked(jiraClient.getUsers).mockRejectedValue(error);

    await expect(listColleaguesCommand()).rejects.toThrow('Network error');
  });

  it('should handle errors with project key', async () => {
    const error = new Error('Project not found');
    vi.mocked(jiraClient.getUsers).mockRejectedValue(error);

    await expect(listColleaguesCommand('INVALID')).rejects.toThrow('Project not found');

    expect(jiraClient.getUsers).toHaveBeenCalledWith('INVALID');
  });
});
