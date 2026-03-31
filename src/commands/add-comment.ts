import * as fs from 'fs';
import * as path from 'path';
import { markdownToAdf } from 'marklassian';
import { addIssueComment, validateIssuePermissions, resolveUserByName } from '../lib/jira-client.js';
import { processMentionsInADF } from '../lib/adf-mentions.js';
import { CommandError } from '../lib/errors.js';
import { validateOptions, AddCommentSchema } from '../lib/validation.js';
import { outputResult } from '../lib/json-mode.js';

export async function addCommentCommand(
  options: { filePath: string; issueKey: string }
): Promise<void> {
  // Validate options
  validateOptions(AddCommentSchema, options);

  const { filePath, issueKey } = options;

  // Resolve file path to absolute
  const absolutePath = path.resolve(filePath);

  // Read file
  let markdownContent: string;
  try {
    markdownContent = fs.readFileSync(absolutePath, 'utf-8');
  } catch (error: any) {
    throw new CommandError(`Error reading file: ${error.message}`, {
      hints: ['Make sure the file exists and you have permission to read it.']
    });
  }


  // Validate file is not empty
  if (markdownContent.trim() === '') {
    throw new CommandError('File is empty');
  }

  // Convert Markdown to ADF
  let adfContent: any;
  try {
    adfContent = markdownToAdf(markdownContent);
    // Process mentions in ADF
    adfContent = await processMentionsInADF(adfContent, resolveUserByName);
  } catch (error: any) {
    throw new CommandError(`Error converting Markdown to ADF: ${error.message}`, {
      hints: ['Ensure the Markdown content is valid.']
    });
  }

  // Check permissions and filters
  await validateIssuePermissions(issueKey, 'add-comment');

  try {
    await addIssueComment(issueKey, adfContent);
    outputResult({ success: true, issueKey, file: absolutePath });
  } catch (error: any) {
    if (error instanceof CommandError) throw error;

    const errorMsg = error.message?.toLowerCase() || '';
    const hints: string[] = [];

    if (errorMsg.includes('404')) {
      hints.push('Check that the issue key is correct');
    } else if (errorMsg.includes('403')) {
      hints.push('You may not have permission to comment on this issue');
    }

    throw new CommandError(`Failed to add comment: ${error.message}`, { hints });
  }
}