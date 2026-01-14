import { describe, it, expect, beforeAll } from 'vitest';
import { getCurrentUser } from '../../src/lib/jira-client.js';
import { checkEnv } from './integration-test-utils.js';

describe('me integration test', () => {
  beforeAll(() => {
    checkEnv();
  });

  it('should fetch real user info from Jira', async () => {
    const user = await getCurrentUser();
    
    expect(user).toBeDefined();
    expect(user.accountId).toBeDefined();
    expect(user.displayName).toBeDefined();
    expect(user.emailAddress).toBe(process.env.JIRA_USER_EMAIL);
    expect(user.host).toContain('atlassian.net');
  });
});
