import { vi, describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import yaml from 'js-yaml';
import * as settingsLib from '../src/lib/settings.js';

vi.mock('fs');
vi.mock('../src/lib/jira-client.js');
vi.mock('../src/lib/utils.js', () => ({
  validateEnvVars: vi.fn(),
  getVersion: vi.fn().mockReturnValue('1.0.0'),
}));

const mockFs = fs as vi.Mocked<typeof fs>;

describe('Presets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    settingsLib.__resetCache__();
  });

  describe('PRESETS record', () => {
    it('should export PRESETS with read-only, standard, my-tasks, and yolo presets', async () => {
      const { PRESETS } = await import('../src/lib/presets.js');
      expect(PRESETS).toHaveProperty('read-only');
      expect(PRESETS).toHaveProperty('standard');
      expect(PRESETS).toHaveProperty('my-tasks');
      expect(PRESETS).toHaveProperty('yolo');
    });

    it('all preset definitions should have valid commands (non-empty)', async () => {
      const { PRESETS } = await import('../src/lib/presets.js');
      for (const [name, preset] of Object.entries(PRESETS)) {
        expect(preset.defaults['allowed-commands'].length, `${name} should have commands`).toBeGreaterThan(0);
        expect(preset.defaults['allowed-jira-projects'].length, `${name} should have projects`).toBeGreaterThan(0);
        expect(preset.defaults['allowed-confluence-spaces'].length, `${name} should have confluence spaces`).toBeGreaterThan(0);
      }
    });

    it('read-only preset should not include write commands', async () => {
      const { PRESETS } = await import('../src/lib/presets.js');
      const readOnly = PRESETS['read-only'];
      const commands = readOnly.defaults['allowed-commands'];
      expect(commands).not.toContain('all');
      expect(commands).not.toContain('issue.create');
      expect(commands).not.toContain('issue.update');
      expect(commands).not.toContain('issue.transition');
    });

    it('yolo preset should allow all commands', async () => {
      const { PRESETS } = await import('../src/lib/presets.js');
      const yolo = PRESETS['yolo'];
      expect(yolo.defaults['allowed-commands']).toContain('all');
    });

    it('my-tasks preset should have globalParticipationFilter', async () => {
      const { PRESETS } = await import('../src/lib/presets.js');
      const myTasks = PRESETS['my-tasks'];
      expect(myTasks.globalParticipationFilter).toBeDefined();
      expect(myTasks.globalParticipationFilter?.was_assignee).toBe(true);
      expect(myTasks.globalParticipationFilter?.was_reporter).toBe(true);
      expect(myTasks.globalParticipationFilter?.was_commenter).toBe(true);
      expect(myTasks.globalParticipationFilter?.is_watcher).toBe(true);
    });
  });

  describe('getPreset()', () => {
    it('should return correct preset for known name', async () => {
      const { getPreset, PRESETS } = await import('../src/lib/presets.js');
      const preset = getPreset('read-only');
      expect(preset).toEqual(PRESETS['read-only']);
    });

    it('should return correct preset for standard', async () => {
      const { getPreset, PRESETS } = await import('../src/lib/presets.js');
      const preset = getPreset('standard');
      expect(preset).toEqual(PRESETS['standard']);
    });

    it('should throw for unknown preset name', async () => {
      const { getPreset } = await import('../src/lib/presets.js');
      expect(() => getPreset('nonexistent')).toThrow(/unknown preset/i);
    });

    it('should throw with available preset names for unknown name', async () => {
      const { getPreset } = await import('../src/lib/presets.js');
      expect(() => getPreset('bad-name')).toThrow(/read-only|standard|my-tasks|yolo/i);
    });
  });

  describe('listPresets()', () => {
    it('should return an object with all preset names as keys', async () => {
      const { listPresets } = await import('../src/lib/presets.js');
      const result = listPresets();
      expect(result).toHaveProperty('read-only');
      expect(result).toHaveProperty('standard');
      expect(result).toHaveProperty('my-tasks');
      expect(result).toHaveProperty('yolo');
    });

    it('each entry should contain description and allowed-commands', async () => {
      const { listPresets } = await import('../src/lib/presets.js');
      const result = listPresets();
      for (const [, entry] of Object.entries(result)) {
        expect(entry).toHaveProperty('description');
        expect(entry).toHaveProperty('allowed-commands');
        expect(entry).toHaveProperty('allowed-jira-projects');
        expect(entry).toHaveProperty('allowed-confluence-spaces');
      }
    });

    it('my-tasks entry should include globalParticipationFilter', async () => {
      const { listPresets } = await import('../src/lib/presets.js');
      const result = listPresets();
      expect(result['my-tasks']).toHaveProperty('globalParticipationFilter');
      expect(result['my-tasks'].globalParticipationFilter?.was_assignee).toBe(true);
    });

    it('presets without globalParticipationFilter should not include the field', async () => {
      const { listPresets } = await import('../src/lib/presets.js');
      const result = listPresets();
      expect(result['read-only']).not.toHaveProperty('globalParticipationFilter');
      expect(result['standard']).not.toHaveProperty('globalParticipationFilter');
      expect(result['yolo']).not.toHaveProperty('globalParticipationFilter');
    });
  });

  describe('detectPreset()', () => {
    it('should detect exact preset match', async () => {
      const { detectPreset, PRESETS } = await import('../src/lib/presets.js');
      const settings = PRESETS['read-only'].defaults;
      const result = detectPreset(settings);
      expect(result.current).toBe('read-only');
    });

    it('should detect yolo preset', async () => {
      const { detectPreset, PRESETS } = await import('../src/lib/presets.js');
      const settings = PRESETS['yolo'].defaults;
      const result = detectPreset(settings);
      expect(result.current).toBe('yolo');
    });

    it('should return custom for non-matching settings', async () => {
      const { detectPreset } = await import('../src/lib/presets.js');
      const customSettings = {
        'allowed-jira-projects': ['MYPROJ'],
        'allowed-commands': ['issue.get'],
        'allowed-confluence-spaces': ['all'],
      };
      const result = detectPreset(customSettings);
      expect(result.current).toBe('custom');
    });

    it('should include closestMatch and differences for custom', async () => {
      const { detectPreset } = await import('../src/lib/presets.js');
      const customSettings = {
        'allowed-jira-projects': ['all'],
        'allowed-commands': ['issue.get', 'issue.link.delete'],
        'allowed-confluence-spaces': ['all'],
      };
      const result = detectPreset(customSettings);
      expect(result.current).toBe('custom');
      expect(result).toHaveProperty('description');
    });

    it('should not match my-tasks when globalParticipationFilter is absent', async () => {
      const { detectPreset, PRESETS } = await import('../src/lib/presets.js');
      // Use my-tasks commands but omit globalParticipationFilter
      const settingsWithoutFilter = {
        ...PRESETS['my-tasks'].defaults,
        // no globalParticipationFilter
      };
      const result = detectPreset(settingsWithoutFilter);
      expect(result.current).not.toBe('my-tasks');
    });

    it('should match my-tasks when globalParticipationFilter is present and correct', async () => {
      const { detectPreset, PRESETS } = await import('../src/lib/presets.js');
      const preset = PRESETS['my-tasks'];
      const settings = {
        ...preset.defaults,
        globalParticipationFilter: preset.globalParticipationFilter,
      };
      const result = detectPreset(settings);
      expect(result.current).toBe('my-tasks');
    });

    it('should not match my-tasks when globalParticipationFilter differs from preset', async () => {
      const { detectPreset, PRESETS } = await import('../src/lib/presets.js');
      const settings = {
        ...PRESETS['my-tasks'].defaults,
        globalParticipationFilter: { was_assignee: true, was_reporter: false, was_commenter: false, is_watcher: false },
      };
      const result = detectPreset(settings);
      expect(result.current).not.toBe('my-tasks');
    });
  });

  describe('my-tasks globalParticipationFilter in validateIssueAgainstFilters()', () => {
    it('should apply global participation filter when globalParticipationFilter is set', async () => {
      const mockSettings = {
        defaults: {
          'allowed-jira-projects': ['all'],
          'allowed-commands': ['all'],
          'allowed-confluence-spaces': ['all'],
          globalParticipationFilter: {
            was_assignee: true,
            was_reporter: true,
            was_commenter: true,
            is_watcher: true,
          },
        },
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(yaml.dump(mockSettings));

      const currentUserId = 'user123';
      const issueWithUser = {
        key: 'PROJ-1',
        assignee: { accountId: 'user123' },
        reporter: { accountId: 'other' },
        comments: [],
        watchers: [],
      };

      const result = settingsLib.validateIssueAgainstFilters(issueWithUser, currentUserId);
      expect(result).toBe(true);
    });

    it('should deny issue when user has not participated and globalParticipationFilter is set', async () => {
      const mockSettings = {
        defaults: {
          'allowed-jira-projects': ['all'],
          'allowed-commands': ['all'],
          'allowed-confluence-spaces': ['all'],
          globalParticipationFilter: {
            was_assignee: true,
            was_reporter: true,
            was_commenter: true,
            is_watcher: true,
          },
        },
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(yaml.dump(mockSettings));

      const currentUserId = 'user123';
      const issueNoParticipation = {
        key: 'PROJ-1',
        assignee: { accountId: 'other-user' },
        reporter: { accountId: 'other-user2' },
        comments: [{ author: { accountId: 'other-user3' } }],
        watchers: [],
      };

      const result = settingsLib.validateIssueAgainstFilters(issueNoParticipation, currentUserId);
      expect(result).toBe(false);
    });

    it('should not apply global filter when project has explicit string match (not all)', async () => {
      const mockSettings = {
        defaults: {
          'allowed-jira-projects': ['PROJ'],
          'allowed-commands': ['all'],
          'allowed-confluence-spaces': ['all'],
          globalParticipationFilter: {
            was_assignee: true,
          },
        },
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(yaml.dump(mockSettings));

      const currentUserId = 'user123';
      const issueNoParticipation = {
        key: 'PROJ-1',
        assignee: { accountId: 'other' },
        reporter: { accountId: 'other2' },
        comments: [],
        watchers: [],
      };

      // When project is explicitly listed (not 'all'), it's just a string match — no participation filter
      const result = settingsLib.validateIssueAgainstFilters(issueNoParticipation, currentUserId);
      expect(result).toBe(true);
    });
  });

  describe('settingsCommand --preset flag', () => {
    it('should apply preset settings and preserve saved-queries', async () => {
      const { settingsCommand } = await import('../src/commands/settings.js');

      const existingSettings = {
        defaults: {
          'allowed-jira-projects': ['MYPROJ'],
          'allowed-commands': ['issue.get'],
          'allowed-confluence-spaces': ['all'],
        },
        savedQueries: {
          'my-query': 'project = MYPROJ',
        },
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(yaml.dump(existingSettings));

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await settingsCommand({ preset: 'read-only' });

      expect(mockFs.writeFileSync).toHaveBeenCalled();
      const writeCall = mockFs.writeFileSync.mock.calls.find(
        (c: any) => c[0].toString().includes('settings.yaml')
      );
      expect(writeCall).toBeDefined();
      const writtenYaml = yaml.load(writeCall![1] as string) as any;
      // savedQueries should be preserved
      expect(writtenYaml.savedQueries?.['my-query']).toBe('project = MYPROJ');
      // preset defaults should be applied
      expect(writtenYaml.defaults?.['allowed-commands']).not.toContain('issue.create');

      const output = consoleSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.success).toBe(true);
      expect(parsed.preset).toBe('read-only');
    });

    it('should throw for unknown preset name', async () => {
      const { settingsCommand } = await import('../src/commands/settings.js');

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(yaml.dump({ defaults: { 'allowed-jira-projects': ['all'], 'allowed-commands': ['all'], 'allowed-confluence-spaces': ['all'] } }));

      await expect(settingsCommand({ preset: 'nonexistent-preset' })).rejects.toThrow();
    });
  });

  describe('settingsCommand --list-presets flag', () => {
    it('should output all preset details', async () => {
      const { settingsCommand } = await import('../src/commands/settings.js');

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await settingsCommand({ listPresets: true });

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.presets).toHaveProperty('read-only');
      expect(parsed.presets).toHaveProperty('standard');
      expect(parsed.presets).toHaveProperty('my-tasks');
      expect(parsed.presets).toHaveProperty('yolo');
    });
  });

  describe('settingsCommand --detect-preset flag', () => {
    it('should detect and output current preset name', async () => {
      const { settingsCommand } = await import('../src/commands/settings.js');
      const { PRESETS } = await import('../src/lib/presets.js');

      const yoloSettings = {
        defaults: PRESETS['yolo'].defaults,
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(yaml.dump(yoloSettings));

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await settingsCommand({ detectPreset: true });

      const output = consoleSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.current).toBe('yolo');
    });
  });

  describe('mutual exclusion of --preset, --list-presets, --detect-preset', () => {
    it('should throw when --preset and --list-presets are used together', async () => {
      const { settingsCommand } = await import('../src/commands/settings.js');
      await expect(settingsCommand({ preset: 'read-only', listPresets: true })).rejects.toThrow(/mutually exclusive/i);
    });

    it('should throw when --preset and --detect-preset are used together', async () => {
      const { settingsCommand } = await import('../src/commands/settings.js');
      await expect(settingsCommand({ preset: 'read-only', detectPreset: true })).rejects.toThrow(/mutually exclusive/i);
    });

    it('should throw when --list-presets and --detect-preset are used together', async () => {
      const { settingsCommand } = await import('../src/commands/settings.js');
      await expect(settingsCommand({ listPresets: true, detectPreset: true })).rejects.toThrow(/mutually exclusive/i);
    });

    it('should throw when --preset and --reset are used together', async () => {
      const { settingsCommand } = await import('../src/commands/settings.js');
      await expect(settingsCommand({ preset: 'read-only', reset: true })).rejects.toThrow(/mutually exclusive/i);
    });
  });
});
