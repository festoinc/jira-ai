import { vi, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, test } from 'vitest';
import { addLabelCommand } from '../src/commands/add-label.js';
import { deleteLabelCommand } from '../src/commands/delete-label.js';
import * as jiraClient from '../src/lib/jira-client.js';

// Mock dependencies
vi.mock('../src/lib/jira-client.js');
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

    it('should exit with error when task ID is empty', async () => {
      const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('Process exit');
      });

      await expect(addLabelCommand('', mockLabelsString)).rejects.toThrow('Process exit');

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Task ID is required')
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
      processExitSpy.mockRestore();
    });

    it('should exit with error when labels string is empty', async () => {
      const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('Process exit');
      });

      await expect(addLabelCommand(mockTaskId, '')).rejects.toThrow('Process exit');

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Labels are required')
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
      processExitSpy.mockRestore();
    });

    it('should handle API errors and show hints', async () => {
      const apiError = new Error('Not Found (404)');
      mockJiraClient.addIssueLabels.mockRejectedValue(apiError);
      const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('Process exit');
      });

      await expect(addLabelCommand(mockTaskId, mockLabelsString)).rejects.toThrow('Process exit');

      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Not Found (404)'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Hint: Check that the issue ID/key is correct'));
      expect(processExitSpy).toHaveBeenCalledWith(1);
      processExitSpy.mockRestore();
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

    it('should exit with error when task ID is empty', async () => {
      const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('Process exit');
      });

      await expect(deleteLabelCommand('', mockLabelsString)).rejects.toThrow('Process exit');

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Task ID is required')
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
      processExitSpy.mockRestore();
    });

    it('should handle API errors', async () => {
      const apiError = new Error('Some error');
      mockJiraClient.removeIssueLabels.mockRejectedValue(apiError);
      const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('Process exit');
      });

      await expect(deleteLabelCommand(mockTaskId, mockLabelsString)).rejects.toThrow('Process exit');

      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Some error'));
      expect(processExitSpy).toHaveBeenCalledWith(1);
      processExitSpy.mockRestore();
    });
  });
});
