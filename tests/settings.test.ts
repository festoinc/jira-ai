import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  loadSettings,
  isProjectAllowed,
  isCommandAllowed,
  getAllowedProjects,
  getAllowedCommands,
  __resetCache__
} from '../src/lib/settings';

// Mock fs module
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('Settings Module', () => {
  const mockConfigDir = path.join(os.homedir(), '.jira-ai');
  const mockSettingsPath = path.join(mockConfigDir, 'settings.yaml');
  const mockLocalSettingsPath = path.join(process.cwd(), 'settings.yaml');

  beforeEach(() => {
    jest.clearAllMocks();
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

      expect(settings.projects).toEqual(['BP', 'PM', 'PS']);
      expect(settings.commands).toEqual(['me', 'projects']);
      expect(mockFs.readFileSync).toHaveBeenCalledWith(mockSettingsPath, 'utf8');
    });

    it('should return default settings when file does not exist', () => {
      // Mock that neither config dir nor settings files exist
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockReturnValue(undefined);
      mockFs.writeFileSync.mockReturnValue(undefined);

      const settings = loadSettings();

      expect(settings.projects).toEqual(['all']);
      expect(settings.commands).toEqual(['all']);
      // Should create the config directory
      expect(mockFs.mkdirSync).toHaveBeenCalledWith(mockConfigDir, { recursive: true });
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

      expect(settings.projects).toEqual(['all']);
      expect(settings.commands).toEqual(['all']);
    });

    it('should exit process on invalid YAML', () => {
      mockFs.existsSync.mockImplementation((path) => {
        if (path === mockConfigDir) return true;
        if (path === mockSettingsPath) return true;
        return false;
      });
      mockFs.readFileSync.mockReturnValue('invalid: yaml: content:');

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('Process exit');
      });

      expect(() => loadSettings()).toThrow('Process exit');
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(1);

      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
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
  });
});
