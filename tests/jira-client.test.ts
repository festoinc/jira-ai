import { vi, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, test } from 'vitest';
import { getTaskWithDetails, addIssueLabels, removeIssueLabels, getIssueTransitions, transitionIssue } from '../src/lib/jira-client.js';
import { Version3Client } from 'jira.js';

// Mock dependencies
const { mockGetIssue, mockEditIssue, mockGetTransitions, mockDoTransition } = vi.hoisted(() => ({
  mockGetIssue: vi.fn(),
  mockEditIssue: vi.fn(),
  mockGetTransitions: vi.fn(),
  mockDoTransition: vi.fn(),
}));

vi.mock('jira.js', () => ({
  Version3Client: vi.fn().mockImplementation(function() {
    return {
      issues: {
        getIssue: mockGetIssue,
        editIssue: mockEditIssue,
        getTransitions: mockGetTransitions,
        doTransition: mockDoTransition
      }
    };
  })
}));

vi.mock('../src/lib/utils.js', () => ({
  convertADFToMarkdown: vi.fn(val => val ? 'mocked markdown' : undefined)
}));

describe('Jira Client', () => {
  beforeAll(() => {
    // Set environment variables required by getJiraClient
    process.env.JIRA_HOST = 'https://test.atlassian.net';
    process.env.JIRA_USER_EMAIL = 'test@example.com';
    process.env.JIRA_API_TOKEN = 'test-token';
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getTaskWithDetails', () => {
    it('should correctly extract task details including parent and subtasks', async () => {
      const mockRawIssue = {
        id: '10001',
        key: 'PROJ-123',
        fields: {
          summary: 'Test summary',
          description: { type: 'doc', content: [] },
          status: { name: 'In Progress' },
          assignee: { displayName: 'John Doe' },
          reporter: { displayName: 'Jane Smith' },
          created: '2023-01-01T10:00:00.000Z',
          updated: '2023-01-02T10:00:00.000Z',
          duedate: '2023-12-31',
          labels: ['bug', 'urgent'],
          comment: {
            comments: [
              {
                id: 'comment-1',
                author: { displayName: 'Author 1' },
                body: { type: 'doc', content: [] },
                created: '2023-01-01T11:00:00.000Z'
              }
            ]
          },
          parent: {
            id: '10000',
            key: 'PROJ-100',
            fields: {
              summary: 'Parent summary',
              status: { name: 'Done' }
            }
          },
          subtasks: [
            {
              id: '10002',
              key: 'PROJ-124',
              fields: {
                summary: 'Subtask summary',
                status: { name: 'To Do' }
              }
            }
          ]
        }
      };

      mockGetIssue.mockResolvedValue(mockRawIssue);

      const result = await getTaskWithDetails('PROJ-123');

      expect(mockGetIssue).toHaveBeenCalledWith({
        issueIdOrKey: 'PROJ-123',
        fields: expect.arrayContaining(['parent', 'subtasks', 'labels'])
      });

      expect(result.key).toBe('PROJ-123');
      expect(result.dueDate).toBe('2023-12-31');
      expect(result.labels).toEqual(['bug', 'urgent']);
      expect(result.parent).toEqual({
        id: '10000',
        key: 'PROJ-100',
        summary: 'Parent summary',
        status: { name: 'Done' }
      });
      expect(result.subtasks).toHaveLength(1);
      expect(result.subtasks[0]).toEqual({
        id: '10002',
        key: 'PROJ-124',
        summary: 'Subtask summary',
        status: { name: 'To Do' }
      });
    });

    it('should handle task with no parent or subtasks', async () => {
      const mockRawIssue = {
        id: '10001',
        key: 'PROJ-123',
        fields: {
          summary: 'Test summary',
          status: { name: 'In Progress' },
          created: '2023-01-01T10:00:00.000Z',
          updated: '2023-01-02T10:00:00.000Z',
          labels: []
        }
      };

      mockGetIssue.mockResolvedValue(mockRawIssue);

      const result = await getTaskWithDetails('PROJ-123');

      expect(result.parent).toBeUndefined();
      expect(result.subtasks).toEqual([]);
      expect(result.labels).toEqual([]);
    });

    it('should fetch history when includeHistory is true', async () => {
      const mockRawIssue = {
        id: '10001',
        key: 'PROJ-123',
        fields: {
          summary: 'Test summary',
          status: { name: 'In Progress' },
          created: '2023-01-01T10:00:00.000Z',
          updated: '2023-01-02T10:00:00.000Z',
        },
        changelog: {
          histories: [
            {
              id: '101',
              author: { displayName: 'John Doe' },
              created: '2023-01-01T12:00:00.000Z',
              items: [
                {
                  field: 'status',
                  fromString: 'To Do',
                  toString: 'In Progress'
                }
              ]
            }
          ]
        }
      };

      mockGetIssue.mockResolvedValue(mockRawIssue);

      // @ts-ignore - testing new functionality
      const result = await getTaskWithDetails('PROJ-123', { includeHistory: true });

      expect(mockGetIssue).toHaveBeenCalledWith(expect.objectContaining({
        issueIdOrKey: 'PROJ-123',
        expand: 'changelog'
      }));

      expect(result.history).toBeDefined();
      expect(result.history).toHaveLength(1);
      expect(result.history![0]).toEqual({
        id: '101',
        author: 'John Doe',
        created: '2023-01-01T12:00:00.000Z',
        items: [
          {
            field: 'status',
            from: 'To Do',
            to: 'In Progress'
          }
        ]
      });
    });
  });

  describe('addIssueLabels', () => {
    it('should call editIssue with correct add operations', async () => {
      mockEditIssue.mockResolvedValue({});
      const labels = ['label1', 'label2'];
      
      await addIssueLabels('PROJ-123', labels);

      expect(mockEditIssue).toHaveBeenCalledWith({
        issueIdOrKey: 'PROJ-123',
        update: {
          labels: [
            { add: 'label1' },
            { add: 'label2' }
          ]
        }
      });
    });
  });

  describe('removeIssueLabels', () => {
    it('should call editIssue with correct remove operations', async () => {
      mockEditIssue.mockResolvedValue({});
      const labels = ['label1', 'label2'];
      
      await removeIssueLabels('PROJ-123', labels);

      expect(mockEditIssue).toHaveBeenCalledWith({
        issueIdOrKey: 'PROJ-123',
        update: {
          labels: [
            { remove: 'label1' },
            { remove: 'label2' }
          ]
        }
      });
    });
  });

  describe('getIssueTransitions', () => {
    it('should correctly fetch and format transitions', async () => {
      mockGetTransitions.mockResolvedValue({
        transitions: [
          {
            id: '1',
            name: 'Transition 1',
            to: { id: '10', name: 'Status 1' }
          },
          {
            id: '2',
            name: 'Transition 2',
            to: { id: '20', name: 'Status 2' }
          }
        ]
      });

      const result = await getIssueTransitions('PROJ-123');

      expect(mockGetTransitions).toHaveBeenCalledWith({ issueIdOrKey: 'PROJ-123' });
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: '1',
        name: 'Transition 1',
        to: { id: '10', name: 'Status 1' }
      });
    });
  });

  describe('transitionIssue', () => {
    it('should call doTransition with correct parameters', async () => {
      mockDoTransition.mockResolvedValue({});

      await transitionIssue('PROJ-123', '1');

      expect(mockDoTransition).toHaveBeenCalledWith({
        issueIdOrKey: 'PROJ-123',
        transition: { id: '1' }
      });
    });
  });
});