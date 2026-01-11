import { taskWithDetailsCommand } from '../src/commands/task-with-details';
import * as jiraClient from '../src/lib/jira-client';
import * as formatters from '../src/lib/formatters';

// Mock dependencies
jest.mock('../src/lib/jira-client');
jest.mock('../src/lib/formatters');
jest.mock('ora', () => {
  return jest.fn(() => ({
    start: jest.fn().mockReturnThis(),
    succeed: jest.fn().mockReturnThis(),
    fail: jest.fn().mockReturnThis()
  }));
});

const mockJiraClient = jiraClient as jest.Mocked<typeof jiraClient>;
const mockFormatters = formatters as jest.Mocked<typeof formatters>;

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
    jest.clearAllMocks();
    console.log = jest.fn();
    console.error = jest.fn();
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
    const processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('Process exit');
    });

    await expect(taskWithDetailsCommand('INVALID-1')).rejects.toThrow('Process exit');
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Error: Task not found'));
    expect(processExitSpy).toHaveBeenCalledWith(1);

    processExitSpy.mockRestore();
  });
});
