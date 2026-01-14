import { describe, it, expect, beforeAll } from 'vitest';
import { getUsers } from '../../src/lib/jira-client.js';
import { checkEnv } from './integration-test-utils.js';

describe('get-users integration test', () => {
  beforeAll(() => {
    checkEnv();
  });

  it('should fetch users from Jira', async () => {
    const users = await getUsers();
    
    expect(Array.isArray(users)).toBe(true);
    expect(users.length).toBeGreaterThan(0);
    
    const currentUser = users.find(u => u.emailAddress === process.env.JIRA_USER_EMAIL);
    expect(currentUser).toBeDefined();
  });
});
