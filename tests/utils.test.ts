import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { validateEnvVars } from '../src/lib/utils.js';
import * as authStorage from '../src/lib/auth-storage.js';
import { CommandError } from '../src/lib/errors.js';

vi.mock('../src/lib/auth-storage.js');

describe('Utils Module', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('validateEnvVars', () => {
    it('should throw CommandError if credentials are missing', () => {
      // Clear environment variables
      delete process.env.JIRA_HOST;
      delete process.env.JIRA_USER_EMAIL;
      delete process.env.JIRA_API_TOKEN;

      vi.spyOn(authStorage, 'hasCredentials').mockReturnValue(false);

      expect(() => validateEnvVars()).toThrow(CommandError);
    });

    it('should not throw if environment variables are present', () => {
      process.env.JIRA_HOST = 'test.atlassian.net';
      process.env.JIRA_USER_EMAIL = 'test@example.com';
      process.env.JIRA_API_TOKEN = 'token';

      vi.spyOn(authStorage, 'hasCredentials').mockReturnValue(false);

      expect(() => validateEnvVars()).not.toThrow();
    });

    it('should not throw if auth storage has credentials', () => {
      delete process.env.JIRA_HOST;
      delete process.env.JIRA_USER_EMAIL;
      delete process.env.JIRA_API_TOKEN;

      vi.spyOn(authStorage, 'hasCredentials').mockReturnValue(true);

      expect(() => validateEnvVars()).not.toThrow();
    });
  });
});
