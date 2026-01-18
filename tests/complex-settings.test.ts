import { vi, describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { loadSettings, isProjectAllowed, isCommandAllowed, applyGlobalFilters, validateIssueAgainstFilters, __resetCache__ } from '../src/lib/settings.js';

// Mock fs module
vi.mock('fs');
const mockFs = fs as vi.Mocked<typeof fs>;

describe('Complex Settings', () => {
  const mockConfigDir = path.join(os.homedir(), '.jira-ai');
  const mockSettingsPath = path.join(mockConfigDir, 'settings.yaml');

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the settings cache before each test
    __resetCache__();
  });

  describe('loadSettings with complex projects', () => {
    it('should load complex project settings', () => {
      const mockYaml = `
projects:
  - BP
  - key: PM
    commands:
      - task-with-details
      - add-comment
    filters:
      participated:
        was_assignee: true
        was_reporter: true
      jql: "issuetype = Bug"
commands:
  - me
  - projects
`;
      mockFs.existsSync.mockImplementation((path) => {
        if (path === mockConfigDir) return true;
        if (path === mockSettingsPath) return true;
        return false;
      });
      mockFs.readFileSync.mockReturnValue(mockYaml);

      const settings = loadSettings();

      const allowedProjects = settings.defaults?.['allowed-jira-projects'] || [];
      expect(allowedProjects).toHaveLength(2);
      expect(allowedProjects[0]).toBe('BP');
      expect(allowedProjects[1]).toEqual({
        key: 'PM',
        commands: ['task-with-details', 'add-comment'],
        filters: {
          participated: {
            was_assignee: true,
            was_reporter: true
          },
          jql: 'issuetype = Bug'
        }
      });
    });
  });

  describe('isCommandAllowed with project context', () => {
    it('should respect project-specific command restrictions', () => {
      const mockYaml = `
projects:
  - key: PM
    commands:
      - task-with-details
commands:
  - me
  - projects
`;
      mockFs.existsSync.mockImplementation((path) => {
        if (path === mockConfigDir) return true;
        if (path === mockSettingsPath) return true;
        return false;
      });
      mockFs.readFileSync.mockReturnValue(mockYaml);

      // Global commands should work when no project specified
      expect(isCommandAllowed('me')).toBe(true);
      expect(isCommandAllowed('projects')).toBe(true);
      // Now should be true because it's allowed in PM project
      expect(isCommandAllowed('task-with-details')).toBe(true);

      // Project-specific commands should work when project is specified
      expect(isCommandAllowed('task-with-details', 'PM')).toBe(true);
      
      // Global commands NOT in project list should be blocked for that project
      expect(isCommandAllowed('me', 'PM')).toBe(false);
      expect(isCommandAllowed('projects', 'PM')).toBe(false);
    });

    it('should always allow about and auth commands', () => {
      const mockYaml = `
projects:
  - key: PM
    commands:
      - task-with-details
commands:
  - me
`;
      mockFs.existsSync.mockImplementation((path) => {
        if (path === mockConfigDir) return true;
        if (path === mockSettingsPath) return true;
        return false;
      });
      mockFs.readFileSync.mockReturnValue(mockYaml);

      expect(isCommandAllowed('about')).toBe(true);
      expect(isCommandAllowed('auth')).toBe(true);
      expect(isCommandAllowed('about', 'PM')).toBe(true);
      expect(isCommandAllowed('auth', 'PM')).toBe(true);
    });

    it('should use global commands if project has no specific commands', () => {
      const mockYaml = `
projects:
  - BP
  - key: PM
    filters:
      jql: "type=bug"
commands:
  - me
`;
      mockFs.existsSync.mockImplementation((path) => {
        if (path === mockConfigDir) return true;
        if (path === mockSettingsPath) return true;
        return false;
      });
      mockFs.readFileSync.mockReturnValue(mockYaml);

      expect(isCommandAllowed('me', 'BP')).toBe(true);
      expect(isCommandAllowed('me', 'PM')).toBe(true);
      expect(isCommandAllowed('projects', 'PM')).toBe(false);
    });
  });

  describe('isProjectAllowed', () => {
    it('should work with complex project objects', () => {
      const mockYaml = `
projects:
  - BP
  - key: PM
commands:
  - me
`;
      mockFs.existsSync.mockImplementation((path) => {
        if (path === mockConfigDir) return true;
        if (path === mockSettingsPath) return true;
        return false;
      });
      mockFs.readFileSync.mockReturnValue(mockYaml);

      expect(isProjectAllowed('BP')).toBe(true);
      expect(isProjectAllowed('PM')).toBe(true);
      expect(isProjectAllowed('XYZ')).toBe(false);
    });
  });

  describe('applyGlobalFilters', () => {
    it('should not modify JQL if "all" is in projects', () => {
      const mockYaml = `
projects:
  - all
commands:
  - me
`;
      mockFs.existsSync.mockImplementation((path) => {
        if (path === mockConfigDir) return true;
        if (path === mockSettingsPath) return true;
        return false;
      });
      mockFs.readFileSync.mockReturnValue(mockYaml);
      
      const jql = 'issuetype = Task';
      expect(applyGlobalFilters(jql)).toBe(jql);
    });

    it('should restrict JQL to allowed projects', () => {
      const mockYaml = `
projects:
  - BP
  - PM
commands:
  - me
`;
      mockFs.existsSync.mockImplementation((path) => {
        if (path === mockConfigDir) return true;
        if (path === mockSettingsPath) return true;
        return false;
      });
      mockFs.readFileSync.mockReturnValue(mockYaml);
      
      const jql = 'priority = High';
      const result = applyGlobalFilters(jql);
      expect(result).toBe('(project = "BP" OR project = "PM") AND (priority = High)');
    });

    it('should append project-specific JQL filters', () => {
      const mockYaml = `
projects:
  - BP
  - key: PM
    filters:
      jql: "issuetype = Bug"
commands:
  - me
`;
      mockFs.existsSync.mockImplementation((path) => {
        if (path === mockConfigDir) return true;
        if (path === mockSettingsPath) return true;
        return false;
      });
      mockFs.readFileSync.mockReturnValue(mockYaml);
      
      const jql = 'priority = High';
      const result = applyGlobalFilters(jql);
      expect(result).toBe('(project = "BP" OR (project = "PM" AND (issuetype = Bug))) AND (priority = High)');
    });
  });

  describe('validateIssueAgainstFilters', () => {
    const currentUserId = 'user-123';

    it('should return true if no filters defined', () => {
      const mockYaml = `
projects:
  - BP
commands: [all]
`;
      mockFs.existsSync.mockImplementation((path) => {
        if (path === mockConfigDir) return true;
        if (path === mockSettingsPath) return true;
        return false;
      });
      mockFs.readFileSync.mockReturnValue(mockYaml);
      const issue = { key: 'BP-1' };
      expect(validateIssueAgainstFilters(issue, currentUserId)).toBe(true);
    });

    it('should return false if project not allowed', () => {
      const mockYaml = `
projects:
  - BP
commands: [all]
`;
      mockFs.existsSync.mockImplementation((path) => {
        if (path === mockConfigDir) return true;
        if (path === mockSettingsPath) return true;
        return false;
      });
      mockFs.readFileSync.mockReturnValue(mockYaml);
      const issue = { key: 'PM-1' };
      expect(validateIssueAgainstFilters(issue, currentUserId)).toBe(false);
    });

    it('should validate participated filters', () => {
      const mockYaml = `
projects:
  - key: PM
    filters:
      participated:
        was_assignee: true
commands: [all]
`;
      mockFs.existsSync.mockImplementation((path) => {
        if (path === mockConfigDir) return true;
        if (path === mockSettingsPath) return true;
        return false;
      });
      mockFs.readFileSync.mockReturnValue(mockYaml);
      
      const issueAssigned = { 
        key: 'PM-1', 
        assignee: { accountId: 'user-123' } 
      };
      const issueNotAssigned = { 
        key: 'PM-2', 
        assignee: { accountId: 'other-user' } 
      };

      expect(validateIssueAgainstFilters(issueAssigned, currentUserId)).toBe(true);
      expect(validateIssueAgainstFilters(issueNotAssigned, currentUserId)).toBe(false);
    });

    it('should validate multiple participated filters (OR logic)', () => {
      const mockYaml = `
projects:
  - key: PM
    filters:
      participated:
        was_assignee: true
        was_reporter: true
commands: [all]
`;
      mockFs.existsSync.mockImplementation((path) => {
        if (path === mockConfigDir) return true;
        if (path === mockSettingsPath) return true;
        return false;
      });
      mockFs.readFileSync.mockReturnValue(mockYaml);
      
      const issueReporter = { 
        key: 'PM-1', 
        reporter: { accountId: 'user-123' },
        assignee: { accountId: 'other' }
      };

      expect(validateIssueAgainstFilters(issueReporter, currentUserId)).toBe(true);
    });

    it('should validate commenter filter', () => {
      const mockYaml = `
projects:
  - key: PM
    filters:
      participated:
        was_commenter: true
commands: [all]
`;
      mockFs.existsSync.mockImplementation((path) => {
        if (path === mockConfigDir) return true;
        if (path === mockSettingsPath) return true;
        return false;
      });
      mockFs.readFileSync.mockReturnValue(mockYaml);
      
      const issueWithComment = { 
        key: 'PM-1', 
        comments: [
          { author: { accountId: 'other' } },
          { author: { accountId: 'user-123' } }
        ]
      };

      expect(validateIssueAgainstFilters(issueWithComment, currentUserId)).toBe(true);
    });

    it('should validate watcher filter', () => {
      const mockYaml = `
projects:
  - key: PM
    filters:
      participated:
        is_watcher: true
commands: [all]
`;
      mockFs.existsSync.mockImplementation((path) => {
        if (path === mockConfigDir) return true;
        if (path === mockSettingsPath) return true;
        return false;
      });
      mockFs.readFileSync.mockReturnValue(mockYaml);
      
      const issueWatched = { 
        key: 'PM-1', 
        watchers: ['CURRENT_USER']
      };

      expect(validateIssueAgainstFilters(issueWatched, currentUserId)).toBe(true);
    });
  });
});
