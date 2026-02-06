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
  getIssueWorklogs,
  assignIssue,
  getJiraClient,
  createTemporaryClient,
  setOrganizationOverride,
  searchUsers,
  resolveUserByName,
  clearUserCache
} from '../src/lib/jira-client.js';
import * as authStorage from '../src/lib/auth-storage.js';
import { Version3Client } from 'jira.js';
import * as settings from '../src/lib/settings.js';

let mockCurrentOrg: string | undefined = undefined;
vi.mock('../src/lib/auth-storage.js', () => ({
  loadCredentials: vi.fn(),
  getCurrentOrganizationAlias: vi.fn(() => mockCurrentOrg),
  setOrganizationOverride: vi.fn((alias) => { mockCurrentOrg = alias; }),
  hasCredentials: vi.fn(),
  loadConfig: vi.fn(),
  saveConfig: vi.fn(),
  extractAliasFromHost: vi.fn(),
}));
vi.mock('../src/lib/settings.js');

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
  mockFindAssignableUsers,
  mockGetIssueWorklog,
  mockSearchEnhanced,
  mockAssignIssue,
  mockConfig
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
  mockFindAssignableUsers: vi.fn(),
  mockGetIssueWorklog: vi.fn(),
  mockSearchEnhanced: vi.fn(),
  mockAssignIssue: vi.fn(),
  mockConfig: { host: 'https://test.atlassian.net' }
}));

const mockSettings = settings as vi.Mocked<typeof settings>;

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
        getChangeLogs: mockGetChangeLogs,
        assignIssue: mockAssignIssue
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
        searchForIssuesUsingJqlPost: mockIssueSearch,
        searchForIssuesUsingJqlEnhancedSearch: mockSearchEnhanced
      },
      issueComments: {
        addComment: mockAddComment
      },
      issueWorklogs: {
        getIssueWorklog: mockGetIssueWorklog
      },
      userSearch: {
        findUsers: mockFindUsers,
        findAssignableUsers: mockFindAssignableUsers
      },
      config: mockConfig
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
    
    // Default settings mock
    mockSettings.applyGlobalFilters.mockImplementation(jql => jql);
    mockSettings.isProjectAllowed.mockReturnValue(true);
    mockSettings.isCommandAllowed.mockReturnValue(true);
    mockSettings.validateIssueAgainstFilters.mockReturnValue(true);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    clearUserCache();
    mockCurrentOrg = undefined;
    vi.mocked(authStorage.loadCredentials).mockReturnValue({
      host: 'https://test.atlassian.net',
      email: 'test@example.com',
      apiToken: 'test-token'
    });
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
      const mockIssue = {
        id: '1',
        key: 'TEST-1',
        fields: {
          summary: 'Test summary',
          status: { name: 'To Do', statusCategory: { key: 'new' } },
          created: '2023-01-01',
          updated: '2023-01-01',
          labels: []
        },
        changelog: {
          total: 1,
          histories: [{ id: '1', author: { displayName: 'User' }, created: '2023-01-01', items: [] }]
        }
      };
      vi.mocked(mockGetIssue).mockResolvedValue(mockIssue as any);

      const result = await getTaskWithDetails('TEST-1', { includeHistory: true });

      expect(result.history).toBeDefined();
      expect(result.history![0].id).toBe('1');
    });

    it('should fetch more histories if total is greater than returned histories', async () => {
      const mockIssue = {
        id: '1',
        key: 'TEST-1',
        fields: {
          summary: 'Test summary',
          status: { name: 'To Do', statusCategory: { key: 'new' } },
          created: '2023-01-01',
          updated: '2023-01-01',
          labels: []
        },
        changelog: {
          total: 2,
          histories: [{ id: '1', author: { displayName: 'User' }, created: '2023-01-01', items: [] }]
        }
      };
      vi.mocked(mockGetIssue).mockResolvedValue(mockIssue as any);
      vi.mocked(mockGetChangeLogs).mockResolvedValue({
        values: [
          { id: '1', author: { displayName: 'User' }, created: '2023-01-01', items: [] },
          { id: '2', author: { displayName: 'User' }, created: '2023-01-02', items: [] }
        ]
      } as any);

      const result = await getTaskWithDetails('TEST-1', { includeHistory: true, historyLimit: 2 });

      expect(mockGetChangeLogs).toHaveBeenCalledWith({ issueIdOrKey: 'TEST-1' });
      expect(result.history).toHaveLength(2);
      expect(result.history![0].id).toBe('2'); // Descending order
    });

    it('should apply historyOffset', async () => {
      const mockIssue = {
        id: '1',
        key: 'TEST-1',
        fields: {
          summary: 'Test summary',
          status: { name: 'To Do', statusCategory: { key: 'new' } },
          created: '2023-01-01',
          updated: '2023-01-01',
          labels: []
        },
        changelog: {
          total: 2,
          histories: [
            { id: '1', author: { displayName: 'User' }, created: '2023-01-01', items: [] },
            { id: '2', author: { displayName: 'User' }, created: '2023-01-02', items: [] }
          ]
        }
      };
      vi.mocked(mockGetIssue).mockResolvedValue(mockIssue as any);

      const result = await getTaskWithDetails('TEST-1', { includeHistory: true, historyOffset: 1, historyLimit: 1 });

      expect(result.history).toHaveLength(1);
      expect(result.history![0].id).toBe('1'); // Second item after sort and offset
    });

    it('should handle history with no items', async () => {
      const mockIssue = {
        id: '1',
        key: 'TEST-1',
        fields: {
          summary: 'Test summary',
          status: { name: 'To Do', statusCategory: { key: 'new' } },
          created: '2023-01-01',
          updated: '2023-01-01',
          labels: []
        },
        changelog: {
          total: 1,
          histories: [{ id: '1', author: { displayName: 'User' }, created: '2023-01-01' }]
        }
      };
      vi.mocked(mockGetIssue).mockResolvedValue(mockIssue as any);

      const result = await getTaskWithDetails('TEST-1', { includeHistory: true });
      expect(result.history![0].items).toBeUndefined();
    });

    it('should handle history items with missing fields', async () => {
      const mockIssue = {
        id: '1',
        key: 'TEST-1',
        fields: {
          summary: 'Test summary',
          status: { name: 'To Do', statusCategory: { key: 'new' } },
          created: '2023-01-01',
          updated: '2023-01-01',
          labels: []
        },
        changelog: {
          total: 1,
          histories: [{ 
            id: '1', 
            author: { displayName: 'User' }, 
            created: '2023-01-01',
            items: [{ fromString: 'A', toString: 'B' }] 
          }]
        }
      };
      vi.mocked(mockGetIssue).mockResolvedValue(mockIssue as any);

      const result = await getTaskWithDetails('TEST-1', { includeHistory: true });
      expect(result.history![0].items![0].field).toBe('');
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
      mockSearchEnhanced.mockResolvedValue({
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

      expect(mockSearchEnhanced).toHaveBeenCalledWith({
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
      const mockUsers = [
        { accountId: '1', displayName: 'User 1', active: true, accountType: 'atlassian' },
        { accountId: '2', displayName: 'User 2', active: false, accountType: 'atlassian' }
      ];
      mockFindUsers.mockResolvedValue(mockUsers as any);

      const result = await getUsers();

      expect(mockFindUsers).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].accountId).toBe('1');
    });

    it('should fetch users for a project when projectKey is provided', async () => {
      const mockUsers = [
        { accountId: '1', displayName: 'User 1', active: true, accountType: 'atlassian' }
      ];
      mockFindAssignableUsers.mockResolvedValue(mockUsers as any);

      const result = await getUsers('TEST');

      expect(mockFindAssignableUsers).toHaveBeenCalledWith({
        project: 'TEST',
        maxResults: 1000
      });
      expect(result).toHaveLength(1);
    });

    it('should handle missing host in client config', async () => {
      const oldHost = mockConfig.host;
      mockConfig.host = undefined as any;
      const mockUsers = [
        { accountId: '1', displayName: 'User 1', active: true, accountType: 'atlassian' }
      ];
      mockFindUsers.mockResolvedValue(mockUsers as any);

      const result = await getUsers();
      expect(result[0].host).toBe('N/A');
      
      mockConfig.host = oldHost;
    });

    it('should handle missing fields in user info', async () => {
      const mockUsers = [
        { active: true, accountType: 'atlassian' }
      ];
      mockFindUsers.mockResolvedValue(mockUsers as any);

      const result = await getUsers();
      expect(result[0].accountId).toBe('');
      expect(result[0].displayName).toBe('');
    });
  });

  describe('getIssueWorklogs', () => {
    it('should fetch and format worklogs', async () => {
      const mockWorklogs = {
        worklogs: [
          {
            id: '1',
            author: { accountId: 'user1', displayName: 'User 1' },
            started: '2023-01-01T10:00:00.000+0000',
            timeSpent: '1h',
            timeSpentSeconds: 3600
          }
        ]
      };
      mockGetIssueWorklog.mockResolvedValue(mockWorklogs as any);

      const result = await getIssueWorklogs('TEST-1');

      expect(mockGetIssueWorklog).toHaveBeenCalledWith({ issueIdOrKey: 'TEST-1' });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
      expect(result[0].author.displayName).toBe('User 1');
    });

    it('should handle missing worklogs in response', async () => {
      mockGetIssueWorklog.mockResolvedValue({} as any);

      const result = await getIssueWorklogs('TEST-1');
      expect(result).toEqual([]);
    });

    it('should handle missing fields in worklogs', async () => {
      const mockWorklogs = {
        worklogs: [
          {
            // Missing id, author and other fields
          }
        ]
      };
      mockGetIssueWorklog.mockResolvedValue(mockWorklogs as any);

      const result = await getIssueWorklogs('TEST-1');

      expect(result[0].id).toBe('');
      expect(result[0].author.displayName).toBe('Unknown');
      expect(result[0].author.accountId).toBe('');
    });
  });

  describe('searchUsers', () => {
    it('should search for users and format results', async () => {
      const mockUsers = [
        { accountId: '1', displayName: 'User 1', active: true, accountType: 'atlassian' }
      ];
      mockFindUsers.mockResolvedValue(mockUsers as any);

      const result = await searchUsers('User 1');

      expect(mockFindUsers).toHaveBeenCalledWith({
        query: 'User 1',
        maxResults: 10
      });
      expect(result).toHaveLength(1);
      expect(result[0].displayName).toBe('User 1');
    });
  });

  describe('resolveUserByName', () => {
    it('should resolve user by display name', async () => {
      const mockUsers = [
        { accountId: 'id-123', displayName: 'Anatolii Fesiuk', active: true, accountType: 'atlassian' }
      ];
      mockFindUsers.mockResolvedValue(mockUsers as any);

      const result = await resolveUserByName('Anatolii Fesiuk');

      expect(result).toBe('id-123');
    });

    it('should use cache for subsequent calls', async () => {
      const mockUsers = [
        { accountId: 'id-123', displayName: 'Anatolii Fesiuk', active: true, accountType: 'atlassian' }
      ];
      mockFindUsers.mockResolvedValue(mockUsers as any);

      await resolveUserByName('Anatolii Fesiuk');
      const result = await resolveUserByName('Anatolii Fesiuk');

      expect(result).toBe('id-123');
      expect(mockFindUsers).toHaveBeenCalledTimes(1);
    });

    it('should return null if user not found', async () => {
      mockFindUsers.mockResolvedValue([] as any);

      const result = await resolveUserByName('Unknown User');

      expect(result).toBeNull();
    });
  });

  describe('assignIssue', () => {
    it('should call assignIssue with correct parameters', async () => {
      mockAssignIssue.mockResolvedValue({});

      await assignIssue('PROJ-123', 'user-123');

      expect(mockAssignIssue).toHaveBeenCalledWith({
        issueIdOrKey: 'PROJ-123',
        accountId: 'user-123'
      });
    });

    it('should allow unassigning with null accountId', async () => {
      mockAssignIssue.mockResolvedValue({});

      await assignIssue('PROJ-123', null);

      expect(mockAssignIssue).toHaveBeenCalledWith({
        issueIdOrKey: 'PROJ-123',
        accountId: null
      });
    });
  });

  describe('getJiraClient and organizationOverride', () => {
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
      originalEnv = { ...process.env };
      delete process.env.JIRA_HOST;
      delete process.env.JIRA_USER_EMAIL;
      delete process.env.JIRA_API_TOKEN;
      setOrganizationOverride(undefined as any);
    });

    afterEach(() => {
      process.env = originalEnv;
      // Reset the client and override
      setOrganizationOverride(undefined as any);
    });

    it('should throw error when no credentials are found', () => {
      vi.mocked(authStorage.loadCredentials).mockReturnValue(null);
      expect(() => getJiraClient()).toThrow('Jira credentials not found');
    });

    it('should load credentials from storage when env vars are missing', () => {
      const mockCreds = { host: 'host', email: 'email', apiToken: 'token' };
      vi.mocked(authStorage.loadCredentials).mockReturnValue(mockCreds);
      
      const client = getJiraClient();
      expect(Version3Client).toHaveBeenCalled();
      expect(client).toBeDefined();
    });

    it('should handle organization override', () => {
      const mockCreds = { host: 'org-host', email: 'org-email', apiToken: 'org-token' };
      vi.mocked(authStorage.loadCredentials).mockReturnValue(mockCreds);
      
      setOrganizationOverride('my-org');
      getJiraClient();
      
      expect(authStorage.loadCredentials).toHaveBeenCalledWith('my-org');
    });

    it('should throw error when organization override credentials not found', () => {
      vi.mocked(authStorage.loadCredentials).mockReturnValue(null);
      setOrganizationOverride('unknown-org');
      
      expect(() => getJiraClient()).toThrow('Jira credentials for organization "unknown-org" not found.');
    });
  });

  describe('createTemporaryClient', () => {
    it('should create a temporary client with provided credentials', () => {
      const client = createTemporaryClient('https://temp.atlassian.net', 'temp@example.com', 'temp-token');
      expect(client).toBeDefined();
      expect(Version3Client).toHaveBeenCalled();
    });

    it('should use normal host for basic authType', () => {
      createTemporaryClient('https://temp.atlassian.net', 'temp@example.com', 'temp-token', {
        authType: 'basic',
        cloudId: undefined
      });
      expect(Version3Client).toHaveBeenCalledWith(
        expect.objectContaining({ host: 'https://temp.atlassian.net' })
      );
    });

    it('should use gateway URL for service_account authType with cloudId', () => {
      createTemporaryClient('https://temp.atlassian.net', 'bot@example.com', 'bot-token', {
        authType: 'service_account',
        cloudId: 'cloud-abc-123'
      });
      expect(Version3Client).toHaveBeenCalledWith(
        expect.objectContaining({ host: 'https://api.atlassian.com/ex/jira/cloud-abc-123' })
      );
    });

    it('should use normal host for service_account without cloudId', () => {
      createTemporaryClient('https://temp.atlassian.net', 'bot@example.com', 'bot-token', {
        authType: 'service_account'
      });
      expect(Version3Client).toHaveBeenCalledWith(
        expect.objectContaining({ host: 'https://temp.atlassian.net' })
      );
    });
  });

  describe('getJiraClient with service account credentials', () => {
    beforeEach(() => {
      setOrganizationOverride(undefined as any);
    });

    afterEach(() => {
      setOrganizationOverride(undefined as any);
    });

    it('should use gateway URL when stored credentials have service_account authType', () => {
      vi.mocked(authStorage.loadCredentials).mockReturnValue({
        host: 'https://mycompany.atlassian.net',
        email: 'bot@example.com',
        apiToken: 'bot-token',
        authType: 'service_account',
        cloudId: 'stored-cloud-id'
      });

      getJiraClient();

      expect(Version3Client).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'https://api.atlassian.com/ex/jira/stored-cloud-id'
        })
      );
    });

    it('should use normal host when stored credentials have basic authType', () => {
      vi.mocked(authStorage.loadCredentials).mockReturnValue({
        host: 'https://mycompany.atlassian.net',
        email: 'user@example.com',
        apiToken: 'user-token',
        authType: 'basic'
      });

      getJiraClient();

      expect(Version3Client).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'https://mycompany.atlassian.net'
        })
      );
    });

    it('should use normal host when stored credentials have no authType', () => {
      vi.mocked(authStorage.loadCredentials).mockReturnValue({
        host: 'https://mycompany.atlassian.net',
        email: 'user@example.com',
        apiToken: 'user-token'
      });

      getJiraClient();

      expect(Version3Client).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'https://mycompany.atlassian.net'
        })
      );
    });
  });
});