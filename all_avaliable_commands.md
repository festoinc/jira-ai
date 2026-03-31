# Available Commands

## Global Options

| Flag | Description |
| :--- | :--- |
| `--compact` | Output results as single-line JSON for maximum token efficiency. Works with all commands. |

## Top-Level Commands

| Command | Description |
| :--- | :--- |
| `auth` | Set up Jira authentication credentials via `--from-json` or `.env` file via `--from-file`. |
| `settings` | View, validate (`--validate <file>`), or apply (`--apply <file>`) configuration settings. |
| `about` | Show version information. |

## Issue Commands (`issue`)

| Command | Description |
| :--- | :--- |
| `issue get <issue-id>` | Retrieve comprehensive issue data including key, summary, status, assignee, reporter, dates, labels, description, and comments. Use `--include-detailed-history` for change logs. |
| `issue create` | Create a new Jira issue with specified title, project key, and issue type. Supports `--priority`, `--description`, `--description-file`, `--labels`, `--component`, `--fix-version`, `--due-date`, `--assignee`, and `--custom-field` flags. |
| `issue search <jql-query>` | Execute a JQL search query. Supports limiting results via `--limit` (default 50). |
| `issue transition <issue-id> <to-status>` | Change the status of a Jira issue using status name or ID. Supports `--resolution <name>`, `--comment <text>`, `--comment-file <path>`, `--assignee <email-or-name>`, `--fix-version <name>`, and `--custom-field "Field Name=value"` flags. |
| `issue transitions <issue-id>` | List all available transitions for an issue, including which fields are required for each. Supports `--required-only` to filter to transitions with required fields. |
| `issue update <issue-id>` | Update one or more fields of a Jira issue. Supports `--priority`, `--summary`, `--description`, `--from-file`, `--labels`, `--clear-labels`, `--component`, `--fix-version`, `--due-date`, `--assignee`, and `--custom-field` flags. |
| `issue comment <issue-id>` | Add a new comment to a Jira issue using content from a local Markdown file. |
| `issue stats <issue-ids>` | Calculate time-based metrics (time logged, estimate, status duration) for one or more issues. |
| `issue assign <issue-id> <account-id>` | Assign or reassign a Jira issue to a user. Use "null" to unassign. |
| `issue label add <issue-id> <labels>` | Add one or more labels (comma-separated) to a Jira issue. |
| `issue label remove <issue-id> <labels>` | Remove one or more labels (comma-separated) from a Jira issue. |

## Issue Link Commands (`issue link`)

| Command | Description | Permission |
| :--- | :--- | :--- |
| `issue link types` | List all available issue link types for the Jira instance. | `issue.link.types` |
| `issue link list <issue-key>` | List all issue links (inward + outward) for an issue. | `issue.link.list` |
| `issue link create <source-key> <link-type> <target-key>` | Create a link between two issues. Link type can be a name (e.g., `"Blocks"`, `"Relates"`). | `issue.link.create` |
| `issue link delete <source-key> --target <target-key>` | Delete a link between two issues. | `issue.link.delete` |

### Examples

List all link types available in your Jira instance:
```bash
jira-ai issue link types
```

List all links for an issue:
```bash
jira-ai issue link list PROJ-123
```

Create a "blocks" link from PROJ-123 to PROJ-456:
```bash
jira-ai issue link create PROJ-123 "Blocks" PROJ-456
```

Create a "relates to" link:
```bash
jira-ai issue link create PROJ-100 "Relates" PROJ-200
```

Delete a link between two issues:
```bash
jira-ai issue link delete PROJ-123 --target PROJ-456
```

### Permissions

Issue link commands use hierarchical permission keys. If `issue` is in your `allowed-commands` list, all `issue.link.*` commands are implicitly allowed. You can also use `issue.link` to allow only link commands, or specify individual keys: `issue.link.types`, `issue.link.list`, `issue.link.create`, `issue.link.delete`.

## Issue Create Examples

Create a basic issue:
```bash
jira-ai issue create --title "Login bug" --project PROJ --issue-type Bug
```

Create an issue with priority, description, labels, and assignee:
```bash
jira-ai issue create \
  --title "Implement search" \
  --project PROJ \
  --issue-type Task \
  --priority High \
  --description "Add full-text search to the application" \
  --labels "search,frontend" \
  --component "ui" \
  --fix-version "v2.0" \
  --due-date 2026-04-15 \
  --assignee "John Doe"
```

Create an issue with description from a file and custom fields:
```bash
jira-ai issue create \
  --title "API integration" \
  --project PROJ \
  --issue-type Task \
  --description-file ./description.md \
  --custom-field "customfield_10001=value1" \
  --custom-field "customfield_10002=value2"
```

## Issue Transition Examples

Basic status change:
```bash
jira-ai issue transition PROJ-123 "In Progress"
```

Add a comment and resolution:
```bash
jira-ai issue transition PROJ-123 Done --resolution Done --comment "Completed the feature."
```

Change assignee and fix version:
```bash
jira-ai issue transition PROJ-123 "In Review" --assignee "Jane Smith" --fix-version "v2.0"
```

Pass a comment from a file:
```bash
jira-ai issue transition PROJ-123 Done --comment-file ./release-notes.md
```

Set a custom field:
```bash
jira-ai issue transition PROJ-123 Done --custom-field "Story Points=5"
```

Discover available transitions and required fields:
```bash
jira-ai issue transitions PROJ-123
```

Only show transitions with required fields:
```bash
jira-ai issue transitions PROJ-123 --required-only
```

## Issue Update Examples

Update an issue's priority and summary:
```bash
jira-ai issue update PROJ-123 --priority Critical --summary "Updated title"
```

Update labels (replaces all existing labels):
```bash
jira-ai issue update PROJ-123 --labels "urgent,backend"
```

Clear all labels from an issue:
```bash
jira-ai issue update PROJ-123 --clear-labels
```

Update multiple fields at once:
```bash
jira-ai issue update PROJ-123 \
  --priority High \
  --due-date 2026-05-01 \
  --component "api,backend" \
  --fix-version "v2.1" \
  --assignee "Jane Smith"
```

Update description from a file:
```bash
jira-ai issue update PROJ-123 --description-file ./updated-desc.md
```

Update a custom field:
```bash
jira-ai issue update PROJ-123 --custom-field "customfield_10001=new-value"
```

## Project Fields Examples

List all fields for a project:
```bash
jira-ai project fields PROJ
```

Filter fields by issue type:
```bash
jira-ai project fields PROJ --type Bug
```

Show only custom fields:
```bash
jira-ai project fields PROJ --custom
```

Search fields by name:
```bash
jira-ai project fields PROJ --search "priority"
```

## Project Commands (`project`)

| Command | Description |
| :--- | :--- |
| `project list` | List all accessible Jira projects showing their key, name, ID, type, and project lead. |
| `project statuses <project-key>` | Fetch all available workflow statuses for a project (To Do, In Progress, Done). |
| `project types <project-key>` | List all issue types (Standard and Subtask) available for a project. |
| `project fields <project-key>` | List all available fields for a project, including custom fields. Use `--type <issue-type>` to filter by issue type, `--custom` to show only custom fields, `--search <term>` to filter by name or ID. |

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
