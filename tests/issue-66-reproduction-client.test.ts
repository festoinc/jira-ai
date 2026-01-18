import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { searchIssuesByJql } from '../src/lib/jira-client.js';
import * as settings from '../src/lib/settings.js';

import * as authStorage from '../src/lib/auth-storage.js';

vi.mock('../src/lib/auth-storage.js', () => ({
  loadCredentials: vi.fn(() => ({
    host: 'https://test.atlassian.net',
    email: 'test@example.com',
    apiToken: 'test-token'
  })),
  getCurrentOrganizationAlias: vi.fn(),
}));
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

describe('Issue 66 Reproduction: searchIssuesByJql should use enhanced Search API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSettings.applyGlobalFilters.mockImplementation(jql => jql);
  });

  it('should use enhanced Search API', async () => {
    mockIssueSearchEnhanced.mockResolvedValue({ issues: [] });
    
    await searchIssuesByJql('project = TEST', 50);

    expect(mockIssueSearchEnhanced).toHaveBeenCalled();
    expect(mockIssueSearchStandard).not.toHaveBeenCalled();
  });
});
