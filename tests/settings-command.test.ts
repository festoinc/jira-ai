import { vi, describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import { saveSettings, loadSettings, __resetCache__ } from '../src/lib/settings.js';
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
    __resetCache__();
  });

  describe('saveSettings', () => {
    it('should save settings to file', () => {
      const settings = {
        projects: ['PROJ'],
        commands: ['me']
      };

      saveSettings(settings);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('settings.yaml'),
        expect.stringContaining('projects:\n  - PROJ')
      );
    });
  });

  describe('settingsCommand', () => {
    it('should display settings when no options provided', async () => {
      const mockSettings = {
        projects: ['P1'],
        commands: ['all']
      };
      
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(yaml.dump(mockSettings));
      
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
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
        .rejects.toThrow('Project "NONEXISTENT" not found in Jira.');
      
      expect(ui.failSpinner).toHaveBeenCalledWith(expect.stringContaining('Deep validation failed'));
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
  });
});
