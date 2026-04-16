# Available Commands

## Global Options

| Flag | Description |
| :--- | :--- |
| `--compact` | Output results as single-line JSON for maximum token efficiency. Works with all commands. |
| `--dry-run` | Preview write operations without executing them. Supported on `issue create`, `issue update`, `issue transition`, and `issue worklog add/update/delete`. No Jira API write calls are made. |

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
| `issue create` | Create a new Jira issue with specified title, project key, and issue type. Supports `--priority`, `--description`, `--description-file`, `--labels`, `--component`, `--fix-version`, `--due-date`, `--assignee`, and `--custom-field` flags. Supports `--dry-run` to preview without creating. |
| `issue search [jql-query]` | Execute a JQL search query. Supports `--limit <n>` (default 50), `--query <name>` to run a saved query, and `--list-queries` to list all saved queries. |
| `issue transition <issue-id> <to-status>` | Change the status of a Jira issue using status name or ID. Supports `--resolution <name>`, `--comment <text>`, `--comment-file <path>`, `--assignee <email-or-name>`, `--fix-version <name>`, and `--custom-field "Field Name=value"` flags. Supports `--dry-run` to preview without transitioning. |
| `issue transitions <issue-id>` | List all available transitions for an issue, including which fields are required for each. Supports `--required-only` to filter to transitions with required fields. |
| `issue update <issue-id>` | Update one or more fields of a Jira issue. Supports `--priority`, `--summary`, `--description`, `--from-file`, `--labels`, `--clear-labels`, `--component`, `--fix-version`, `--due-date`, `--assignee`, and `--custom-field` flags. Supports `--dry-run` to preview without updating. |
| `issue comment <issue-id>` | Add a new comment to a Jira issue using content from a local Markdown file. |
| `issue stats <issue-ids>` | Calculate time-based metrics (time logged, estimate, status duration) for one or more issues. |
| `issue assign <issue-id> <account-id>` | Assign or reassign a Jira issue to a user. Use "null" to unassign. |
| `issue label add <issue-id> <labels>` | Add one or more labels (comma-separated) to a Jira issue. |
| `issue label remove <issue-id> <labels>` | Remove one or more labels (comma-separated) from a Jira issue. |
| `issue tree <issue-key>` | Show the full issue hierarchy tree rooted at an issue (epic → story → subtasks). Use `--links` to include linked issues, `--depth N` (default 3) to limit traversal depth, `--max-nodes N` (default 200) to cap total nodes, and `--types TYPES` to filter link types. |
| `issue activity <issue-key>` | Show a unified activity feed (changelog + comments) for an issue. Supports `--since <ISO-timestamp>`, `--limit <n>` (default 50), `--types <types>` (comma-separated activity types), `--author <name-or-email>`, and `--compact`. |
| `issue comments <issue-key>` | List comments on an issue. Supports `--limit <n>` (default 50), `--since <ISO-timestamp>`, and `--reverse` (oldest first; default is newest first). |

## Issue Worklog Commands (`issue worklog`)

| Command | Description | Permission |
| :--- | :--- | :--- |
| `issue worklog list <issue-id>` | List all worklogs for a Jira issue. | `issue.worklog.list` |
| `issue worklog add <issue-id>` | Log time against a Jira issue. Requires `--time <duration>`. | `issue.worklog.add` |
| `issue worklog update <issue-id>` | Update an existing worklog entry. Requires `--id <worklog-id>`. | `issue.worklog.update` |
| `issue worklog delete <issue-id>` | Delete a worklog entry. Requires `--id <worklog-id>`. | `issue.worklog.delete` |

### Options

#### `issue worklog list`

| Flag | Description |
| :--- | :--- |
| `--started-after <timestamp>` | Only return worklogs started at or after this UNIX timestamp (milliseconds). |
| `--started-before <timestamp>` | Only return worklogs started before this UNIX timestamp (milliseconds). |
| `--author-account-id <accountId>` | Filter by author account ID. |

#### `issue worklog add`

| Flag | Required | Description |
| :--- | :--- | :--- |
| `--time <duration>` | Yes | Time spent (e.g., `1h`, `30m`, `1d2h30m`, `1w`). |
| `--comment <text>` | No | Comment for this worklog entry. |
| `--started <datetime>` | No | When work started (ISO 8601). Defaults to now. Timezone offsets are automatically normalized. |
| `--adjust-estimate <method>` | No | How to adjust the remaining estimate: `auto`, `new`, `leave`, `manual`. |
| `--new-estimate <duration>` | No | New remaining estimate (use with `--adjust-estimate new` or `manual`). |
| `--reduce-by <duration>` | No | Reduce remaining estimate by this amount (use with `--adjust-estimate manual`). |

#### `issue worklog update`

| Flag | Required | Description |
| :--- | :--- | :--- |
| `--id <worklog-id>` | Yes | ID of the worklog to update. |
| `--time <duration>` | No | New time spent. |
| `--comment <text>` | No | New comment. |
| `--started <datetime>` | No | New start time (ISO 8601). Timezone offsets are automatically normalized. |
| `--adjust-estimate <method>` | No | How to adjust the remaining estimate: `auto`, `new`, `leave`, `manual`. |
| `--new-estimate <duration>` | No | New remaining estimate (use with `--adjust-estimate new` or `manual`). |

At least one of `--time`, `--comment`, or `--started` must be provided.

#### `issue worklog delete`

| Flag | Required | Description |
| :--- | :--- | :--- |
| `--id <worklog-id>` | Yes | ID of the worklog to delete. |
| `--adjust-estimate <method>` | No | How to adjust the remaining estimate: `auto`, `new`, `leave`, `manual`. |
| `--new-estimate <duration>` | No | New remaining estimate (use with `--adjust-estimate new` or `manual`). |
| `--increase-by <duration>` | No | Increase remaining estimate by this amount (use with `--adjust-estimate manual`). |

All write commands (`add`, `update`, `delete`) support `--dry-run` to preview changes without executing.

### Duration Format

Time values use Jira-style duration notation. Components can be combined in any order:

| Component | Meaning | Conversion |
| :--- | :--- | :--- |
| `1w` | 1 week | 5 working days (40 hours) |
| `1d` | 1 day | 8 hours |
| `1h` | 1 hour | 60 minutes |
| `1m` | 1 minute | 60 seconds |

Examples: `30m`, `2h`, `1d`, `1w`, `1d2h30m`, `2w1d3h15m`.

### Timezone Handling

The `--started` flag accepts ISO 8601 timestamps with any standard timezone format. Timestamps are automatically normalized to Jira's required format (`yyyy-MM-dd'T'HH:mm:ss.SSS±HHMM`):

- `2026-04-15T07:00:00Z` → `2026-04-15T07:00:00.000+0000`
- `2026-04-15T10:00:00+03:00` → `2026-04-15T10:00:00.000+0300`
- `2026-04-15T07:00:00-05:30` → `2026-04-15T07:00:00.000-0530`

When omitted, `--started` defaults to the current time in UTC.

### Examples

Log 2 hours of work:

```bash
jira-ai issue worklog add PROJ-123 --time 2h
```

Log time with a comment and custom start time:

```bash
jira-ai issue worklog add PROJ-123 --time 1d2h30m --comment "Backend refactor" --started "2026-04-15T09:00:00+02:00"
```

Log time and auto-adjust remaining estimate:

```bash
jira-ai issue worklog add PROJ-123 --time 3h --adjust-estimate auto
```

Log time and set a new remaining estimate:

```bash
jira-ai issue worklog add PROJ-123 --time 4h --adjust-estimate new --new-estimate 2d
```

List all worklogs for an issue:

```bash
jira-ai issue worklog list PROJ-123
```

Filter worklogs by time range:

```bash
jira-ai issue worklog list PROJ-123 --started-after 1713139200000 --started-before 1715731200000
```

Update a worklog's comment and time:

```bash
jira-ai issue worklog update PROJ-123 --id 12345 --time 3h --comment "Updated after code review"
```

Delete a worklog:

```bash
jira-ai issue worklog delete PROJ-123 --id 12345
```

Preview a worklog add without executing:

```bash
jira-ai issue worklog add PROJ-123 --time 2h --dry-run
```

### Permissions

Issue worklog commands use hierarchical permission keys. If `issue` is in your `allowed-commands` list, all `issue.worklog.*` commands are implicitly allowed. You can also use `issue.worklog` to allow only worklog commands, or specify individual keys: `issue.worklog.list`, `issue.worklog.add`, `issue.worklog.update`, `issue.worklog.delete`.

## Saved Queries

Define reusable JQL queries in `settings.yaml` under the `saved-queries` key:

```yaml
saved-queries:
  my-open-bugs: "project = PROJ AND status = Open AND issuetype = Bug"
  overdue-tasks: "project = PROJ AND duedate < now() AND status != Done"
```

Query names must be lowercase alphanumeric with optional hyphens (e.g., `my-query`). Hyphens cannot appear at the start or end.

### Options

| Flag | Description |
| :--- | :--- |
| `--query <name>` | Execute a saved query by name. Mutually exclusive with a positional JQL argument. |
| `--list-queries` | List all configured saved queries and their JQL definitions. |
| `--limit <n>` | Maximum number of results (default 50, max 1000). Applies to both raw JQL and saved queries. |

### Examples

Run a saved query:

```bash
jira-ai issue search --query my-open-bugs
```

List all saved queries:

```bash
jira-ai issue search --list-queries
```

Run a saved query with a result limit:

```bash
jira-ai issue search --query overdue-tasks --limit 10
```

Raw JQL still works as before:

```bash
jira-ai issue search "project = PROJ AND status = Open"
```

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

## Tree Commands

### `issue tree`

Show the full issue hierarchy tree rooted at an issue, including subtasks and optionally linked issues.

```bash
jira-ai issue tree <issue-key> [options]
```

**Permission:** `issue.tree`

| Flag | Description | Default |
| :--- | :--- | :--- |
| `--links` | Include linked issues as leaf nodes connected to the root issue. | `false` |
| `--depth <N>` | Maximum traversal depth for the hierarchy walk. | `3` |
| `--max-nodes <N>` | Maximum number of nodes to include in the tree. | `200` |
| `--types <TYPES>` | Comma-separated link type names to include (requires `--links`). | — |
| `--compact` | Single-line JSON output (global flag). | `false` |

**Output fields:**

| Field | Type | Description |
| :--- | :--- | :--- |
| `root` | `string` | The root issue key. |
| `nodes` | `TreeNode[]` | Flat list of all nodes in the tree. Each node has `key`, `summary`, `status`, `type`, `priority`, and `assignee`. |
| `edges` | `TreeEdge[]` | Directed edges between nodes. Each edge has `from`, `to`, and `relation` (`"hierarchy"`, `"subtask"`, or a link type name). |
| `depth` | `number` | Actual depth traversed (may be less than requested). |
| `truncated` | `boolean` | `true` if `maxNodes` limit was hit before full traversal. |
| `totalNodes` | `number` | Total number of nodes in the result. |

#### Examples

Basic hierarchy tree:

```bash
jira-ai issue tree PROJ-10
```

Include linked issues:

```bash
jira-ai issue tree PROJ-10 --links
```

Filter linked issues by type, limit depth and nodes:

```bash
jira-ai issue tree PROJ-10 --links --types "Blocks,Relates" --depth 2 --max-nodes 100
```

Compact output for maximum token efficiency:

```bash
jira-ai --compact issue tree PROJ-10
```

### `sprint tree`

Show all issues in a sprint organized by their hierarchy (epics → stories → subtasks).

```bash
jira-ai sprint tree <sprint-id> [options]
```

**Permission:** `sprint.tree`

| Flag | Description | Default |
| :--- | :--- | :--- |
| `--depth <N>` | Maximum traversal depth for the hierarchy walk. | `3` |
| `--max-nodes <N>` | Maximum number of nodes to include (the virtual sprint root does not count). | `200` |
| `--compact` | Single-line JSON output (global flag). | `false` |

The output uses the same `TreeResult` structure as `issue tree`. The root is always a virtual sprint node (e.g., `"sprint-42"`). Issues whose parent is outside the sprint are connected directly to the sprint root.

#### Examples

Full sprint hierarchy:

```bash
jira-ai sprint tree 42
```

Increase depth for deeply nested hierarchies:

```bash
jira-ai sprint tree 42 --depth 5 --max-nodes 500
```

## Dry-Run / Preview Mode

Preview write operations without executing them. Add `--dry-run` to `issue create`, `issue update`, `issue transition`, or `issue worklog add/update/delete` to see exactly what would change.

```bash
jira-ai issue update PROJ-123 --priority High --dry-run
jira-ai issue transition PROJ-123 Done --resolution Fixed --dry-run
jira-ai issue create --project PROJ --type Bug --title "Fix crash" --dry-run
jira-ai issue worklog add PROJ-123 --time 2h --comment "Debugging" --dry-run
```

**Output format:**

```json
{
  "dryRun": true,
  "command": "issue.update",
  "target": "PROJ-123",
  "changes": {
    "priority": { "from": "Medium", "to": "High" }
  },
  "preview": { "...": "same output as the real command" },
  "message": "No changes were made. Remove --dry-run to execute."
}
```

- `dryRun`: Always `true` when `--dry-run` is used.
- `command`: The command that was previewed (e.g., `issue.update`).
- `target`: The issue key or identifier affected.
- `changes`: For update/transition commands, shows `{ "field": { "from": "old", "to": "new" } }`. For create commands, shows the full issue that would be created.
- `preview`: The same output format the real command would produce.
- `message`: Confirmation that no changes were made.

Phase 1 scope: `issue create`, `issue update`, `issue transition`. Worklog dry-run: `issue worklog add`, `issue worklog update`, `issue worklog delete`.

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
| `user worklog <person> <timeframe>` | Retrieve worklogs for a user over a timeframe (e.g., `7d`, `30d`). Supports `--group-by-issue` to group results by issue. |

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
| `sprint tree <sprint-id>` | Show all issues in a sprint organized by hierarchy (epics → stories → subtasks). Use `--depth N` (default 3) to limit traversal depth and `--max-nodes N` (default 200) to cap total nodes. |

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
