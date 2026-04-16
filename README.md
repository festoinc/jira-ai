# Jira AI CLI

An AI-friendly CLI for Jira that prioritizes efficiency and security.

<img width="519" height="245" alt="Screenshot From 2026-01-17 23-14-31" src="https://github.com/user-attachments/assets/97a597d8-fd5e-4cb1-a8d0-1a045b44146f" />


## Core Benefits

1.  **Context Efficiency:** Eliminates redundant context data, consuming significantly fewer tokens than Jira MCP or similar tools.
2.  **Bullet-proof Security:** Restrict AI to only the actions you permit, ensuring your environment remains secure. 

## Start
- **AI Agent:** [Project overview and commands](https://raw.githubusercontent.com/festoinc/jira-ai/main/SKILL.md)

## Installation

```bash
npm install -g jira-ai
```

## Quick Start

Authenticate with credentials (non-interactive — JSON or .env file only):
```bash
jira-ai auth --from-json '{"url":"https://your-domain.atlassian.net","email":"you@example.com","apikey":"your-api-token"}'
```

See all available commands:
```bash
jira-ai --help
```

## JSON Output

All commands always output structured JSON. Use global flags to control formatting:

- Default: pretty-printed JSON (2-space indentation)
- `--compact`: single-line JSON for maximum token efficiency

```bash
jira-ai issue get PROJ-123
jira-ai --compact project list
jira-ai --compact issue search "project = PROJ AND status = Open"
```

Errors are returned as structured JSON to stdout:
```json
{ "error": true, "message": "Issue not found", "hints": ["Check the issue key"], "exitCode": 1 }
```

### Dry-Run / Preview Mode

Preview write operations without executing them. The `--dry-run` flag is available on `issue create`, `issue update`, `issue transition`, and `issue worklog add/update/delete`. No Jira API write calls are made — output is purely a preview.

```bash
jira-ai issue update PROJ-123 --priority High --dry-run
jira-ai issue transition PROJ-123 Done --resolution Fixed --dry-run
jira-ai issue create --project PROJ --type Bug --title "Fix crash" --dry-run
jira-ai issue worklog add PROJ-123 --time 2h --comment "Debugging" --dry-run
```

Dry-run output follows a consistent JSON structure:

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

The `preview` field contains the same output the real command would produce, so AI agents can process it identically. Phase 1 supports `issue create`, `issue update`, and `issue transition`. Worklog dry-run: `issue worklog add`, `issue worklog update`, `issue worklog delete`.

### Issue Hierarchy Tree

Explore issue hierarchies with the `issue tree` command. It returns a directed graph (nodes + edges) representing the full parent-child hierarchy starting from a given issue:

```bash
jira-ai issue tree PROJ-10
```

Include linked issues as leaf nodes:

```bash
jira-ai issue tree PROJ-10 --links
```

Filter linked issues by type and limit depth:

```bash
jira-ai issue tree PROJ-10 --links --types "Blocks,Relates" --depth 2 --max-nodes 100
```

### Sprint Hierarchy Tree

View all issues in a sprint organized by their hierarchy (epics → stories → subtasks):

```bash
jira-ai sprint tree 42
```

Customize traversal depth and node limit:

```bash
jira-ai sprint tree 42 --depth 4 --max-nodes 500
```

### Rich Issue Management

Create issues with detailed field support:
```bash
jira-ai issue create --title "New feature" --project PROJ --issue-type Task \
  --priority High --description "Feature details" --labels "feature,backend" \
  --component "api" --fix-version "v2.0" --due-date 2026-04-15 --assignee "John Doe"
```

Update issues with any combination of fields:
```bash
jira-ai issue update PROJ-123 --priority Critical --summary "Updated title" \
  --labels "urgent" --due-date 2026-05-01
```

Discover available fields for a project (including custom fields):
```bash
jira-ai project fields PROJ --type Task
```

### Transition Issues

Change the status of an issue:
```bash
jira-ai issue transition PROJ-123 "In Progress"
```

Add a comment and resolution during transition:
```bash
jira-ai issue transition PROJ-123 Done --resolution Done --comment "Completed the feature."
```

Change assignee and fix version during transition:
```bash
jira-ai issue transition PROJ-123 "In Review" --assignee "Jane Smith" --fix-version "v2.0"
```

Set a custom field during transition:
```bash
jira-ai issue transition PROJ-123 Done --custom-field "Story Points=5"
```

Pass a comment from a file (useful for long comments):
```bash
jira-ai issue transition PROJ-123 Done --comment-file ./release-notes.md
```

Discover which transitions are available and what fields they require:
```bash
jira-ai issue transitions PROJ-123
```

Only show transitions that have required fields:
```bash
jira-ai issue transitions PROJ-123 --required-only
```

Get structured output for scripting:
```bash
jira-ai issue transitions PROJ-123
```

When a transition fails due to missing required fields, the error message lists what is needed and suggests running `issue transitions <key>` to discover them.

### Activity Feed & Comments

View a unified activity feed combining changelog entries and comments for an issue:

```bash
jira-ai issue activity PROJ-123
```

Filter by time, activity type, or author:

```bash
jira-ai issue activity PROJ-123 --since 2026-01-01T00:00:00Z --types status_change,comment_added --author "Jane Smith"
```

Use `--compact` to strip comment bodies for maximum token efficiency:

```bash
jira-ai issue activity PROJ-123 --compact
```

List comments on an issue:

```bash
jira-ai issue comments PROJ-123
```

Use `--reverse` for chronological (oldest-first) order, or `--since` to filter by time:

```bash
jira-ai issue comments PROJ-123 --since 2026-01-01T00:00:00Z --reverse --limit 20
```

**Activity types:** `status_change`, `field_change`, `comment_added`, `comment_updated`, `attachment_added`, `attachment_removed`, `link_added`, `link_removed`

### Worklog Management

Log time against issues with full CRUD support:

```bash
jira-ai issue worklog add PROJ-123 --time 2h
```

Add a comment and specify when the work started:

```bash
jira-ai issue worklog add PROJ-123 --time 1d2h30m --comment "Backend refactor" --started "2026-04-15T09:00:00+02:00"
```

The `--started` flag accepts any standard ISO 8601 timestamp. Timezone offsets are automatically normalized to Jira's required format (`yyyy-MM-dd'T'HH:mm:ss.SSS±HHMM`):

- `2026-04-15T07:00:00Z` → `2026-04-15T07:00:00.000+0000`
- `2026-04-15T10:00:00+03:00` → `2026-04-15T10:00:00.000+0300`
- `2026-04-15T07:00:00-05:30` → `2026-04-15T07:00:00.000-0530`

When omitted, `--started` defaults to the current time.

Log time with estimate adjustment (`--adjust-estimate` accepts `auto`, `new`, `leave`, or `manual`):

```bash
jira-ai issue worklog add PROJ-123 --time 4h --adjust-estimate new --new-estimate 2d
```

Use `--reduce-by` with `--adjust-estimate manual` to decrease the remaining estimate:

```bash
jira-ai issue worklog add PROJ-123 --time 3h --adjust-estimate manual --reduce-by 2h
```

List worklogs for an issue:

```bash
jira-ai issue worklog list PROJ-123
```

Filter by time range or author:

```bash
jira-ai issue worklog list PROJ-123 --started-after 1713139200000 --started-before 1715731200000
jira-ai issue worklog list PROJ-123 --author-account-id 557058:abc123-def456-ghi789
```

Update an existing worklog:

```bash
jira-ai issue worklog update PROJ-123 --id 12345 --time 3h --comment "Updated after review"
```

Delete a worklog (use `--increase-by` with `--adjust-estimate manual` to restore estimate):

```bash
jira-ai issue worklog delete PROJ-123 --id 12345
jira-ai issue worklog delete PROJ-123 --id 12345 --adjust-estimate manual --increase-by 2h
```

Preview any write operation with `--dry-run`:

```bash
jira-ai issue worklog add PROJ-123 --time 2h --dry-run
```

Duration format uses Jira-style notation: `1w` (5 working days), `1d` (8 hours), `1h`, `30m`, or combinations like `1d2h30m`.

## Service Account Authentication

Atlassian service accounts use scoped API tokens that must authenticate through the `api.atlassian.com` gateway rather than direct site URLs.

### Using a `.env` file

Create a `.env` file with your service account credentials:

```env
JIRA_HOST=your-domain.atlassian.net
JIRA_USER_EMAIL=your-bot@serviceaccount.atlassian.com
JIRA_API_TOKEN=your-service-account-api-token
JIRA_AUTH_TYPE=service_account
```

Then authenticate:

```bash
jira-ai auth --from-file path/to/.env
```

The Cloud ID will be auto-discovered from your site URL. To provide it explicitly:

```env
JIRA_CLOUD_ID=your-cloud-id
```

### Using CLI flags

```bash
jira-ai auth --service-account --from-json '{"url":"...","email":"...","apikey":"..."}'
```

Or with an explicit Cloud ID:

```bash
jira-ai auth --service-account --cloud-id your-cloud-id --from-json '{"url":"...","email":"...","apikey":"..."}'
```

### How it works

Standard Jira API tokens authenticate directly against `your-domain.atlassian.net`. Service account tokens are scoped and must route through the Atlassian API gateway at `api.atlassian.com/ex/jira/{cloudId}/...`.

When `authType` is set to `service_account`, jira-ai automatically:

1. Discovers your Cloud ID from `https://your-domain.atlassian.net/_edge/tenant_info` (if not provided)
2. Routes all API requests through `https://api.atlassian.com/ex/jira/{cloudId}` instead of the direct site URL
3. Uses the same basic auth (email + API token) — just through the gateway

Existing configurations using standard API tokens are unaffected.

## Saved Queries

Define reusable JQL queries in your `settings.yaml` under the `saved-queries` key to avoid repeating common searches.

### Configuration

Add a `saved-queries` map to your `settings.yaml` — each key is a query name (lowercase alphanumeric with hyphens) and each value is a JQL string:

```yaml
saved-queries:
  my-open-bugs: "project = PROJ AND status = Open AND issuetype = Bug"
  overdue-tasks: "project = PROJ AND duedate < now() AND status != Done"
  my-assignee: "assignee = currentUser()"
```

### Usage

Run a saved query by name:

```bash
jira-ai issue search --query my-open-bugs
```

List all configured saved queries:

```bash
jira-ai issue search --list-queries
```

Combine with result limits:

```bash
jira-ai issue search --query overdue-tasks --limit 10
```

Saved queries are mutually exclusive with raw JQL — you cannot provide both a positional JQL argument and `--query` at the same time.

## Presets

Predefined configuration presets let you quickly set up permission levels without manually editing `settings.yaml`. Presets configure `allowed-commands`, `allowed-jira-projects`, and `allowed-confluence-spaces` in one step.

The `--preset`, `--list-presets`, `--detect-preset`, `--apply`, `--validate`, and `--reset` flags are mutually exclusive — only one can be used at a time.

### Available Presets

| Preset | Description |
| :--- | :--- |
| `read-only` | AI can only observe. No create, update, delete, or transition operations. |
| `standard` | AI can perform common productive actions but cannot do destructive operations (delete, sprint management). |
| `my-tasks` | AI has full command access but is restricted to issues where the current user participated (assignee, reporter, commenter, or watcher). |
| `yolo` | Unrestricted access. The AI can do everything. The name explicitly signals risk. |

#### What each preset allows

- **`read-only`** — `issue get/search/stats/comments/activity/tree/worklog.list/link.list/link.types/attach/list`, `project list/statuses/types/fields`, `user me/search/worklog`, `confl get/spaces/pages/search`, `epic list/get/issues/progress`, `board list/get/config/issues`, `sprint list/get/issues/tree`
- **`standard`** — Everything in `read-only`, plus `issue create/update/transition/comment/assign/label.add/label.remove/link.create/attach.upload/attach.download/worklog.add/worklog.update`, `confl create/comment/update`, `epic create/update/link/unlink`, `sprint update`
- **`my-tasks`** — All commands across all domains (`issue`, `project`, `user`, `confl`, `epic`, `board`, `sprint`, `backlog`), but issue visibility is filtered to those where the user participated (see [globalParticipationFilter](#globalparticipationfilter) below)
- **`yolo`** — All commands, all projects, all Confluence spaces. No restrictions.

### Usage

Apply a preset:

```bash
jira-ai settings --preset read-only
jira-ai settings --preset standard
jira-ai settings --preset my-tasks
jira-ai settings --preset yolo
```

List all available presets with their full configuration details:

```bash
jira-ai settings --list-presets
```

Detect which preset (if any) your current settings match:

```bash
jira-ai settings --detect-preset
```

If your settings don't match any preset exactly, `--detect-preset` reports `custom` and shows the closest match with a diff of added/removed commands.

After applying a preset, you can further customize permissions by editing `~/.jira-ai/settings.yaml`. Saved queries are preserved when switching presets.

### globalParticipationFilter

The `my-tasks` preset sets a `globalParticipationFilter` in `settings.yaml` that restricts which issues the AI can see and interact with. Only issues where the current user matches at least one participation criterion are accessible:

```yaml
defaults:
  globalParticipationFilter:
    was_assignee: true
    was_reporter: true
    was_commenter: true
    is_watcher: true
```

| Field | JQL equivalent | Meaning |
| :--- | :--- | :--- |
| `was_assignee` | `assignee was currentUser()` | User was ever assigned to the issue |
| `was_reporter` | `reporter = currentUser()` | User is the issue reporter |
| `was_commenter` | `issue in issueHistory()` | User commented on the issue |
| `is_watcher` | `issue in watchedIssues()` | User is watching the issue |

The filter applies to both search queries (JQL is automatically wrapped) and direct issue access (per-issue validation). You can customize the filter after applying a preset by editing `~/.jira-ai/settings.yaml` — set individual fields to `false` to relax that criterion.

## Configuration & Restrictions

Tool allows you to have very complex configutations of what Projects/Jira commands/Issue types you would have acess to thought the tool.
Use this command to start setup: 

```bash
jira-ai settings --help
```

All avalible commands: [https://github.com/festoinc/jira-ai/blob/main/all_avaliable_commands.md](https://github.com/festoinc/jira-ai/blob/main/all_avaliable_commands.md)

## Links

- **Repository:** [https://github.com/festoinc/jira-ai](https://github.com/festoinc/jira-ai)
- **Issues:** [https://github.com/festoinc/jira-ai/issues](https://github.com/festoinc/jira-ai/issues)
- **NPM:** [https://www.npmjs.com/package/jira-ai](https://www.npmjs.com/package/jira-ai)

## License

Apache License 2.0
