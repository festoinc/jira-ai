# Jira AI CLI

An AI-friendly CLI for Jira that prioritizes efficiency and security.

<img width="519" height="245" alt="Screenshot From 2026-01-17 23-14-31" src="https://github.com/user-attachments/assets/97a597d8-fd5e-4cb1-a8d0-1a045b44146f" />


## Core Benefits

1.  **Context Efficiency:** Eliminates redundant context data, consuming significantly fewer tokens than Jira MCP or similar tools.
2.  **Bullet-proof Security:** Restrict AI to only the actions you permit, ensuring your environment remains secure. 

## Start
- **Human:** [Quick walk through video](https://www.loom.com/share/defb69de020e413aa8c33eda0671c29f)
- **AI Agent:** [Project overview and commands](https://raw.githubusercontent.com/festoinc/jira-ai/main/SKILL.md)

## Installation

If you **know how to install npm** then after installation run [this instuction.](https://raw.githubusercontent.com/festoinc/jira-ai/refs/heads/main/advanced-installation.md) in your CLI agent.

If you **don't know what npm** is but want to use Jira **"the haker way"** [this instruction is for you.](https://raw.githubusercontent.com/festoinc/jira-ai/refs/heads/main/starter-installation.md) copy it and run in any AI agent like chat GPT, Gemini e.t.c.

```bash
npm install -g jira-ai
```

### Install in Claude code: 
#### Step 1: Add the Marketplace
Add this marketplace to your Claude instance:
```bash
claude plugin marketplace add festoinc/management-plugins
```

#### Step 2: Install the Plugin
```bash
claude plugin install jira-ai-connector@management-plugins
```

Will be avalibale automatically as skill


### Install in  Gemini CLI
#### Step 1: Add the Extension
Add this extension to your Gemini CLI:
```bash
gemini extension install https://github.com/festoinc/management-plugins
```

Will be avalible as slash command 
```bash
/work-with-jira
```

## Quick Start

Run interactive authorization:
```bash
jira-ai auth
```

See all available commands:
```bash
jira-ai --help
```

## JSON Output Mode

All commands support structured JSON output via global flags. This is designed for AI agents and scripting integrations where parsed data is more useful than formatted tables.

### `--json`

Outputs pretty-printed JSON (2-space indentation):
```bash
jira-ai --json issue get PROJ-123
jira-ai --json project list
jira-ai --json issue search "project = PROJ AND status = Open"
```

### `--json-compact`

Outputs single-line JSON for maximum token efficiency — ideal for AI agent workflows:
```bash
jira-ai --json-compact issue get PROJ-123
```

### Error handling in JSON mode

Errors are returned as structured JSON to stdout:
```json
{ "error": true, "message": "Issue not found", "hints": ["Check the issue key"], "exitCode": 1 }
```

Default table output is unchanged when neither flag is used.

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
jira-ai --json issue transitions PROJ-123
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
jira-ai auth --service-account
```

Or with an explicit Cloud ID:

```bash
jira-ai auth --service-account --cloud-id your-cloud-id
```

### How it works

Standard Jira API tokens authenticate directly against `your-domain.atlassian.net`. Service account tokens are scoped and must route through the Atlassian API gateway at `api.atlassian.com/ex/jira/{cloudId}/...`.

When `authType` is set to `service_account`, jira-ai automatically:

1. Discovers your Cloud ID from `https://your-domain.atlassian.net/_edge/tenant_info` (if not provided)
2. Routes all API requests through `https://api.atlassian.com/ex/jira/{cloudId}` instead of the direct site URL
3. Uses the same basic auth (email + API token) — just through the gateway

Existing configurations using standard API tokens are unaffected.

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
