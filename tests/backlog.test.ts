import { vi, describe, it, expect, beforeEach } from 'vitest';
import { backlogMoveCommand } from '../src/commands/backlog.js';
import * as agileClient from '../src/lib/agile-client.js';
import * as settings from '../src/lib/settings.js';

vi.mock('../src/lib/agile-client.js');
vi.mock('../src/lib/settings.js');
vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
  })),
}));

const mockAgileClient = agileClient as vi.Mocked<typeof agileClient>;
const mockSettings = settings as vi.Mocked<typeof settings>;

describe('Backlog Commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    console.log = vi.fn();
    console.error = vi.fn();
    mockSettings.isCommandAllowed.mockReturnValue(true);
  });

  describe('backlogMoveCommand', () => {
    it('should move issues to backlog', async () => {
      mockAgileClient.moveIssuesToBacklog.mockResolvedValue(undefined);

      await backlogMoveCommand({ issues: ['GP-1', 'GP-2'] });

      expect(mockAgileClient.moveIssuesToBacklog).toHaveBeenCalledWith(['GP-1', 'GP-2']);
      expect(console.log).toHaveBeenCalled();
    });

    it('should move a single issue to backlog', async () => {
      mockAgileClient.moveIssuesToBacklog.mockResolvedValue(undefined);

      await backlogMoveCommand({ issues: ['GP-5'] });

      expect(mockAgileClient.moveIssuesToBacklog).toHaveBeenCalledWith(['GP-5']);
    });

    it('should throw when issues list is empty', async () => {
      await expect(backlogMoveCommand({ issues: [] })).rejects.toThrow();
    });

    it('should throw when more than 50 issues are provided', async () => {
      const issues = Array.from({ length: 51 }, (_, i) => `GP-${i + 1}`);

      await expect(backlogMoveCommand({ issues })).rejects.toThrow('50');
    });

    it('should throw when issues is not provided', async () => {
      await expect(
        backlogMoveCommand({ issues: undefined as unknown as string[] })
      ).rejects.toThrow();
    });

    it('should deny execution when board.backlog permission is not granted', async () => {
      mockSettings.isCommandAllowed.mockReturnValue(false);

      await expect(backlogMoveCommand({ issues: ['GP-1'] })).rejects.toThrow();
    });

    it('should display success message with issue count', async () => {
      mockAgileClient.moveIssuesToBacklog.mockResolvedValue(undefined);

      await backlogMoveCommand({ issues: ['GP-1', 'GP-2', 'GP-3'] });

      expect(console.log).toHaveBeenCalled();
    });
  });
});
