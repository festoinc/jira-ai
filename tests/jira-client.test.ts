import { vi, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, test } from 'vitest';
import {
  getTaskWithDetails,
  addIssueLabels,
  removeIssueLabels,
  getIssueTransitions,
  transitionIssue,
  getCurrentUser,
  getProjects,
  getProjectStatuses,
  searchIssuesByJql,
  updateIssueDescription,
  addIssueComment,
  getProjectIssueTypes,
  createIssue,
  getIssueStatistics,
  getUsers,
  createTemporaryClient,
  setOrganizationOverride
} from '../src/lib/jira-client.js';
import { Version3Client } from 'jira.js';

// Mock dependencies
const {
  mockGetIssue,
  mockEditIssue,
  mockGetTransitions,
  mockDoTransition,
  mockGetCurrentUser,
  mockSearchProjects,
  mockGetAllStatuses,
  mockIssueSearch,
  mockAddComment,
  mockGetProject,
  mockCreateIssue,
  mockGetChangeLogs,
  mockFindUsers,
  mockFindAssignableUsers
} = vi.hoisted(() => ({
  mockGetIssue: vi.fn(),
  mockEditIssue: vi.fn(),
  mockGetTransitions: vi.fn(),
  mockDoTransition: vi.fn(),
  mockGetCurrentUser: vi.fn(),
  mockSearchProjects: vi.fn(),
  mockGetAllStatuses: vi.fn(),
  mockIssueSearch: vi.fn(),
  mockAddComment: vi.fn(),
  mockGetProject: vi.fn(),
  mockCreateIssue: vi.fn(),
  mockGetChangeLogs: vi.fn(),
  mockFindUsers: vi.fn(),
  mockFindAssignableUsers: vi.fn()
}));

vi.mock('jira.js', () => ({
  Version3Client: vi.fn().mockImplementation(function() {
    return {
      issues: {
        getIssue: mockGetIssue,
        editIssue: mockEditIssue,
        getTransitions: mockGetTransitions,
        doTransition: mockDoTransition,
        addComment: mockAddComment,
        createIssue: mockCreateIssue,
        getChangeLogs: mockGetChangeLogs
      },
      myself: {
        getCurrentUser: mockGetCurrentUser
      },
      projects: {
        searchProjects: mockSearchProjects,
        getAllStatuses: mockGetAllStatuses,
        getProject: mockGetProject,
        getProjectComponents: vi.fn()
      },
      issueSearch: {
        searchForIssuesUsingJqlEnhancedSearch: mockIssueSearch
      },
      issueComments: {
        addComment: mockAddComment
      },
      userSearch: {
        findUsers: mockFindUsers,
        findAssignableUsers: mockFindAssignableUsers
      },
      config: {
        host: 'https://test.atlassian.net'
      }
    };
  })
}));

vi.mock('../src/lib/utils.js', () => ({
  convertADFToMarkdown: vi.fn(val => val ? 'mocked markdown' : undefined),
  calculateStatusStatistics: vi.fn(() => ({ 'To Do': 3600, 'In Progress': 7200 }))
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

  describe('getCurrentUser', () => {
    it('should fetch and format current user info', async () => {
      mockGetCurrentUser.mockResolvedValue({
        accountId: 'user-123',
        displayName: 'John Doe',
        emailAddress: 'john@example.com',
        active: true,
        timeZone: 'America/New_York'
      });

      const result = await getCurrentUser();

      expect(mockGetCurrentUser).toHaveBeenCalled();
      expect(result).toEqual({
        accountId: 'user-123',
        displayName: 'John Doe',
        emailAddress: 'john@example.com',
        active: true,
        timeZone: 'America/New_York',
        host: 'https://test.atlassian.net'
      });
    });
  });

  describe('getProjects', () => {
    it('should fetch and format projects list', async () => {
      mockSearchProjects.mockResolvedValue({
        values: [
          {
            id: '1',
            key: 'PROJ',
            name: 'Project One',
            projectTypeKey: 'software',
            lead: { displayName: 'Jane Doe' }
          },
          {
            id: '2',
            key: 'PROJ2',
            name: 'Project Two',
            projectTypeKey: 'business',
            lead: null
          }
        ]
      });

      const result = await getProjects();

      expect(mockSearchProjects).toHaveBeenCalledWith({ expand: 'lead' });
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: '1',
        key: 'PROJ',
        name: 'Project One',
        projectTypeKey: 'software',
        lead: { displayName: 'Jane Doe' }
      });
      expect(result[1].lead).toBeUndefined();
    });
  });

  describe('getProjectStatuses', () => {
    it('should fetch and deduplicate project statuses', async () => {
      mockGetAllStatuses.mockResolvedValue([
        {
          statuses: [
            {
              id: '1',
              name: 'To Do',
              description: 'Work to be done',
              statusCategory: { id: '10', key: 'NEW', name: 'To Do' }
            }
          ]
        },
        {
          statuses: [
            {
              id: '1',
              name: 'To Do',
              description: 'Work to be done',
              statusCategory: { id: '10', key: 'NEW', name: 'To Do' }
            },
            {
              id: '2',
              name: 'Done',
              description: 'Completed',
              statusCategory: { id: '30', key: 'DONE', name: 'Done' }
            }
          ]
        }
      ]);

      const result = await getProjectStatuses('PROJ');

      expect(mockGetAllStatuses).toHaveBeenCalledWith({ projectIdOrKey: 'PROJ' });
      expect(result).toHaveLength(2);
      expect(result.find(s => s.id === '1')).toBeDefined();
      expect(result.find(s => s.id === '2')).toBeDefined();
    });
  });

  describe('searchIssuesByJql', () => {
    it('should execute JQL search and format results', async () => {
      mockIssueSearch.mockResolvedValue({
        issues: [
          {
            key: 'TEST-1',
            fields: {
              summary: 'Test issue',
              status: { name: 'In Progress' },
              assignee: { displayName: 'John Doe' },
              priority: { name: 'High' }
            }
          }
        ]
      });

      const result = await searchIssuesByJql('project = TEST', 50);

      expect(mockIssueSearch).toHaveBeenCalledWith({
        jql: 'project = TEST',
        maxResults: 50,
        fields: ['summary', 'status', 'assignee', 'priority']
      });
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        key: 'TEST-1',
        summary: 'Test issue',
        status: { name: 'In Progress' },
        assignee: { displayName: 'John Doe' },
        priority: { name: 'High' }
      });
    });
  });

  describe('updateIssueDescription', () => {
    it('should update issue description with ADF format', async () => {
      mockEditIssue.mockResolvedValue({});

      await updateIssueDescription('PROJ-123', 'New description');

      expect(mockEditIssue).toHaveBeenCalledWith({
        issueIdOrKey: 'PROJ-123',
        fields: {
          description: 'New description'
        },
        notifyUsers: false
      });
    });
  });

  describe('addIssueComment', () => {
    it('should add comment with ADF format', async () => {
      mockAddComment.mockResolvedValue({});

      await addIssueComment('PROJ-123', 'Test comment');

      expect(mockAddComment).toHaveBeenCalledWith({
        issueIdOrKey: 'PROJ-123',
        comment: 'Test comment'
      });
    });
  });

  describe('getProjectIssueTypes', () => {
    it('should fetch and format project issue types', async () => {
      mockGetProject.mockResolvedValue({
        issueTypes: [
          {
            id: '1',
            name: 'Task',
            description: 'A task',
            subtask: false,
            hierarchyLevel: 0
          },
          {
            id: '2',
            name: 'Subtask',
            description: 'A subtask',
            subtask: true,
            hierarchyLevel: -1
          }
        ]
      });

      const result = await getProjectIssueTypes('PROJ');

      expect(mockGetProject).toHaveBeenCalledWith({
        projectIdOrKey: 'PROJ',
        expand: 'issueTypes'
      });
      expect(result).toHaveLength(2);
      expect(result[0].subtask).toBe(false);
      expect(result[1].subtask).toBe(true);
    });
  });

  describe('createIssue', () => {
    it('should create issue with provided fields', async () => {
      mockCreateIssue.mockResolvedValue({
        key: 'PROJ-124',
        id: '10124'
      });

      const result = await createIssue('PROJ', 'Test issue', 'Task');

      expect(mockCreateIssue).toHaveBeenCalledWith({
        fields: {
          project: { key: 'PROJ' },
          summary: 'Test issue',
          issuetype: { name: 'Task' }
        }
      });
      expect(result.key).toBe('PROJ-124');
      expect(result.id).toBe('10124');
    });

    it('should create issue with parent key for subtasks', async () => {
      mockCreateIssue.mockResolvedValue({
        key: 'PROJ-125',
        id: '10125'
      });

      const result = await createIssue('PROJ', 'Test subtask', 'Subtask', 'PROJ-100');

      expect(mockCreateIssue).toHaveBeenCalledWith({
        fields: {
          project: { key: 'PROJ' },
          summary: 'Test subtask',
          issuetype: { name: 'Subtask' },
          parent: { key: 'PROJ-100' }
        }
      });
      expect(result.key).toBe('PROJ-125');
    });
  });

  describe('getIssueStatistics', () => {
    it('should fetch and calculate issue statistics', async () => {
      mockGetIssue.mockResolvedValue({
        id: '10001',
        key: 'TEST-1',
        fields: {
          summary: 'Test issue',
          status: { name: 'Done' },
          created: '2024-01-01T10:00:00.000Z',
          timetracking: {
            timeSpentSeconds: 3600,
            originalEstimateSeconds: 7200
          }
        },
        changelog: {
          histories: [
            {
              created: '2024-01-02T10:00:00.000Z',
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
      });

      const result = await getIssueStatistics('TEST-1');

      expect(mockGetIssue).toHaveBeenCalledWith({
        issueIdOrKey: 'TEST-1',
        expand: 'changelog',
        fields: ['summary', 'status', 'timetracking', 'created']
      });
      expect(result.key).toBe('TEST-1');
      expect(result.summary).toBe('Test issue');
      expect(result.timeSpentSeconds).toBe(3600);
      expect(result.originalEstimateSeconds).toBe(7200);
      expect(result.currentStatus).toBe('Done');
    });
  });

  describe('getUsers', () => {
    it('should fetch all active users when no projectKey provided', async () => {
      mockFindUsers.mockResolvedValue([
        {
          accountId: '1',
          displayName: 'User One',
          emailAddress: 'user1@example.com',
          active: true,
          accountType: 'atlassian',
          timeZone: 'UTC'
        },
        {
          accountId: '2',
          displayName: 'User Two',
          emailAddress: 'user2@example.com',
          active: false,
          accountType: 'atlassian',
          timeZone: 'UTC'
        }
      ]);

      const result = await getUsers();

      expect(mockFindUsers).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].active).toBe(true);
    });

  });

  describe('createTemporaryClient', () => {
    it('should create a temporary client with provided credentials', () => {
      const client = createTemporaryClient('https://temp.atlassian.net', 'temp@example.com', 'temp-token');
      expect(client).toBeDefined();
      expect(Version3Client).toHaveBeenCalled();
    });
  });
});