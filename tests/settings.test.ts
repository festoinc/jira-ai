import { vi, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, test } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { loadSettings, isProjectAllowed, isCommandAllowed, getAllowedProjects, getAllowedCommands, __resetCache__, getSettingsPath } from '../src/lib/settings.js';
import { CliError } from '../src/types/errors.js';

// Mock fs module
vi.mock('fs');
const mockFs = fs as vi.Mocked<typeof fs>;

describe('Settings Module', () => {
  const mockConfigDir = path.join(os.homedir(), '.jira-ai');
  const mockSettingsPath = path.join(mockConfigDir, 'settings.yaml');
  const mockLocalSettingsPath = path.join(process.cwd(), 'settings.yaml');

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the settings cache before each test
    __resetCache__();
  });

  describe('loadSettings', () => {
    it('should load settings from settings.yaml file', () => {
      const mockYaml = `
projects:
  - BP
  - PM
  - PS
commands:
  - me
  - projects
`;
      // Mock that config dir exists and settings file exists
      mockFs.existsSync.mockImplementation((path) => {
        if (path === mockConfigDir) return true;
        if (path === mockSettingsPath) return true;
        return false;
      });
      mockFs.readFileSync.mockReturnValue(mockYaml);

      const settings = loadSettings();

      expect(settings.defaults?.['allowed-jira-projects']).toEqual(['BP', 'PM', 'PS']);
      expect(settings.defaults?.['allowed-commands']).toEqual(['me', 'projects']);
      expect(mockFs.readFileSync).toHaveBeenCalledWith(mockSettingsPath, 'utf8');
    });

    it('should return default settings when file does not exist', () => {
      // Mock that neither config dir nor settings files exist
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockReturnValue(undefined);
      mockFs.writeFileSync.mockReturnValue(undefined);

      const settings = loadSettings();

      expect(settings.defaults?.['allowed-jira-projects']).toEqual(['all']);
      expect(settings.defaults?.['allowed-commands']).toEqual([
        'me',
        'projects',
        'task-with-details',
        'run-jql',
        'list-issue-types',
        'project-statuses',
        'create-task',
        'list-colleagues',
        'add-comment',
        'add-label-to-issue',
        'delete-label-from-issue',
        'get-issue-statistics',
        'get-person-worklog',
        'organization',
        'transition',
        'update-description',
        'confluence'
      ]);
      // Should create default settings file
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        mockSettingsPath,
        expect.stringContaining('projects')
      );
    });

    it('should handle null/undefined projects/commands by defaulting to all', () => {
      const mockYaml = `
projects:
commands:
`;
      mockFs.existsSync.mockImplementation((path) => {
        if (path === mockConfigDir) return true;
        if (path === mockSettingsPath) return true;
        return false;
      });
      mockFs.readFileSync.mockReturnValue(mockYaml);

      const settings = loadSettings();

      expect(settings.defaults?.['allowed-jira-projects']).toEqual(['all']);
      expect(settings.defaults?.['allowed-commands']).toEqual([
        'me',
        'projects',
        'task-with-details',
        'run-jql',
        'list-issue-types',
        'project-statuses',
        'create-task',
        'list-colleagues',
        'add-comment',
        'add-label-to-issue',
        'delete-label-from-issue',
        'get-issue-statistics',
        'get-person-worklog',
        'organization',
        'transition',
        'update-description',
        'confluence'
      ]);
    });

    it('should throw CliError on invalid YAML', () => {
      mockFs.existsSync.mockImplementation((path) => {
        if (path === mockConfigDir) return true;
        if (path === mockSettingsPath) return true;
        return false;
      });
      mockFs.readFileSync.mockReturnValue('invalid: yaml: content:');

      expect(() => loadSettings()).toThrow(CliError);
    });
  });

  describe('isProjectAllowed', () => {
    it('should return true when "all" is in projects list', () => {
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

      expect(isProjectAllowed('BP')).toBe(true);
      expect(isProjectAllowed('ANY_PROJECT')).toBe(true);
      expect(isProjectAllowed('XYZ')).toBe(true);
    });

    it('should return true when project is in allowed list', () => {
      const mockYaml = `
projects:
  - BP
  - PM
  - PS
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
      expect(isProjectAllowed('PS')).toBe(true);
    });

    it('should return false when project is not in allowed list', () => {
      const mockYaml = `
projects:
  - BP
  - PM
  - PS
commands:
  - me
`;
      mockFs.existsSync.mockImplementation((path) => {
        if (path === mockConfigDir) return true;
        if (path === mockSettingsPath) return true;
        return false;
      });
      mockFs.readFileSync.mockReturnValue(mockYaml);

      expect(isProjectAllowed('XYZ')).toBe(false);
      expect(isProjectAllowed('IT')).toBe(false);
      expect(isProjectAllowed('CHAN')).toBe(false);
    });

    it('should be case-sensitive', () => {
      const mockYaml = `
projects:
  - BP
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
      expect(isProjectAllowed('bp')).toBe(false);
      expect(isProjectAllowed('Bp')).toBe(false);
    });
  });

  describe('isCommandAllowed', () => {
    it('should return true when "all" is in commands list', () => {
      const mockYaml = `
projects:
  - BP
commands:
  - all
`;
      mockFs.existsSync.mockImplementation((path) => {
        if (path === mockConfigDir) return true;
        if (path === mockSettingsPath) return true;
        return false;
      });
      mockFs.readFileSync.mockReturnValue(mockYaml);

      expect(isCommandAllowed('me')).toBe(true);
      expect(isCommandAllowed('projects')).toBe(true);
      expect(isCommandAllowed('task-with-details')).toBe(true);
    });

    it('should return true when command is in allowed list', () => {
      const mockYaml = `
projects:
  - BP
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

      expect(isCommandAllowed('me')).toBe(true);
      expect(isCommandAllowed('projects')).toBe(true);
    });

    it('should return false when command is not in allowed list', () => {
      const mockYaml = `
projects:
  - BP
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

      expect(isCommandAllowed('task-with-details')).toBe(false);
      expect(isCommandAllowed('project-statuses')).toBe(false);
    });
  });

  describe('getAllowedProjects', () => {
    it('should return list of allowed projects', () => {
      const mockYaml = `
projects:
  - BP
  - PM
  - PS
commands:
  - me
`;
      mockFs.existsSync.mockImplementation((path) => {
        if (path === mockConfigDir) return true;
        if (path === mockSettingsPath) return true;
        return false;
      });
      mockFs.readFileSync.mockReturnValue(mockYaml);

      const projects = getAllowedProjects();
      expect(projects).toEqual(['BP', 'PM', 'PS']);
    });

    it('should return ["all"] when all projects are allowed', () => {
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

      const projects = getAllowedProjects();
      expect(projects).toEqual(['all']);
    });
  });

  describe('getAllowedCommands', () => {
    it('should return list of allowed commands', () => {
      const mockYaml = `
projects:
  - BP
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

      const commands = getAllowedCommands();
      expect(commands).toEqual(['me', 'projects']);
    });

    it('should return ["all"] when all commands are allowed', () => {
      const mockYaml = `
projects:
  - BP
commands:
  - all
`;
      mockFs.existsSync.mockImplementation((path) => {
        if (path === mockConfigDir) return true;
        if (path === mockSettingsPath) return true;
        return false;
      });
      mockFs.readFileSync.mockReturnValue(mockYaml);

      const commands = getAllowedCommands();
      expect(commands).toEqual(['all']);
    });
  });

  describe('Settings caching', () => {
    it('should cache settings and not read file multiple times', () => {
      const mockYaml = `
projects:
  - BP
commands:
  - me
`;
      mockFs.existsSync.mockImplementation((path) => {
        if (path === mockConfigDir) return true;
        if (path === mockSettingsPath) return true;
        return false;
      });
      mockFs.readFileSync.mockReturnValue(mockYaml);

      // Call multiple times
      loadSettings();
      loadSettings();
      loadSettings();

      // Should only read file once due to caching
      expect(mockFs.readFileSync).toHaveBeenCalledTimes(1);
    });

    it('should migrate local settings.yaml if it exists', () => {
      mockFs.existsSync.mockImplementation((path) => {
        if (path === mockConfigDir) return true;
        if (path === mockSettingsPath) return false;
        if (path === mockLocalSettingsPath) return true;
        return false;
      });

      const mockYaml = 'projects: [MIGRATED]\ncommands: [all]';
      mockFs.readFileSync.mockReturnValue(mockYaml);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const settings = loadSettings();

      expect(settings.defaults?.['allowed-jira-projects']).toEqual(['MIGRATED']);
      expect(mockFs.readFileSync).toHaveBeenCalledWith(mockLocalSettingsPath, 'utf8');
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(mockSettingsPath, mockYaml);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle migration errors gracefully', () => {
      mockFs.existsSync.mockImplementation((path) => {
        if (path === mockConfigDir) return true;
        if (path === mockSettingsPath) return false;
        if (path === mockLocalSettingsPath) return true;
        return false;
      });

      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('Read error');
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      loadSettings();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Error migrating settings.yaml:'), expect.any(Error));
      consoleSpy.mockRestore();
    });

    it('should handle errors when creating default settings', () => {
      mockFs.existsSync.mockReturnValue(false); // Nothing exists
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('Write error');
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      loadSettings();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Error creating default settings.yaml:'), expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('Utility functions', () => {
    it('should return settings path', () => {
      expect(getSettingsPath()).toContain('.jira-ai/settings.yaml');
    });
  });
});
