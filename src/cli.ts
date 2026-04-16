#!/usr/bin/env node

import { Command } from 'commander';
import { validateEnvVars, getVersion } from './lib/utils.js';
import { meCommand } from './commands/me.js';
import { projectsCommand } from './commands/projects.js';
import { taskWithDetailsCommand } from './commands/task-with-details.js';
import { projectStatusesCommand } from './commands/project-statuses.js';
import { listIssueTypesCommand } from './commands/list-issue-types.js';
import { listColleaguesCommand } from './commands/list-colleagues.js';
import { runJqlCommand } from './commands/run-jql.js';
import { updateDescriptionCommand } from './commands/update-description.js';
import { updateIssueCommand } from './commands/update-issue.js';
import { projectFieldsCommand } from './commands/project-fields.js';
import { addCommentCommand } from './commands/add-comment.js';
import { addLabelCommand } from './commands/add-label.js';
import { deleteLabelCommand } from './commands/delete-label.js';
import { listIssueLinksCommand } from './commands/list-issue-links.js';
import { createIssueLinkCommand } from './commands/create-issue-link.js';
import { deleteIssueLinkCommand } from './commands/delete-issue-link.js';
import { listLinkTypesCommand } from './commands/list-link-types.js';
import { createTaskCommand } from './commands/create-task.js';
import { transitionCommand, listTransitionsCommand } from './commands/transition.js';
import { issueAssignCommand } from './commands/issue.js';
import { issueTreeCommand } from './commands/issue-tree.js';
import { sprintTreeCommand } from './commands/sprint-tree.js';
import {
  uploadAttachmentCommand,
  listAttachmentsCommand,
  downloadAttachmentCommand,
  deleteAttachmentCommand,
} from './commands/attach.js';
import { getIssueStatisticsCommand } from './commands/get-issue-statistics.js';
import { getPersonWorklogCommand } from './commands/get-person-worklog.js';
import { isCommandAllowed, getAllowedCommands } from './lib/settings.js';
import {
  confluenceGetPageCommand,
  confluenceListSpacesCommand,
  confluenceGetSpacePagesHierarchyCommand,
  confluenceAddCommentCommand,
  confluenceCreatePageCommand,
  confluenceUpdateDescriptionCommand,
  confluenceSearchCommand
} from './commands/confluence.js';
import {
  epicListCommand,
  epicGetCommand,
  epicCreateCommand,
  epicUpdateCommand,
  epicIssuesCommand,
  epicLinkCommand,
  epicUnlinkCommand,
  epicProgressCommand,
} from './commands/epic.js';
import {
  boardListCommand,
  boardGetCommand,
  boardConfigCommand,
  boardIssuesCommand,
  boardRankCommand,
} from './commands/board.js';
import {
  sprintListCommand,
  sprintGetCommand,
  sprintCreateCommand,
  sprintStartCommand,
  sprintCompleteCommand,
  sprintUpdateCommand,
  sprintDeleteCommand,
  sprintIssuesCommand,
  sprintMoveCommand,
} from './commands/sprint.js';
import { backlogMoveCommand } from './commands/backlog.js';
import { issueCommentsCommand } from './commands/issue-comments.js';
import { issueActivityCommand } from './commands/issue-activity.js';
import {
  issueWorklogListCommand,
  issueWorklogAddCommand,
  issueWorklogUpdateCommand,
  issueWorklogDeleteCommand,
} from './commands/issue-worklog.js';
import { aboutCommand } from './commands/about.js';
import { authCommand } from './commands/auth.js';
import { settingsCommand } from './commands/settings.js';
import { hasCredentials } from './lib/auth-storage.js';
import { checkForUpdate, formatUpdateMessage, checkForUpdateSync } from './lib/update-check.js';
import { CliError } from './types/errors.js';
import { CommandError } from './lib/errors.js';
import { initJsonMode, outputError } from './lib/json-mode.js';
import {
  CreateTaskSchema,
  AddCommentSchema,
  UpdateDescriptionSchema,
  UpdateIssueSchema,
  ProjectFieldsSchema,
  ConfluenceAddCommentSchema,
  RunJqlSchema,
  GetPersonWorklogSchema,
  GetIssueStatisticsSchema,
  EpicListSchema,
  EpicCreateSchema,
  EpicUpdateSchema,
  EpicLinkSchema,
  EpicMaxSchema,
  validateOptions,
  IssueKeySchema,
  ProjectKeySchema,
  TimeframeSchema,
  BoardListSchema,
  BoardIssuesSchema,
  BoardRankSchema,
  SprintListSchema,
  SprintCreateSchema,
  SprintUpdateSchema,
  SprintIssuesSchema,
  SprintMoveSchema,
  BacklogMoveSchema,
  AttachUploadSchema,
  AttachDownloadSchema,
  CommentsListSchema,
  ActivityFeedSchema,
} from './lib/validation.js';
import { realpathSync } from 'fs';

// Create CLI program
const program = new Command();

program
  .name('jira-ai')
  .description('CLI tool for interacting with Atlassian Jira')
  .version(getVersion())
  .option('--compact', 'Output as compact JSON')
  .option('--dry-run', 'Preview changes without executing them')
  .addHelpText('after', () => {
    const latestVersion = checkForUpdateSync();
    if (latestVersion) {
      return `\n${formatUpdateMessage(latestVersion)}\n`;
    }
    return '';
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
  .description('Set up Jira authentication credentials via --from-json or --from-file.')
  .option('--from-json <json_string>', 'Accepts a raw JSON string with credentials')
  .option('--from-file <path>', 'Accepts a path to a file (typically .env) with credentials')
  .option('--logout', 'Logout from Jira')
  .option('--service-account', 'Use Atlassian service account auth via api.atlassian.com gateway')
  .option('--cloud-id <id>', 'Atlassian Cloud ID (auto-discovered if not provided)')
  .action((options) => authCommand(options))
  .command('logout')
  .description('Logout from Jira')
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
  .option('--priority <priority>', 'Issue priority (e.g., High, Medium, Low)')
  .option('--description <text>', 'Issue description as Markdown')
  .option('--description-file <path>', 'Path to a Markdown file for the description')
  .option('--labels <labels>', 'Comma-separated labels')
  .option('--component <component>', 'Comma-separated component names')
  .option('--fix-version <version>', 'Comma-separated fix version names')
  .option('--due-date <date>', 'Due date in YYYY-MM-DD format')
  .option('--assignee <assignee>', 'Assignee (accountid:<id> or display name)')
  .option('--custom-field <field=value>', 'Custom field in fieldId=value format (repeatable)', (val: string, prev: string[]) => [...(prev || []), val], [] as string[])
  .action(withPermission('issue.create', createTaskCommand, { schema: CreateTaskSchema }));

issue
  .command('search [jql-query]')
  .description('Execute a JQL search query. Provide raw JQL or use --query to reference a saved query.')
  .option('-l, --limit <number>', 'Maximum number of results (default: 50)', '50')
  .option('--query <name>', 'Use a saved query by name (mutually exclusive with positional JQL)')
  .option('--list-queries', 'List all available saved queries')
  .action(withPermission('issue.search', runJqlCommand, {
    schema: RunJqlSchema,
    validateArgs: (args) => {
      const jqlQuery = args[0] as string | undefined;
      const opts = args[args.length - 2] as any;
      const hasQuery = opts && opts.query;
      const hasListQueries = opts && opts.listQueries;
      if (!hasQuery && !hasListQueries && (typeof jqlQuery !== 'string' || jqlQuery.trim() === '')) {
        throw new CliError('JQL query cannot be empty. Provide a JQL query, use --query <name>, or use --list-queries.');
      }
    }
  }));

issue
  .command('transition <issue-id> <to-status>')
  .description('Change the status of a Jira issue. The <to-status> can be either the status name or ID.')
  .option('--resolution <name>', 'Resolution name (e.g., "Done", "Won\'t Do")')
  .option('--comment <text>', 'Add a comment (markdown) during transition')
  .option('--comment-file <path>', 'Read comment from a markdown file (mutually exclusive with --comment)')
  .option('--assignee <email-or-name>', 'Assignee (accountid:<id> or display name)')
  .option('--fix-version <name>', 'Fix version name')
  .option('--custom-field <entry>', 'Custom field as "Field Name=value" (repeatable)', (v: string, acc: string[]) => { acc.push(v); return acc; }, [] as string[])
  .action(withPermission('issue.transition', (taskId: string, toStatus: string, opts: any) => transitionCommand(taskId, toStatus, {
    resolution: opts.resolution,
    comment: opts.comment,
    commentFile: opts.commentFile,
    assignee: opts.assignee,
    fixVersion: opts.fixVersion,
    customFields: opts.customField,
  }), {
    validateArgs: (args) => validateOptions(IssueKeySchema, args[0])
  }));

issue
  .command('transitions <issue-id>')
  .description('List available transitions for a Jira issue, including required fields.')
  .option('--required-only', 'Only show transitions that have required fields')
  .action(withPermission('issue.transition', (issueId: string, opts: any) => listTransitionsCommand(issueId, {
    requiredOnly: opts.requiredOnly,
  }), {
    validateArgs: (args) => validateOptions(IssueKeySchema, args[0])
  }));

issue
  .command('update <issue-id>')
  .description('Update one or more fields of a Jira issue. Supports priority, summary, description, labels, components, fix versions, due date, assignee, and custom fields.')
  .option('--from-file <path>', 'Update description from a Markdown file (legacy alias for --description-file)')
  .option('--priority <priority>', 'New priority (e.g., High, Medium, Low)')
  .option('--summary <text>', 'New summary/title')
  .option('--description <text>', 'New description as Markdown')
  .option('--labels <labels>', 'Comma-separated labels (replaces existing)')
  .option('--clear-labels', 'Remove all labels from the issue')
  .option('--component <component>', 'Comma-separated component names')
  .option('--fix-version <version>', 'Comma-separated fix version names')
  .option('--due-date <date>', 'Due date in YYYY-MM-DD format')
  .option('--assignee <assignee>', 'Assignee (accountid:<id> or display name)')
  .option('--custom-field <field=value>', 'Custom field in fieldId=value format (repeatable)', (val: string, prev: string[]) => [...(prev || []), val], [] as string[])
  .action(withPermission('issue.update', (issueId: string, options: any) => {
    return updateIssueCommand(issueId, options);
  }, {
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
  .command('comments <issue-id>')
  .description('List comments on a Jira issue.')
  .option('--limit <n>', 'Maximum number of comments to return (default: 50)')
  .option('--since <iso>', 'Only include comments created on or after this ISO timestamp')
  .option('--reverse', 'Return comments in chronological order (oldest first)')
  .action(withPermission('issue.comments', (issueKey: string, options: any) => {
    return issueCommentsCommand({
      issueKey,
      limit: options.limit ? parseInt(options.limit, 10) : undefined,
      since: options.since,
      reverse: options.reverse,
    });
  }, {
    validateArgs: (args) => validateOptions(IssueKeySchema, args[0])
  }));

issue
  .command('activity <issue-id>')
  .description('Show a unified activity feed (changelog + comments) for a Jira issue.')
  .option('--since <iso>', 'Only include activities on or after this ISO timestamp')
  .option('--limit <n>', 'Maximum number of activities to return (default: 50)')
  .option('--types <types>', 'Comma-separated activity types to include (e.g., status_change,comment_added)')
  .option('--author <name-or-email>', 'Filter by author display name, email, or accountId')
  .action(withPermission('issue.activity', (issueKey: string, options: any) => {
    return issueActivityCommand({
      issueKey,
      since: options.since,
      limit: options.limit ? parseInt(options.limit, 10) : undefined,
      types: options.types,
      author: options.author,
      compact: program.opts().compact || options.compact,
    });
  }, {
    validateArgs: (args) => validateOptions(IssueKeySchema, args[0])
  }));

// Issue worklog subcommands
const worklog = issue
  .command('worklog')
  .description('Manage worklogs for a Jira issue');

worklog
  .command('list <issue-id>')
  .description('List all worklogs for a Jira issue.')
  .option('--started-after <timestamp>', 'Only return worklogs started at or after this UNIX timestamp (ms)')
  .option('--started-before <timestamp>', 'Only return worklogs started before this UNIX timestamp (ms)')
  .option('--author-account-id <accountId>', 'Filter by author account ID')
  .action(withPermission('issue.worklog.list', (issueKey: string, options: any) => {
    return issueWorklogListCommand({
      issueKey,
      startedAfter: options.startedAfter ? parseInt(options.startedAfter, 10) : undefined,
      startedBefore: options.startedBefore ? parseInt(options.startedBefore, 10) : undefined,
      authorAccountId: options.authorAccountId,
    });
  }, {
    validateArgs: (args) => validateOptions(IssueKeySchema, args[0])
  }));

worklog
  .command('add <issue-id>')
  .description('Log time against a Jira issue.')
  .requiredOption('--time <duration>', 'Time to log (e.g. 1h, 30m, 1d2h30m, 1w)')
  .option('--comment <text>', 'Optional comment for this worklog entry')
  .option('--started <datetime>', 'When the work started (ISO 8601, defaults to now). Timezone offsets are auto-normalized.')
  .option('--adjust-estimate <method>', 'Estimate adjustment: auto, new, leave, manual')
  .option('--new-estimate <duration>', 'New remaining estimate (use with --adjust-estimate new or manual)')
  .option('--reduce-by <duration>', 'Reduce remaining estimate by this amount (use with --adjust-estimate manual)')
  .action(withPermission('issue.worklog.add', (issueKey: string, options: any) => {
    return issueWorklogAddCommand({
      issueKey,
      time: options.time,
      comment: options.comment,
      started: options.started,
      adjustEstimate: options.adjustEstimate,
      newEstimate: options.newEstimate,
      reduceBy: options.reduceBy,
    });
  }, {
    validateArgs: (args) => validateOptions(IssueKeySchema, args[0])
  }));

worklog
  .command('update <issue-id>')
  .description('Update an existing worklog entry.')
  .requiredOption('--id <worklog-id>', 'ID of the worklog to update')
  .option('--time <duration>', 'New time spent (e.g. 1h, 30m, 1d)')
  .option('--comment <text>', 'New comment for this worklog')
  .option('--started <datetime>', 'New start time (ISO 8601). Timezone offsets are auto-normalized.')
  .option('--adjust-estimate <method>', 'Estimate adjustment: auto, new, leave, manual')
  .option('--new-estimate <duration>', 'New remaining estimate')
  .action(withPermission('issue.worklog.update', (issueKey: string, options: any) => {
    return issueWorklogUpdateCommand({
      issueKey,
      id: options.id,
      time: options.time,
      comment: options.comment,
      started: options.started,
      adjustEstimate: options.adjustEstimate,
      newEstimate: options.newEstimate,
    });
  }, {
    validateArgs: (args) => validateOptions(IssueKeySchema, args[0])
  }));

worklog
  .command('delete <issue-id>')
  .description('Delete a worklog entry from a Jira issue.')
  .requiredOption('--id <worklog-id>', 'ID of the worklog to delete')
  .option('--adjust-estimate <method>', 'Estimate adjustment: auto, new, leave, manual')
  .option('--new-estimate <duration>', 'New remaining estimate (use with --adjust-estimate new)')
  .option('--increase-by <duration>', 'Increase remaining estimate by this amount')
  .action(withPermission('issue.worklog.delete', (issueKey: string, options: any) => {
    return issueWorklogDeleteCommand({
      issueKey,
      id: options.id,
      adjustEstimate: options.adjustEstimate,
      newEstimate: options.newEstimate,
      increaseBy: options.increaseBy,
    });
  }, {
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

// Issue link subcommands
const issueLink = issue
  .command('link')
  .description('Manage issue-to-issue links');

issueLink
  .command('list <issue-key>')
  .description('List all issue links (inward + outward) for an issue.')
  .action(withPermission('issue.link.list', listIssueLinksCommand, {
    validateArgs: (args) => validateOptions(IssueKeySchema, args[0])
  }));

issueLink
  .command('create <source-key> <link-type> <target-key>')
  .description('Create a link between two issues. Link type can be name (e.g., "Blocks", "Relates").')
  .action(withPermission('issue.link.create', (sourceKey: string, linkType: string, targetKey: string) => {
    return createIssueLinkCommand(sourceKey, linkType, targetKey);
  }, {
    validateArgs: (args) => {
      validateOptions(IssueKeySchema, args[0]);
      validateOptions(IssueKeySchema, args[2]);
      if (typeof args[1] !== 'string' || args[1].trim() === '') {
        throw new CliError('Link type is required');
      }
    }
  }));

issueLink
  .command('delete <source-key>')
  .requiredOption('--target <target-key>', 'Target issue key')
  .description('Delete a link between two issues.')
  .action(withPermission('issue.link.delete', (sourceKey: string, options: { target: string }) => {
    return deleteIssueLinkCommand(sourceKey, options.target);
  }, {
    validateArgs: (args) => {
      validateOptions(IssueKeySchema, args[0]);
      const options = args[args.length - 2];
      if (typeof options.target !== 'string' || options.target.trim() === '') {
        throw new CliError('Target issue key is required');
      }
      validateOptions(IssueKeySchema, options.target);
    }
  }));

issueLink
  .command('types')
  .description('List all available issue link types for the Jira instance.')
  .action(withPermission('issue.link.types', listLinkTypesCommand));

// Issue attach subcommands
const issueAttach = issue
  .command('attach')
  .description('Manage issue attachments');

issueAttach
  .command('upload <issue-key>')
  .description('Upload one or more files as attachments to a Jira issue.')
  .requiredOption('--file <path...>', 'File path(s) to upload (repeatable)')
  .action(withPermission('issue.attach.upload', (issueKey: string, options: { file: string[] }) => {
    return uploadAttachmentCommand(issueKey, options.file);
  }, {
    schema: AttachUploadSchema,
    validateArgs: (args) => validateOptions(IssueKeySchema, args[0])
  }));

issueAttach
  .command('list <issue-key>')
  .description('List all attachments for a Jira issue.')
  .action(withPermission('issue.attach.list', listAttachmentsCommand, {
    validateArgs: (args) => validateOptions(IssueKeySchema, args[0])
  }));

issueAttach
  .command('download <issue-key>')
  .description('Download an attachment from a Jira issue.')
  .requiredOption('--id <attachment-id>', 'Attachment ID to download')
  .option('--output <path>', 'Output file path (defaults to attachment filename in current directory)')
  .action(withPermission('issue.attach.download', (issueKey: string, options: { id: string; output?: string }) => {
    return downloadAttachmentCommand(issueKey, options.id, options.output);
  }, {
    schema: AttachDownloadSchema,
    validateArgs: (args) => validateOptions(IssueKeySchema, args[0])
  }));

issueAttach
  .command('delete <issue-key>')
  .description('Delete an attachment from a Jira issue.')
  .requiredOption('--id <attachment-id>', 'Attachment ID to delete')
  .action(withPermission('issue.attach.delete', (issueKey: string, options: { id: string }) => {
    return deleteAttachmentCommand(issueKey, options.id);
  }, {
    validateArgs: (args) => validateOptions(IssueKeySchema, args[0])
  }));

issue
  .command('tree <issue-key>')
  .description('Show the full issue hierarchy tree rooted at an issue, including subtasks and optionally linked issues.')
  .option('--links', 'Include linked issues as single-hop leaf nodes')
  .option('--depth <number>', 'Max traversal depth (default: 3)', '3')
  .option('--max-nodes <number>', 'Max nodes in tree (default: 200)', '200')
  .option('--types <types>', 'Comma-separated link types to include (e.g. Blocks,Relates)')
  .action(withPermission('issue.tree', (issueKey: string, options: any) =>
    issueTreeCommand(issueKey, {
      links: options.links || false,
      depth: options.depth ? Number(options.depth) : undefined,
      maxNodes: options.maxNodes ? Number(options.maxNodes) : undefined,
      types: options.types,
    }),
    { validateArgs: (args) => validateOptions(IssueKeySchema, args[0]) }
  ));

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

project
  .command('fields <project-key>')
  .description('List all available fields for a project, including custom fields.')
  .option('--type <issue-type>', 'Filter fields by issue type')
  .option('--custom', 'Show only custom fields')
  .option('--search <term>', 'Filter fields by name or ID')
  .action(withPermission('project.fields', (projectKey: string, options: any) => {
    return projectFieldsCommand(projectKey, options);
  }, {
    schema: ProjectFieldsSchema,
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


// =============================================================================
// EPIC COMMANDS
// =============================================================================
const epic = program
  .command('epic')
  .description('Manage Jira epics');

epic
  .command('list <project-key>')
  .description('List epics in a project. Use --done to include completed epics.')
  .option('--done', 'Include completed epics')
  .option('--max <n>', 'Maximum results (default: 50)', '50')
  .action(withPermission('epic.list', epicListCommand, { schema: EpicListSchema }));

epic
  .command('get <epic-key>')
  .description('Get full details of a single epic including description, assignee, and labels.')
  .action(withPermission('epic.get', epicGetCommand, {
    validateArgs: (args) => validateOptions(IssueKeySchema, args[0])
  }));

epic
  .command('create <project-key>')
  .description('Create a new epic in a project.')
  .requiredOption('--name <name>', 'Epic name')
  .requiredOption('--summary <text>', 'Epic summary')
  .option('--description <text>', 'Epic description')
  .option('--labels <labels>', 'Comma-separated labels')
  .action(withPermission('epic.create', epicCreateCommand, {
    schema: EpicCreateSchema,
    validateArgs: (args) => validateOptions(ProjectKeySchema, args[0])
  }));

epic
  .command('update <epic-key>')
  .description('Update an epic\'s name and/or summary.')
  .option('--name <name>', 'New epic name')
  .option('--summary <text>', 'New summary')
  .action(withPermission('epic.update', epicUpdateCommand, {
    schema: EpicUpdateSchema,
    validateArgs: (args) => validateOptions(IssueKeySchema, args[0])
  }));

epic
  .command('issues <epic-key>')
  .description('List all issues belonging to an epic.')
  .option('--max <n>', 'Maximum results (default: 50)', '50')
  .action(withPermission('epic.issues', epicIssuesCommand, {
    schema: EpicMaxSchema,
    validateArgs: (args) => validateOptions(IssueKeySchema, args[0])
  }));

epic
  .command('link <issue-key>')
  .description('Link an existing issue to an epic.')
  .requiredOption('--epic <epic-key>', 'Epic issue key')
  .action(withPermission('epic.link', (issueKey: string, options: { epic: string }) => {
    return epicLinkCommand(issueKey, options.epic);
  }, {
    schema: EpicLinkSchema,
    validateArgs: (args) => validateOptions(IssueKeySchema, args[0])
  }));

epic
  .command('unlink <issue-key>')
  .description('Remove an issue from its epic.')
  .action(withPermission('epic.unlink', epicUnlinkCommand, {
    validateArgs: (args) => validateOptions(IssueKeySchema, args[0])
  }));

epic
  .command('progress <epic-key>')
  .description('Show epic completion progress with issue counts and story points.')
  .action(withPermission('epic.progress', epicProgressCommand, {
    validateArgs: (args) => validateOptions(IssueKeySchema, args[0])
  }));

// =============================================================================
// BOARD COMMANDS
// =============================================================================
const board = program
  .command('board')
  .description('Manage Jira agile boards');

board
  .command('list')
  .description('List all boards, optionally filtered by project or type.')
  .option('--project <key>', 'Filter by project key')
  .option('--type <type>', 'Filter by board type (scrum, kanban)')
  .action(withPermission('board.list', boardListCommand, { schema: BoardListSchema }));

board
  .command('get <board-id>')
  .description('Get details of a specific board.')
  .action(withPermission('board.get', (boardId: string) => boardGetCommand(Number(boardId))));

board
  .command('config <board-id>')
  .description('Get configuration for a board including columns and filter.')
  .action(withPermission('board.config', (boardId: string) => boardConfigCommand(Number(boardId))));

board
  .command('issues <board-id>')
  .description('List issues on a board.')
  .option('--jql <jql>', 'Additional JQL filter')
  .option('--max <n>', 'Maximum results')
  .action(withPermission('board.issues', (boardId: string, options: { jql?: string; max?: string }) =>
    boardIssuesCommand(Number(boardId), { jql: options.jql, max: options.max ? Number(options.max) : undefined }),
    { schema: BoardIssuesSchema }
  ));

board
  .command('rank')
  .description('Rank issues on a board before or after another issue.')
  .requiredOption('--issues <keys...>', 'Issue keys to rank')
  .option('--before <key>', 'Rank before this issue')
  .option('--after <key>', 'Rank after this issue')
  .action(withPermission('board.rank', boardRankCommand, { schema: BoardRankSchema }));

// =============================================================================
// SPRINT COMMANDS
// =============================================================================
const sprint = program
  .command('sprint')
  .description('Manage Jira sprints');

sprint
  .command('list <board-id>')
  .description('List sprints for a board.')
  .option('--state <state>', 'Filter by state (future, active, closed)')
  .action(withPermission('sprint.list', (boardId: string, options: { state?: string }) =>
    sprintListCommand(Number(boardId), options),
    { schema: SprintListSchema }
  ));

sprint
  .command('get <sprint-id>')
  .description('Get details of a specific sprint.')
  .action(withPermission('sprint.get', (sprintId: string) => sprintGetCommand(Number(sprintId))));

sprint
  .command('create <board-id>')
  .description('Create a new sprint on a board.')
  .requiredOption('--name <name>', 'Sprint name')
  .option('--goal <goal>', 'Sprint goal')
  .option('--start <date>', 'Start date (ISO format)')
  .option('--end <date>', 'End date (ISO format)')
  .action(withPermission('sprint.create', (boardId: string, options: { name: string; goal?: string; start?: string; end?: string }) =>
    sprintCreateCommand(Number(boardId), options.name, options),
    { schema: SprintCreateSchema }
  ));

sprint
  .command('start <sprint-id>')
  .description('Start a sprint (must be in future state).')
  .action(withPermission('sprint.start', (sprintId: string) => sprintStartCommand(Number(sprintId))));

sprint
  .command('complete <sprint-id>')
  .description('Complete a sprint (must be in active state).')
  .action(withPermission('sprint.complete', (sprintId: string) => sprintCompleteCommand(Number(sprintId))));

sprint
  .command('update <sprint-id>')
  .description('Update sprint name, goal, or dates.')
  .option('--name <name>', 'New sprint name')
  .option('--goal <goal>', 'New sprint goal')
  .option('--start <date>', 'New start date (ISO format)')
  .option('--end <date>', 'New end date (ISO format)')
  .action(withPermission('sprint.update', (sprintId: string, options: { name?: string; goal?: string; start?: string; end?: string }) =>
    sprintUpdateCommand(Number(sprintId), options),
    { schema: SprintUpdateSchema }
  ));

sprint
  .command('delete <sprint-id>')
  .description('Delete a sprint.')
  .action(withPermission('sprint.delete', (sprintId: string) => sprintDeleteCommand(Number(sprintId))));

sprint
  .command('issues <sprint-id>')
  .description('List issues in a sprint.')
  .option('--jql <jql>', 'Additional JQL filter')
  .option('--max <n>', 'Maximum results')
  .action(withPermission('sprint.issues', (sprintId: string, options: { jql?: string; max?: string }) =>
    sprintIssuesCommand(Number(sprintId), { jql: options.jql, max: options.max ? Number(options.max) : undefined }),
    { schema: SprintIssuesSchema }
  ));

sprint
  .command('move <sprint-id>')
  .description('Move issues into a sprint.')
  .requiredOption('--issues <keys...>', 'Issue keys to move')
  .option('--before <key>', 'Rank before this issue')
  .option('--after <key>', 'Rank after this issue')
  .action(withPermission('sprint.move', (sprintId: string, options: { issues: string[]; before?: string; after?: string }) =>
    sprintMoveCommand(Number(sprintId), options),
    { schema: SprintMoveSchema }
  ));

sprint
  .command('tree <sprint-id>')
  .description('Show the full issue hierarchy tree for a sprint, grouped by epics.')
  .option('--depth <number>', 'Max traversal depth (default: 3)', '3')
  .option('--max-nodes <number>', 'Max nodes in tree (default: 200)', '200')
  .action(withPermission('sprint.tree', (sprintId: string, options: any) =>
    sprintTreeCommand(sprintId, {
      depth: options.depth ? Number(options.depth) : undefined,
      maxNodes: options.maxNodes ? Number(options.maxNodes) : undefined,
    })
  ));

// =============================================================================
// BACKLOG COMMANDS
// =============================================================================
const backlog = program
  .command('backlog')
  .description('Manage Jira backlog');

backlog
  .command('move')
  .description('Move issues to the backlog.')
  .requiredOption('--issues <keys...>', 'Issue keys to move to backlog')
  .action(withPermission('board.backlog', backlogMoveCommand, { schema: BacklogMoveSchema }));

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
  .option('--preset <name>', 'Apply a predefined configuration preset (read-only, standard, my-tasks, yolo)')
  .option('--list-presets', 'List all available predefined presets with their details')
  .option('--detect-preset', 'Detect which preset (if any) matches current settings')
  .addHelpText('after', `
Examples:
  $ jira-ai settings
  $ jira-ai settings --validate my-settings.yaml
  $ jira-ai settings --apply my-settings.yaml
  $ jira-ai settings --reset
  $ jira-ai settings --preset read-only
  $ jira-ai settings --preset standard
  $ jira-ai settings --list-presets
  $ jira-ai settings --detect-preset

Settings File Structure:
  defaults:
    allowed-jira-projects:
      - all                     # Allow all projects
    allowed-commands:
      - all                     # Allow all commands
    allowed-confluence-spaces:
      - all                     # Allow all Confluence spaces

Command Groups (use in allowed-commands):
  issue       - get, create, search, transition, update, comment, stats, assign, label
  project     - list, statuses, types
  user        - me, search, worklog
  epic        - list, get, create, update, issues, link, unlink, progress
  confl       - get, spaces, pages, create, comment, update
  board       - list, get, config, issues, rank
  sprint      - list, get, create, start, complete, update, delete, issues, move
  backlog     - move

Examples:
  - "issue"           → allows all issue subcommands
  - "issue.get"       → allows only issue get
  - "issue.label"     → allows issue label add and remove
  - "project.list"    → allows only project list
  - "user.me"         → allows only user me
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
    program.addHelpText('after', `\nYou are not authorized. Please use 'jira-ai auth' to authorize. Then you can run other commands.`);
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
    initJsonMode();

    // Background update check (non-blocking for the user)
    checkForUpdate().catch(() => {});

    configureCommandVisibility(program);
    await program.parseAsync(process.argv);
  } catch (error) {
    if (error instanceof CommandError) {
      outputError(error.message, error.hints, error.exitCode);
    } else if (error instanceof CliError) {
      outputError(error.message, [], 1);
    } else if (error instanceof Error) {
      outputError(`Unexpected Error: ${error.message}`, ['Please report this issue if it persists.'], 1);
    } else {
      outputError(`An unknown error occurred: ${String(error)}`, [], 1);
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
