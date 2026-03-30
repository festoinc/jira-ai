import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  getAgileClient,
  __resetAgileClient__,
  getBoards,
  getBoard,
  getBoardConfig,
  getBoardIssues,
  getSprints,
  getSprint,
  createSprint,
  startSprint,
  completeSprint,
  updateSprint,
  deleteSprint,
  getSprintIssues,
  moveIssuesToSprint,
  moveIssuesToBacklog,
  rankIssues,
} from '../src/lib/agile-client.js';
import * as authStorage from '../src/lib/auth-storage.js';
import { AgileClient } from 'jira.js';

const {
  mockGetAllBoards,
  mockGetBoard,
  mockGetConfiguration,
  mockGetIssuesForBoard,
  mockGetAllSprints,
  mockGetSprint,
  mockCreateSprint,
  mockPartiallyUpdateSprint,
  mockDeleteSprint,
  mockGetIssuesForSprint,
  mockMoveIssuesToSprintAndRank,
  mockMoveIssuesToBacklog,
  mockRankIssues,
} = vi.hoisted(() => ({
  mockGetAllBoards: vi.fn(),
  mockGetBoard: vi.fn(),
  mockGetConfiguration: vi.fn(),
  mockGetIssuesForBoard: vi.fn(),
  mockGetAllSprints: vi.fn(),
  mockGetSprint: vi.fn(),
  mockCreateSprint: vi.fn(),
  mockPartiallyUpdateSprint: vi.fn(),
  mockDeleteSprint: vi.fn(),
  mockGetIssuesForSprint: vi.fn(),
  mockMoveIssuesToSprintAndRank: vi.fn(),
  mockMoveIssuesToBacklog: vi.fn(),
  mockRankIssues: vi.fn(),
}));

vi.mock('jira.js', () => ({
  AgileClient: vi.fn().mockImplementation(function () {
    return {
      board: {
        getAllBoards: mockGetAllBoards,
        getBoard: mockGetBoard,
        getConfiguration: mockGetConfiguration,
        getIssuesForBoard: mockGetIssuesForBoard,
        getAllSprints: mockGetAllSprints,
      },
      sprint: {
        getSprint: mockGetSprint,
        createSprint: mockCreateSprint,
        partiallyUpdateSprint: mockPartiallyUpdateSprint,
        deleteSprint: mockDeleteSprint,
        getIssuesForSprint: mockGetIssuesForSprint,
        moveIssuesToSprintAndRank: mockMoveIssuesToSprintAndRank,
      },
      backlog: {
        moveIssuesToBacklog: mockMoveIssuesToBacklog,
      },
      issue: {
        rankIssues: mockRankIssues,
      },
    };
  }),
}));

vi.mock('../src/lib/auth-storage.js');

const mockAuthStorage = authStorage as vi.Mocked<typeof authStorage>;

describe('AgileClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetAgileClient__();
    mockAuthStorage.loadCredentials.mockResolvedValue({
      host: 'https://test.atlassian.net',
      email: 'user@test.com',
      apiToken: 'test-token',
    });
  });

  describe('getAgileClient() singleton', () => {
    it('should create a new AgileClient on first call', async () => {
      const client = await getAgileClient();
      expect(AgileClient).toHaveBeenCalledTimes(1);
      expect(AgileClient).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'https://test.atlassian.net',
        })
      );
      expect(client).toBeDefined();
    });

    it('should return the same instance on subsequent calls (singleton)', async () => {
      const client1 = await getAgileClient();
      const client2 = await getAgileClient();
      expect(AgileClient).toHaveBeenCalledTimes(1);
      expect(client1).toBe(client2);
    });

    it('should use email and apiToken from credentials', async () => {
      await getAgileClient();
      expect(AgileClient).toHaveBeenCalledWith(
        expect.objectContaining({
          authentication: expect.objectContaining({
            basic: expect.objectContaining({
              email: 'user@test.com',
              apiToken: 'test-token',
            }),
          }),
        })
      );
    });
  });

  describe('getBoards()', () => {
    it('should call getAllBoards and return boards', async () => {
      const mockBoards = {
        maxResults: 50,
        startAt: 0,
        total: 1,
        isLast: true,
        values: [{ id: 36, name: 'GP board', type: 'simple' }],
      };
      mockGetAllBoards.mockResolvedValue(mockBoards);

      const result = await getBoards();
      expect(mockGetAllBoards).toHaveBeenCalled();
      expect(result).toEqual(mockBoards);
    });

    it('should pass projectKeyOrId filter when provided', async () => {
      mockGetAllBoards.mockResolvedValue({ values: [] });

      await getBoards({ projectKeyOrId: 'GP' });
      expect(mockGetAllBoards).toHaveBeenCalledWith(
        expect.objectContaining({ projectKeyOrId: 'GP' })
      );
    });

    it('should pass type filter when provided', async () => {
      mockGetAllBoards.mockResolvedValue({ values: [] });

      await getBoards({ type: 'scrum' });
      expect(mockGetAllBoards).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'scrum' })
      );
    });
  });

  describe('getBoard()', () => {
    it('should call getBoard with boardId and return board details', async () => {
      const mockBoard = { id: 36, name: 'GP board', type: 'simple' };
      mockGetBoard.mockResolvedValue(mockBoard);

      const result = await getBoard(36);
      expect(mockGetBoard).toHaveBeenCalledWith({ boardId: 36 });
      expect(result).toEqual(mockBoard);
    });
  });

  describe('getBoardConfig()', () => {
    it('should call getConfiguration with boardId and return config', async () => {
      const mockConfig = {
        id: 36,
        name: 'GP board',
        columnConfig: { columns: [] },
      };
      mockGetConfiguration.mockResolvedValue(mockConfig);

      const result = await getBoardConfig(36);
      expect(mockGetConfiguration).toHaveBeenCalledWith({ boardId: 36 });
      expect(result).toEqual(mockConfig);
    });
  });

  describe('getBoardIssues()', () => {
    it('should call getIssuesForBoard with boardId', async () => {
      const mockIssues = { total: 0, issues: [] };
      mockGetIssuesForBoard.mockResolvedValue(mockIssues);

      const result = await getBoardIssues(36);
      expect(mockGetIssuesForBoard).toHaveBeenCalledWith(
        expect.objectContaining({ boardId: 36 })
      );
      expect(result).toEqual(mockIssues);
    });

    it('should pass jql filter when provided', async () => {
      mockGetIssuesForBoard.mockResolvedValue({ total: 0, issues: [] });

      await getBoardIssues(36, { jql: 'status = "In Progress"', maxResults: 20 });
      expect(mockGetIssuesForBoard).toHaveBeenCalledWith(
        expect.objectContaining({ jql: 'status = "In Progress"', maxResults: 20 })
      );
    });
  });

  describe('getSprints()', () => {
    it('should call getAllSprints with boardId', async () => {
      const mockSprints = { values: [{ id: 42, name: 'Sprint 1', state: 'active' }] };
      mockGetAllSprints.mockResolvedValue(mockSprints);

      const result = await getSprints(36);
      expect(mockGetAllSprints).toHaveBeenCalledWith(
        expect.objectContaining({ boardId: 36 })
      );
      expect(result).toEqual(mockSprints);
    });

    it('should pass state filter when provided', async () => {
      mockGetAllSprints.mockResolvedValue({ values: [] });

      await getSprints(36, { state: 'active' });
      expect(mockGetAllSprints).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'active' })
      );
    });

    it('should throw CommandError when board does not support sprints', async () => {
      mockGetAllSprints.mockRejectedValue(
        new Error('The board does not support sprints')
      );

      await expect(getSprints(36)).rejects.toThrow('board does not support sprints');
    });
  });

  describe('getSprint()', () => {
    it('should call getSprint with sprintId', async () => {
      const mockSprint = { id: 42, name: 'Sprint 1', state: 'active' };
      mockGetSprint.mockResolvedValue(mockSprint);

      const result = await getSprint(42);
      expect(mockGetSprint).toHaveBeenCalledWith({ sprintId: 42 });
      expect(result).toEqual(mockSprint);
    });
  });

  describe('createSprint()', () => {
    it('should call createSprint with required fields', async () => {
      const mockSprint = { id: 43, name: 'Sprint 2', state: 'future' };
      mockCreateSprint.mockResolvedValue(mockSprint);

      const result = await createSprint(36, 'Sprint 2');
      expect(mockCreateSprint).toHaveBeenCalledWith(
        expect.objectContaining({ originBoardId: 36, name: 'Sprint 2' })
      );
      expect(result).toEqual(mockSprint);
    });

    it('should pass optional goal, startDate, endDate', async () => {
      mockCreateSprint.mockResolvedValue({ id: 43 });

      await createSprint(36, 'Sprint 2', {
        goal: 'Complete auth',
        startDate: '2026-04-01',
        endDate: '2026-04-14',
      });
      expect(mockCreateSprint).toHaveBeenCalledWith(
        expect.objectContaining({
          goal: 'Complete auth',
          startDate: '2026-04-01',
          endDate: '2026-04-14',
        })
      );
    });
  });

  describe('startSprint()', () => {
    it('should update sprint state to active', async () => {
      mockPartiallyUpdateSprint.mockResolvedValue({});

      await startSprint(42);
      expect(mockPartiallyUpdateSprint).toHaveBeenCalledWith(
        expect.objectContaining({ sprintId: 42, state: 'active' })
      );
    });

    it('should throw CommandError when sprint is already closed', async () => {
      mockPartiallyUpdateSprint.mockRejectedValue(
        new Error('Cannot start a closed sprint')
      );

      await expect(startSprint(42)).rejects.toThrow('Cannot start a closed sprint');
    });
  });

  describe('completeSprint()', () => {
    it('should update sprint state to closed', async () => {
      mockPartiallyUpdateSprint.mockResolvedValue({});

      await completeSprint(42);
      expect(mockPartiallyUpdateSprint).toHaveBeenCalledWith(
        expect.objectContaining({ sprintId: 42, state: 'closed' })
      );
    });

    it('should throw CommandError when sprint is in future state', async () => {
      mockPartiallyUpdateSprint.mockRejectedValue(
        new Error('Cannot complete a sprint without dates')
      );

      await expect(completeSprint(42)).rejects.toThrow('Cannot complete a sprint without dates');
    });
  });

  describe('updateSprint()', () => {
    it('should call partiallyUpdateSprint with sprintId and updates', async () => {
      mockPartiallyUpdateSprint.mockResolvedValue({});

      await updateSprint(42, { name: 'Sprint 2 Renamed', goal: 'New goal' });
      expect(mockPartiallyUpdateSprint).toHaveBeenCalledWith(
        expect.objectContaining({
          sprintId: 42,
          name: 'Sprint 2 Renamed',
          goal: 'New goal',
        })
      );
    });
  });

  describe('deleteSprint()', () => {
    it('should call deleteSprint with sprintId', async () => {
      mockDeleteSprint.mockResolvedValue(undefined);

      await deleteSprint(42);
      expect(mockDeleteSprint).toHaveBeenCalledWith({ sprintId: 42 });
    });
  });

  describe('getSprintIssues()', () => {
    it('should call getIssuesForSprint with sprintId', async () => {
      const mockIssues = { total: 5, issues: [] };
      mockGetIssuesForSprint.mockResolvedValue(mockIssues);

      const result = await getSprintIssues(42);
      expect(mockGetIssuesForSprint).toHaveBeenCalledWith(
        expect.objectContaining({ sprintId: 42 })
      );
      expect(result).toEqual(mockIssues);
    });

    it('should pass jql and maxResults when provided', async () => {
      mockGetIssuesForSprint.mockResolvedValue({ total: 0, issues: [] });

      await getSprintIssues(42, { jql: 'status = Done', maxResults: 10 });
      expect(mockGetIssuesForSprint).toHaveBeenCalledWith(
        expect.objectContaining({ jql: 'status = Done', maxResults: 10 })
      );
    });
  });

  describe('moveIssuesToSprint()', () => {
    it('should call moveIssuesToSprintAndRank with sprintId and issue keys', async () => {
      mockMoveIssuesToSprintAndRank.mockResolvedValue(undefined);

      await moveIssuesToSprint(42, ['GP-1', 'GP-2']);
      expect(mockMoveIssuesToSprintAndRank).toHaveBeenCalledWith(
        expect.objectContaining({
          sprintId: 42,
          issues: ['GP-1', 'GP-2'],
        })
      );
    });

    it('should throw CommandError when more than 50 issues provided', async () => {
      const issues = Array.from({ length: 51 }, (_, i) => `GP-${i + 1}`);

      await expect(moveIssuesToSprint(42, issues)).rejects.toThrow(
        '50'
      );
    });

    it('should pass rankBeforeIssue when provided', async () => {
      mockMoveIssuesToSprintAndRank.mockResolvedValue(undefined);

      await moveIssuesToSprint(42, ['GP-1'], { rankBeforeIssue: 'GP-5' });
      expect(mockMoveIssuesToSprintAndRank).toHaveBeenCalledWith(
        expect.objectContaining({ rankBeforeIssue: 'GP-5' })
      );
    });

    it('should pass rankAfterIssue when provided', async () => {
      mockMoveIssuesToSprintAndRank.mockResolvedValue(undefined);

      await moveIssuesToSprint(42, ['GP-1'], { rankAfterIssue: 'GP-3' });
      expect(mockMoveIssuesToSprintAndRank).toHaveBeenCalledWith(
        expect.objectContaining({ rankAfterIssue: 'GP-3' })
      );
    });
  });

  describe('moveIssuesToBacklog()', () => {
    it('should call moveIssuesToBacklog with issue keys', async () => {
      mockMoveIssuesToBacklog.mockResolvedValue(undefined);

      await moveIssuesToBacklog(['GP-1', 'GP-2']);
      expect(mockMoveIssuesToBacklog).toHaveBeenCalledWith(
        expect.objectContaining({ issues: ['GP-1', 'GP-2'] })
      );
    });

    it('should throw CommandError when more than 50 issues provided', async () => {
      const issues = Array.from({ length: 51 }, (_, i) => `GP-${i + 1}`);

      await expect(moveIssuesToBacklog(issues)).rejects.toThrow('50');
    });
  });

  describe('rankIssues()', () => {
    it('should call rankIssues with issue keys and rankBeforeIssue', async () => {
      mockRankIssues.mockResolvedValue(undefined);

      await rankIssues(['GP-1', 'GP-2'], { rankBeforeIssue: 'GP-5' });
      expect(mockRankIssues).toHaveBeenCalledWith(
        expect.objectContaining({
          issues: ['GP-1', 'GP-2'],
          rankBeforeIssue: 'GP-5',
        })
      );
    });

    it('should call rankIssues with rankAfterIssue', async () => {
      mockRankIssues.mockResolvedValue(undefined);

      await rankIssues(['GP-1'], { rankAfterIssue: 'GP-3' });
      expect(mockRankIssues).toHaveBeenCalledWith(
        expect.objectContaining({ rankAfterIssue: 'GP-3' })
      );
    });

    it('should throw CommandError when more than 50 issues provided', async () => {
      const issues = Array.from({ length: 51 }, (_, i) => `GP-${i + 1}`);

      await expect(rankIssues(issues, { rankBeforeIssue: 'GP-100' })).rejects.toThrow('50');
    });
  });
});
