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
import { transitionCommand } from './commands/transition.js';
import { getIssueStatisticsCommand } from './commands/get-issue-statistics.js';
import { aboutCommand } from './commands/about.js';
import { authCommand } from './commands/auth.js';
import { 
  listOrganizations, 
  useOrganizationCommand, 
  removeOrganizationCommand 
} from './commands/organization.js';
import { isCommandAllowed, getAllowedCommands } from './lib/settings.js';
import { setOrganizationOverride } from './lib/jira-client.js';
import { hasCredentials } from './lib/auth-storage.js';
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
  .version('0.3.20')
  .option('-o, --organization <alias>', 'Override the active Jira organization');

// Hook to handle the global option before any command runs
program.on('option:organization', (alias) => {
  setOrganizationOverride(alias);
});

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
  .option('--alias <alias>', 'Alias for this organization')
  .action((options) => authCommand(options));

// Organization commands
const org = program
  .command('organization')
  .alias('org')
  .description('Manage Jira organization profiles');

org
  .command('list')
  .description('Show all saved organizations')
  .action(() => listOrganizations());

org
  .command('use <alias>')
  .description('Switch the active organization')
  .action((alias) => useOrganizationCommand(alias));

org
  .command('remove <alias>')
  .description('Delete an organization credentials')
  .action((alias) => removeOrganizationCommand(alias));

org
  .command('add <alias>')
  .description('Add a new organization')
  .action((alias) => authCommand({ alias }));

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
  .option('--include-detailed-history', 'Include the full history of task actions')
  .option('--history-limit <number>', 'Number of history entries to show (default: 50)', '50')
  .option('--history-offset <number>', 'Number of history entries to skip (default: 0)', '0')
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

// Transition command
program
  .command('transition <task-id> <to-status>')
  .description('Transition a Jira task to a new status')
  .action(withPermission('transition', transitionCommand, {
    validateArgs: (args) => validateOptions(IssueKeySchema, args[0])
  }));

// Get issue statistics command
program
  .command('get-issue-statistics <task-ids>')
  .description('Show time metrics and lifecycle of issues (comma-separated keys)')
  .action(withPermission('get-issue-statistics', getIssueStatisticsCommand));


// About command (always allowed)
program
  .command('about')
  .description('Show information about the tool')
  .action(aboutCommand);

/**
 * Configure command visibility based on auth status and settings
 */
export function configureCommandVisibility(program: Command) {
  const hasCreds = hasCredentials();
  const envVarsSet = !!(
    process.env.JIRA_HOST && 
    process.env.JIRA_USER_EMAIL && 
    process.env.JIRA_API_TOKEN
  );
  const isAuthorized = hasCreds || envVarsSet;

  if (!isAuthorized) {
    program.commands.forEach(cmd => {
      if (cmd.name() !== 'auth' && cmd.name() !== 'about') {
        (cmd as any)._hidden = true;
      }
    });
    program.addHelpText('after', `\n${chalk.yellow('You are not authorized. Please use `jira-ai auth` to authorize. Then you can run other commands.')}`);
  } else {
    program.commands.forEach(cmd => {
      // auth and about are always visible
      if (cmd.name() !== 'auth' && cmd.name() !== 'about') {
        if (!isCommandAllowed(cmd.name())) {
          (cmd as any)._hidden = true;
        }
      }
    });
  }
}

// Parse command line arguments
export async function main() {
  try {
    configureCommandVisibility(program);
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

if (process.argv[1]?.endsWith('cli.ts') || process.argv[1]?.endsWith('cli.js')) {
  main();
}

export { program };
