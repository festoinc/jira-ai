import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createTaskCommand } from '../src/commands/create-task.js';
import * as jiraClient from '../src/lib/jira-client.js';
import { CommandError } from '../src/lib/errors.js';

// Mock dependencies
vi.mock('../src/lib/jira-client.js');
vi.mock('../src/lib/utils.js');
vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis()
  }))
}));

const mockJiraClient = jiraClient as vi.Mocked<typeof jiraClient>;

describe('Create Task Command', () => {
  const mockOptions = {
    title: 'Test Task Title',
    project: 'TEST',
    issueType: 'Task',
  };

  const mockResponse = {
    key: 'TEST-123',
    id: '10001',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    console.log = vi.fn();
    console.error = vi.fn();

    // Setup default mock
    mockJiraClient.createIssue = vi.fn().mockResolvedValue(mockResponse);
  });

  it('should successfully create a task', async () => {
    await createTaskCommand(mockOptions);

    expect(mockJiraClient.createIssue).toHaveBeenCalledWith(
      'TEST',
      'Test Task Title',
      'Task',
      undefined
    );
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('TEST-123'));
  });

  it('should create a task with parent issue', async () => {
    const optionsWithParent = {
      ...mockOptions,
      parent: 'TEST-100',
    };

    await createTaskCommand(optionsWithParent);

    expect(mockJiraClient.createIssue).toHaveBeenCalledWith(
      'TEST',
      'Test Task Title',
      'Task',
      'TEST-100'
    );
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Parent: TEST-100'));
  });

  it('should throw error when title is empty', async () => {
    await expect(
      createTaskCommand({ ...mockOptions, title: '' })
    ).rejects.toThrow(CommandError);
    await expect(
      createTaskCommand({ ...mockOptions, title: '' })
    ).rejects.toThrow('Title is required');
  });

  it('should throw error when project is empty', async () => {
    await expect(
      createTaskCommand({ ...mockOptions, project: '' })
    ).rejects.toThrow(CommandError);
    await expect(
      createTaskCommand({ ...mockOptions, project: '' })
    ).rejects.toThrow('Project is required');
  });

  it('should throw error when issue type is empty', async () => {
    await expect(
      createTaskCommand({ ...mockOptions, issueType: '' })
    ).rejects.toThrow(CommandError);
    await expect(
      createTaskCommand({ ...mockOptions, issueType: '' })
    ).rejects.toThrow('Issue type is required');
  });

    it('should throw error and hint when project not found', async () => {

      const apiError = new Error('Project does not exist');

      mockJiraClient.createIssue = vi.fn().mockRejectedValue(apiError);

  

      const promise = createTaskCommand(mockOptions);

      await expect(promise).rejects.toThrow('Project does not exist');

      await expect(promise).rejects.toBeInstanceOf(CommandError);

      const error = await promise.catch(e => e);

      expect(error.hints).toContain('Check that the project key is correct');

    });

  

    it('should throw error and hint when issue type is invalid', async () => {

      const apiError = new Error('Invalid issue type specified');

      mockJiraClient.createIssue = vi.fn().mockRejectedValue(apiError);

  

      const promise = createTaskCommand(mockOptions);

      await expect(promise).rejects.toThrow('Invalid issue type specified');

      const error = await promise.catch(e => e);

      expect(error.hints).toContain('Check that the issue type is correct');

    });

  

    it('should throw error and hint when parent issue is invalid', async () => {

      const apiError = new Error('Parent issue not found');

      mockJiraClient.createIssue = vi.fn().mockRejectedValue(apiError);

  

      const promise = createTaskCommand({ ...mockOptions, parent: 'TEST-999' });

      await expect(promise).rejects.toThrow('Parent issue not found');

      const error = await promise.catch(e => e);

      expect(error.hints).toContain('Check that the parent issue key is correct');

    });

  

    it('should throw error and hint when permission denied (403)', async () => {

      const apiError = new Error('Permission denied (403)');

      mockJiraClient.createIssue = vi.fn().mockRejectedValue(apiError);

  

      const promise = createTaskCommand(mockOptions);

      await expect(promise).rejects.toThrow('Permission denied (403)');

      const error = await promise.catch(e => e);

      expect(error.hints).toContain('You may not have permission to create issues in this project');

    });

  });

  