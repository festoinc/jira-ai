#!/usr/bin/env node

import { Command } from 'commander';
import dotenv from 'dotenv';
import chalk from 'chalk';
import { validateEnvVars } from './lib/utils';
import { meCommand } from './commands/me';
import { projectsCommand } from './commands/projects';
import { taskWithDetailsCommand } from './commands/task-with-details';
import { projectStatusesCommand } from './commands/project-statuses';
import { listIssueTypesCommand } from './commands/list-issue-types';
import { runJqlCommand } from './commands/run-jql';
import { updateDescriptionCommand } from './commands/update-description';
import { addCommentCommand } from './commands/add-comment';
import { aboutCommand } from './commands/about';
import { authCommand } from './commands/auth';
import { isCommandAllowed, getAllowedCommands } from './lib/settings';

// Load environment variables
dotenv.config();

// Create CLI program
const program = new Command();

program
  .name('jira-ai')
  .description('CLI tool for interacting with Atlassian Jira')
  .version('1.0.0');

// Middleware to validate credentials for commands that need them
const validateCredentials = () => {
  validateEnvVars();
};

// Helper function to wrap commands with permission check and credential validation
function withPermission(commandName: string, commandFn: (...args: any[]) => Promise<void>, skipValidation = false) {
  return async (...args: any[]) => {
    if (!skipValidation) {
      validateCredentials();
    }
    
    if (!isCommandAllowed(commandName)) {
      console.error(chalk.red(`\n❌ Command '${commandName}' is not allowed.`));
      console.log(chalk.gray('Allowed commands: ' + getAllowedCommands().join(', ')));
      console.log(chalk.gray('Update settings.yaml to enable this command.\n'));
      process.exit(1);
    }
    return commandFn(...args);
  };
}

// Auth command (always allowed, skips validation)
program
  .command('auth')
  .description('Set up Jira authentication credentials')
  .action(() => authCommand());

// Me command
program
  .command('me')
  .description('Show basic user information')
  .action(withPermission('me', meCommand));

// Projects command
program
  .command('projects')
  .description('Show list of projects')
  .action(withPermission('projects', projectsCommand));

// Task with details command
program
  .command('task-with-details <task-id>')
  .description('Show task title, body, and comments')
  .action(withPermission('task-with-details', taskWithDetailsCommand));

// Project statuses command
program
  .command('project-statuses <project-id>')
  .description('Show all possible statuses for a project')
  .action(withPermission('project-statuses', projectStatusesCommand));

// List issue types command
program
  .command('list-issue-types <project-key>')
  .description('Show all issue types for a project')
  .action(withPermission('list-issue-types', listIssueTypesCommand));

// Run JQL command
program
  .command('run-jql <jql-query>')
  .description('Execute JQL query and display results')
  .option('-l, --limit <number>', 'Maximum number of results (default: 50)', '50')
  .action(withPermission('run-jql', runJqlCommand));

// Update description command
program
  .command('update-description <task-id>')
  .description('Update task description from a Markdown file')
  .requiredOption('--from-file <path>', 'Path to Markdown file')
  .action(withPermission('update-description', updateDescriptionCommand));

// Add comment command
program
  .command('add-comment')
  .description('Add a comment to a Jira issue from a Markdown file')
  .requiredOption('--file-path <path>', 'Path to Markdown file')
  .requiredOption('--issue-key <key>', 'Jira issue key (e.g., PS-123)')
  .action(withPermission('add-comment', addCommentCommand));

// About command (always allowed)
program
  .command('about')
  .description('Show information about available commands')
  .action(aboutCommand);

// Parse command line arguments
program.parse();
