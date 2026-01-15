import { vi, describe, it, expect, beforeEach } from 'vitest';
import { taskWithDetailsCommand } from '../src/commands/task-with-details.js';
import * as jiraClient from '../src/lib/jira-client.js';
import * as formatters from '../src/lib/formatters.js';
import * as settings from '../src/lib/settings.js';

// Mock dependencies
vi.mock('../src/lib/jira-client.js');
vi.mock('../src/lib/formatters.js');
vi.mock('../src/lib/settings.js');
vi.mock('ora', () => {
  return {
    default: vi.fn(() => ({
      start: vi.fn().mockReturnThis(),
      succeed: vi.fn().mockReturnThis(),
      fail: vi.fn().mockReturnThis(),
      stop: vi.fn().mockReturnThis(),
    })),
  };
});

const mockJiraClient = jiraClient as vi.Mocked<typeof jiraClient>;
const mockFormatters = formatters as vi.Mocked<typeof formatters>;
const mockSettings = settings as vi.Mocked<typeof settings>;

describe('Task With Details Command', () => {
  const mockTask: any = {
    id: '10001',
    key: 'PROJ-123',
    summary: 'Test task summary',
    description: 'Test task description',
    status: { name: 'In Progress' },
    assignee: { accountId: 'user-1', displayName: 'John Doe' },
    reporter: { accountId: 'user-2', displayName: 'Jane Smith' },
    created: '2023-01-01T10:00:00.000Z',
    updated: '2023-01-02T10:00:00.000Z',
    labels: ['frontend', 'ui'],
    comments: [],
    parent: {
      id: '10000',
      key: 'PROJ-100',
      summary: 'Parent task summary',
      status: { name: 'Done' }
    },
    subtasks: []
  };

  const mockUser = {
    accountId: 'user-1',
    displayName: 'John Doe',
    emailAddress: 'john@example.com',
    active: true,
    timeZone: 'UTC',
    host: 'test.atlassian.net'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    console.log = vi.fn();
    console.error = vi.fn();
    
    mockSettings.isCommandAllowed.mockReturnValue(true);
    mockSettings.validateIssueAgainstFilters.mockReturnValue(true);
    mockJiraClient.getCurrentUser.mockResolvedValue(mockUser);
  });

  it('should fetch and display task details with parent and subtasks', async () => {
    mockJiraClient.validateIssuePermissions.mockResolvedValue(mockTask);
    mockFormatters.formatTaskDetails.mockReturnValue('Formatted task details');

    await taskWithDetailsCommand('PROJ-123');

    expect(mockJiraClient.validateIssuePermissions).toHaveBeenCalledWith('PROJ-123', 'task-with-details', expect.objectContaining({
      includeHistory: undefined
    }));
    expect(mockFormatters.formatTaskDetails).toHaveBeenCalledWith(mockTask);
    expect(console.log).toHaveBeenCalledWith('Formatted task details');
  });

  it('should handle errors gracefully', async () => {
    const mockError = new Error('Task not found');
    mockJiraClient.validateIssuePermissions.mockRejectedValue(mockError);

    await expect(taskWithDetailsCommand('INVALID-1')).rejects.toThrow('Task not found');
  });
});