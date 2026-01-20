# Available Commands

## Top-Level Commands

| Command | Description |
| :--- | :--- |
| `auth` | Set up Jira authentication credentials. Supports interactive input, raw JSON string via `--from-json`, or `.env` file via `--from-file`. |
| `settings` | View, validate (`--validate <file>`), or apply (`--apply <file>`) configuration settings. |
| `about` | Show information about the tool. |

## Issue Commands (`issue`)

| Command | Description |
| :--- | :--- |
| `issue get <issue-id>` | Retrieve comprehensive issue data including key, summary, status, assignee, reporter, dates, labels, description, and comments. Use `--include-detailed-history` for change logs. |
| `issue create` | Create a new Jira issue with specified title, project key, and issue type. |
| `issue search <jql-query>` | Execute a JQL search query. Supports limiting results via `--limit` (default 50). |
| `issue transition <issue-id> <to-status>` | Change the status of a Jira issue using status name or ID. |
| `issue update <issue-id>` | Update a Jira issue's description using content from a local Markdown file. |
| `issue comment <issue-id>` | Add a new comment to a Jira issue using content from a local Markdown file. |
| `issue stats <issue-ids>` | Calculate time-based metrics (time logged, estimate, status duration) for one or more issues. |
| `issue assign <issue-id> <account-id>` | Assign or reassign a Jira issue to a user. Use "null" to unassign. |
| `issue label add <issue-id> <labels>` | Add one or more labels (comma-separated) to a Jira issue. |
| `issue label remove <issue-id> <labels>` | Remove one or more labels (comma-separated) from a Jira issue. |

## Project Commands (`project`)

| Command | Description |
| :--- | :--- |
| `project list` | List all accessible Jira projects showing their key, name, ID, type, and project lead. |
| `project statuses <project-key>` | Fetch all available workflow statuses for a project (To Do, In Progress, Done). |
| `project types <project-key>` | List all issue types (Standard and Subtask) available for a project. |

## User Commands (`user`)

| Command | Description |
| :--- | :--- |
| `user me` | Show profile details for the currently authenticated user. |
| `user search [project-key]` | Search and list users within the organization or a specific project. |
| `user worklog <person> <timeframe>` | Retrieve worklogs for a user over a timeframe (e.g., `7d`, `2w`). |

## Organization Commands (`org`)

| Command | Description |
| :--- | :--- |
| `org list` | List all saved Jira organization profiles. |
| `org use <alias>` | Switch the active Jira organization profile. |
| `org add <alias>` | Add a new Jira organization profile. |
| `org remove <alias>` | Delete credentials for the specified organization. |

## Confluence Commands (`confl`)

| Command | Description |
| :--- | :--- |
| `confl get <url>` | Download and display Confluence page content and comments from a URL. |
| `confl spaces` | List all allowed Confluence spaces. |
| `confl pages <space-key>` | Display a hierarchical tree view of pages within a space. |
| `confl create <space> <title> [parent-page]` | Create a new Confluence page. |
| `confl comment <url>` | Add a comment to a Confluence page using a Markdown file. |
| `confl update <url>` | Update the content of a Confluence page using a Markdown file. |
