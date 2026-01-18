import { vi, describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { 
  loadSettings, 
  isProjectAllowed, 
  isCommandAllowed, 
  isConfluenceSpaceAllowed,
  __resetCache__ 
} from '../src/lib/settings.js';
import * as authStorage from '../src/lib/auth-storage.js';

// Mock fs module
vi.mock('fs');
const mockFs = fs as vi.Mocked<typeof fs>;

// Mock auth-storage
vi.mock('../src/lib/auth-storage.js', async () => {
  const actual = await vi.importActual('../src/lib/auth-storage.js') as any;
  return {
    ...actual,
    getCurrentOrganizationAlias: vi.fn(),
  };
});

describe('Multi-Organization Settings', () => {
  const mockConfigDir = path.join(os.homedir(), '.jira-ai');
  const mockSettingsPath = path.join(mockConfigDir, 'settings.yaml');

  beforeEach(() => {
    vi.clearAllMocks();
    __resetCache__();
    vi.mocked(authStorage.getCurrentOrganizationAlias).mockReturnValue('my-org');
  });

  describe('Organization-based Filtering', () => {
    it('should use organization specific settings when available', () => {
      const mockYaml = `
organizations:
  my-org:
    allowed-jira-projects: ["PROJ-A"]
    allowed-commands: ["me"]
    allowed-confluence-spaces: ["SPACE-A"]
`;
      mockFs.existsSync.mockImplementation((path) => {
        if (path === mockConfigDir || path === mockSettingsPath) return true;
        return false;
      });
      mockFs.readFileSync.mockReturnValue(mockYaml);

      expect(isProjectAllowed('PROJ-A')).toBe(true);
      expect(isProjectAllowed('PROJ-B')).toBe(false);
      expect(isCommandAllowed('me')).toBe(true);
      expect(isCommandAllowed('projects')).toBe(false);
      // expect(isConfluenceSpaceAllowed('SPACE-A')).toBe(true);
      // expect(isConfluenceSpaceAllowed('SPACE-B')).toBe(false);
    });

    it('should fall back to defaults when organization is not listed', () => {
      vi.mocked(authStorage.getCurrentOrganizationAlias).mockReturnValue('other-org');
      const mockYaml = `
defaults:
  allowed-jira-projects: ["PROJ-DEFAULT"]
  allowed-commands: ["projects"]
  allowed-confluence-spaces: ["SPACE-DEFAULT"]
organizations:
  my-org:
    allowed-jira-projects: ["PROJ-A"]
`;
      mockFs.existsSync.mockImplementation((path) => {
        if (path === mockConfigDir || path === mockSettingsPath) return true;
        return false;
      });
      mockFs.readFileSync.mockReturnValue(mockYaml);

      expect(isProjectAllowed('PROJ-DEFAULT')).toBe(true);
      expect(isProjectAllowed('PROJ-A')).toBe(false);
      expect(isCommandAllowed('projects')).toBe(true);
      expect(isCommandAllowed('me')).toBe(false);
    });

    it('should deny access if organization not listed and no defaults', () => {
      vi.mocked(authStorage.getCurrentOrganizationAlias).mockReturnValue('unknown-org');
      const mockYaml = `
organizations:
  my-org:
    allowed-jira-projects: ["PROJ-A"]
`;
      mockFs.existsSync.mockImplementation((path) => {
        if (path === mockConfigDir || path === mockSettingsPath) return true;
        return false;
      });
      mockFs.readFileSync.mockReturnValue(mockYaml);

      expect(isProjectAllowed('PROJ-A')).toBe(false);
      expect(isCommandAllowed('me')).toBe(false);
    });
  });

  describe('Migration', () => {
    it('should migrate old structure to defaults', () => {
      const mockYaml = `
projects:
  - OLD-PROJ
commands:
  - old-cmd
`;
      mockFs.existsSync.mockImplementation((path) => {
        if (path === mockConfigDir || path === mockSettingsPath) return true;
        return false;
      });
      mockFs.readFileSync.mockReturnValue(mockYaml);

      const settings = loadSettings();
      expect(settings.defaults).toBeDefined();
      expect(settings.defaults?.['allowed-jira-projects']).toContain('OLD-PROJ');
      expect(settings.defaults?.['allowed-commands']).toContain('old-cmd');
    });
  });

  describe('Project-Specific Commands', () => {
    it('should support commands defined within project config', () => {
      const mockYaml = `
organizations:
  my-org:
    allowed-jira-projects:
      - key: "PROJ-X"
        commands: ["list-colleagues"]
`;
      mockFs.existsSync.mockImplementation((path) => {
        if (path === mockConfigDir || path === mockSettingsPath) return true;
        return false;
      });
      mockFs.readFileSync.mockReturnValue(mockYaml);

      expect(isCommandAllowed('list-colleagues', 'PROJ-X')).toBe(true);
      expect(isCommandAllowed('me', 'PROJ-X')).toBe(false);
    });
  });
});
