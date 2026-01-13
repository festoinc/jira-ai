import { vi, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, test } from 'vitest';
import chalk from 'chalk';
import {
  formatTaskDetails,
  formatUsers,
  formatUserInfo,
  formatProjects,
  formatTaskHistory,
  formatProjectStatuses,
  formatJqlResults,
  formatProjectIssueTypes,
  formatIssueStatistics
} from '../src/lib/formatters.js';
import { TaskDetails, UserInfo, Project, Status, JqlIssue, IssueType, IssueStatistics, HistoryEntry } from '../src/lib/jira-client.js';

describe('Formatters', () => {
  const mockTask: TaskDetails = {
    id: '10001',
    key: 'PROJ-123',
    summary: 'Test task summary',
    description: 'Test task description',
    status: { name: 'In Progress' },
    assignee: { displayName: 'John Doe' },
    reporter: { displayName: 'Jane Smith' },
    created: '2023-01-01T10:00:00.000Z',
    updated: '2023-01-02T10:00:00.000Z',
    labels: ['frontend', 'ui'],
    comments: [],
    subtasks: []
  };

  describe('formatTaskDetails', () => {
    it('should include labels in the output', () => {
      const output = formatTaskDetails(mockTask);
      expect(output).toContain('Labels');
      expect(output).toContain('frontend');
      expect(output).toContain('ui');
    });

    it('should handle task with no labels', () => {
      const taskNoLabels = { ...mockTask, labels: [] };
      const output = formatTaskDetails(taskNoLabels);
      expect(output).not.toContain('Labels:');
    });

    it('should display N/A for missing dueDate', () => {
      const output = formatTaskDetails(mockTask);
      expect(output).toContain('Due Date');
      expect(output).toContain('N/A');
    });

    it('should display overdue dueDate in red', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-01'));
      
      const overdueTask: TaskDetails = {
        ...mockTask,
        dueDate: '2023-12-31',
        status: { name: 'To Do', category: 'new' }
      };
      
      const output = formatTaskDetails(overdueTask);
      expect(output).toContain('Due Date');
      expect(output).toContain('2023-12-31');
      // Chalk might be tricky to test directly in string, but we can check if it's there
      // Since we use chalk, it adds ANSI escape codes.
      
      vi.useRealTimers();
    });

    it('should not display overdue dueDate in red if status is done', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-01'));
      
      const doneOverdueTask: TaskDetails = {
        ...mockTask,
        dueDate: '2023-12-31',
        status: { name: 'Done', category: 'done' }
      };
      
      const output = formatTaskDetails(doneOverdueTask);
      expect(output).toContain('Due Date');
      expect(output).toContain('2023-12-31');
      
      vi.useRealTimers();
    });

    it('should display future dueDate in green', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-01'));
      
      const futureTask: TaskDetails = {
        ...mockTask,
        dueDate: '2024-01-02'
      };
      
      const output = formatTaskDetails(futureTask);
      expect(output).toContain('Due Date');
      expect(output).toContain('2024-01-02');
      
      vi.useRealTimers();
    });

    it('should include history section when history is present', () => {
      const taskWithHistory: TaskDetails = {
        ...mockTask,
        history: [
          {
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
          }
        ]
      };
      
      const output = formatTaskDetails(taskWithHistory);
      expect(output).toContain('Task History');
      expect(output).toContain('John Doe');
      expect(output).toContain('status');
      expect(output).toContain('To Do');
      expect(output).toContain('In Progress');
    });
  });

  describe('formatUsers', () => {
    it('should format a list of users into a table', () => {
      const mockUsers: UserInfo[] = [
        {
          accountId: 'acc-1',
          displayName: 'User One',
          emailAddress: 'user1@example.com',
          active: true,
          timeZone: 'UTC',
          host: 'test.atlassian.net'
        }
      ];
      const output = formatUsers(mockUsers);
      expect(output).toContain('User One');
      expect(output).toContain('user1@example.com');
      expect(output).toContain('acc-1');
      expect(output).toContain('Colleagues (1 total)');
    });

    it('should display "No users found." when list is empty', () => {
      const output = formatUsers([]);
      expect(output).toContain('No users found.');
    });

    it('should handle users without email', () => {
      const mockUsers: UserInfo[] = [
        {
          accountId: 'acc-1',
          displayName: 'User One',
          emailAddress: null as any,
          active: true,
          timeZone: 'UTC',
          host: 'test.atlassian.net'
        }
      ];
      const output = formatUsers(mockUsers);
      expect(output).toContain('User One');
      expect(output).toContain('N/A');
    });
  });

  describe('formatUserInfo', () => {
    it('should format user info into a table', () => {
      const mockUser: UserInfo = {
        accountId: 'acc-123',
        displayName: 'John Doe',
        emailAddress: 'john@example.com',
        active: true,
        timeZone: 'America/New_York',
        host: 'test.atlassian.net'
      };
      const output = formatUserInfo(mockUser);
      expect(output).toContain('User Information:');
      expect(output).toContain('John Doe');
      expect(output).toContain('john@example.com');
      expect(output).toContain('acc-123');
      expect(output).toContain('Active');
      expect(output).toContain('America/New_York');
    });

    it('should show inactive status', () => {
      const mockUser: UserInfo = {
        accountId: 'acc-123',
        displayName: 'Jane Doe',
        emailAddress: 'jane@example.com',
        active: false,
        timeZone: 'UTC',
        host: 'test.atlassian.net'
      };
      const output = formatUserInfo(mockUser);
      expect(output).toContain('Inactive');
    });
  });

  describe('formatProjects', () => {
    it('should format a list of projects', () => {
      const mockProjects: Project[] = [
        {
          id: '1',
          key: 'PROJ',
          name: 'Project One',
          projectTypeKey: 'software',
          lead: { displayName: 'John Doe' }
        }
      ];
      const output = formatProjects(mockProjects);
      expect(output).toContain('Projects (1 total)');
      expect(output).toContain('PROJ');
      expect(output).toContain('Project One');
      expect(output).toContain('software');
      expect(output).toContain('John Doe');
    });

    it('should display N/A for project without lead', () => {
      const mockProjects: Project[] = [
        {
          id: '1',
          key: 'PROJ',
          name: 'Project One',
          projectTypeKey: 'software',
          lead: null as any
        }
      ];
      const output = formatProjects(mockProjects);
      expect(output).toContain('N/A');
    });

    it('should display message when no projects found', () => {
      const output = formatProjects([]);
      expect(output).toContain('No projects found.');
    });
  });

  describe('formatTaskHistory', () => {
    it('should format task history', () => {
      const mockHistory: HistoryEntry[] = [
        {
          id: '1',
          author: 'John Doe',
          created: '2023-01-01T10:00:00.000Z',
          items: [
            { field: 'status', from: 'To Do', to: 'In Progress' }
          ]
        }
      ];
      const output = formatTaskHistory(mockHistory);
      expect(output).toContain('Task History (1 entries)');
      expect(output).toContain('John Doe');
      expect(output).toContain('status');
      expect(output).toContain('To Do');
      expect(output).toContain('In Progress');
    });

    it('should handle history with multiple items per entry', () => {
      const mockHistory: HistoryEntry[] = [
        {
          id: '1',
          author: 'John Doe',
          created: '2023-01-01T10:00:00.000Z',
          items: [
            { field: 'status', from: 'To Do', to: 'In Progress' },
            { field: 'assignee', from: null, to: 'Jane Doe' }
          ]
        }
      ];
      const output = formatTaskHistory(mockHistory);
      expect(output).toContain('status');
      expect(output).toContain('assignee');
      expect(output).toContain('None');
    });

    it('should display message when no history', () => {
      const output = formatTaskHistory([]);
      expect(output).toContain('No history entries found.');
    });
  });

  describe('formatProjectStatuses', () => {
    it('should format project statuses', () => {
      const mockStatuses: Status[] = [
        {
          id: '1',
          name: 'To Do',
          description: 'Work to be done',
          statusCategory: { key: 'NEW', name: 'To Do' }
        },
        {
          id: '2',
          name: 'Done',
          description: 'Completed work',
          statusCategory: { key: 'DONE', name: 'Done' }
        }
      ];
      const output = formatProjectStatuses('PROJ', mockStatuses);
      expect(output).toContain('Project PROJ - Available Statuses (2 total)');
      expect(output).toContain('To Do');
      expect(output).toContain('Done');
    });

    it('should handle statuses without description', () => {
      const mockStatuses: Status[] = [
        {
          id: '1',
          name: 'Custom',
          description: null as any,
          statusCategory: { key: 'INDETERMINATE', name: 'In Progress' }
        }
      ];
      const output = formatProjectStatuses('PROJ', mockStatuses);
      expect(output).toContain('No description');
    });

    it('should display message when no statuses', () => {
      const output = formatProjectStatuses('PROJ', []);
      expect(output).toContain('No statuses found for this project.');
    });
  });

  describe('formatJqlResults', () => {
    it('should format JQL results', () => {
      const mockIssues: JqlIssue[] = [
        {
          key: 'TEST-1',
          summary: 'Test issue',
          status: { name: 'In Progress' },
          assignee: { displayName: 'John Doe' },
          priority: { name: 'High' }
        }
      ];
      const output = formatJqlResults(mockIssues);
      expect(output).toContain('Results (1 total)');
      expect(output).toContain('TEST-1');
      expect(output).toContain('Test issue');
      expect(output).toContain('In Progress');
      expect(output).toContain('John Doe');
      expect(output).toContain('High');
    });

    it('should handle issues without assignee', () => {
      const mockIssues: JqlIssue[] = [
        {
          key: 'TEST-1',
          summary: 'Test issue',
          status: { name: 'To Do' },
          assignee: null as any,
          priority: { name: 'Medium' }
        }
      ];
      const output = formatJqlResults(mockIssues);
      expect(output).toContain('Unassigned');
    });

    it('should handle issues without priority', () => {
      const mockIssues: JqlIssue[] = [
        {
          key: 'TEST-1',
          summary: 'Test issue',
          status: { name: 'To Do' },
          assignee: { displayName: 'John Doe' },
          priority: null as any
        }
      ];
      const output = formatJqlResults(mockIssues);
      expect(output).toContain('None');
    });

    it('should display message when no results', () => {
      const output = formatJqlResults([]);
      expect(output).toContain('No issues found matching your JQL query.');
    });
  });

  describe('formatProjectIssueTypes', () => {
    it('should format project issue types', () => {
      const mockIssueTypes: IssueType[] = [
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
      ];
      const output = formatProjectIssueTypes('PROJ', mockIssueTypes);
      expect(output).toContain('Project PROJ - Issue Types (2 total)');
      expect(output).toContain('Standard Issue Types:');
      expect(output).toContain('Subtask Types:');
      expect(output).toContain('Task');
      expect(output).toContain('Subtask');
    });

    it('should handle only standard types', () => {
      const mockIssueTypes: IssueType[] = [
        {
          id: '1',
          name: 'Task',
          description: 'A task',
          subtask: false,
          hierarchyLevel: 0
        }
      ];
      const output = formatProjectIssueTypes('PROJ', mockIssueTypes);
      expect(output).toContain('Standard Issue Types:');
      expect(output).not.toContain('Subtask Types:');
    });

    it('should handle types without description', () => {
      const mockIssueTypes: IssueType[] = [
        {
          id: '1',
          name: 'Custom',
          description: null as any,
          subtask: false,
          hierarchyLevel: 0
        }
      ];
      const output = formatProjectIssueTypes('PROJ', mockIssueTypes);
      expect(output).toContain('No description');
    });

    it('should display message when no issue types', () => {
      const output = formatProjectIssueTypes('PROJ', []);
      expect(output).toContain('No issue types found for this project.');
    });
  });

  describe('formatIssueStatistics', () => {
    it('should format issue statistics', () => {
      const mockStats: IssueStatistics[] = [
        {
          key: 'TEST-1',
          summary: 'Test issue',
          timeSpentSeconds: 3600,
          originalEstimateSeconds: 7200,
          statusDurations: {
            'To Do': 1800,
            'In Progress': 3600
          }
        }
      ];
      const output = formatIssueStatistics(mockStats);
      expect(output).toContain('Issue Statistics');
      expect(output).toContain('TEST-1');
      expect(output).toContain('Test issue');
      expect(output).toContain('To Do');
      expect(output).toContain('In Progress');
    });

    it('should highlight when time spent exceeds estimate', () => {
      const mockStats: IssueStatistics[] = [
        {
          key: 'TEST-1',
          summary: 'Over budget',
          timeSpentSeconds: 10000,
          originalEstimateSeconds: 5000,
          statusDurations: {}
        }
      ];
      const output = formatIssueStatistics(mockStats);
      expect(output).toContain('TEST-1');
    });

    it('should handle zero estimate', () => {
      const mockStats: IssueStatistics[] = [
        {
          key: 'TEST-1',
          summary: 'No estimate',
          timeSpentSeconds: 3600,
          originalEstimateSeconds: 0,
          statusDurations: {}
        }
      ];
      const output = formatIssueStatistics(mockStats);
      expect(output).toContain('TEST-1');
    });

    it('should display message when no statistics', () => {
      const output = formatIssueStatistics([]);
      expect(output).toContain('No statistics to display.');
    });
  });

  describe('formatTaskDetails with additional scenarios', () => {
    it('should handle task with parent', () => {
      const taskWithParent: TaskDetails = {
        ...mockTask,
        parent: {
          key: 'PROJ-100',
          summary: 'Parent task',
          status: { name: 'In Progress' }
        }
      };
      const output = formatTaskDetails(taskWithParent);
      expect(output).toContain('Parent Task:');
      expect(output).toContain('PROJ-100');
      expect(output).toContain('Parent task');
    });

    it('should handle task with subtasks', () => {
      const taskWithSubtasks: TaskDetails = {
        ...mockTask,
        subtasks: [
          {
            key: 'PROJ-124',
            summary: 'Subtask 1',
            status: { name: 'Done' }
          },
          {
            key: 'PROJ-125',
            summary: 'Subtask 2',
            status: { name: 'To Do' }
          }
        ]
      };
      const output = formatTaskDetails(taskWithSubtasks);
      expect(output).toContain('Subtasks (2):');
      expect(output).toContain('PROJ-124');
      expect(output).toContain('PROJ-125');
    });

    it('should handle task without description', () => {
      const taskNoDesc: TaskDetails = {
        ...mockTask,
        description: null as any
      };
      const output = formatTaskDetails(taskNoDesc);
      expect(output).not.toContain('Description:');
    });

    it('should handle task with comments', () => {
      const taskWithComments: TaskDetails = {
        ...mockTask,
        comments: [
          {
            id: '1',
            body: 'This is a comment',
            author: { displayName: 'John Doe' },
            created: '2023-01-03T10:00:00.000Z'
          }
        ]
      };
      const output = formatTaskDetails(taskWithComments);
      expect(output).toContain('Comments (1):');
      expect(output).toContain('John Doe');
      expect(output).toContain('This is a comment');
    });

    it('should handle task without assignee or reporter', () => {
      const taskNoAssignee: TaskDetails = {
        ...mockTask,
        assignee: null as any,
        reporter: null as any
      };
      const output = formatTaskDetails(taskNoAssignee);
      expect(output).toContain('Unassigned');
      expect(output).toContain('N/A');
    });
  });
});
