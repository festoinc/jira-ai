import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';
import { markdownToAdf } from 'marklassian';
import { updateIssueDescription } from '../lib/jira-client.js';
import { CliError } from '../types/errors.js';
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
  } catch (error) {
    throw new CliError(`Error reading file: ${error instanceof Error ? error.message : String(error)}`);
  }


  // Validate file is not empty
  if (markdownContent.trim() === '') {
    throw new CliError('File is empty');
  }

  // Convert Markdown to ADF
  let adfContent: any;
  try {
    adfContent = markdownToAdf(markdownContent);
  } catch (error) {
    throw new CliError(`Error converting Markdown to ADF: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Update issue description with spinner
  const spinner = ora(`Updating description for ${taskId}...`).start();

  try {
    await updateIssueDescription(taskId, adfContent);
    spinner.succeed(chalk.green(`Description updated successfully for ${taskId}`));
    console.log(chalk.gray(`\nFile: ${absolutePath}`));
  } catch (error) {
    spinner.fail(chalk.red('Failed to update description'));

    // Provide helpful hints based on error
    if (error instanceof Error && error.message.includes('404')) {
      console.log(chalk.yellow('\nHint: Check that the task ID is correct'));
    } else if (error instanceof Error && error.message.includes('403')) {
      console.log(
        chalk.yellow('\nHint: You may not have permission to edit this issue')
      );
    }

    throw error;
  }
}
