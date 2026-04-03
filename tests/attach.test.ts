import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  uploadAttachmentCommand,
  listAttachmentsCommand,
  downloadAttachmentCommand,
  deleteAttachmentCommand,
} from '../src/commands/attach.js';
import * as jiraClient from '../src/lib/jira-client.js';
import { CommandError } from '../src/lib/errors.js';

vi.mock('../src/lib/jira-client.js');

const mockJiraClient = jiraClient as vi.Mocked<typeof jiraClient>;

const mockAttachment1 = {
  id: 'att-001',
  filename: 'screenshot.png',
  mimeType: 'image/png',
  size: 102400,
  created: '2024-01-15T10:00:00.000Z',
  author: { displayName: 'Alice', emailAddress: 'alice@example.com' },
  content: 'https://festoinc.atlassian.net/secure/attachment/att-001/screenshot.png',
};

const mockAttachment2 = {
  id: 'att-002',
  filename: 'report.pdf',
  mimeType: 'application/pdf',
  size: 204800,
  created: '2024-01-16T12:00:00.000Z',
  author: { displayName: 'Bob', emailAddress: 'bob@example.com' },
  content: 'https://festoinc.atlassian.net/secure/attachment/att-002/report.pdf',
};

let consoleLogSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  mockJiraClient.validateIssuePermissions.mockResolvedValue({} as any);
});

afterEach(() => {
  consoleLogSpy.mockRestore();
});

// ---------------------------------------------------------------------------
// uploadAttachmentCommand
// ---------------------------------------------------------------------------

describe('uploadAttachmentCommand', () => {
  it('should upload a single file and return attachment info', async () => {
    mockJiraClient.addIssueAttachment.mockResolvedValue([mockAttachment1]);

    await uploadAttachmentCommand('PROJ-1', ['/tmp/screenshot.png']);

    expect(mockJiraClient.validateIssuePermissions).toHaveBeenCalledWith('PROJ-1', 'issue.attach.upload');
    expect(mockJiraClient.addIssueAttachment).toHaveBeenCalledWith('PROJ-1', ['/tmp/screenshot.png']);
    const output = consoleLogSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty('success', true);
    expect(parsed).toHaveProperty('issueKey', 'PROJ-1');
    expect(Array.isArray(parsed.attachments)).toBe(true);
    expect(parsed.attachments).toHaveLength(1);
    expect(parsed.attachments[0].id).toBe('att-001');
  });

  it('should upload multiple files and return all attachment infos', async () => {
    mockJiraClient.addIssueAttachment.mockResolvedValue([mockAttachment1, mockAttachment2]);

    await uploadAttachmentCommand('PROJ-1', ['/tmp/screenshot.png', '/tmp/report.pdf']);

    expect(mockJiraClient.addIssueAttachment).toHaveBeenCalledWith('PROJ-1', [
      '/tmp/screenshot.png',
      '/tmp/report.pdf',
    ]);
    const output = consoleLogSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed.attachments).toHaveLength(2);
  });

  it('should throw CommandError when issue key is empty', async () => {
    await expect(uploadAttachmentCommand('', ['/tmp/file.txt'])).rejects.toThrow(CommandError);
    await expect(uploadAttachmentCommand('', ['/tmp/file.txt'])).rejects.toThrow('Issue key is required');
  });

  it('should throw CommandError when no files provided', async () => {
    await expect(uploadAttachmentCommand('PROJ-1', [])).rejects.toThrow(CommandError);
    await expect(uploadAttachmentCommand('PROJ-1', [])).rejects.toThrow('At least one file path is required');
  });

  it('should throw CommandError with 404 hint when issue not found', async () => {
    mockJiraClient.addIssueAttachment.mockRejectedValue(new Error('404 Not Found'));

    await expect(uploadAttachmentCommand('PROJ-999', ['/tmp/file.txt'])).rejects.toThrow(CommandError);
    await expect(uploadAttachmentCommand('PROJ-999', ['/tmp/file.txt'])).rejects.toMatchObject({
      message: expect.stringContaining('Failed to upload attachment'),
    });
  });

  it('should throw CommandError with 403 hint when lacking permissions', async () => {
    mockJiraClient.addIssueAttachment.mockRejectedValue(new Error('403 Forbidden'));

    await expect(uploadAttachmentCommand('PROJ-1', ['/tmp/file.txt'])).rejects.toThrow(CommandError);
  });

  it('should throw CommandError with file-not-found hint when file missing', async () => {
    mockJiraClient.addIssueAttachment.mockRejectedValue(new Error('ENOENT: no such file or directory'));

    const err = await uploadAttachmentCommand('PROJ-1', ['/tmp/nonexistent.txt']).catch(e => e);
    expect(err).toBeInstanceOf(CommandError);
    expect(err.hints).toEqual(expect.arrayContaining([expect.stringContaining('file')]));
  });

  it('should re-throw CommandError as-is', async () => {
    const original = new CommandError('Already wrapped');
    mockJiraClient.addIssueAttachment.mockRejectedValue(original);

    await expect(uploadAttachmentCommand('PROJ-1', ['/tmp/file.txt'])).rejects.toBe(original);
  });

  it('should throw ValidationError for invalid issue key format', async () => {
    await expect(uploadAttachmentCommand('not-a-key', ['/tmp/file.txt'])).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// listAttachmentsCommand
// ---------------------------------------------------------------------------

describe('listAttachmentsCommand', () => {
  it('should list attachments for an issue', async () => {
    mockJiraClient.getIssueAttachments.mockResolvedValue([mockAttachment1, mockAttachment2]);

    await listAttachmentsCommand('PROJ-1');

    expect(mockJiraClient.validateIssuePermissions).toHaveBeenCalledWith('PROJ-1', 'issue.attach.list');
    expect(mockJiraClient.getIssueAttachments).toHaveBeenCalledWith('PROJ-1');
    const output = consoleLogSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].id).toBe('att-001');
    expect(parsed[1].id).toBe('att-002');
  });

  it('should return empty array when no attachments', async () => {
    mockJiraClient.getIssueAttachments.mockResolvedValue([]);

    await listAttachmentsCommand('PROJ-1');

    const output = consoleLogSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed).toHaveLength(0);
  });

  it('should throw CommandError when issue key is empty', async () => {
    await expect(listAttachmentsCommand('')).rejects.toThrow(CommandError);
    await expect(listAttachmentsCommand('')).rejects.toThrow('Issue key is required');
  });

  it('should throw CommandError with 404 hint when issue not found', async () => {
    mockJiraClient.getIssueAttachments.mockRejectedValue(new Error('404 Not Found'));

    await expect(listAttachmentsCommand('PROJ-999')).rejects.toThrow(CommandError);
    await expect(listAttachmentsCommand('PROJ-999')).rejects.toMatchObject({
      message: expect.stringContaining('Failed to list attachments'),
    });
  });

  it('should throw CommandError with 403 hint when lacking permissions', async () => {
    mockJiraClient.getIssueAttachments.mockRejectedValue(new Error('403 Forbidden'));

    await expect(listAttachmentsCommand('PROJ-1')).rejects.toThrow(CommandError);
  });

  it('should re-throw CommandError as-is', async () => {
    const original = new CommandError('Already wrapped');
    mockJiraClient.getIssueAttachments.mockRejectedValue(original);

    await expect(listAttachmentsCommand('PROJ-1')).rejects.toBe(original);
  });

  it('should throw ValidationError for invalid issue key format', async () => {
    await expect(listAttachmentsCommand('not-a-key')).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// downloadAttachmentCommand
// ---------------------------------------------------------------------------

describe('downloadAttachmentCommand', () => {
  it('should download attachment to default output path (filename)', async () => {
    mockJiraClient.downloadAttachment.mockResolvedValue('/tmp/screenshot.png');

    await downloadAttachmentCommand('PROJ-1', 'att-001');

    expect(mockJiraClient.validateIssuePermissions).toHaveBeenCalledWith('PROJ-1', 'issue.attach.download');
    expect(mockJiraClient.downloadAttachment).toHaveBeenCalledWith('PROJ-1', 'att-001', undefined);
    const output = consoleLogSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty('success', true);
    expect(parsed).toHaveProperty('attachmentId', 'att-001');
    expect(parsed).toHaveProperty('outputPath');
  });

  it('should download attachment to specified output path', async () => {
    mockJiraClient.downloadAttachment.mockResolvedValue('/custom/path/file.png');

    await downloadAttachmentCommand('PROJ-1', 'att-001', '/custom/path/file.png');

    expect(mockJiraClient.downloadAttachment).toHaveBeenCalledWith('PROJ-1', 'att-001', '/custom/path/file.png');
    const output = consoleLogSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed.outputPath).toBe('/custom/path/file.png');
  });

  it('should throw CommandError when issue key is empty', async () => {
    await expect(downloadAttachmentCommand('', 'att-001')).rejects.toThrow(CommandError);
    await expect(downloadAttachmentCommand('', 'att-001')).rejects.toThrow('Issue key is required');
  });

  it('should throw CommandError when attachment ID is empty', async () => {
    await expect(downloadAttachmentCommand('PROJ-1', '')).rejects.toThrow(CommandError);
    await expect(downloadAttachmentCommand('PROJ-1', '')).rejects.toThrow('Attachment ID is required');
  });

  it('should throw CommandError with 404 hint when attachment not found', async () => {
    mockJiraClient.downloadAttachment.mockRejectedValue(new Error('404 Not Found'));

    await expect(downloadAttachmentCommand('PROJ-1', 'att-999')).rejects.toThrow(CommandError);
    await expect(downloadAttachmentCommand('PROJ-1', 'att-999')).rejects.toMatchObject({
      message: expect.stringContaining('Failed to download attachment'),
    });
  });

  it('should throw CommandError with 403 hint when lacking permissions', async () => {
    mockJiraClient.downloadAttachment.mockRejectedValue(new Error('403 Forbidden'));

    await expect(downloadAttachmentCommand('PROJ-1', 'att-001')).rejects.toThrow(CommandError);
  });

  it('should re-throw CommandError as-is', async () => {
    const original = new CommandError('Already wrapped');
    mockJiraClient.downloadAttachment.mockRejectedValue(original);

    await expect(downloadAttachmentCommand('PROJ-1', 'att-001')).rejects.toBe(original);
  });

  it('should throw ValidationError for invalid issue key format', async () => {
    await expect(downloadAttachmentCommand('not-a-key', 'att-001')).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// deleteAttachmentCommand
// ---------------------------------------------------------------------------

describe('deleteAttachmentCommand', () => {
  it('should delete attachment and return success', async () => {
    mockJiraClient.deleteAttachment.mockResolvedValue(undefined);

    await deleteAttachmentCommand('PROJ-1', 'att-001');

    expect(mockJiraClient.validateIssuePermissions).toHaveBeenCalledWith('PROJ-1', 'issue.attach.delete');
    expect(mockJiraClient.deleteAttachment).toHaveBeenCalledWith('PROJ-1', 'att-001');
    const output = consoleLogSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty('success', true);
    expect(parsed).toHaveProperty('issueKey', 'PROJ-1');
    expect(parsed).toHaveProperty('attachmentId', 'att-001');
  });

  it('should throw CommandError when issue key is empty', async () => {
    await expect(deleteAttachmentCommand('', 'att-001')).rejects.toThrow(CommandError);
    await expect(deleteAttachmentCommand('', 'att-001')).rejects.toThrow('Issue key is required');
  });

  it('should throw CommandError when attachment ID is empty', async () => {
    await expect(deleteAttachmentCommand('PROJ-1', '')).rejects.toThrow(CommandError);
    await expect(deleteAttachmentCommand('PROJ-1', '')).rejects.toThrow('Attachment ID is required');
  });

  it('should throw CommandError with 404 hint when attachment not found', async () => {
    mockJiraClient.deleteAttachment.mockRejectedValue(new Error('404 Not Found'));

    await expect(deleteAttachmentCommand('PROJ-1', 'att-999')).rejects.toThrow(CommandError);
    await expect(deleteAttachmentCommand('PROJ-1', 'att-999')).rejects.toMatchObject({
      message: expect.stringContaining('Failed to delete attachment'),
    });
  });

  it('should throw CommandError with 403 hint when lacking permissions', async () => {
    mockJiraClient.deleteAttachment.mockRejectedValue(new Error('403 Forbidden'));

    await expect(deleteAttachmentCommand('PROJ-1', 'att-001')).rejects.toThrow(CommandError);
  });

  it('should re-throw CommandError as-is', async () => {
    const original = new CommandError('Already wrapped');
    mockJiraClient.deleteAttachment.mockRejectedValue(original);

    await expect(deleteAttachmentCommand('PROJ-1', 'att-001')).rejects.toBe(original);
  });

  it('should throw ValidationError for invalid issue key format', async () => {
    await expect(deleteAttachmentCommand('not-a-key', 'att-001')).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// jira-client attachment functions (unit tests)
// ---------------------------------------------------------------------------

describe('jira-client attachment functions', () => {
  it('addIssueAttachment should be exported from jira-client', () => {
    expect(typeof jiraClient.addIssueAttachment).toBe('function');
  });

  it('getIssueAttachments should be exported from jira-client', () => {
    expect(typeof jiraClient.getIssueAttachments).toBe('function');
  });

  it('downloadAttachment should be exported from jira-client', () => {
    expect(typeof jiraClient.downloadAttachment).toBe('function');
  });

  it('deleteAttachment should be exported from jira-client', () => {
    expect(typeof jiraClient.deleteAttachment).toBe('function');
  });
});
