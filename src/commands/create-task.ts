import chalk from 'chalk';
import { createIssue } from '../lib/jira-client.js';
import { CommandError } from '../lib/errors.js';
import { ui } from '../lib/ui.js';
import { validateOptions, CreateTaskSchema } from '../lib/validation.js';

export async function createTaskCommand(
  options: {
    title: string;
    project: string;
    issueType: string;
    parent?: string;
  }
): Promise<void> {
  // Validate options
  validateOptions(CreateTaskSchema, options);

  const { title, project, issueType, parent } = options;

  // Create issue with spinner
  ui.startSpinner(`Creating ${issueType} in project ${project}...`);

  try {
    const result = await createIssue(project, title, issueType, parent);

    ui.succeedSpinner(chalk.green(`Issue created successfully: ${result.key}`));
    console.log(chalk.gray(`\nTitle: ${title}`));
    console.log(chalk.gray(`Project: ${project}`));
    console.log(chalk.gray(`Issue Type: ${issueType}`));
    if (parent) {
      console.log(chalk.gray(`Parent: ${parent}`));
    }
    console.log(chalk.cyan(`\nIssue Key: ${result.key}`));
  } catch (error: any) {
    const errorMsg = error.message?.toLowerCase() || '';
    const hints: string[] = [];

    if (errorMsg.includes('project')) {
      hints.push('Check that the project key is correct', 'Use "jira-ai projects" to see available projects');
    } else if (errorMsg.includes('issue type') || errorMsg.includes('issuetype')) {
      hints.push('Check that the issue type is correct', `Use "jira-ai list-issue-types ${project}" to see available issue types`);
    } else if (errorMsg.includes('parent')) {
      hints.push('Check that the parent issue key is correct', 'Parent issues are required for subtasks');
    } else if (errorMsg.includes('403')) {
      hints.push('You may not have permission to create issues in this project');
    }

    throw new CommandError(`Failed to create issue: ${error.message}`, { hints });
  }
}
