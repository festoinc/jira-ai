import { vi, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, test } from 'vitest';
import * as settings from '../src/lib/settings.js';

// Mock all dependencies
vi.mock('../src/lib/settings.js');
vi.mock('../src/commands/me.js');
vi.mock('../src/commands/projects.js');
vi.mock('../src/commands/task-with-details.js');
vi.mock('../src/commands/project-statuses.js');
vi.mock('../src/commands/about.js');
vi.mock('../src/lib/utils', () => ({
  validateEnvVars: vi.fn()
}));
vi.mock('dotenv', () => ({
  config: vi.fn()
}));

const mockSettings = settings as vi.Mocked<typeof settings>;

describe('CLI Command Permissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    console.log = vi.fn();
    console.error = vi.fn();
  });

  describe('Command permission checks', () => {
    it('should allow execution when command is in allowed list', () => {
      mockSettings.isCommandAllowed.mockReturnValue(true);
      mockSettings.getAllowedCommands.mockReturnValue(['me', 'projects']);

      expect(mockSettings.isCommandAllowed('me')).toBe(true);
      expect(mockSettings.isCommandAllowed('projects')).toBe(true);
    });

    it('should deny execution when command is not in allowed list', () => {
      mockSettings.isCommandAllowed.mockImplementation((cmd: string) =>
        ['me', 'projects'].includes(cmd)
      );
      mockSettings.getAllowedCommands.mockReturnValue(['me', 'projects']);

      expect(mockSettings.isCommandAllowed('task-with-details')).toBe(false);
      expect(mockSettings.isCommandAllowed('project-statuses')).toBe(false);
    });

    it('should allow all commands when "all" is specified', () => {
      mockSettings.isCommandAllowed.mockReturnValue(true);
      mockSettings.getAllowedCommands.mockReturnValue(['all']);

      expect(mockSettings.isCommandAllowed('me')).toBe(true);
      expect(mockSettings.isCommandAllowed('projects')).toBe(true);
      expect(mockSettings.isCommandAllowed('task-with-details')).toBe(true);
      expect(mockSettings.isCommandAllowed('project-statuses')).toBe(true);
    });
  });

  describe('Permission wrapper behavior', () => {
    it('should execute command when permission is granted', async () => {
      mockSettings.isCommandAllowed.mockReturnValue(true);

      const mockCommand = vi.fn().mockResolvedValue(undefined);
      const wrappedCommand = async (...args: any[]) => {
        if (!mockSettings.isCommandAllowed('me')) {
          console.error('Command not allowed');
          process.exit(1);
        }
        return mockCommand(...args);
      };

      await wrappedCommand('arg1', 'arg2');

      expect(mockCommand).toHaveBeenCalledWith('arg1', 'arg2');
      expect(console.error).not.toHaveBeenCalled();
    });

    it('should block command execution when permission is denied', async () => {
      mockSettings.isCommandAllowed.mockReturnValue(false);
      mockSettings.getAllowedCommands.mockReturnValue(['me', 'projects']);

      const mockCommand = vi.fn().mockResolvedValue(undefined);
      const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('Process exit');
      });

      const wrappedCommand = async (...args: any[]) => {
        if (!mockSettings.isCommandAllowed('task-with-details')) {
          console.error("Command 'task-with-details' is not allowed.");
          console.log('Allowed commands: ' + mockSettings.getAllowedCommands().join(', '));
          process.exit(1);
        }
        return mockCommand(...args);
      };

      await expect(wrappedCommand()).rejects.toThrow('Process exit');

      expect(mockCommand).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('not allowed'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('me, projects'));
      expect(processExitSpy).toHaveBeenCalledWith(1);

      processExitSpy.mockRestore();
    });

    it('should pass arguments correctly to allowed commands', async () => {
      mockSettings.isCommandAllowed.mockReturnValue(true);

      const mockCommand = vi.fn().mockResolvedValue(undefined);
      const wrappedCommand = async (...args: any[]) => {
        if (!mockSettings.isCommandAllowed('task-with-details')) {
          process.exit(1);
        }
        return mockCommand(...args);
      };

      await wrappedCommand('BP-123');

      expect(mockCommand).toHaveBeenCalledWith('BP-123');
      expect(mockCommand).toHaveBeenCalledTimes(1);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle scenario: only me and projects allowed', () => {
      mockSettings.isCommandAllowed.mockImplementation((cmd: string) =>
        ['me', 'projects'].includes(cmd)
      );
      mockSettings.getAllowedCommands.mockReturnValue(['me', 'projects']);

      expect(mockSettings.isCommandAllowed('me')).toBe(true);
      expect(mockSettings.isCommandAllowed('projects')).toBe(true);
      expect(mockSettings.isCommandAllowed('task-with-details')).toBe(false);
      expect(mockSettings.isCommandAllowed('project-statuses')).toBe(false);
      expect(mockSettings.isCommandAllowed('about')).toBe(false);
    });

    it('should handle scenario: all commands allowed', () => {
      mockSettings.isCommandAllowed.mockReturnValue(true);
      mockSettings.getAllowedCommands.mockReturnValue(['all']);

      const commands = ['me', 'projects', 'task-with-details', 'project-statuses', 'about'];
      commands.forEach(cmd => {
        expect(mockSettings.isCommandAllowed(cmd)).toBe(true);
      });
    });

    it('should handle scenario: no commands allowed except about', () => {
      mockSettings.isCommandAllowed.mockImplementation((cmd: string) =>
        cmd === 'about'
      );
      mockSettings.getAllowedCommands.mockReturnValue([]);

      expect(mockSettings.isCommandAllowed('me')).toBe(false);
      expect(mockSettings.isCommandAllowed('projects')).toBe(false);
      expect(mockSettings.isCommandAllowed('about')).toBe(true);
    });
  });
});
