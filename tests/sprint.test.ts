import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  sprintListCommand,
  sprintGetCommand,
  sprintCreateCommand,
  sprintStartCommand,
  sprintCompleteCommand,
  sprintUpdateCommand,
  sprintDeleteCommand,
  sprintIssuesCommand,
  sprintMoveCommand,
} from '../src/commands/sprint.js';
import * as agileClient from '../src/lib/agile-client.js';
import * as settings from '../src/lib/settings.js';
import { CommandError } from '../src/lib/errors.js';

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

const mockSprintActive = {
  id: 42,
  name: 'Sprint 1',
  state: 'active',
  startDate: '2026-03-20',
  endDate: '2026-04-03',
  goal: 'Complete auth feature',
  originBoardId: 36,
};

const mockSprintFuture = {
  id: 43,
  name: 'Sprint 2',
  state: 'future',
  startDate: '2026-04-07',
  endDate: '2026-04-21',
  originBoardId: 36,
};

describe('Sprint Commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    console.log = vi.fn();
    console.error = vi.fn();
    mockSettings.isCommandAllowed.mockReturnValue(true);
  });

  describe('sprintListCommand', () => {
    it('should list sprints for a board', async () => {
      mockAgileClient.getSprints.mockResolvedValue({
        values: [mockSprintActive, mockSprintFuture],
      });

      await sprintListCommand(36);

      expect(mockAgileClient.getSprints).toHaveBeenCalledWith(
        36,
        expect.anything()
      );
      expect(console.log).toHaveBeenCalled();
    });

    it('should filter by state when provided', async () => {
      mockAgileClient.getSprints.mockResolvedValue({ values: [mockSprintActive] });

      await sprintListCommand(36, { state: 'active' });

      expect(mockAgileClient.getSprints).toHaveBeenCalledWith(
        36,
        expect.objectContaining({ state: 'active' })
      );
    });

    it('should show message when no sprints found', async () => {
      mockAgileClient.getSprints.mockResolvedValue({ values: [] });

      await sprintListCommand(36);

      const output = (console.log as vi.Mock).mock.calls[0]?.[0];
      const parsed = JSON.parse(output);
      expect(parsed).toEqual({ sprints: [], total: 0 });
    });

    it('should show error when board does not support sprints', async () => {
      mockAgileClient.getSprints.mockRejectedValue(
        new CommandError('This board does not support sprints. Sprint operations require a Scrum board.')
      );

      await expect(sprintListCommand(36)).rejects.toThrow(
        'does not support sprints'
      );
    });

    it('should deny execution when sprint.list permission is not granted', async () => {
      mockSettings.isCommandAllowed.mockReturnValue(false);

      await expect(sprintListCommand(36)).rejects.toThrow();
    });
  });

  describe('sprintGetCommand', () => {
    it('should get sprint details by ID', async () => {
      mockAgileClient.getSprint.mockResolvedValue(mockSprintActive);

      await sprintGetCommand(42);

      expect(mockAgileClient.getSprint).toHaveBeenCalledWith(42);
      expect(console.log).toHaveBeenCalled();
    });

    it('should display sprint details including dates and goal', async () => {
      mockAgileClient.getSprint.mockResolvedValue(mockSprintActive);

      await sprintGetCommand(42);

      const output = (console.log as vi.Mock).mock.calls.flat().join('\n');
      expect(output).toContain('Sprint 1');
    });

    it('should throw when sprintId is missing', async () => {
      await expect(sprintGetCommand(undefined as unknown as number)).rejects.toThrow();
    });

    it('should deny execution when sprint.get permission is not granted', async () => {
      mockSettings.isCommandAllowed.mockReturnValue(false);

      await expect(sprintGetCommand(42)).rejects.toThrow();
    });
  });

  describe('sprintCreateCommand', () => {
    it('should create a sprint with required fields', async () => {
      mockAgileClient.createSprint.mockResolvedValue({ id: 44, name: 'Sprint 3', state: 'future' });

      await sprintCreateCommand(36, 'Sprint 3');

      expect(mockAgileClient.createSprint).toHaveBeenCalledWith(
        36,
        'Sprint 3',
        expect.anything()
      );
      expect(console.log).toHaveBeenCalled();
    });

    it('should create a sprint with optional fields', async () => {
      mockAgileClient.createSprint.mockResolvedValue({ id: 44 });

      await sprintCreateCommand(36, 'Sprint 3', {
        goal: 'Build reporting',
        start: '2026-04-15',
        end: '2026-04-28',
      });

      expect(mockAgileClient.createSprint).toHaveBeenCalledWith(
        36,
        'Sprint 3',
        expect.objectContaining({
          goal: 'Build reporting',
          startDate: '2026-04-15',
          endDate: '2026-04-28',
        })
      );
    });

    it('should throw when boardId is missing', async () => {
      await expect(
        sprintCreateCommand(undefined as unknown as number, 'Sprint 3')
      ).rejects.toThrow();
    });

    it('should throw when name is missing', async () => {
      await expect(sprintCreateCommand(36, '')).rejects.toThrow();
    });

    it('should deny execution when sprint.create permission is not granted', async () => {
      mockSettings.isCommandAllowed.mockReturnValue(false);

      await expect(sprintCreateCommand(36, 'Sprint 3')).rejects.toThrow();
    });
  });

  describe('sprintStartCommand', () => {
    it('should start a future sprint', async () => {
      mockAgileClient.getSprint.mockResolvedValue(mockSprintFuture);
      mockAgileClient.startSprint.mockResolvedValue(undefined);

      await sprintStartCommand(43);

      expect(mockAgileClient.getSprint).toHaveBeenCalledWith(43);
      expect(mockAgileClient.startSprint).toHaveBeenCalledWith(43);
      expect(console.log).toHaveBeenCalled();
    });

    it('should throw when trying to start a non-future sprint', async () => {
      mockAgileClient.getSprint.mockResolvedValue(mockSprintActive);

      await expect(sprintStartCommand(42)).rejects.toThrow("Cannot start sprint in state 'active'");
    });

    it('should deny execution when sprint.start permission is not granted', async () => {
      mockSettings.isCommandAllowed.mockReturnValue(false);

      await expect(sprintStartCommand(43)).rejects.toThrow();
    });
  });

  describe('sprintCompleteCommand', () => {
    it('should complete an active sprint', async () => {
      mockAgileClient.getSprint.mockResolvedValue(mockSprintActive);
      mockAgileClient.completeSprint.mockResolvedValue(undefined);

      await sprintCompleteCommand(42);

      expect(mockAgileClient.getSprint).toHaveBeenCalledWith(42);
      expect(mockAgileClient.completeSprint).toHaveBeenCalledWith(42);
      expect(console.log).toHaveBeenCalled();
    });

    it('should throw when trying to complete a non-active sprint', async () => {
      mockAgileClient.getSprint.mockResolvedValue(mockSprintFuture);

      await expect(sprintCompleteCommand(43)).rejects.toThrow("Cannot complete sprint in state 'future'");
    });

    it('should deny execution when sprint.complete permission is not granted', async () => {
      mockSettings.isCommandAllowed.mockReturnValue(false);

      await expect(sprintCompleteCommand(42)).rejects.toThrow();
    });
  });

  describe('sprintUpdateCommand', () => {
    it('should update sprint name', async () => {
      mockAgileClient.updateSprint.mockResolvedValue(undefined);

      await sprintUpdateCommand(42, { name: 'Sprint 1 Renamed' });

      expect(mockAgileClient.updateSprint).toHaveBeenCalledWith(
        42,
        expect.objectContaining({ name: 'Sprint 1 Renamed' })
      );
    });

    it('should update sprint goal', async () => {
      mockAgileClient.updateSprint.mockResolvedValue(undefined);

      await sprintUpdateCommand(42, { goal: 'Updated goal' });

      expect(mockAgileClient.updateSprint).toHaveBeenCalledWith(
        42,
        expect.objectContaining({ goal: 'Updated goal' })
      );
    });

    it('should throw when sprintId is missing', async () => {
      await expect(
        sprintUpdateCommand(undefined as unknown as number, { name: 'New name' })
      ).rejects.toThrow();
    });

    it('should deny execution when sprint.update permission is not granted', async () => {
      mockSettings.isCommandAllowed.mockReturnValue(false);

      await expect(sprintUpdateCommand(42, { name: 'New name' })).rejects.toThrow();
    });
  });

  describe('sprintDeleteCommand', () => {
    it('should delete a sprint', async () => {
      mockAgileClient.deleteSprint.mockResolvedValue(undefined);

      await sprintDeleteCommand(43);

      expect(mockAgileClient.deleteSprint).toHaveBeenCalledWith(43);
      expect(console.log).toHaveBeenCalled();
    });

    it('should throw when sprintId is missing', async () => {
      await expect(
        sprintDeleteCommand(undefined as unknown as number)
      ).rejects.toThrow();
    });

    it('should deny execution when sprint.delete permission is not granted', async () => {
      mockSettings.isCommandAllowed.mockReturnValue(false);

      await expect(sprintDeleteCommand(43)).rejects.toThrow();
    });
  });

  describe('sprintIssuesCommand', () => {
    it('should get issues for a sprint', async () => {
      mockAgileClient.getSprintIssues.mockResolvedValue({
        total: 2,
        issues: [
          { key: 'GP-1', fields: { summary: 'Issue 1', status: { name: 'To Do' } } },
          { key: 'GP-2', fields: { summary: 'Issue 2', status: { name: 'In Progress' } } },
        ],
      });

      await sprintIssuesCommand(42);

      expect(mockAgileClient.getSprintIssues).toHaveBeenCalledWith(
        42,
        expect.anything()
      );
      expect(console.log).toHaveBeenCalled();
    });

    it('should pass jql filter when provided', async () => {
      mockAgileClient.getSprintIssues.mockResolvedValue({ total: 0, issues: [] });

      await sprintIssuesCommand(42, { jql: 'status = Done' });

      expect(mockAgileClient.getSprintIssues).toHaveBeenCalledWith(
        42,
        expect.objectContaining({ jql: 'status = Done' })
      );
    });

    it('should pass max option when provided', async () => {
      mockAgileClient.getSprintIssues.mockResolvedValue({ total: 0, issues: [] });

      await sprintIssuesCommand(42, { max: 25 });

      expect(mockAgileClient.getSprintIssues).toHaveBeenCalledWith(
        42,
        expect.objectContaining({ maxResults: 25 })
      );
    });

    it('should deny execution when sprint.issues permission is not granted', async () => {
      mockSettings.isCommandAllowed.mockReturnValue(false);

      await expect(sprintIssuesCommand(42)).rejects.toThrow();
    });
  });

  describe('sprintMoveCommand', () => {
    it('should move issues to a sprint', async () => {
      mockAgileClient.moveIssuesToSprint.mockResolvedValue(undefined);

      await sprintMoveCommand(42, { issues: ['GP-1', 'GP-2'] });

      expect(mockAgileClient.moveIssuesToSprint).toHaveBeenCalledWith(
        42,
        ['GP-1', 'GP-2'],
        expect.anything()
      );
      expect(console.log).toHaveBeenCalled();
    });

    it('should pass rankBefore when provided', async () => {
      mockAgileClient.moveIssuesToSprint.mockResolvedValue(undefined);

      await sprintMoveCommand(42, { issues: ['GP-1'], before: 'GP-5' });

      expect(mockAgileClient.moveIssuesToSprint).toHaveBeenCalledWith(
        42,
        ['GP-1'],
        expect.objectContaining({ rankBeforeIssue: 'GP-5' })
      );
    });

    it('should pass rankAfter when provided', async () => {
      mockAgileClient.moveIssuesToSprint.mockResolvedValue(undefined);

      await sprintMoveCommand(42, { issues: ['GP-1'], after: 'GP-3' });

      expect(mockAgileClient.moveIssuesToSprint).toHaveBeenCalledWith(
        42,
        ['GP-1'],
        expect.objectContaining({ rankAfterIssue: 'GP-3' })
      );
    });

    it('should throw when more than 50 issues are provided', async () => {
      const issues = Array.from({ length: 51 }, (_, i) => `GP-${i + 1}`);

      await expect(sprintMoveCommand(42, { issues })).rejects.toThrow('50');
    });

    it('should throw when issues list is empty', async () => {
      await expect(sprintMoveCommand(42, { issues: [] })).rejects.toThrow();
    });

    it('should deny execution when sprint.move permission is not granted', async () => {
      mockSettings.isCommandAllowed.mockReturnValue(false);

      await expect(sprintMoveCommand(42, { issues: ['GP-1'] })).rejects.toThrow();
    });
  });
});
