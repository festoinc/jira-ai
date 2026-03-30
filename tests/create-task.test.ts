import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createTaskCommand } from '../src/commands/create-task.js';
import * as jiraClient from '../src/lib/jira-client.js';
import { CommandError } from '../src/lib/errors.js';
import * as settings from '../src/lib/settings.js';

// Mock dependencies
vi.mock('../src/lib/jira-client.js');
vi.mock('../src/lib/utils.js');
vi.mock('../src/lib/settings.js');
vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis()
  }))
}));

const mockJiraClient = jiraClient as vi.Mocked<typeof jiraClient>;
const mockSettings = settings as vi.Mocked<typeof settings>;

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
    mockSettings.isProjectAllowed.mockReturnValue(true);
    mockSettings.isCommandAllowed.mockReturnValue(true);
  });

  it('should successfully create a task', async () => {
    await createTaskCommand(mockOptions);

    expect(mockJiraClient.createIssue).toHaveBeenCalledWith(
      expect.objectContaining({
        project: 'TEST',
        summary: 'Test Task Title',
        issueType: 'Task',
      })
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
      expect.objectContaining({
        project: 'TEST',
        summary: 'Test Task Title',
        issueType: 'Task',
        parent: 'TEST-100',
      })
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

  // =========================================================================
  // JIR-42: New optional fields — intentionally RED (feature not yet built)
  // =========================================================================

  describe('New optional fields (JIR-42)', () => {
    it('should create a task with priority', async () => {
      await createTaskCommand({ ...mockOptions, priority: 'High' });

      expect(mockJiraClient.createIssue).toHaveBeenCalledWith(
        expect.objectContaining({ priority: { name: 'High' } })
      );
    });

    it('should create a task with description from string', async () => {
      await createTaskCommand({ ...mockOptions, description: '# My description' });

      expect(mockJiraClient.createIssue).toHaveBeenCalledWith(
        expect.objectContaining({ description: expect.objectContaining({ type: 'doc' }) })
      );
    });

    it('should create a task with description from file (--description-file)', async () => {
      await createTaskCommand({ ...mockOptions, descriptionFile: '/path/to/desc.md' });

      expect(mockJiraClient.createIssue).toHaveBeenCalledWith(
        expect.objectContaining({ description: expect.objectContaining({ type: 'doc' }) })
      );
    });

    it('should create a task with labels', async () => {
      await createTaskCommand({ ...mockOptions, labels: 'bug,frontend' });

      expect(mockJiraClient.createIssue).toHaveBeenCalledWith(
        expect.objectContaining({ labels: ['bug', 'frontend'] })
      );
    });

    it('should create a task with a single label', async () => {
      await createTaskCommand({ ...mockOptions, labels: 'backend' });

      expect(mockJiraClient.createIssue).toHaveBeenCalledWith(
        expect.objectContaining({ labels: ['backend'] })
      );
    });

    it('should create a task with component', async () => {
      await createTaskCommand({ ...mockOptions, component: 'Backend' });

      expect(mockJiraClient.createIssue).toHaveBeenCalledWith(
        expect.objectContaining({ components: [{ name: 'Backend' }] })
      );
    });

    it('should create a task with multiple components', async () => {
      await createTaskCommand({ ...mockOptions, component: 'Backend,API' });

      expect(mockJiraClient.createIssue).toHaveBeenCalledWith(
        expect.objectContaining({ components: [{ name: 'Backend' }, { name: 'API' }] })
      );
    });

    it('should create a task with fix version', async () => {
      await createTaskCommand({ ...mockOptions, fixVersion: 'v1.0' });

      expect(mockJiraClient.createIssue).toHaveBeenCalledWith(
        expect.objectContaining({ fixVersions: [{ name: 'v1.0' }] })
      );
    });

    it('should create a task with due date', async () => {
      await createTaskCommand({ ...mockOptions, dueDate: '2025-12-31' });

      expect(mockJiraClient.createIssue).toHaveBeenCalledWith(
        expect.objectContaining({ duedate: '2025-12-31' })
      );
    });

    it('should create a task with assignee by account id', async () => {
      await createTaskCommand({ ...mockOptions, assignee: 'accountid:abc123' });

      expect(mockJiraClient.createIssue).toHaveBeenCalledWith(
        expect.objectContaining({ assignee: { accountId: 'abc123' } })
      );
    });

    it('should resolve assignee by display name during create', async () => {
      mockJiraClient.resolveUserByName = vi.fn().mockResolvedValue('resolved-id');
      await createTaskCommand({ ...mockOptions, assignee: 'Jane Doe' });

      expect(mockJiraClient.resolveUserByName).toHaveBeenCalledWith('Jane Doe');
      expect(mockJiraClient.createIssue).toHaveBeenCalledWith(
        expect.objectContaining({ assignee: { accountId: 'resolved-id' } })
      );
    });

    it('should create a task with a custom field', async () => {
      await createTaskCommand({ ...mockOptions, customField: ['customfield_10100=5'] });

      expect(mockJiraClient.createIssue).toHaveBeenCalledWith(
        expect.objectContaining({ customfield_10100: 5 })
      );
    });

    it('should create a task with all optional fields combined', async () => {
      await createTaskCommand({
        ...mockOptions,
        priority: 'Medium',
        description: '# Desc',
        labels: 'bug',
        component: 'Core',
        fixVersion: 'v2.0',
        dueDate: '2026-06-01',
        assignee: 'accountid:xyz',
        customField: ['customfield_10100=3'],
      });

      expect(mockJiraClient.createIssue).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: { name: 'Medium' },
          labels: ['bug'],
          components: [{ name: 'Core' }],
          fixVersions: [{ name: 'v2.0' }],
          duedate: '2026-06-01',
          assignee: { accountId: 'xyz' },
          customfield_10100: 3,
        })
      );
    });

    it('should throw when due date format is invalid', async () => {
      await expect(
        createTaskCommand({ ...mockOptions, dueDate: 'tomorrow' })
      ).rejects.toThrow(CommandError);
    });

    it('should throw when both --description and --description-file are provided', async () => {
      await expect(
        createTaskCommand({ ...mockOptions, description: '# Desc', descriptionFile: '/path/to/file.md' })
      ).rejects.toThrow(CommandError);
    });
  });
});
