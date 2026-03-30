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

## Epic Commands (`epic`)

| Command | Description |
| :--- | :--- |
| `epic list <project-key>` | List epics in a project. Use `--done` to include completed epics, `--max <n>` to limit results (default 50). |
| `epic get <epic-key>` | Get full details of a single epic including description, assignee, and labels. |
| `epic create <project-key>` | Create a new epic. Requires `--name <name>` and `--summary <text>`. Optional: `--description <text>`, `--labels <labels>`. |
| `epic update <epic-key>` | Update an epic's name and/or summary. Use `--name <name>` and/or `--summary <text>`. |
| `epic issues <epic-key>` | List all issues belonging to an epic. Use `--max <n>` to limit results (default 50). |
| `epic link <issue-key>` | Link an existing issue to an epic. Requires `--epic <epic-key>`. |
| `epic unlink <issue-key>` | Remove an issue from its epic. |
| `epic progress <epic-key>` | Show epic completion progress with issue counts and story points, including a visual progress bar. |

## Board Commands (`board`)

| Command | Description |
| :--- | :--- |
| `board list` | List all accessible boards. Optional `--project <key>` to filter by project, `--type <type>` to filter by board type. |
| `board get <board-id>` | Get details of a specific board including ID, type, project, and location. |
| `board config <board-id>` | Get board configuration including column setup, filter, and rank field. |
| `board issues <board-id>` | List issues on a board. Optional `--jql <query>` and `--max <n>` (default 50). |
| `board rank` | Rank issues on a board. Requires `--issues <keys>` and either `--before <key>` or `--after <key>`. |

## Sprint Commands (`sprint`)

| Command | Description |
| :--- | :--- |
| `sprint list <board-id>` | List sprints for a board. Optional `--state <state>` to filter (active, future, closed). |
| `sprint get <sprint-id>` | Get full sprint details including state, dates, goal, and origin board. |
| `sprint create <board-id>` | Create a new sprint. Requires `--name <name>`. Optional: `--goal <text>`, `--start <date>`, `--end <date>`. |
| `sprint start <sprint-id>` | Start a future sprint. Sprint must have start and end dates set. |
| `sprint complete <sprint-id>` | Complete an active sprint. |
| `sprint update <sprint-id>` | Update sprint fields. One or more of: `--name <name>`, `--goal <text>`, `--start <date>`, `--end <date>`. |
| `sprint delete <sprint-id>` | Delete a sprint. |
| `sprint issues <sprint-id>` | List issues in a sprint. Optional `--jql <query>` and `--max <n>` (default 50). |
| `sprint move <sprint-id>` | Move issues to a sprint. Requires `--issues <keys>` (max 50). Optional: `--before <key>`, `--after <key>` for ranking. |

## Backlog Commands (`backlog`)

| Command | Description |
| :--- | :--- |
| `backlog move` | Move issues to the backlog. Requires `--issues <keys>` (max 50). |

## Confluence Commands (`confl`)

| Command | Description |
| :--- | :--- |
| `confl get <url>` | Download and display Confluence page content and comments from a URL. |
| `confl spaces` | List all allowed Confluence spaces. |
| `confl pages <space-key>` | Display a hierarchical tree view of pages within a space. |
| `confl create <space> <title> [parent-page]` | Create a new Confluence page. |
| `confl comment <url>` | Add a comment to a Confluence page using a Markdown file. |
| `confl update <url>` | Update the content of a Confluence page using a Markdown file. |
