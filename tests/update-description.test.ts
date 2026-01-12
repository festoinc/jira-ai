import { updateDescriptionCommand } from '../src/commands/update-description';
import * as jiraClient from '../src/lib/jira-client';
import * as fs from 'fs';
import * as path from 'path';
import { markdownToAdf } from 'marklassian';

// Mock dependencies
jest.mock('fs');
jest.mock('marklassian');
jest.mock('../src/lib/jira-client');
jest.mock('../src/lib/utils');
jest.mock('ora', () => {
  return jest.fn(() => ({
    start: jest.fn().mockReturnThis(),
    succeed: jest.fn().mockReturnThis(),
    fail: jest.fn().mockReturnThis()
  }));
});

const mockJiraClient = jiraClient as jest.Mocked<typeof jiraClient>;
const mockFs = fs as jest.Mocked<typeof fs>;
const mockMarkdownToAdf = markdownToAdf as jest.MockedFunction<typeof markdownToAdf>;

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
    jest.clearAllMocks();
    console.log = jest.fn();
    console.error = jest.fn();

    // Setup default mocks
    jest.spyOn(mockFs, 'existsSync').mockReturnValue(true);
    jest.spyOn(mockFs, 'readFileSync').mockReturnValue(mockMarkdownContent);
    mockMarkdownToAdf.mockReturnValue(mockAdfContent);
    mockJiraClient.updateIssueDescription = jest.fn().mockResolvedValue(undefined);
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

  it('should exit with error when task ID is empty', async () => {
    const processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('Process exit');
    });

    await expect(updateDescriptionCommand('', { fromFile: mockFilePath })).rejects.toThrow(
      'Process exit'
    );

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Task ID cannot be empty')
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);

    processExitSpy.mockRestore();
  });

  it('should exit with error when file does not exist', async () => {
    jest.spyOn(mockFs, 'existsSync').mockReturnValue(false);
    const processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('Process exit');
    });

    await expect(
      updateDescriptionCommand(mockTaskId, { fromFile: mockFilePath })
    ).rejects.toThrow('Process exit');

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('File not found')
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);

    processExitSpy.mockRestore();
  });

  it('should exit with error when file read fails', async () => {
    const readError = new Error('Permission denied');
    jest.spyOn(mockFs, 'readFileSync').mockImplementation(() => {
      throw readError;
    });
    const processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('Process exit');
    });

    await expect(
      updateDescriptionCommand(mockTaskId, { fromFile: mockFilePath })
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
    jest.spyOn(mockFs, 'readFileSync').mockReturnValue('   \n  \t  ');
    const processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('Process exit');
    });

    await expect(
      updateDescriptionCommand(mockTaskId, { fromFile: mockFilePath })
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
    const processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('Process exit');
    });

    await expect(
      updateDescriptionCommand(mockTaskId, { fromFile: mockFilePath })
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
    mockJiraClient.updateIssueDescription = jest.fn().mockRejectedValue(apiError);
    const processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('Process exit');
    });

    await expect(
      updateDescriptionCommand(mockTaskId, { fromFile: mockFilePath })
    ).rejects.toThrow('Process exit');

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Issue not found (404)')
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Check that the task ID is correct')
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);

    processExitSpy.mockRestore();
  });

  it('should exit with error and hint when permission denied (403)', async () => {
    const apiError = new Error('Permission denied (403)');
    mockJiraClient.updateIssueDescription = jest.fn().mockRejectedValue(apiError);
    const processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('Process exit');
    });

    await expect(
      updateDescriptionCommand(mockTaskId, { fromFile: mockFilePath })
    ).rejects.toThrow('Process exit');

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Permission denied (403)')
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('You may not have permission to edit this issue')
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);

    processExitSpy.mockRestore();
  });

  it('should exit with error for other API errors', async () => {
    const apiError = new Error('Network connection failed');
    mockJiraClient.updateIssueDescription = jest.fn().mockRejectedValue(apiError);
    const processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('Process exit');
    });

    await expect(
      updateDescriptionCommand(mockTaskId, { fromFile: mockFilePath })
    ).rejects.toThrow('Process exit');

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Network connection failed')
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);

    processExitSpy.mockRestore();
  });

  it('should resolve relative file paths to absolute paths', async () => {
    const relativeFilePath = './description.md';
    const absolutePath = path.resolve(relativeFilePath);

    await updateDescriptionCommand(mockTaskId, { fromFile: relativeFilePath });

    expect(mockFs.existsSync).toHaveBeenCalledWith(absolutePath);
    expect(mockFs.readFileSync).toHaveBeenCalledWith(absolutePath, 'utf-8');
  });

  it('should handle complex markdown content', async () => {
    const complexMarkdown = `# Heading 1

## Heading 2

This is **bold** and *italic* text.

- List item 1
- List item 2

\`\`\`javascript
const example = "code block";
\`\`\`

[Link](https://example.com)`;

    jest.spyOn(mockFs, 'readFileSync').mockReturnValue(complexMarkdown);

    await updateDescriptionCommand(mockTaskId, { fromFile: mockFilePath });

    expect(mockMarkdownToAdf).toHaveBeenCalledWith(complexMarkdown);
    expect(mockJiraClient.updateIssueDescription).toHaveBeenCalled();
  });
});
