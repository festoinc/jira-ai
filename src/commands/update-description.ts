import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';
import { markdownToAdf } from 'marklassian';
import { updateIssueDescription } from '../lib/jira-client.js';

export async function updateDescriptionCommand(
  taskId: string,
  options: { fromFile: string }
): Promise<void> {
  // Validate taskId
  if (!taskId || taskId.trim() === '') {
    console.error(chalk.red('\nError: Task ID cannot be empty'));
    process.exit(1);
  }

  // Validate file path
  const filePath = options.fromFile;
  if (!filePath || filePath.trim() === '') {
    console.error(chalk.red('\nError: File path is required (use --from-file)'));
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

  // Update issue description with spinner
  const spinner = ora(`Updating description for ${taskId}...`).start();

  try {
    await updateIssueDescription(taskId, adfContent);
    spinner.succeed(chalk.green(`Description updated successfully for ${taskId}`));
    console.log(chalk.gray(`\nFile: ${absolutePath}`));
  } catch (error) {
    spinner.fail(chalk.red('Failed to update description'));
    console.error(
      chalk.red(
        '\nError: ' + (error instanceof Error ? error.message : 'Unknown error')
      )
    );

    // Provide helpful hints based on error
    if (error instanceof Error && error.message.includes('404')) {
      console.log(chalk.yellow('\nHint: Check that the task ID is correct'));
    } else if (error instanceof Error && error.message.includes('403')) {
      console.log(
        chalk.yellow('\nHint: You may not have permission to edit this issue')
      );
    }

    process.exit(1);
  }
}
