import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getJiraClient } from '../src/lib/jira-client.js';
import { getConfluenceClient } from '../src/lib/confluence-client.ts';
import * as authStorage from '../src/lib/auth-storage.js';

vi.mock('../src/lib/auth-storage.js', async () => {
  const actual = await vi.importActual('../src/lib/auth-storage.js') as any;
  return {
    ...actual,
    hasCredentials: vi.fn(),
    loadCredentials: vi.fn(),
    getCurrentOrganizationAlias: vi.fn(),
  };
});

describe('Issue 86 Reproduction - Environment Variables for Auth', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    vi.clearAllMocks();
    
    // Ensure we start with no cached clients
    // We can't easily reset the let jiraClient in the module without re-importing or having a reset function
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should NOT use environment variables for Jira client when they are set', async () => {
    process.env.JIRA_HOST = 'https://env-host.atlassian.net';
    process.env.JIRA_USER_EMAIL = 'env@example.com';
    process.env.JIRA_API_TOKEN = 'env-token';

    vi.mocked(authStorage.hasCredentials).mockReturnValue(false);
    vi.mocked(authStorage.loadCredentials).mockReturnValue(null);

    // AFTER FIX, this should throw an error because it should ignore env vars and find no stored credentials
    expect(() => getJiraClient()).toThrow(/Jira credentials not found/);
  });

  it('should NOT use environment variables for Confluence client when they are set', async () => {
    process.env.JIRA_HOST = 'https://env-host.atlassian.net';
    process.env.JIRA_USER_EMAIL = 'env@example.com';
    process.env.JIRA_API_TOKEN = 'env-token';

    vi.mocked(authStorage.hasCredentials).mockReturnValue(false);
    vi.mocked(authStorage.loadCredentials).mockReturnValue(null);

    // AFTER FIX, this should throw an error because it should ignore env vars and find no stored credentials
    expect(() => getConfluenceClient()).toThrow(/Credentials not found/);
  });
});
