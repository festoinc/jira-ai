import { vi, describe, it, expect, beforeEach } from 'vitest';
import { addCommentCommand } from '../src/commands/add-comment.js';
import * as jiraClient from '../src/lib/jira-client.js';
import * as fs from 'fs';
import * as path from 'path';
import { markdownToAdf } from 'marklassian';
import { CommandError } from '../src/lib/errors.js';

// Mock dependencies
vi.mock('fs');
vi.mock('marklassian');
vi.mock('../src/lib/jira-client.js');
vi.mock('../src/lib/utils.js');
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
const mockFs = fs as vi.Mocked<typeof fs>;
const mockMarkdownToAdf = markdownToAdf as vi.MockedFunction<typeof markdownToAdf>;

describe('Add Comment Command', () => {
  const mockIssueKey = 'TEST-123';
  const mockFilePath = '/path/to/comment.md';
  const mockMarkdownContent = '# Test Comment\n\nThis is a test comment.';
  const mockAdfContent = {
    version: 1,
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: 'Test Comment' }]
      }
    ]
  };

  beforeEach(() => {
    vi.clearAllMocks();
    console.log = vi.fn();
    console.error = vi.fn();

    // Setup default mocks
    vi.spyOn(mockFs, 'existsSync').mockReturnValue(true);
    vi.spyOn(mockFs, 'readFileSync').mockReturnValue(mockMarkdownContent);
    mockMarkdownToAdf.mockReturnValue(mockAdfContent);
    mockJiraClient.addIssueComment = vi.fn().mockResolvedValue(undefined);
  });

  it('should successfully add a comment to a Jira issue', async () => {
    await addCommentCommand({ filePath: mockFilePath, issueKey: mockIssueKey });

    expect(mockFs.existsSync).toHaveBeenCalledWith(path.resolve(mockFilePath));
    expect(mockFs.readFileSync).toHaveBeenCalledWith(path.resolve(mockFilePath), 'utf-8');
    expect(mockMarkdownToAdf).toHaveBeenCalledWith(mockMarkdownContent);
    expect(mockJiraClient.addIssueComment).toHaveBeenCalledWith(
      mockIssueKey,
      mockAdfContent
    );
    expect(console.log).toHaveBeenCalled();
  });

  it('should throw error when issue key is empty', async () => {
    await expect(addCommentCommand({ filePath: mockFilePath, issueKey: '' })).rejects.toThrow(
      CommandError
    );
    await expect(addCommentCommand({ filePath: mockFilePath, issueKey: '' })).rejects.toThrow(
      'Issue key is required'
    );
  });

  it('should throw error when file path is empty', async () => {
    await expect(addCommentCommand({ filePath: '', issueKey: mockIssueKey })).rejects.toThrow(
      CommandError
    );
    await expect(addCommentCommand({ filePath: '', issueKey: mockIssueKey })).rejects.toThrow(
      'File path is required'
    );
  });

  it('should throw error when file does not exist', async () => {
    vi.spyOn(mockFs, 'existsSync').mockReturnValue(false);

    await expect(
      addCommentCommand({ filePath: mockFilePath, issueKey: mockIssueKey })
    ).rejects.toThrow(CommandError);
    await expect(
      addCommentCommand({ filePath: mockFilePath, issueKey: mockIssueKey })
    ).rejects.toThrow('File not found');
  });

  it('should throw error when file read fails', async () => {
    const readError = new Error('Permission denied');
    vi.spyOn(mockFs, 'readFileSync').mockImplementation(() => {
      throw readError;
    });

    await expect(
      addCommentCommand({ filePath: mockFilePath, issueKey: mockIssueKey })
    ).rejects.toThrow(CommandError);
    await expect(
      addCommentCommand({ filePath: mockFilePath, issueKey: mockIssueKey })
    ).rejects.toThrow('Error reading file');
  });

  it('should throw error when file is empty', async () => {
    vi.spyOn(mockFs, 'readFileSync').mockReturnValue('   \n  \t  ');

    await expect(
      addCommentCommand({ filePath: mockFilePath, issueKey: mockIssueKey })
    ).rejects.toThrow(CommandError);
    await expect(
      addCommentCommand({ filePath: mockFilePath, issueKey: mockIssueKey })
    ).rejects.toThrow('File is empty');
  });

  it('should throw error when markdown conversion fails', async () => {
    const conversionError = new Error('Invalid markdown syntax');
    mockMarkdownToAdf.mockImplementation(() => {
      throw conversionError;
    });

    await expect(
      addCommentCommand({ filePath: mockFilePath, issueKey: mockIssueKey })
    ).rejects.toThrow(CommandError);
    await expect(
      addCommentCommand({ filePath: mockFilePath, issueKey: mockIssueKey })
    ).rejects.toThrow('Error converting Markdown to ADF');
  });

  it('should throw error and hint when issue not found (404)', async () => {
    const apiError = new Error('Issue not found (404)');
    mockJiraClient.addIssueComment = vi.fn().mockRejectedValue(apiError);

    const promise = addCommentCommand({ filePath: mockFilePath, issueKey: mockIssueKey });
    await expect(promise).rejects.toThrow('Issue not found (404)');
    const error = await promise.catch(e => e);
    expect(error.hints).toContain('Check that the issue key is correct');
  });

  it('should throw error and hint when permission denied (403)', async () => {
    const apiError = new Error('Permission denied (403)');
    mockJiraClient.addIssueComment = vi.fn().mockRejectedValue(apiError);

    const promise = addCommentCommand({ filePath: mockFilePath, issueKey: mockIssueKey });
    await expect(promise).rejects.toThrow('Permission denied (403)');
    const error = await promise.catch(e => e);
    expect(error.hints).toContain('You may not have permission to comment on this issue');
  });
});
