import { vi, describe, it, expect, beforeEach } from 'vitest';
import { issueAssignCommand } from '../src/commands/issue.js';
import * as jiraClient from '../src/lib/jira-client.js';
import { CommandError } from '../src/lib/errors.js';

// Mock dependencies
vi.mock('../src/lib/jira-client.js');
vi.mock('../src/lib/ui.js', () => ({
  ui: {
    startSpinner: vi.fn(),
    stopSpinner: vi.fn(),
    succeedSpinner: vi.fn(),
    failSpinner: vi.fn(),
  }
}));

const mockJiraClient = jiraClient as vi.Mocked<typeof jiraClient>;

describe('Issue Assign Command', () => {
  const issueKey = 'PROJ-123';
  const accountId = 'user-123';

  beforeEach(() => {
    vi.clearAllMocks();
    mockJiraClient.validateIssuePermissions.mockResolvedValue({} as any);
    mockJiraClient.assignIssue.mockResolvedValue();
  });

  it('should successfully assign an issue', async () => {
    await issueAssignCommand(issueKey, accountId);

    expect(mockJiraClient.validateIssuePermissions).toHaveBeenCalledWith(issueKey, 'issue');
    expect(mockJiraClient.assignIssue).toHaveBeenCalledWith(issueKey, accountId);
  });

  it('should successfully unassign an issue when accountId is "null"', async () => {
    await issueAssignCommand(issueKey, 'null');

    expect(mockJiraClient.assignIssue).toHaveBeenCalledWith(issueKey, null);
  });

  it('should handle API errors during assignment', async () => {
    const apiError = new Error('Assignment failed');
    mockJiraClient.assignIssue.mockRejectedValue(apiError);

    await expect(issueAssignCommand(issueKey, accountId))
      .rejects.toThrow('Failed to assign issue: Assignment failed');
  });

  it('should provide hints for 400 Bad Request', async () => {
    const apiError: any = new Error('400 Bad Request');
    mockJiraClient.assignIssue.mockRejectedValue(apiError);

    const promise = issueAssignCommand(issueKey, accountId);
    await expect(promise).rejects.toThrow();
    
    const error = await promise.catch(e => e);
    expect(error.hints).toContain('The assignee account ID might be invalid or the user is not assignable to this issue.');
  });

  it('should provide hints for 403 Forbidden', async () => {
    const apiError: any = new Error('403 Forbidden');
    mockJiraClient.assignIssue.mockRejectedValue(apiError);

    const promise = issueAssignCommand(issueKey, accountId);
    await expect(promise).rejects.toThrow();
    
    const error = await promise.catch(e => e);
    expect(error.hints).toContain('You may not have permission to assign this issue');
  });
});
