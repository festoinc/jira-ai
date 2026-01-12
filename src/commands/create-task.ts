import chalk from 'chalk';
import ora from 'ora';
import { createIssue } from '../lib/jira-client.js';

export async function createTaskCommand(
  options: {
    title: string;
    project: string;
    issueType: string;
    parent?: string;
  }
): Promise<void> {
  const { title, project, issueType, parent } = options;

  // Validate required fields
  if (!title || title.trim() === '') {
    console.error(chalk.red('\nError: Title is required (use --title)'));
    process.exit(1);
  }

  if (!project || project.trim() === '') {
    console.error(chalk.red('\nError: Project is required (use --project)'));
    process.exit(1);
  }

  if (!issueType || issueType.trim() === '') {
    console.error(chalk.red('\nError: Issue type is required (use --issue-type)'));
    process.exit(1);
  }

  // Create issue with spinner
  const spinner = ora(`Creating ${issueType} in project ${project}...`).start();

  try {
    const result = await createIssue(project, title, issueType, parent);

    spinner.succeed(chalk.green(`Issue created successfully: ${result.key}`));
    console.log(chalk.gray(`\nTitle: ${title}`));
    console.log(chalk.gray(`Project: ${project}`));
    console.log(chalk.gray(`Issue Type: ${issueType}`));
    if (parent) {
      console.log(chalk.gray(`Parent: ${parent}`));
    }
    console.log(chalk.cyan(`\nIssue Key: ${result.key}`));
  } catch (error) {
    spinner.fail(chalk.red('Failed to create issue'));
    console.error(
      chalk.red(
        '\nError: ' + (error instanceof Error ? error.message : 'Unknown error')
      )
    );

    // Provide helpful hints based on error
    if (error instanceof Error) {
      if (error.message.includes('project') || error.message.includes('Project')) {
        console.log(chalk.yellow('\nHint: Check that the project key is correct'));
        console.log(chalk.yellow('Use "jira-ai projects" to see available projects'));
      } else if (error.message.includes('issue type') || error.message.includes('issuetype')) {
        console.log(chalk.yellow('\nHint: Check that the issue type is correct'));
        console.log(chalk.yellow(`Use "jira-ai list-issue-types ${project}" to see available issue types`));
      } else if (error.message.includes('parent') || error.message.includes('Parent')) {
        console.log(chalk.yellow('\nHint: Check that the parent issue key is correct'));
        console.log(chalk.yellow('Parent issues are required for subtasks'));
      } else if (error.message.includes('403')) {
        console.log(
          chalk.yellow('\nHint: You may not have permission to create issues in this project')
        );
      }
    }

    process.exit(1);
  }
}
