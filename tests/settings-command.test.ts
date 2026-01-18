import { vi, describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import * as settingsLib from '../src/lib/settings.js';
import { settingsCommand } from '../src/commands/settings.js';
import { ui } from '../src/lib/ui.js';
import * as jiraClient from '../src/lib/jira-client.js';
import yaml from 'js-yaml';

vi.mock('fs');
vi.mock('../src/lib/ui.js', () => ({
  ui: {
    startSpinner: vi.fn(),
    succeedSpinner: vi.fn(),
    failSpinner: vi.fn(),
    updateSpinner: vi.fn(),
  }
}));
vi.mock('../src/lib/jira-client.js');
vi.mock('../src/lib/utils.js', () => ({
  validateEnvVars: vi.fn(),
  getVersion: vi.fn().mockReturnValue('1.0.0'),
}));

const mockFs = fs as vi.Mocked<typeof fs>;

describe('Settings Command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    mockFs.writeFileSync.mockReset();
    mockFs.existsSync.mockReset();
    mockFs.readFileSync.mockReset();
    settingsLib.__resetCache__();
  });

  describe('saveSettings', () => {
    it('should save settings to file', () => {
      const settings: any = {
        defaults: {
          'allowed-jira-projects': ['PROJ'],
          'allowed-commands': ['me'],
          'allowed-confluence-spaces': ['all']
        }
      };

      settingsLib.saveSettings(settings);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('settings.yaml'),
        expect.stringContaining('allowed-jira-projects:\n    - PROJ')
      );
    });
  });

  describe('settingsCommand', () => {
    it('should display settings when no options provided', async () => {
      const mockSettings = {
        defaults: {
          'allowed-jira-projects': ['P1'],
          'allowed-commands': ['all'],
          'allowed-confluence-spaces': ['all']
        }
      };
      
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(yaml.dump(mockSettings));
      
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.spyOn(settingsLib, 'loadSettings').mockReturnValue(mockSettings as any);
      
      await settingsCommand({});
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Active Configuration'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('P1'));
    });

    it('should validate settings file', async () => {
      const validSettings = {
        projects: ['PROJ'],
        commands: ['all']
      };
      
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(yaml.dump(validSettings));
      (jiraClient.getProjects as any).mockResolvedValue([{ key: 'PROJ' }]);
      
      await settingsCommand({ validate: 'valid.yaml' });
      
      expect(ui.succeedSpinner).toHaveBeenCalledWith(expect.stringContaining('Settings are valid!'));
    });

    it('should fail validation if project not found in Jira', async () => {
      const validSettings = {
        projects: ['NONEXISTENT'],
        commands: ['all']
      };
      
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(yaml.dump(validSettings));
      (jiraClient.getProjects as any).mockResolvedValue([{ key: 'PROJ' }]);
      
      await expect(settingsCommand({ validate: 'invalid.yaml' }))
        .rejects.toThrow('Project "NONEXISTENT" (in defaults) not found in Jira.');
      
      expect(ui.failSpinner).toHaveBeenCalledWith(expect.stringContaining('Deep validation failed'));
    });

    it('should handle projects defined as objects with key', async () => {
      const validSettings = {
        projects: [{ key: 'PROJ' }],
        commands: ['all']
      };
      
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(yaml.dump(validSettings));
      (jiraClient.getProjects as any).mockResolvedValue([{ key: 'PROJ' }]);
      
      await settingsCommand({ validate: 'valid.yaml' });
      
      expect(ui.succeedSpinner).toHaveBeenCalledWith(expect.stringContaining('Settings are valid!'));
    });

    it('should skip validation for project "all"', async () => {
      const settings = {
        projects: ['all'],
        commands: ['all']
      };
      
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(yaml.dump(settings));
      (jiraClient.getProjects as any).mockResolvedValue([{ key: 'PROJ' }]);
      
      await settingsCommand({ validate: 'valid.yaml' });
      
      expect(ui.succeedSpinner).toHaveBeenCalledWith(expect.stringContaining('Settings are valid!'));
    });

    it('should fail validation if file does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);
      await expect(settingsCommand({ validate: 'nonexistent.yaml' }))
        .rejects.toThrow('File not found: nonexistent.yaml');
      expect(ui.failSpinner).toHaveBeenCalledWith(expect.stringContaining('File not found'));
    });

    it('should fail validation if YAML is invalid', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('invalid: [yaml');
      await expect(settingsCommand({ validate: 'invalid.yaml' }))
        .rejects.toThrow('Error parsing YAML in invalid.yaml');
      expect(ui.failSpinner).toHaveBeenCalledWith(expect.stringContaining('Error parsing YAML'));
    });

    it('should handle non-Error objects in YAML parsing error', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation(() => { throw 'string error'; });
      await expect(settingsCommand({ validate: 'invalid.yaml' }))
        .rejects.toThrow('Error parsing YAML in invalid.yaml');
      expect(ui.failSpinner).toHaveBeenCalledWith(expect.stringContaining('Error parsing YAML: string error'));
    });

    it('should handle non-Error objects in deep validation error', async () => {
      const validSettings = { projects: ['PROJ'], commands: ['all'] };
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(yaml.dump(validSettings));
      (jiraClient.getProjects as any).mockRejectedValue('string connection error');
      
      await expect(settingsCommand({ validate: 'valid.yaml' }))
        .rejects.toThrow('Failed to connect to Jira for validation: string connection error');
      expect(ui.failSpinner).toHaveBeenCalledWith(expect.stringContaining('Deep validation failed: string connection error'));
    });

    it('should fail validation if schema is invalid', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(yaml.dump({ projects: 'not-an-array' }));
      await expect(settingsCommand({ validate: 'invalid.yaml' }))
        .rejects.toThrow('Invalid settings structure');
      expect(ui.failSpinner).toHaveBeenCalledWith('Schema validation failed');
    });

    it('should fail validation if Jira connection fails', async () => {
      const validSettings = { projects: ['PROJ'], commands: ['all'] };
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(yaml.dump(validSettings));
      (jiraClient.getProjects as any).mockRejectedValue(new Error('Connection error'));
      
      await expect(settingsCommand({ validate: 'valid.yaml' }))
        .rejects.toThrow('Failed to connect to Jira for validation: Connection error');
      expect(ui.failSpinner).toHaveBeenCalledWith(expect.stringContaining('Deep validation failed: Connection error'));
    });

    it('should apply settings from file', async () => {
      const validSettings = {
        projects: ['PROJ'],
        commands: ['all']
      };
      
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(yaml.dump(validSettings));
      (jiraClient.getProjects as any).mockResolvedValue([{ key: 'PROJ' }]);
      
      await settingsCommand({ apply: 'new-settings.yaml' });
      
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('settings.yaml'),
        expect.stringContaining('PROJ')
      );
      expect(ui.succeedSpinner).toHaveBeenCalledWith(expect.stringContaining('Settings applied successfully!'));
    });

    it('should fail applying settings if save fails', async () => {
      const validSettings = { projects: ['PROJ'], commands: ['all'] };
      
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(yaml.dump(validSettings));
      (jiraClient.getProjects as any).mockResolvedValue([{ key: 'PROJ' }]);
      mockFs.writeFileSync.mockImplementation((path: any) => {
        if (path.toString().endsWith('settings.yaml')) {
          throw new Error('Write failed');
        }
      });

      await expect(settingsCommand({ apply: 'new-settings.yaml' }))
        .rejects.toThrow('Write failed');
      expect(ui.failSpinner).toHaveBeenCalledWith(expect.stringContaining('Write failed'));
    });

    it('should handle non-Error objects in apply settings error', async () => {
      const validSettings = { projects: ['PROJ'], commands: ['all'] };
      
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(yaml.dump(validSettings));
      (jiraClient.getProjects as any).mockResolvedValue([{ key: 'PROJ' }]);
      vi.spyOn(settingsLib, 'saveSettings').mockImplementation(() => {
        throw 'string write error';
      });

      await expect(settingsCommand({ apply: 'new-settings.yaml' }))
        .rejects.toBe('string write error');
      expect(ui.failSpinner).toHaveBeenCalledWith(expect.stringContaining('Error applying settings: string write error'));
    });

    it('should reset settings to default', async () => {
      await settingsCommand({ reset: true });

      expect(ui.startSpinner).toHaveBeenCalledWith(expect.stringContaining('Resetting settings'));
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('settings.yaml'),
        expect.stringContaining('allowed-jira-projects:\n    - all')
      );
      expect(ui.succeedSpinner).toHaveBeenCalledWith(expect.stringContaining('Settings reset to default successfully!'));
    });

    it('should handle errors when resetting settings', async () => {
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('Reset failed');
      });

      await expect(settingsCommand({ reset: true }))
        .rejects.toThrow('Reset failed');
      expect(ui.failSpinner).toHaveBeenCalledWith(expect.stringContaining('Error saving'));
      expect(ui.failSpinner).toHaveBeenCalledWith(expect.stringContaining('Reset failed'));
    });
  });
});
