import { vi, describe, it, expect, beforeEach } from 'vitest';
import { addLabelCommand } from '../src/commands/add-label.js';
import { deleteLabelCommand } from '../src/commands/delete-label.js';
import * as jiraClient from '../src/lib/jira-client.js';
import { CommandError } from '../src/lib/errors.js';

// Mock dependencies
vi.mock('../src/lib/jira-client.js');
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
  });

  describe('add-label-to-issue', () => {
    it('should successfully add labels to a Jira issue', async () => {
      await addLabelCommand(mockTaskId, mockLabelsString);

      expect(mockJiraClient.addIssueLabels).toHaveBeenCalledWith(
        mockTaskId,
        mockLabelsArray
      );
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Labels: bug, critical'));
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
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Labels: bug, critical'));
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
