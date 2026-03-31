# Jira AI CLI - AI Agent Skill

An AI-friendly CLI for Jira designed for maximum efficiency and security. All output is structured JSON — no human-readable formatting, no interactive prompts.

## Why Use Jira AI CLI?
- **Efficiency:** Consumes significantly fewer tokens than Jira MCP or similar tools by eliminating redundant context data.
- **Security:** Bullet-proof security by restricting AI actions to only what you permit.

## Installation & Setup

```bash
npm install -g jira-ai
```

### Authentication
Provide credentials via JSON string or `.env` file (no interactive prompts):

```bash
jira-ai auth --from-json '{"url":"https://your-domain.atlassian.net","email":"you@example.com","apikey":"your-api-token"}'
```

Or use a `.env` file for service accounts:
```bash
jira-ai auth --from-file path/to/.env
```

### Setup Settings & Restrictions
```bash
jira-ai settings --help
```

## JSON Output

All commands always output structured JSON. Use global flags to control formatting:

- Default: pretty-printed JSON (2-space indentation)
- `--compact`: single-line JSON for maximum token efficiency

```bash
jira-ai issue get PROJ-123
jira-ai --compact issue get PROJ-123
jira-ai project list
jira-ai issue search "project = PROJ AND status = Open"
```

Errors are returned as structured JSON to stdout:
```json
{ "error": true, "message": "Issue not found", "hints": ["Check the issue key"], "exitCode": 1 }
```

## Command Overview

### Issues
- `issue get <issue-id>`: Retrieve issue details.
- `issue create`: Create a new issue. Supports `--title`, `--project`, `--issue-type`, `--parent` (for subtasks), `--priority`, `--description`, `--description-file`, `--labels`, `--component`, `--fix-version`, `--due-date`, `--assignee`, `--custom-field`.
- `issue search <jql>`: Execute JQL search.
- `issue transition <issue-id> <status>`: Change issue status. Supports `--resolution <name>`, `--comment <text>`, `--comment-file <path>`, `--assignee <email-or-name>`, `--fix-version <name>`, `--custom-field "Field Name=value"`.
- `issue transitions <issue-id>`: List available transitions for an issue, including required fields. Supports `--required-only`.
- `issue update <issue-id>`: Update one or more fields of an issue. Supports `--priority`, `--summary`, `--description`, `--from-file`, `--labels`, `--clear-labels`, `--component`, `--fix-version`, `--due-date`, `--assignee`, `--custom-field`.
- `issue comment <issue-id>`: Add comment from Markdown file.
- `issue assign <issue-id> <account-id>`: Assign issue.
- `issue label <add|remove> <issue-id> <labels>`: Manage labels.
- `issue link types`: List all available issue link types.
- `issue link list <issue-key>`: List all links (inward + outward) for an issue.
- `issue link create <source-key> <link-type> <target-key>`: Create a link between two issues (e.g., `"Blocks"`, `"Relates"`).
- `issue link delete <source-key> --target <target-key>`: Delete a link between two issues.

### Projects & Users
- `project list`: List accessible projects.
- `project fields <project-key>`: Discover available fields including custom fields. Use `--type <issue-type>` to filter by issue type, `--custom` for custom fields only, `--search <term>` to search by name.
- `user search [project-key]`: Find users.
- `user worklog <user> <timeframe>`: Get worklogs.

### Epics
- `epic list <project-key>`: List epics in a project (`--done` to include completed, `--max <n>` to limit).
- `epic get <epic-key>`: Get full epic details.
- `epic create <project-key>`: Create a new epic (`--name`, `--summary` required; `--description`, `--labels` optional).
- `epic update <epic-key>`: Update epic name and/or summary.
- `epic issues <epic-key>`: List issues belonging to an epic (`--max <n>` to limit).
- `epic link <issue-key>`: Link an issue to an epic (`--epic <epic-key>`).
- `epic unlink <issue-key>`: Remove an issue from its epic.
- `epic progress <epic-key>`: Show epic completion progress with visual bar.

### Boards, Sprints & Backlog
- `board list [--project <key>] [--type <type>]`: List accessible boards.
- `board get <board-id>`: Get board details.
- `board config <board-id>`: Get board configuration (columns, filter, rank field).
- `board issues <board-id>`: List issues on a board (`--jql`, `--max`).
- `board rank --issues <keys> --before <key>|--after <key>`: Rank issues on a board.
- `sprint list <board-id> [--state <state>]`: List sprints for a board.
- `sprint get <sprint-id>`: Get sprint details.
- `sprint create <board-id> --name <name>`: Create a sprint (`--goal`, `--start`, `--end` optional).
- `sprint start <sprint-id>`: Start a future sprint.
- `sprint complete <sprint-id>`: Complete an active sprint.
- `sprint update <sprint-id>`: Update sprint (`--name`, `--goal`, `--start`, `--end`).
- `sprint delete <sprint-id>`: Delete a sprint.
- `sprint issues <sprint-id>`: List issues in a sprint (`--jql`, `--max`).
- `sprint move <sprint-id> --issues <keys>`: Move issues to a sprint.
- `backlog move --issues <keys>`: Move issues to the backlog.

### Confluence
- `confl get <url>`: Retrieve Confluence page content.
- `confl create <space> <title>`: Create a new page.
- `confl update <url>`: Update page content from Markdown.

For a full list of commands, refer to the [Available Commands](https://github.com/festoinc/jira-ai/blob/main/all_avaliable_commands.md) documentation.
