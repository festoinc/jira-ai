import { addLabelCommand } from '../src/commands/add-label';
import { deleteLabelCommand } from '../src/commands/delete-label';
import * as jiraClient from '../src/lib/jira-client';

// Mock dependencies
jest.mock('../src/lib/jira-client');
jest.mock('ora', () => {
  return jest.fn(() => ({
    start: jest.fn().mockReturnThis(),
    succeed: jest.fn().mockReturnThis(),
    fail: jest.fn().mockReturnThis()
  }));
});

const mockJiraClient = jiraClient as jest.Mocked<typeof jiraClient>;

describe('Label Commands', () => {
  const mockTaskId = 'TEST-123';
  const mockLabelsString = 'bug, critical';
  const mockLabelsArray = ['bug', 'critical'];

  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn();
    console.error = jest.fn();
    
    mockJiraClient.addIssueLabels = jest.fn().mockResolvedValue(undefined);
    mockJiraClient.removeIssueLabels = jest.fn().mockResolvedValue(undefined);
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
      const processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
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
      const processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
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
      const processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
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
      const processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
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
      const processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('Process exit');
      });

      await expect(deleteLabelCommand(mockTaskId, mockLabelsString)).rejects.toThrow('Process exit');

      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Some error'));
      expect(processExitSpy).toHaveBeenCalledWith(1);
      processExitSpy.mockRestore();
    });
  });
});
