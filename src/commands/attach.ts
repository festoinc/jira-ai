import {
  addIssueAttachment,
  getIssueAttachments,
  downloadAttachment,
  deleteAttachment,
  validateIssuePermissions,
} from '../lib/jira-client.js';
import { CommandError } from '../lib/errors.js';
import { validateOptions, IssueKeySchema } from '../lib/validation.js';
import { outputResult } from '../lib/json-mode.js';

export async function uploadAttachmentCommand(
  issueKey: string,
  filePaths: string[]
): Promise<void> {
  if (!issueKey || issueKey.trim() === '') {
    throw new CommandError('Issue key is required');
  }
  validateOptions(IssueKeySchema, issueKey);

  if (!filePaths || filePaths.length === 0) {
    throw new CommandError('At least one file path is required');
  }

  await validateIssuePermissions(issueKey, 'issue');

  try {
    const attachments = await addIssueAttachment(issueKey, filePaths);
    outputResult({ success: true, issueKey, attachments });
  } catch (error: any) {
    if (error instanceof CommandError) throw error;

    const errorMsg = error.message?.toLowerCase() || '';
    const hints: string[] = [];

    if (errorMsg.includes('404')) {
      hints.push('Check that the issue key is correct');
    } else if (errorMsg.includes('403')) {
      hints.push('You may not have permission to attach files to this issue');
    } else if (errorMsg.includes('enoent') || errorMsg.includes('no such file')) {
      hints.push('Check that the file path is correct and the file exists');
    }

    throw new CommandError(`Failed to upload attachment: ${error.message}`, { hints });
  }
}

export async function listAttachmentsCommand(issueKey: string): Promise<void> {
  if (!issueKey || issueKey.trim() === '') {
    throw new CommandError('Issue key is required');
  }
  validateOptions(IssueKeySchema, issueKey);

  await validateIssuePermissions(issueKey, 'issue');

  try {
    const attachments = await getIssueAttachments(issueKey);
    outputResult(attachments);
  } catch (error: any) {
    if (error instanceof CommandError) throw error;

    const errorMsg = error.message?.toLowerCase() || '';
    const hints: string[] = [];

    if (errorMsg.includes('404')) {
      hints.push('Check that the issue key is correct');
    } else if (errorMsg.includes('403')) {
      hints.push('You may not have permission to view attachments for this issue');
    }

    throw new CommandError(`Failed to list attachments: ${error.message}`, { hints });
  }
}

export async function downloadAttachmentCommand(
  issueKey: string,
  attachmentId: string,
  outputPath?: string
): Promise<void> {
  if (!issueKey || issueKey.trim() === '') {
    throw new CommandError('Issue key is required');
  }
  validateOptions(IssueKeySchema, issueKey);

  if (!attachmentId || attachmentId.trim() === '') {
    throw new CommandError('Attachment ID is required');
  }

  await validateIssuePermissions(issueKey, 'issue');

  try {
    const savedPath = await downloadAttachment(issueKey, attachmentId, outputPath);
    outputResult({ success: true, attachmentId, outputPath: savedPath });
  } catch (error: any) {
    if (error instanceof CommandError) throw error;

    const errorMsg = error.message?.toLowerCase() || '';
    const hints: string[] = [];

    if (errorMsg.includes('404')) {
      hints.push('Check that the attachment ID is correct');
    } else if (errorMsg.includes('403')) {
      hints.push('You may not have permission to download this attachment');
    }

    throw new CommandError(`Failed to download attachment: ${error.message}`, { hints });
  }
}

export async function deleteAttachmentCommand(
  issueKey: string,
  attachmentId: string
): Promise<void> {
  if (!issueKey || issueKey.trim() === '') {
    throw new CommandError('Issue key is required');
  }
  validateOptions(IssueKeySchema, issueKey);

  if (!attachmentId || attachmentId.trim() === '') {
    throw new CommandError('Attachment ID is required');
  }

  await validateIssuePermissions(issueKey, 'issue');

  try {
    await deleteAttachment(issueKey, attachmentId);
    outputResult({ success: true, issueKey, attachmentId });
  } catch (error: any) {
    if (error instanceof CommandError) throw error;

    const errorMsg = error.message?.toLowerCase() || '';
    const hints: string[] = [];

    if (errorMsg.includes('404')) {
      hints.push('Check that the attachment ID is correct');
    } else if (errorMsg.includes('403')) {
      hints.push('You may not have permission to delete this attachment');
    }

    throw new CommandError(`Failed to delete attachment: ${error.message}`, { hints });
  }
}
