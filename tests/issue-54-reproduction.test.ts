import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { validateIssuePermissions } from '../src/lib/jira-client.js';
import * as settings from '../src/lib/settings.js';
import { Version3Client } from 'jira.js';

vi.mock('../src/lib/auth-storage.js');
vi.mock('../src/lib/settings.js');

const {
  mockGetIssue,
  mockGetCurrentUser,
  mockIssueSearch,
} = vi.hoisted(() => ({
  mockGetIssue: vi.fn(),
  mockGetCurrentUser: vi.fn(),
  mockIssueSearch: vi.fn(),
}));

const mockSettings = settings as vi.Mocked<typeof settings>;

vi.mock('jira.js', () => ({
  Version3Client: vi.fn().mockImplementation(function() {
    return {
      issues: {
        getIssue: mockGetIssue,
      },
      myself: {
        getCurrentUser: mockGetCurrentUser
      },
      issueSearch: {
        searchForIssuesUsingJqlEnhancedSearch: mockIssueSearch
      },
      config: { host: 'https://test.atlassian.net' }
    };
  })
}));

vi.mock('../src/lib/utils.js', () => ({
  convertADFToMarkdown: vi.fn(val => val ? 'mocked markdown' : undefined),
}));

describe('Issue #54 Reproduction: Post-Fetch Validation', () => {
  beforeAll(() => {
    process.env.JIRA_HOST = 'https://test.atlassian.net';
    process.env.JIRA_USER_EMAIL = 'test@example.com';
    process.env.JIRA_API_TOKEN = 'test-token';
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockSettings.isProjectAllowed.mockReturnValue(true);
    mockSettings.isCommandAllowed.mockReturnValue(true);
    mockSettings.validateIssueAgainstFilters.mockReturnValue(true);
    const mockProjects = [
      {
        key: 'AT',
        filters: {
          jql: 'issuetype = Bug'
        }
      }
    ];
    mockSettings.getAllowedProjects.mockReturnValue(mockProjects);
    mockSettings.loadSettings.mockReturnValue({
      defaults: {
        'allowed-jira-projects': mockProjects,
        'allowed-commands': ['all'],
        'allowed-confluence-spaces': ['all']
      }
    });

    mockGetCurrentUser.mockResolvedValue({
        accountId: 'user-123',
        displayName: 'Test User'
    });
  });

  it('SHOULD fail when issue does not match project JQL filter', async () => {
    // Mock the issue being fetched (it's a Task, not a Bug)
    mockGetIssue.mockResolvedValue({
      id: '10097',
      key: 'AT-97',
      fields: {
        summary: 'Test Task',
        status: { name: 'To Do' },
        created: '2023-01-01T10:00:00.000Z',
        updated: '2023-01-01T10:00:00.000Z',
        labels: []
      }
    });

    // Mock search result for JQL check: returning 0 issues means no match
    mockIssueSearch.mockResolvedValue({
        issues: [],
        total: 0
    });

    // We WANT it to throw a CommandError.
    await expect(validateIssuePermissions('AT-97', 'add-comment')).rejects.toThrow(/restricted by project filters/);
  });
});
