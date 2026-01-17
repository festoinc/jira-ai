# Available Commands

| Command | Description |
| :--- | :--- |
| `auth` | Set up Jira authentication credentials. Supports interactive input, raw JSON string via `--from-json`, or `.env` file via `--from-file`. |
| `organization` | Manage Jira organization profiles. |
| `organization list` | List all saved Jira organization profiles, showing their aliases and associated host URLs. |
| `organization use <alias>` | Switch the active Jira organization profile to the one specified by the alias. |
| `organization remove <alias>` | Delete the saved credentials and profile for the specified organization alias. |
| `organization add <alias>` | Interactive prompt to add a new Jira organization profile with the given alias. |
| `me` | Show profile details for the currently authenticated user, including Jira host, display name, email, account ID, status, and time zone. |
| `projects` | List all accessible Jira projects showing their key, name, ID, type, and project lead. |
| `list-colleagues [project-key]` | Search and list users within the organization or a specific project (if project-key is provided). Returns display name, email, and account ID. |
| `task-with-details <task-id>` | Retrieve comprehensive issue data including key, summary, status, assignee, reporter, dates, labels, tasks, description, and comments. Use `--include-detailed-history` for change logs. |
| `project-statuses <project-id>` | Fetch all available workflow statuses for a given project (To Do, In Progress, Done). |
| `list-issue-types <project-key>` | List all issue types (Standard and Subtask) available for a project. |
| `run-jql <jql-query>` | Execute a Jira Query Language (JQL) search. Supports limiting results via `--limit` (default 50). |
| `update-description <task-id>` | Update a Jira task's description using content from a local Markdown file. |
| `add-comment` | Add a new comment to a Jira issue using content from a local Markdown file. |
| `add-label-to-issue <task-id> <labels>` | Add one or more labels (comma-separated) to a specific Jira issue. |
| `delete-label-from-issue <task-id> <labels>` | Remove one or more labels (comma-separated) from a specific Jira issue. |
| `create-task` | Create a new Jira issue with specified title, project key, and issue type. |
| `transition <task-id> <to-status>` | Change the status of a Jira task using status name or ID. |
| `get-issue-statistics <task-ids>` | Calculate time-based metrics (time logged, estimate, status duration) for one or more issues. |
| `get-person-worklog <person> <timeframe>` | Retrieve worklogs for a specific user over a timeframe (e.g., `7d`, `2w`). |
| `about` | Show information about the tool. |
| `settings` | View, validate (`--validate <file>`), or apply (`--apply <file>`) configuration settings. |