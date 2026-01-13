import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { markdownToAdf } from 'marklassian';
import { updateIssueDescription } from '../lib/jira-client.js';
import { CommandError } from '../lib/errors.js';
import { ui } from '../lib/ui.js';
import { validateOptions, UpdateDescriptionSchema, IssueKeySchema } from '../lib/validation.js';

export async function updateDescriptionCommand(
  taskId: string,
  options: { fromFile: string }
): Promise<void> {
  // Validate taskId (positional)
  validateOptions(IssueKeySchema, taskId);
  
  // Validate options
  validateOptions(UpdateDescriptionSchema, options);

  const filePath = options.fromFile;

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

  // Update issue description with spinner
  ui.startSpinner(`Updating description for ${taskId}...`);

  try {
    await updateIssueDescription(taskId, adfContent);
    ui.succeedSpinner(chalk.green(`Description updated successfully for ${taskId}`));
    console.log(chalk.gray(`\nFile: ${absolutePath}`));
  } catch (error: any) {
    const errorMsg = error.message?.toLowerCase() || '';
    const hints: string[] = [];

    if (errorMsg.includes('404')) {
      hints.push('Check that the task ID is correct');
    } else if (errorMsg.includes('403')) {
      hints.push('You may not have permission to edit this issue');
    }

    throw new CommandError(`Failed to update description: ${error.message}`, { hints });
  }
}
