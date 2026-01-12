import { vi, describe, it, expect, beforeEach } from 'vitest';
import { updateDescriptionCommand } from '../src/commands/update-description.js';
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
const mockFs = fs as vi.Mocked<typeof mockFs>;
const mockMarkdownToAdf = markdownToAdf as vi.MockedFunction<typeof markdownToAdf>;

describe('Update Description Command', () => {
  const mockTaskId = 'TEST-123';
  const mockFilePath = '/path/to/description.md';
  const mockMarkdownContent = '# Test Description\n\nThis is a test description.';
  const mockAdfContent = {
    version: 1,
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: 'Test Description' }]
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
    mockJiraClient.updateIssueDescription = vi.fn().mockResolvedValue(undefined);
  });

  it('should successfully update issue description', async () => {
    await updateDescriptionCommand(mockTaskId, { fromFile: mockFilePath });

    expect(mockFs.existsSync).toHaveBeenCalledWith(path.resolve(mockFilePath));
    expect(mockFs.readFileSync).toHaveBeenCalledWith(path.resolve(mockFilePath), 'utf-8');
    expect(mockMarkdownToAdf).toHaveBeenCalledWith(mockMarkdownContent);
    expect(mockJiraClient.updateIssueDescription).toHaveBeenCalledWith(
      mockTaskId,
      mockAdfContent
    );
    expect(console.log).toHaveBeenCalled();
  });

  it('should throw error when task ID is empty', async () => {
    await expect(updateDescriptionCommand('', { fromFile: mockFilePath })).rejects.toThrow(
      CommandError
    );
    await expect(updateDescriptionCommand('', { fromFile: mockFilePath })).rejects.toThrow(
      'Task ID is required'
    );
  });


  it('should throw error when file does not exist', async () => {
    vi.spyOn(mockFs, 'existsSync').mockReturnValue(false);

    await expect(
      updateDescriptionCommand(mockTaskId, { fromFile: mockFilePath })
    ).rejects.toThrow(CommandError);
    await expect(
      updateDescriptionCommand(mockTaskId, { fromFile: mockFilePath })
    ).rejects.toThrow('File not found');
  });

  it('should throw error when file read fails', async () => {
    const readError = new Error('Permission denied');
    vi.spyOn(mockFs, 'readFileSync').mockImplementation(() => {
      throw readError;
    });

    await expect(
      updateDescriptionCommand(mockTaskId, { fromFile: mockFilePath })
    ).rejects.toThrow(CommandError);
    await expect(
      updateDescriptionCommand(mockTaskId, { fromFile: mockFilePath })
    ).rejects.toThrow('Error reading file');
  });

  it('should throw error when file is empty', async () => {
    vi.spyOn(mockFs, 'readFileSync').mockReturnValue('   \n  \t  ');

    await expect(
      updateDescriptionCommand(mockTaskId, { fromFile: mockFilePath })
    ).rejects.toThrow(CommandError);
    await expect(
      updateDescriptionCommand(mockTaskId, { fromFile: mockFilePath })
    ).rejects.toThrow('File is empty');
  });

  it('should throw error when markdown conversion fails', async () => {
    const conversionError = new Error('Invalid markdown syntax');
    mockMarkdownToAdf.mockImplementation(() => {
      throw conversionError;
    });

    await expect(
      updateDescriptionCommand(mockTaskId, { fromFile: mockFilePath })
    ).rejects.toThrow(CommandError);
    await expect(
      updateDescriptionCommand(mockTaskId, { fromFile: mockFilePath })
    ).rejects.toThrow('Error converting Markdown to ADF');
  });

  it('should throw error and hint when issue not found (404)', async () => {
    const apiError = new Error('Issue not found (404)');
    mockJiraClient.updateIssueDescription = vi.fn().mockRejectedValue(apiError);

    const promise = updateDescriptionCommand(mockTaskId, { fromFile: mockFilePath });
    await expect(promise).rejects.toThrow('Issue not found (404)');
    const error = await promise.catch(e => e);
    expect(error.hints).toContain('Check that the task ID is correct');
  });

  it('should throw error and hint when permission denied (403)', async () => {
    const apiError = new Error('Permission denied (403)');
    mockJiraClient.updateIssueDescription = vi.fn().mockRejectedValue(apiError);

    const promise = updateDescriptionCommand(mockTaskId, { fromFile: mockFilePath });
    await expect(promise).rejects.toThrow('Permission denied (403)');
    const error = await promise.catch(e => e);
    expect(error.hints).toContain('You may not have permission to edit this issue');
  });

  it('should throw error for other API errors', async () => {
    const apiError = new Error('Network connection failed');
    mockJiraClient.updateIssueDescription = vi.fn().mockRejectedValue(apiError);

    await expect(
      updateDescriptionCommand(mockTaskId, { fromFile: mockFilePath })
    ).rejects.toThrow('Network connection failed');
  });

  it('should resolve relative file paths to absolute paths', async () => {
    const relativeFilePath = './description.md';
    const absolutePath = path.resolve(relativeFilePath);

    await updateDescriptionCommand(mockTaskId, { fromFile: relativeFilePath });

    expect(mockFs.existsSync).toHaveBeenCalledWith(absolutePath);
    expect(mockFs.readFileSync).toHaveBeenCalledWith(absolutePath, 'utf-8');
  });

  it('should handle complex markdown content', async () => {
    const complexMarkdown = '# Heading 1\n\n## Heading 2\n\nThis is **bold** and *italic* text.\n\n- List item 1\n- List item 2\n\n```javascript\nconst example = "code block";\n```\n\n[Link](https://example.com)';

    vi.spyOn(mockFs, 'readFileSync').mockReturnValue(complexMarkdown);

    await updateDescriptionCommand(mockTaskId, { fromFile: mockFilePath });

    expect(mockMarkdownToAdf).toHaveBeenCalledWith(complexMarkdown);
    expect(mockJiraClient.updateIssueDescription).toHaveBeenCalled();
  });
});
