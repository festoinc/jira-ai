import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { markdownToAdf } from 'marklassian';
import { addIssueComment } from '../lib/jira-client.js';
import { CommandError } from '../lib/errors.js';
import { ui } from '../lib/ui.js';
import { validateOptions, AddCommentSchema } from '../lib/validation.js';

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
  } catch (error: any) {
    throw new CommandError(`Error converting Markdown to ADF: ${error.message}`, {
      hints: ['Ensure the Markdown content is valid.']
    });
  }

  // Add comment with spinner
  ui.startSpinner(`Adding comment to ${issueKey}...`);

  try {
    await addIssueComment(issueKey, adfContent);
    ui.succeedSpinner(chalk.green(`Comment added successfully to ${issueKey}`));
    console.log(chalk.gray(`\nFile: ${absolutePath}`));
  } catch (error: any) {
    const hints: string[] = [];
    if (error.message?.includes('404')) {
      hints.push('Check that the issue key is correct');
    } else if (error.message?.includes('403')) {
      hints.push('You may not have permission to comment on this issue');
    }

    throw new CommandError(`Failed to add comment: ${error.message}`, { hints });
  }
}
