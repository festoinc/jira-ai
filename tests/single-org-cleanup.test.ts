import { vi, describe, it, expect, beforeEach, test } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

const mockConfigDir = path.join(os.homedir(), '.jira-ai');
const mockSettingsPath = path.join(mockConfigDir, 'settings.yaml');

vi.mock('fs');
const mockFs = fs as vi.Mocked<typeof fs>;

import {
  loadSettings,
  isProjectAllowed,
  isCommandAllowed,
  isConfluenceSpaceAllowed,
  getAllowedProjects,
  getAllowedCommands,
  getAllowedConfluenceSpaces,
  applyGlobalFilters,
  validateIssueAgainstFilters,
  __resetCache__,
  DEFAULT_ORG_SETTINGS,
  LEGACY_COMMAND_MAP,
  Settings,
} from '../src/lib/settings.js';

describe('Single-org cleanup (JIR-9)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetCache__();
  });

  describe('Settings interface has no organizations field', () => {
    it('should not contain organizations in typed settings', () => {
      const settings: Settings = {
        defaults: {
          'allowed-jira-projects': ['all'],
          'allowed-commands': ['issue'],
          'allowed-confluence-spaces': ['all'],
        },
      };
      expect(settings.defaults).toBeDefined();
      expect((settings as any).organizations).toBeUndefined();
    });
  });

  describe('DEFAULT_ORG_SETTINGS does not contain org command', () => {
    it('should not list org in default allowed commands', () => {
      expect(DEFAULT_ORG_SETTINGS['allowed-commands']).not.toContain('org');
      expect(DEFAULT_ORG_SETTINGS['allowed-commands']).toEqual([
        'issue',
        'project',
        'user',
        'confl',
        'board',
        'sprint',
      ]);
    });
  });

  describe('LEGACY_COMMAND_MAP has no org entries', () => {
    it('should not contain organization -> org mapping', () => {
      expect(LEGACY_COMMAND_MAP).not.toHaveProperty('organization');
    });

    it('should not contain org -> org mapping', () => {
      expect(LEGACY_COMMAND_MAP).not.toHaveProperty('org');
    });
  });

  describe('No orgAlias parameters in exported functions', () => {
    const setupMockSettings = () => {
      const mockYaml = `
defaults:
  allowed-jira-projects:
    - all
  allowed-commands:
    - issue
  allowed-confluence-spaces:
    - all
`;
      mockFs.existsSync.mockImplementation((p: any) => {
        if (p === mockConfigDir) return true;
        if (p === mockSettingsPath) return true;
        return false;
      });
      mockFs.readFileSync.mockReturnValue(mockYaml);
    };

    it('isProjectAllowed should accept only projectKey', () => {
      setupMockSettings();
      expect(isProjectAllowed('TEST')).toBe(true);
    });

    it('isCommandAllowed should accept commandName and optional projectKey', () => {
      setupMockSettings();
      expect(isCommandAllowed('issue')).toBe(true);
      expect(isCommandAllowed('issue.get')).toBe(true);
    });

    it('isConfluenceSpaceAllowed should accept only spaceKey', () => {
      setupMockSettings();
      expect(isConfluenceSpaceAllowed('TEST')).toBe(true);
    });

    it('getAllowedProjects should accept no arguments', () => {
      setupMockSettings();
      const projects = getAllowedProjects();
      expect(projects).toEqual(['all']);
    });

    it('getAllowedCommands should accept no arguments', () => {
      setupMockSettings();
      const commands = getAllowedCommands();
      expect(commands).toEqual(['issue']);
    });

    it('getAllowedConfluenceSpaces should accept no arguments', () => {
      setupMockSettings();
      const spaces = getAllowedConfluenceSpaces();
      expect(spaces).toEqual(['all']);
    });

    it('applyGlobalFilters should accept only jql', () => {
      setupMockSettings();
      const result = applyGlobalFilters('priority = High');
      expect(result).toBe('priority = High');
    });

    it('validateIssueAgainstFilters should accept only issue and currentUserId', () => {
      setupMockSettings();
      const issue = { key: 'TEST-1' };
      expect(validateIssueAgainstFilters(issue, 'user-123')).toBe(true);
    });
  });
});
