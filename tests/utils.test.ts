import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  validateEnvVars, 
  formatTimestamp, 
  truncate, 
  convertADFToMarkdown, 
  calculateStatusStatistics, 
  formatDuration, 
  parseTimeframe, 
  formatDateForJql,
  getVersion
} from '../src/lib/utils.js';
import * as authStorage from '../src/lib/auth-storage.js';
import { CommandError } from '../src/lib/errors.js';
import { readFileSync } from 'fs';
import { join } from 'path';

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

  describe('getVersion', () => {
    it('should return the correct version from package.json', () => {
      const packageJsonPath = join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
      expect(getVersion()).toBe(packageJson.version);
    });
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
    it('should throw CommandError if neither env vars nor credentials exist', () => {
      vi.mocked(authStorage.hasCredentials).mockReturnValue(false);
      expect(() => validateEnvVars()).toThrow(CommandError);
    });
  });

  describe('formatTimestamp', () => {
    it('should format date string correctly', () => {
      const date = '2023-01-01T12:00:00Z';
      expect(formatTimestamp(date)).toContain('2023');
      expect(formatTimestamp(date)).toContain('Jan');
    });

    it('should format Date object correctly', () => {
      const date = new Date('2023-01-01T12:00:00Z');
      expect(formatTimestamp(date)).toContain('2023');
      expect(formatTimestamp(date)).toContain('Jan');
    });
  });

  describe('truncate', () => {
    it('should not truncate if text is shorter than max length', () => {
      expect(truncate('hello', 10)).toBe('hello');
    });

    it('should truncate and add ellipsis if text is longer than max length', () => {
      expect(truncate('hello world', 5)).toBe('he...');
    });
  });

  describe('convertADFToMarkdown', () => {
    it('should return string as-is', () => {
      expect(convertADFToMarkdown('test')).toBe('test');
    });

    it('should return empty string for null/undefined', () => {
      expect(convertADFToMarkdown(null)).toBe('');
      expect(convertADFToMarkdown(undefined)).toBe('');
    });

    it('should handle conversion errors', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const content = { invalid: 'adf' };
      // fromADF is not mocked yet, but it might fail on invalid input
      // Actually let's just mock it if we want to be sure
      const result = convertADFToMarkdown(content);
      expect(typeof result).toBe('string');
      consoleSpy.mockRestore();
    });
  });

  describe('calculateStatusStatistics', () => {
    it('should calculate duration correctly with no transitions', () => {
      const now = new Date('2023-01-01T12:00:00Z').getTime();
      const created = '2023-01-01T10:00:00Z';
      const stats = calculateStatusStatistics(created, [], 'In Progress', now);
      expect(stats['In Progress']).toBe(7200);
    });

    it('should calculate duration correctly with transitions', () => {
      const now = new Date('2023-01-01T13:00:00Z').getTime();
      const created = '2023-01-01T10:00:00Z';
      const histories = [
        {
          created: '2023-01-01T11:00:00Z',
          items: [{ field: 'status', fromString: 'To Do', toString: 'In Progress' }]
        },
        {
          created: '2023-01-01T12:00:00Z',
          items: [{ field: 'status', fromString: 'In Progress', toString: 'Done' }]
        }
      ];
      const stats = calculateStatusStatistics(created, histories, 'Done', now);
      expect(stats['To Do']).toBe(3600);
      expect(stats['In Progress']).toBe(3600);
      expect(stats['Done']).toBe(3600);
    });

    it('should skip history if no status item is found', () => {
      const now = new Date('2023-01-01T12:00:00Z').getTime();
      const created = '2023-01-01T10:00:00Z';
      const histories = [
        {
          created: '2023-01-01T11:00:00Z',
          items: [{ field: 'priority', fromString: 'Low', toString: 'High' }]
        }
      ];
      const stats = calculateStatusStatistics(created, histories, 'In Progress', now);
      expect(stats['In Progress']).toBe(7200);
    });
  });

  describe('formatDuration', () => {
    it('should format duration correctly', () => {
      expect(formatDuration(0)).toBe('0m');
      expect(formatDuration(60)).toBe('1m');
      expect(formatDuration(3600)).toBe('1h');
      expect(formatDuration(3600 * 24)).toBe('1d');
      expect(formatDuration(3600 * 24 * 7)).toBe('1w');
      expect(formatDuration(3600 * 24 + 3600 + 60)).toBe('1d 1h 1m');
    });

    it('should handle custom hoursPerDay', () => {
        expect(formatDuration(3600 * 8, 8)).toBe('1d');
        expect(formatDuration(3600 * 40, 8)).toBe('1w');
    });
  });

  describe('parseTimeframe', () => {
    it('should parse valid timeframe', () => {
      const { startDate, endDate } = parseTimeframe('7d');
      expect(startDate).toBeInstanceOf(Date);
      expect(endDate).toBeInstanceOf(Date);
      const diffDays = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
      // Inclusive start and end of day makes it roughly 7 days
      expect(diffDays).toBeGreaterThanOrEqual(6);
    });

    it('should throw error for invalid timeframe', () => {
      expect(() => parseTimeframe('invalid')).toThrow('Invalid timeframe format');
    });
  });

  describe('formatDateForJql', () => {
    it('should format date correctly', () => {
      const date = new Date('2023-01-15T12:00:00Z');
      expect(formatDateForJql(date)).toBe('2023-01-15');
    });
  });
});
