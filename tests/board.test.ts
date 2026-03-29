import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  boardListCommand,
  boardGetCommand,
  boardConfigCommand,
  boardIssuesCommand,
  boardRankCommand,
} from '../src/commands/board.js';
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

describe('Board Commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    console.log = vi.fn();
    console.error = vi.fn();
    mockSettings.isCommandAllowed.mockReturnValue(true);
  });

  describe('boardListCommand', () => {
    it('should list all boards', async () => {
      mockAgileClient.getBoards.mockResolvedValue({
        maxResults: 50,
        startAt: 0,
        total: 1,
        isLast: true,
        values: [
          { id: 36, name: 'GP board', type: 'simple', location: { projectKey: 'GP', displayName: 'G-PROJECT (GP)' } },
        ],
      });

      await boardListCommand();

      expect(mockAgileClient.getBoards).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalled();
    });

    it('should filter by project key when provided', async () => {
      mockAgileClient.getBoards.mockResolvedValue({ values: [] });

      await boardListCommand({ projectKey: 'GP' });

      expect(mockAgileClient.getBoards).toHaveBeenCalledWith(
        expect.objectContaining({ projectKeyOrId: 'GP' })
      );
    });

    it('should filter by type when provided', async () => {
      mockAgileClient.getBoards.mockResolvedValue({ values: [] });

      await boardListCommand({ type: 'scrum' });

      expect(mockAgileClient.getBoards).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'scrum' })
      );
    });

    it('should show message when no boards found', async () => {
      mockAgileClient.getBoards.mockResolvedValue({ values: [] });

      await boardListCommand();

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('No boards found')
      );
    });

    it('should deny execution when board.list permission is not granted', async () => {
      mockSettings.isCommandAllowed.mockReturnValue(false);

      await expect(boardListCommand()).rejects.toThrow();
    });
  });

  describe('boardGetCommand', () => {
    it('should get a board by ID', async () => {
      mockAgileClient.getBoard.mockResolvedValue({
        id: 36,
        name: 'GP board',
        type: 'simple',
        location: { projectKey: 'GP', projectName: 'G-PROJECT', displayName: 'G-PROJECT (GP)' },
        isPrivate: false,
      });

      await boardGetCommand(36);

      expect(mockAgileClient.getBoard).toHaveBeenCalledWith(36);
      expect(console.log).toHaveBeenCalled();
    });

    it('should throw when boardId is missing', async () => {
      await expect(boardGetCommand(undefined as unknown as number)).rejects.toThrow();
    });

    it('should deny execution when board.get permission is not granted', async () => {
      mockSettings.isCommandAllowed.mockReturnValue(false);

      await expect(boardGetCommand(36)).rejects.toThrow();
    });
  });

  describe('boardConfigCommand', () => {
    it('should get board configuration', async () => {
      mockAgileClient.getBoardConfig.mockResolvedValue({
        id: 36,
        name: 'GP board',
        type: 'simple',
        columnConfig: {
          columns: [
            { name: 'To Do', statuses: [{ id: '10128' }] },
            { name: 'In Progress', statuses: [{ id: '10129' }] },
            { name: 'Done', statuses: [{ id: '10130' }] },
          ],
          constraintType: 'none',
        },
        filter: { id: '10035' },
        ranking: { rankCustomFieldId: 10019 },
      });

      await boardConfigCommand(36);

      expect(mockAgileClient.getBoardConfig).toHaveBeenCalledWith(36);
      expect(console.log).toHaveBeenCalled();
    });

    it('should throw when boardId is missing', async () => {
      await expect(boardConfigCommand(undefined as unknown as number)).rejects.toThrow();
    });

    it('should deny execution when board.config permission is not granted', async () => {
      mockSettings.isCommandAllowed.mockReturnValue(false);

      await expect(boardConfigCommand(36)).rejects.toThrow();
    });
  });

  describe('boardIssuesCommand', () => {
    it('should get issues for a board', async () => {
      mockAgileClient.getBoardIssues.mockResolvedValue({
        total: 2,
        issues: [
          { key: 'GP-1', fields: { summary: 'Issue 1', status: { name: 'To Do' } } },
          { key: 'GP-2', fields: { summary: 'Issue 2', status: { name: 'In Progress' } } },
        ],
      });

      await boardIssuesCommand(36);

      expect(mockAgileClient.getBoardIssues).toHaveBeenCalledWith(
        36,
        expect.anything()
      );
      expect(console.log).toHaveBeenCalled();
    });

    it('should pass jql filter when provided', async () => {
      mockAgileClient.getBoardIssues.mockResolvedValue({ total: 0, issues: [] });

      await boardIssuesCommand(36, { jql: 'status = "In Progress"' });

      expect(mockAgileClient.getBoardIssues).toHaveBeenCalledWith(
        36,
        expect.objectContaining({ jql: 'status = "In Progress"' })
      );
    });

    it('should pass max option when provided', async () => {
      mockAgileClient.getBoardIssues.mockResolvedValue({ total: 0, issues: [] });

      await boardIssuesCommand(36, { max: 10 });

      expect(mockAgileClient.getBoardIssues).toHaveBeenCalledWith(
        36,
        expect.objectContaining({ maxResults: 10 })
      );
    });

    it('should deny execution when board.issues permission is not granted', async () => {
      mockSettings.isCommandAllowed.mockReturnValue(false);

      await expect(boardIssuesCommand(36)).rejects.toThrow();
    });
  });

  describe('boardRankCommand', () => {
    it('should rank issues on a board with rankBefore', async () => {
      mockAgileClient.rankIssues.mockResolvedValue(undefined);

      await boardRankCommand({ issues: ['GP-1', 'GP-2'], before: 'GP-5' });

      expect(mockAgileClient.rankIssues).toHaveBeenCalledWith(
        ['GP-1', 'GP-2'],
        expect.objectContaining({ rankBeforeIssue: 'GP-5' })
      );
    });

    it('should rank issues with rankAfter', async () => {
      mockAgileClient.rankIssues.mockResolvedValue(undefined);

      await boardRankCommand({ issues: ['GP-1'], after: 'GP-3' });

      expect(mockAgileClient.rankIssues).toHaveBeenCalledWith(
        ['GP-1'],
        expect.objectContaining({ rankAfterIssue: 'GP-3' })
      );
    });

    it('should throw when neither before nor after is provided', async () => {
      await expect(boardRankCommand({ issues: ['GP-1'] })).rejects.toThrow();
    });

    it('should throw when issues list is empty', async () => {
      await expect(
        boardRankCommand({ issues: [], before: 'GP-5' })
      ).rejects.toThrow();
    });

    it('should deny execution when board.rank permission is not granted', async () => {
      mockSettings.isCommandAllowed.mockReturnValue(false);

      await expect(boardRankCommand({ issues: ['GP-1'], before: 'GP-5' })).rejects.toThrow();
    });
  });
});
