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
