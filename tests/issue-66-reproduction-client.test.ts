import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { searchIssuesByJql } from '../src/lib/jira-client.js';
import * as settings from '../src/lib/settings.js';

vi.mock('../src/lib/auth-storage.js');
vi.mock('../src/lib/settings.js');

const {
  mockIssueSearchEnhanced,
  mockIssueSearchStandard,
} = vi.hoisted(() => ({
  mockIssueSearchEnhanced: vi.fn(),
  mockIssueSearchStandard: vi.fn(),
}));

vi.mock('jira.js', () => ({
  Version3Client: vi.fn().mockImplementation(function() {
    return {
      issueSearch: {
        searchForIssuesUsingJqlEnhancedSearch: mockIssueSearchEnhanced,
        searchForIssuesUsingJqlPost: mockIssueSearchStandard,
      },
      config: { host: 'https://test.atlassian.net' }
    };
  })
}));

const mockSettings = settings as vi.Mocked<typeof settings>;

describe('Issue 66 Reproduction: searchIssuesByJql should use standard Search API', () => {
  beforeAll(() => {
    process.env.JIRA_HOST = 'https://test.atlassian.net';
    process.env.JIRA_USER_EMAIL = 'test@example.com';
    process.env.JIRA_API_TOKEN = 'test-token';
    
    mockSettings.applyGlobalFilters.mockImplementation(jql => jql);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should use standard Search API', async () => {
    mockIssueSearchStandard.mockResolvedValue({ issues: [] });
    
    await searchIssuesByJql('project = TEST', 50);

    expect(mockIssueSearchStandard).toHaveBeenCalled();
    expect(mockIssueSearchEnhanced).not.toHaveBeenCalled();
  });
});
