import { vi, describe, it, expect, beforeEach } from 'vitest';
import { addLabelCommand } from '../src/commands/add-label.js';
import { deleteLabelCommand } from '../src/commands/delete-label.js';
import * as jiraClient from '../src/lib/jira-client.js';
import { CommandError } from '../src/lib/errors.js';

// Mock dependencies
vi.mock('../src/lib/jira-client.js');

const mockJiraClient = jiraClient as vi.Mocked<typeof jiraClient>;

describe('Label Commands', () => {
  const mockTaskId = 'TEST-123';
  const mockLabelsString = 'bug, critical';
  const mockLabelsArray = ['bug', 'critical'];

  beforeEach(() => {
    vi.clearAllMocks();
    console.log = vi.fn();
    console.error = vi.fn();

    mockJiraClient.addIssueLabels = vi.fn().mockResolvedValue(undefined);
    mockJiraClient.removeIssueLabels = vi.fn().mockResolvedValue(undefined);
    mockJiraClient.validateIssuePermissions = vi.fn().mockResolvedValue({} as any);
  });

  describe('add-label-to-issue', () => {
    it('should successfully add labels to a Jira issue', async () => {
      await addLabelCommand(mockTaskId, mockLabelsString);

      expect(mockJiraClient.addIssueLabels).toHaveBeenCalledWith(
        mockTaskId,
        mockLabelsArray
      );
      // outputResult outputs JSON; parse and check labels
      const logCall = (console.log as any).mock.calls[0][0];
      const parsed = JSON.parse(logCall);
      expect(parsed).toHaveProperty('success', true);
      expect(parsed).toHaveProperty('issueKey', mockTaskId);
      expect(parsed.labels).toEqual(mockLabelsArray);
    });

    it('should throw error when task ID is empty', async () => {
      await expect(addLabelCommand('', mockLabelsString)).rejects.toThrow(CommandError);
      await expect(addLabelCommand('', mockLabelsString)).rejects.toThrow('Task ID is required');
    });

    it('should throw error when labels string is empty', async () => {
      await expect(addLabelCommand(mockTaskId, '')).rejects.toThrow(CommandError);
      await expect(addLabelCommand(mockTaskId, '')).rejects.toThrow('Labels are required');
    });

    it('should handle API errors and show hints', async () => {
      const apiError = new Error('Not Found (404)');
      mockJiraClient.addIssueLabels.mockRejectedValue(apiError);

      const promise = addLabelCommand(mockTaskId, mockLabelsString);
      await expect(promise).rejects.toThrow('Not Found (404)');
      const error = await promise.catch(e => e);
      expect(error.hints).toContain('Check that the issue ID/key is correct');
    });
  });

  describe('delete-label-from-issue', () => {
    it('should successfully remove labels from a Jira issue', async () => {
      await deleteLabelCommand(mockTaskId, mockLabelsString);

      expect(mockJiraClient.removeIssueLabels).toHaveBeenCalledWith(
        mockTaskId,
        mockLabelsArray
      );
      const logCall = (console.log as any).mock.calls[0][0];
      const parsed = JSON.parse(logCall);
      expect(parsed).toHaveProperty('success', true);
      expect(parsed).toHaveProperty('issueKey', mockTaskId);
      expect(parsed.labels).toEqual(mockLabelsArray);
    });

    it('should throw error when task ID is empty', async () => {
      await expect(deleteLabelCommand('', mockLabelsString)).rejects.toThrow(CommandError);
      await expect(deleteLabelCommand('', mockLabelsString)).rejects.toThrow('Task ID is required');
    });

    it('should handle API errors', async () => {
      const apiError = new Error('Some error');
      mockJiraClient.removeIssueLabels.mockRejectedValue(apiError);

      await expect(deleteLabelCommand(mockTaskId, mockLabelsString)).rejects.toThrow('Some error');
    });
  });
});
