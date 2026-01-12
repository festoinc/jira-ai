import { vi, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, test } from 'vitest';
import { taskWithDetailsCommand } from '../src/commands/task-with-details.js';
import * as jiraClient from '../src/lib/jira-client.js';
import * as formatters from '../src/lib/formatters.js';

// Mock dependencies
vi.mock('../src/lib/jira-client.js');
vi.mock('../src/lib/formatters.js');
vi.mock('ora', () => {
  return {
    default: vi.fn(() => ({
      start: vi.fn().mockReturnThis(),
      succeed: vi.fn().mockReturnThis(),
      fail: vi.fn().mockReturnThis(),
    })),
  };
});

const mockJiraClient = jiraClient as vi.Mocked<typeof jiraClient>;
const mockFormatters = formatters as vi.Mocked<typeof formatters>;

describe('Task With Details Command', () => {
  const mockTask: jiraClient.TaskDetails = {
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
    parent: {
      id: '10000',
      key: 'PROJ-100',
      summary: 'Parent task summary',
      status: { name: 'Done' }
    },
    subtasks: [
      {
        id: '10002',
        key: 'PROJ-124',
        summary: 'Subtask 1 summary',
        status: { name: 'To Do' }
      },
      {
        id: '10003',
        key: 'PROJ-125',
        summary: 'Subtask 2 summary',
        status: { name: 'In Progress' }
      }
    ]
  };

  beforeEach(() => {
    vi.clearAllMocks();
    console.log = vi.fn();
    console.error = vi.fn();
  });

  it('should fetch and display task details with parent and subtasks', async () => {
    mockJiraClient.getTaskWithDetails.mockResolvedValue(mockTask);
    mockFormatters.formatTaskDetails.mockReturnValue('Formatted task details');

    await taskWithDetailsCommand('PROJ-123');

    expect(mockJiraClient.getTaskWithDetails).toHaveBeenCalledWith('PROJ-123');
    expect(mockFormatters.formatTaskDetails).toHaveBeenCalledWith(mockTask);
    expect(console.log).toHaveBeenCalledWith('Formatted task details');
  });

  it('should handle errors gracefully', async () => {
    const mockError = new Error('Task not found');
    mockJiraClient.getTaskWithDetails.mockRejectedValue(mockError);
    const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('Process exit');
    });

    await expect(taskWithDetailsCommand('INVALID-1')).rejects.toThrow('Process exit');
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Error: Task not found'));
    expect(processExitSpy).toHaveBeenCalledWith(1);

    processExitSpy.mockRestore();
  });
});
