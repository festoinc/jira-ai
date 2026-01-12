#!/usr/bin/env node

import { Command } from 'commander';
import dotenv from 'dotenv';
import chalk from 'chalk';
import { validateEnvVars } from './lib/utils.js';
import { meCommand } from './commands/me.js';
import { projectsCommand } from './commands/projects.js';
import { taskWithDetailsCommand } from './commands/task-with-details.js';
import { projectStatusesCommand } from './commands/project-statuses.js';
import { listIssueTypesCommand } from './commands/list-issue-types.js';
import { runJqlCommand } from './commands/run-jql.js';
import { updateDescriptionCommand } from './commands/update-description.js';
import { addCommentCommand } from './commands/add-comment.js';
import { addLabelCommand } from './commands/add-label.js';
import { deleteLabelCommand } from './commands/delete-label.js';
import { createTaskCommand } from './commands/create-task.js';
import { getIssueStatisticsCommand } from './commands/get-issue-statistics.js';
import { aboutCommand } from './commands/about.js';
import { authCommand } from './commands/auth.js';
import { isCommandAllowed, getAllowedCommands } from './lib/settings.js';
import { CliError } from './types/errors.js';
import { CommandError } from './lib/errors.js';
import { ui } from './lib/ui.js';
import { 
  validateOptions, 
  CreateTaskSchema, 
  AddCommentSchema, 
  UpdateDescriptionSchema, 
  RunJqlSchema,
  IssueKeySchema,
  ProjectKeySchema
} from './lib/validation.js';

// Load environment variables
dotenv.config({ quiet: true } as any);

// Create CLI program
const program = new Command();

program
  .name('jira-ai')
  .description('CLI tool for interacting with Atlassian Jira')
  .version('0.3.12');

// Middleware to validate credentials for commands that need them
const validateCredentials = () => {
  validateEnvVars();
};

// Helper function to wrap commands with permission check and credential validation
function withPermission(
  commandName: string, 
  commandFn: (...args: any[]) => Promise<void>, 
  config: { skipValidation?: boolean; schema?: any; validateArgs?: (args: any[]) => void } = {}
) {
  return async (...args: any[]) => {
    if (!config.skipValidation) {
      validateCredentials();
    }
    
    if (!isCommandAllowed(commandName)) {
      throw new CommandError(
        `Command '${commandName}' is not allowed.`,
        {
          hints: [
            `Allowed commands: ${getAllowedCommands().join(', ')}`,
            `Update settings.yaml to enable this command.`
          ]
        }
      );
    }

    if (config.schema) {
      // Commander action arguments: [arg1, arg2, ..., options, command]
      const optionsIdx = args.length - 2;
      const options = args[optionsIdx];
      args[optionsIdx] = validateOptions(config.schema, options);
    }

    if (config.validateArgs) {
      // For now, we don't transform positional args because it's more complex,
      // but we could if needed.
      config.validateArgs(args);
    }


    return commandFn(...args);
  };
}

// Auth command (always allowed, skips validation)
program
  .command('auth')
  .description('Set up Jira authentication credentials')
  .option('--from-json <json_string>', 'Accepts a raw JSON string with credentials')
  .option('--from-file <path>', 'Accepts a path to a file (typically .env) with credentials')
  .action((options) => authCommand(options));

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
  .action(withPermission('task-with-details', taskWithDetailsCommand, {
    validateArgs: (args) => validateOptions(IssueKeySchema, args[0])
  }));

// Project statuses command
program
  .command('project-statuses <project-id>')
  .description('Show all possible statuses for a project')
  .action(withPermission('project-statuses', projectStatusesCommand, {
    validateArgs: (args) => validateOptions(ProjectKeySchema, args[0])
  }));

// List issue types command
program
  .command('list-issue-types <project-key>')
  .description('Show all issue types for a project')
  .action(withPermission('list-issue-types', listIssueTypesCommand, {
    validateArgs: (args) => validateOptions(ProjectKeySchema, args[0])
  }));

// Run JQL command
program
  .command('run-jql <jql-query>')
  .description('Execute JQL query and display results')
  .option('-l, --limit <number>', 'Maximum number of results (default: 50)', '50')
  .action(withPermission('run-jql', runJqlCommand, { 
    schema: RunJqlSchema,
    validateArgs: (args) => {
      if (typeof args[0] !== 'string' || args[0].trim() === '') {
        throw new CliError('JQL query cannot be empty');
      }
    }
  }));


// Update description command
program
  .command('update-description <task-id>')
  .description('Update task description from a Markdown file')
  .requiredOption('--from-file <path>', 'Path to Markdown file')
  .action(withPermission('update-description', updateDescriptionCommand, {
    schema: UpdateDescriptionSchema,
    validateArgs: (args) => validateOptions(IssueKeySchema, args[0])
  }));

// Add comment command
program
  .command('add-comment')
  .description('Add a comment to a Jira issue from a Markdown file')
  .requiredOption('--file-path <path>', 'Path to Markdown file')
  .requiredOption('--issue-key <key>', 'Jira issue key (e.g., PS-123)')
  .action(withPermission('add-comment', addCommentCommand, { schema: AddCommentSchema }));

// Add label command
program
  .command('add-label-to-issue <task-id> <labels>')
  .description('Add one or more labels to a Jira issue (comma-separated)')
  .action(withPermission('add-label-to-issue', addLabelCommand, {
    validateArgs: (args) => {
      validateOptions(IssueKeySchema, args[0]);
      if (typeof args[1] !== 'string' || args[1].trim() === '') {
        throw new CliError('Labels are required (comma-separated)');
      }
    }
  }));

// Delete label command
program
  .command('delete-label-from-issue <task-id> <labels>')
  .description('Remove one or more labels from a Jira issue (comma-separated)')
  .action(withPermission('delete-label-from-issue', deleteLabelCommand, {
    validateArgs: (args) => {
      validateOptions(IssueKeySchema, args[0]);
      if (typeof args[1] !== 'string' || args[1].trim() === '') {
        throw new CliError('Labels are required (comma-separated)');
      }
    }
  }));


// Create task command
program
  .command('create-task')
  .description('Create a new Jira issue')
  .requiredOption('--title <title>', 'Issue title/summary')
  .requiredOption('--project <project>', 'Project key (e.g., PROJ)')
  .requiredOption('--issue-type <type>', 'Issue type (e.g., Task, Epic, Subtask)')
  .option('--parent <key>', 'Parent issue key (required for subtasks)')
  .action(withPermission('create-task', createTaskCommand, { schema: CreateTaskSchema }));

// Get issue statistics command
program
  .command('get-issue-statistics <task-ids>')
  .description('Show time metrics and lifecycle of issues (comma-separated keys)')
  .action(withPermission('get-issue-statistics', getIssueStatisticsCommand));


// About command (always allowed)
program
  .command('about')
  .description('Show information about available commands')
  .action(aboutCommand);

// Parse command line arguments
async function main() {
  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    ui.failSpinner();
    
    if (error instanceof CommandError) {
      console.error(chalk.red(`\n❌ Error: ${error.message}`));
      if (error.hints.length > 0) {
        error.hints.forEach(hint => {
          console.error(chalk.yellow(`   Hint: ${hint}`));
        });
      }
      console.log(); // Add a newline
      process.exit(error.exitCode);
    } else if (error instanceof CliError) {
      console.error(chalk.red(`\n❌ ${error.message}\n`));
      process.exit(1);
    } else if (error instanceof Error) {
      console.error(chalk.red(`\n💥 Unexpected Error: ${error.message}`));
      if (process.env.DEBUG) {
        console.error(chalk.gray(error.stack));
      }
      console.error(chalk.gray('\nPlease report this issue if it persists.\n'));
      process.exit(1);
    } else {
      console.error(chalk.red(`\n💥 An unknown error occurred: ${String(error)}\n`));
      process.exit(1);
    }
  }
}

main();
