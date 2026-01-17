command: auth
description: Set up Jira authentication credentials. Supports interactive input, raw JSON string via --from-json, or .env file via --from-file.

command: organization
description: Manage Jira organization profiles

command: organization list
description: List all saved Jira organization profiles, showing their aliases and associated host URLs.

command: organization use <alias>
description: Switch the active Jira organization profile to the one specified by the alias.

command: organization remove <alias>
description: Delete the saved credentials and profile for the specified organization alias.

command: organization add <alias>
description: Interactive prompt to add a new Jira organization profile with the given alias.

command: me
description: Show profile details for the currently authenticated user, including Jira host, display name, email, account ID, status, and time zone.

command: projects
description: List all accessible Jira projects showing their key, name, ID, type, and project lead.

command: list-colleagues [project-key]
description: Search and list users within the organization or a specific project (if project-key is provided). Returns display name, email, and account ID.

command: task-with-details <task-id>
description: Retrieve comprehensive issue data including key, summary, status (name, category), assignee, reporter, creation/update dates, due date, labels, parent/subtasks, description, and comments. Use --include-detailed-history to fetch a chronological log of all changes including field updates and status transitions.

command: project-statuses <project-id>
description: Fetch all available workflow statuses for a given project. Returns status name, ID, category (To Do, In Progress, Done), and description.

command: list-issue-types <project-key>
description: List all issue types (Standard and Subtask) available for a project, providing their name, ID, hierarchy level, and description.

command: run-jql <jql-query>
description: Execute a Jira Query Language (JQL) search. Returns a list of issues with their key, summary, status, assignee, and priority. Supports limiting results via --limit (default 50).

command: update-description <task-id>
description: Update a Jira task's description using content from a local Markdown file. Requires the task ID and a valid file path.

command: add-comment
description: Add a new comment to a Jira issue using content from a local Markdown file. Requires the issue key and a valid file path.

command: add-label-to-issue <task-id> <labels>
description: Add one or more labels (comma-separated) to a specific Jira issue.

command: delete-label-from-issue <task-id> <labels>
description: Remove one or more labels (comma-separated) from a specific Jira issue.

command: create-task
description: Create a new Jira issue with specified title, project key, and issue type. Optional --parent key for subtasks. Returns the key of the newly created issue.

command: transition <task-id> <to-status>
description: Change the status of a Jira task. The <to-status> can be either the status name or ID.

command: get-issue-statistics <task-ids>
description: Calculate and display time-based metrics for one or more issues (comma-separated). Returns a table containing key, summary, total time logged, original estimate, and a detailed breakdown of duration spent in each status.

command: get-person-worklog <person> <timeframe>
description: Retrieve worklogs for a specific user over a timeframe (e.g., '7d', '2w'). Returns a list of entries with date, issue key, summary, time spent, and comments. Supports --group-by-issue.

command: about
description: Show information about the tool

command: settings
description: View, validate, or apply configuration settings. Use `settings` to view active config, `--validate <file>` to check a YAML file, or `--apply <file>` to update `~/.jira-ai/settings.yaml`.
