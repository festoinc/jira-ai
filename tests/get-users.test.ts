import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { getUsers } from '../src/lib/jira-client.js';

// Mock dependencies
const { mockFindUsers, mockFindAssignableUsers } = vi.hoisted(() => ({
  mockFindUsers: vi.fn(),
  mockFindAssignableUsers: vi.fn(),
}));

vi.mock('jira.js', () => ({
  Version3Client: vi.fn().mockImplementation(function() {
    return {
      userSearch: {
        findUsers: mockFindUsers,
        findAssignableUsers: mockFindAssignableUsers,
      },
      config: {
        host: 'https://test.atlassian.net'
      }
    };
  })
}));

describe('Jira Client - getUsers', () => {
  beforeAll(() => {
    process.env.JIRA_HOST = 'https://test.atlassian.net';
    process.env.JIRA_USER_EMAIL = 'test@example.com';
    process.env.JIRA_API_TOKEN = 'test-token';
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch all active users when no projectKey is provided', async () => {
    const mockUsers = [
      { accountId: '1', displayName: 'User One', emailAddress: 'user1@example.com', active: true, accountType: 'atlassian' },
      { accountId: '2', displayName: 'User Two', emailAddress: 'user2@example.com', active: false, accountType: 'atlassian' },
    ];

    mockFindUsers.mockResolvedValue(mockUsers);

    const result = await getUsers();

    expect(mockFindUsers).toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0].displayName).toBe('User One');
    expect(result[0].active).toBe(true);
  });

  it('should fetch assignable users when projectKey is provided', async () => {
    const mockUsers = [
      { accountId: '3', displayName: 'Project User', emailAddress: 'puser@example.com', active: true, accountType: 'atlassian' },
    ];

    mockFindAssignableUsers.mockResolvedValue(mockUsers);

    const result = await getUsers('PROJ');

    expect(mockFindAssignableUsers).toHaveBeenCalledWith(expect.objectContaining({
      project: 'PROJ'
    }));
    expect(result).toHaveLength(1);
    expect(result[0].displayName).toBe('Project User');
  });
});
