import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';
import { markdownToAdf } from 'marklassian';
import { addIssueComment } from '../lib/jira-client.js';
import { CliError } from '../types/errors.js';
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

  // Add comment with spinner
  const spinner = ora(`Adding comment to ${issueKey}...`).start();

  try {
    await addIssueComment(issueKey, adfContent);
    spinner.succeed(chalk.green(`Comment added successfully to ${issueKey}`));
    console.log(chalk.gray(`\nFile: ${absolutePath}`));
  } catch (error) {
    spinner.fail(chalk.red('Failed to add comment'));

    // Provide helpful hints based on error
    if (error instanceof Error && error.message.includes('404')) {
      console.log(chalk.yellow('\nHint: Check that the issue key is correct'));
    } else if (error instanceof Error && error.message.includes('403')) {
      console.log(
        chalk.yellow('\nHint: You may not have permission to comment on this issue')
      );
    }

    throw error;
  }
}
