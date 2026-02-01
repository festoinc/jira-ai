#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { validateEnvVars, getVersion } from './lib/utils.js';
import { meCommand } from './commands/me.js';
import { projectsCommand } from './commands/projects.js';
import { taskWithDetailsCommand } from './commands/task-with-details.js';
import { projectStatusesCommand } from './commands/project-statuses.js';
import { listIssueTypesCommand } from './commands/list-issue-types.js';
import { listColleaguesCommand } from './commands/list-colleagues.js';
import { runJqlCommand } from './commands/run-jql.js';
import { updateDescriptionCommand } from './commands/update-description.js';
import { addCommentCommand } from './commands/add-comment.js';
import { addLabelCommand } from './commands/add-label.js';
import { deleteLabelCommand } from './commands/delete-label.js';
import { createTaskCommand } from './commands/create-task.js';
import { transitionCommand } from './commands/transition.js';
import { issueAssignCommand } from './commands/issue.js';
import { getIssueStatisticsCommand } from './commands/get-issue-statistics.js';
import { getPersonWorklogCommand } from './commands/get-person-worklog.js';
import {
  confluenceGetPageCommand,
  confluenceListSpacesCommand,
  confluenceGetSpacePagesHierarchyCommand,
  confluenceAddCommentCommand,
  confluenceCreatePageCommand,
  confluenceUpdateDescriptionCommand,
  confluenceSearchCommand
} from './commands/confluence.js';
import { aboutCommand } from './commands/about.js';
import { authCommand } from './commands/auth.js';
import { settingsCommand } from './commands/settings.js';
import {
  listOrganizations,
  useOrganizationCommand,
  removeOrganizationCommand
} from './commands/organization.js';
import { isCommandAllowed, getAllowedCommands } from './lib/settings.js';
import { setOrganizationOverride } from './lib/jira-client.js';
import { hasCredentials } from './lib/auth-storage.js';
import { checkForUpdate, formatUpdateMessage, checkForUpdateSync } from './lib/update-check.js';
import { CliError } from './types/errors.js';
import { CommandError } from './lib/errors.js';
import { ui } from './lib/ui.js';
import {
  CreateTaskSchema,
  AddCommentSchema,
  UpdateDescriptionSchema,
  ConfluenceAddCommentSchema,
  RunJqlSchema,
  GetPersonWorklogSchema,
  GetIssueStatisticsSchema,
  validateOptions,
  IssueKeySchema,
  ProjectKeySchema,
  TimeframeSchema
} from './lib/validation.js';
import { realpathSync } from 'fs';

// Create CLI program
const program = new Command();

program
  .name('jira-ai')
  .description('CLI tool for interacting with Atlassian Jira')
  .version(getVersion())
  .option('-o, --organization <alias>', 'Override the active Jira organization')
  .addHelpText('after', () => {
    const latestVersion = checkForUpdateSync();
    if (latestVersion) {
      return `\n${formatUpdateMessage(latestVersion)}\n`;
    }
    return '';
  });

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
  .description('Set up Jira authentication credentials. Supports interactive input, raw JSON string via --from-json, or .env file via --from-file.')
  .option('--from-json <json_string>', 'Accepts a raw JSON string with credentials')
  .option('--from-file <path>', 'Accepts a path to a file (typically .env) with credentials')
  .option('--alias <alias>', 'Alias for this organization')
  .option('--logout', 'Logout from all organizations')
  .action((options) => authCommand(options))
  .command('logout')
  .description('Logout from all organizations')
  .action(() => authCommand({ logout: true }));

// =============================================================================
// ISSUE COMMANDS
// =============================================================================
const issue = program
  .command('issue')
  .description('Manage Jira issues');

issue
  .command('get <issue-id>')
  .description('Retrieve comprehensive issue data including key, summary, status, assignee, reporter, dates, labels, description, and comments.')
  .option('--include-detailed-history', 'Include the full history of task actions')
  .option('--history-limit <number>', 'Number of history entries to show (default: 50)', '50')
  .option('--history-offset <number>', 'Number of history entries to skip (default: 0)', '0')
  .action(withPermission('issue.get', taskWithDetailsCommand, {
    validateArgs: (args) => validateOptions(IssueKeySchema, args[0])
  }));

issue
  .command('create')
  .description('Create a new Jira issue with specified title, project key, and issue type.')
  .requiredOption('--title <title>', 'Issue title/summary')
  .requiredOption('--project <project>', 'Project key (e.g., PROJ)')
  .requiredOption('--issue-type <type>', 'Issue type (e.g., Task, Epic, Subtask)')
  .option('--parent <key>', 'Parent issue key (required for subtasks)')
  .action(withPermission('issue.create', createTaskCommand, { schema: CreateTaskSchema }));

issue
  .command('search <jql-query>')
  .description('Execute a JQL search query. Returns issues with key, summary, status, assignee, and priority.')
  .option('-l, --limit <number>', 'Maximum number of results (default: 50)', '50')
  .action(withPermission('issue.search', runJqlCommand, {
    schema: RunJqlSchema,
    validateArgs: (args) => {
      if (typeof args[0] !== 'string' || args[0].trim() === '') {
        throw new CliError('JQL query cannot be empty');
      }
    }
  }));

issue
  .command('transition <issue-id> <to-status>')
  .description('Change the status of a Jira issue. The <to-status> can be either the status name or ID.')
  .action(withPermission('issue.transition', transitionCommand, {
    validateArgs: (args) => validateOptions(IssueKeySchema, args[0])
  }));

issue
  .command('update <issue-id>')
  .description('Update a Jira issue\'s description using content from a local Markdown file.')
  .requiredOption('--from-file <path>', 'Path to Markdown file')
  .action(withPermission('issue.update', updateDescriptionCommand, {
    schema: UpdateDescriptionSchema,
    validateArgs: (args) => validateOptions(IssueKeySchema, args[0])
  }));

issue
  .command('comment <issue-id>')
  .description('Add a new comment to a Jira issue using content from a local Markdown file.')
  .requiredOption('--from-file <path>', 'Path to Markdown file')
  .action(withPermission('issue.comment', (issueKey: string, options: { fromFile: string }) => {
    return addCommentCommand({ filePath: options.fromFile, issueKey });
  }, {
    schema: UpdateDescriptionSchema,
    validateArgs: (args) => validateOptions(IssueKeySchema, args[0])
  }));

issue
  .command('stats <issue-ids>')
  .description('Calculate time-based metrics for one or more issues (comma-separated). Shows time logged, estimates, and status breakdown.')
  .option('--full-breakdown', 'Display each status in its own column')
  .action(withPermission('issue.stats', getIssueStatisticsCommand, {
    schema: GetIssueStatisticsSchema
  }));

issue
  .command('assign <issue-id> <account-id>')
  .description('Assign or reassign a Jira issue to a user. Use "null" as account-id to unassign.')
  .action(withPermission('issue.assign', issueAssignCommand, {
    validateArgs: (args) => validateOptions(IssueKeySchema, args[0])
  }));

// Issue label subcommands
const issueLabel = issue
  .command('label')
  .description('Manage issue labels');

issueLabel
  .command('add <issue-id> <labels>')
  .description('Add one or more labels (comma-separated) to a Jira issue.')
  .action(withPermission('issue.label.add', addLabelCommand, {
    validateArgs: (args) => {
      validateOptions(IssueKeySchema, args[0]);
      if (typeof args[1] !== 'string' || args[1].trim() === '') {
        throw new CliError('Labels are required (comma-separated)');
      }
    }
  }));

issueLabel
  .command('remove <issue-id> <labels>')
  .description('Remove one or more labels (comma-separated) from a Jira issue.')
  .action(withPermission('issue.label.remove', deleteLabelCommand, {
    validateArgs: (args) => {
      validateOptions(IssueKeySchema, args[0]);
      if (typeof args[1] !== 'string' || args[1].trim() === '') {
        throw new CliError('Labels are required (comma-separated)');
      }
    }
  }));

// =============================================================================
// PROJECT COMMANDS
// =============================================================================
const project = program
  .command('project')
  .description('Manage Jira projects');

project
  .command('list')
  .description('List all accessible Jira projects showing their key, name, ID, type, and project lead.')
  .action(withPermission('project.list', projectsCommand));

project
  .command('statuses <project-key>')
  .description('Fetch all available workflow statuses for a project (To Do, In Progress, Done).')
  .action(withPermission('project.statuses', projectStatusesCommand, {
    validateArgs: (args) => validateOptions(ProjectKeySchema, args[0])
  }));

project
  .command('types <project-key>')
  .description('List all issue types (Standard and Subtask) available for a project.')
  .action(withPermission('project.types', listIssueTypesCommand, {
    validateArgs: (args) => validateOptions(ProjectKeySchema, args[0])
  }));

// =============================================================================
// USER COMMANDS
// =============================================================================
const user = program
  .command('user')
  .description('User information and worklogs');

user
  .command('me')
  .description('Show profile details for the currently authenticated user.')
  .action(withPermission('user.me', meCommand));

user
  .command('search [project-key]')
  .description('Search and list users within the organization or a specific project.')
  .action(withPermission('user.search', listColleaguesCommand, {
    validateArgs: (args) => {
      if (args[0]) {
        validateOptions(ProjectKeySchema, args[0]);
      }
    }
  }));

user
  .command('worklog <person> <timeframe>')
  .description('Retrieve worklogs for a user over a timeframe (e.g., "7d", "2w").')
  .option('--group-by-issue', 'Group the output by issue')
  .action(withPermission('user.worklog', getPersonWorklogCommand, {
    schema: GetPersonWorklogSchema,
    validateArgs: (args) => {
      validateOptions(TimeframeSchema, args[1]);
    }
  }));

// =============================================================================
// ORGANIZATION COMMANDS
// =============================================================================
const org = program
  .command('org')
  .alias('organization')
  .description('Manage Jira organization profiles');

org
  .command('list')
  .description('List all saved Jira organization profiles.')
  .action(() => listOrganizations());

org
  .command('use <alias>')
  .description('Switch the active Jira organization profile.')
  .action((alias) => useOrganizationCommand(alias));

org
  .command('remove <alias>')
  .description('Delete credentials for the specified organization.')
  .action((alias) => removeOrganizationCommand(alias));

org
  .command('add <alias>')
  .description('Add a new Jira organization profile.')
  .action((alias) => authCommand({ alias }));


// =============================================================================
// CONFLUENCE COMMANDS
// =============================================================================
const confl = program
  .command('confl')
  .alias('confluence')
  .description('Interact with Confluence pages and content');

confl
  .command('get <url>')
  .description('Download and display Confluence page content and comments from a given URL.')
  .option('--return-both-urls', 'Return both the full URL and the legacy short URL')
  .action(withPermission('confl.get', confluenceGetPageCommand, { skipValidation: false }));

confl
  .command('spaces')
  .description('List all allowed Confluence spaces.')
  .action(withPermission('confl.spaces', confluenceListSpacesCommand, { skipValidation: false }));

confl
  .command('pages <space-key>')
  .description('Display a hierarchical tree view of pages within a specific space.')
  .action(withPermission('confl.pages', confluenceGetSpacePagesHierarchyCommand, { skipValidation: false }));

confl
  .command('create <space> <title> [parent-page]')
  .description('Create a new Confluence page.')
  .option('--return-both-urls', 'Return both the full URL and the legacy short URL')
  .action(withPermission('confl.create', confluenceCreatePageCommand, { skipValidation: false }));

confl
  .command('comment <url>')
  .description('Add a comment to a Confluence page using content from a Markdown file.')
  .option('-f, --from-file <path>', 'Path to the markdown file containing the comment content.')
  .action(withPermission('confl.comment', confluenceAddCommentCommand, { schema: ConfluenceAddCommentSchema }));

confl
  .command('update <url>')
  .description('Update the content of a Confluence page using a Markdown file.')
  .option('-f, --from-file <path>', 'Path to the markdown file containing the new content.')
  .action(withPermission('confl.update', confluenceUpdateDescriptionCommand, { schema: UpdateDescriptionSchema }));

confl
  .command('search <query>')
  .description('Search Confluence content using a search phrase.')
  .option('-l, --limit <number>', 'Maximum number of results (default: 20)', '20')
  .action(withPermission('confl.search', confluenceSearchCommand, {
    validateArgs: (args) => {
      if (typeof args[0] !== 'string' || args[0].trim() === '') {
        throw new CliError('Search query cannot be empty');
      }
    }
  }));


// About command (always allowed)
program
  .command('about')
  .description('Show information about the tool')
  .action(aboutCommand);

// Settings command
program
  .command('settings')
  .description('View, validate, or apply configuration settings.')
  .option('--apply <path>', 'Validate and apply settings from a YAML file')
  .option('--validate <path>', 'Perform schema and deep validation of a settings YAML file')
  .option('--reset', 'Revert settings to default')
  .addHelpText('after', `
Examples:
  $ jira-ai settings
  $ jira-ai settings --validate my-settings.yaml
  $ jira-ai settings --apply my-settings.yaml
  $ jira-ai settings --reset

Settings File Structure:
  defaults:
    allowed-jira-projects:
      - all                     # Allow all projects
    allowed-commands:
      - all                     # Allow all commands
    allowed-confluence-spaces:
      - all                     # Allow all Confluence spaces

  organizations:
    work:
      allowed-jira-projects:
        - PROJ                  # Allow specific project
        - key: PM               # Project-specific config
          commands:
            - issue.get         # Only allow reading issues
          filters:
            participated:
              was_assignee: true
      allowed-commands:
        - issue                 # All issue commands
        - project.list          # Only project list
        - user.me               # Only user me
      allowed-confluence-spaces:
        - DOCS

Command Groups (use in allowed-commands):
  issue       - get, create, search, transition, update, comment, stats, assign, label
  project     - list, statuses, types
  user        - me, search, worklog
  org         - list, use, add, remove
  confl       - get, spaces, pages, create, comment, update

Examples:
  - "issue"           → allows all issue subcommands
  - "issue.get"       → allows only issue get
  - "issue.label"     → allows issue label add and remove
`)
  .action((options) => settingsCommand(options));

/**
 * Configure command visibility based on auth status and settings
 */
export function configureCommandVisibility(program: Command) {
  const isAuthorized = hasCredentials();
  const alwaysVisibleCommands = ['auth', 'about', 'settings'];

  if (!isAuthorized) {
    program.commands.forEach(cmd => {
      if (!alwaysVisibleCommands.includes(cmd.name())) {
        (cmd as any)._hidden = true;
      }
    });
    program.addHelpText('after', `\n${chalk.yellow('You are not authorized. Please use `jira-ai auth` to authorize. Then you can run other commands.')}`);
  } else {
    program.commands.forEach(cmd => {
      if (!alwaysVisibleCommands.includes(cmd.name())) {
        // For hierarchical commands, check if the group is allowed
        // e.g., 'issue' command group is allowed if 'issue' or any 'issue.*' is allowed
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
    // Background update check (non-blocking for the user)
    checkForUpdate().catch(() => {});

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

// Check if this file is being run directly (handles symlinks)
const scriptPath = process.argv[1] ? realpathSync(process.argv[1]) : '';
const isMainModule = scriptPath.endsWith('cli.ts') || scriptPath.endsWith('cli.js');

if (isMainModule) {
  main();
}

export { program };
