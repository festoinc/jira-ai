import { vi, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, test } from 'vitest';
import { addCommentCommand } from '../src/commands/add-comment.js';
import * as jiraClient from '../src/lib/jira-client.js';
import * as fs from 'fs';
import * as path from 'path';
import { markdownToAdf } from 'marklassian';

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

  it('should exit with error when issue key is empty', async () => {
    const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('Process exit');
    });

    await expect(addCommentCommand({ filePath: mockFilePath, issueKey: '' })).rejects.toThrow(
      'Process exit'
    );

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Issue key is required')
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);

    processExitSpy.mockRestore();
  });

  it('should exit with error when file path is empty', async () => {
    const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('Process exit');
    });

    await expect(addCommentCommand({ filePath: '', issueKey: mockIssueKey })).rejects.toThrow(
      'Process exit'
    );

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('File path is required')
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);

    processExitSpy.mockRestore();
  });

  it('should exit with error when file does not exist', async () => {
    vi.spyOn(mockFs, 'existsSync').mockReturnValue(false);
    const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('Process exit');
    });

    await expect(
      addCommentCommand({ filePath: mockFilePath, issueKey: mockIssueKey })
    ).rejects.toThrow('Process exit');

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('File not found')
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);

    processExitSpy.mockRestore();
  });

  it('should exit with error when file read fails', async () => {
    const readError = new Error('Permission denied');
    vi.spyOn(mockFs, 'readFileSync').mockImplementation(() => {
      throw readError;
    });
    const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('Process exit');
    });

    await expect(
      addCommentCommand({ filePath: mockFilePath, issueKey: mockIssueKey })
    ).rejects.toThrow('Process exit');

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Error reading file')
    );
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Permission denied')
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);

    processExitSpy.mockRestore();
  });

  it('should exit with error when file is empty', async () => {
    vi.spyOn(mockFs, 'readFileSync').mockReturnValue('   \n  \t  ');
    const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('Process exit');
    });

    await expect(
      addCommentCommand({ filePath: mockFilePath, issueKey: mockIssueKey })
    ).rejects.toThrow('Process exit');

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('File is empty')
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);

    processExitSpy.mockRestore();
  });

  it('should exit with error when markdown conversion fails', async () => {
    const conversionError = new Error('Invalid markdown syntax');
    mockMarkdownToAdf.mockImplementation(() => {
      throw conversionError;
    });
    const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('Process exit');
    });

    await expect(
      addCommentCommand({ filePath: mockFilePath, issueKey: mockIssueKey })
    ).rejects.toThrow('Process exit');

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Error converting Markdown to ADF')
    );
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Invalid markdown syntax')
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);

    processExitSpy.mockRestore();
  });

  it('should exit with error and hint when issue not found (404)', async () => {
    const apiError = new Error('Issue not found (404)');
    mockJiraClient.addIssueComment = vi.fn().mockRejectedValue(apiError);
    const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('Process exit');
    });

    await expect(
      addCommentCommand({ filePath: mockFilePath, issueKey: mockIssueKey })
    ).rejects.toThrow('Process exit');

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Issue not found (404)')
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Check that the issue key is correct')
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);

    processExitSpy.mockRestore();
  });

  it('should exit with error and hint when permission denied (403)', async () => {
    const apiError = new Error('Permission denied (403)');
    mockJiraClient.addIssueComment = vi.fn().mockRejectedValue(apiError);
    const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('Process exit');
    });

    await expect(
      addCommentCommand({ filePath: mockFilePath, issueKey: mockIssueKey })
    ).rejects.toThrow('Process exit');

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Permission denied (403)')
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('You may not have permission to comment on this issue')
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);

    processExitSpy.mockRestore();
  });
});
