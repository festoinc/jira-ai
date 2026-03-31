import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { meCommand } from '../src/commands/me.js';
import * as jiraClient from '../src/lib/jira-client.js';

vi.mock('../src/lib/jira-client.js');

describe('meCommand', () => {
  let consoleLogSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
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

    await meCommand();

    expect(jiraClient.getCurrentUser).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty('displayName', 'John Doe');
    expect(parsed).toHaveProperty('emailAddress', 'john@example.com');
    expect(parsed).toHaveProperty('accountId', 'abc123');
  });

  it('should handle errors when fetching user information', async () => {
    const error = new Error('Unauthorized');
    vi.mocked(jiraClient.getCurrentUser).mockRejectedValue(error);

    await expect(meCommand()).rejects.toThrow('Unauthorized');

    expect(jiraClient.getCurrentUser).toHaveBeenCalled();
  });
});
