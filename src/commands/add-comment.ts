import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';
import { markdownToAdf } from 'marklassian';
import { addIssueComment } from '../lib/jira-client.js';

export async function addCommentCommand(
  options: { filePath: string; issueKey: string }
): Promise<void> {
  const { filePath, issueKey } = options;

  // Validate issueKey
  if (!issueKey || issueKey.trim() === '') {
    console.error(chalk.red('\nError: Issue key is required (use --issue-key)'));
    process.exit(1);
  }

  // Validate file path
  if (!filePath || filePath.trim() === '') {
    console.error(chalk.red('\nError: File path is required (use --file-path)'));
    process.exit(1);
  }

  // Resolve file path to absolute
  const absolutePath = path.resolve(filePath);

  // Check file exists
  if (!fs.existsSync(absolutePath)) {
    console.error(chalk.red(`\nError: File not found: ${absolutePath}`));
    process.exit(1);
  }

  // Read file
  let markdownContent: string;
  try {
    markdownContent = fs.readFileSync(absolutePath, 'utf-8');
  } catch (error) {
    console.error(
      chalk.red(
        '\nError reading file: ' +
          (error instanceof Error ? error.message : 'Unknown error')
      )
    );
    process.exit(1);
  }

  // Validate file is not empty
  if (markdownContent.trim() === '') {
    console.error(chalk.red('\nError: File is empty'));
    process.exit(1);
  }

  // Convert Markdown to ADF
  let adfContent: any;
  try {
    adfContent = markdownToAdf(markdownContent);
  } catch (error) {
    console.error(
      chalk.red(
        '\nError converting Markdown to ADF: ' +
          (error instanceof Error ? error.message : 'Unknown error')
      )
    );
    process.exit(1);
  }

  // Add comment with spinner
  const spinner = ora(`Adding comment to ${issueKey}...`).start();

  try {
    await addIssueComment(issueKey, adfContent);
    spinner.succeed(chalk.green(`Comment added successfully to ${issueKey}`));
    console.log(chalk.gray(`\nFile: ${absolutePath}`));
  } catch (error) {
    spinner.fail(chalk.red('Failed to add comment'));
    console.error(
      chalk.red(
        '\nError: ' + (error instanceof Error ? error.message : 'Unknown error')
      )
    );

    // Provide helpful hints based on error
    if (error instanceof Error && error.message.includes('404')) {
      console.log(chalk.yellow('\nHint: Check that the issue key is correct'));
    } else if (error instanceof Error && error.message.includes('403')) {
      console.log(
        chalk.yellow('\nHint: You may not have permission to comment on this issue')
      );
    }

    process.exit(1);
  }
}
