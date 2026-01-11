#!/usr/bin/env node

import { Command } from 'commander';
import dotenv from 'dotenv';
import chalk from 'chalk';
import { validateEnvVars } from './lib/utils';
import { meCommand } from './commands/me';
import { projectsCommand } from './commands/projects';
import { taskWithDetailsCommand } from './commands/task-with-details';
import { projectStatusesCommand } from './commands/project-statuses';
import { runJqlCommand } from './commands/run-jql';
import { aboutCommand } from './commands/about';
import { isCommandAllowed, getAllowedCommands } from './lib/settings';

// Load environment variables
dotenv.config();

// Validate environment variables
validateEnvVars();

// Helper function to wrap commands with permission check
function withPermission(commandName: string, commandFn: (...args: any[]) => Promise<void>) {
  return async (...args: any[]) => {
    if (!isCommandAllowed(commandName)) {
      console.error(chalk.red(`\n❌ Command '${commandName}' is not allowed.`));
      console.log(chalk.gray('Allowed commands: ' + getAllowedCommands().join(', ')));
      console.log(chalk.gray('Update settings.yaml to enable this command.\n'));
      process.exit(1);
    }
    return commandFn(...args);
  };
}

// Create CLI program
const program = new Command();

program
  .name('jira')
  .description('CLI tool for interacting with Atlassian Jira')
  .version('1.0.0');

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

// Run JQL command
program
  .command('run-jql <jql-query>')
  .description('Execute JQL query and display results')
  .option('-l, --limit <number>', 'Maximum number of results (default: 50)', '50')
  .action(withPermission('run-jql', runJqlCommand));

// About command (always allowed)
program
  .command('about')
  .description('Show information about available commands')
  .action(aboutCommand);

// Parse command line arguments
program.parse();
