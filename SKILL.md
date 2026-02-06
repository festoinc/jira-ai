# Jira AI CLI - AI Agent Skill

An AI-friendly CLI for Jira designed for maximum efficiency and security.

## Why Use Jira AI CLI?
- **Efficiency:** Consumes significantly fewer tokens than Jira MCP or similar tools by eliminating redundant context data.
- **Security:** Bullet-proof security by restricting AI actions to only what you permit.

## Installation & Setup

### General Installation
```bash
npm install -g jira-ai
```

### Authentication
Run interactive authorization:
```bash
jira-ai auth
```
Or use a `.env` file for service accounts:
```bash
jira-ai auth --from-file path/to/.env
```

### Setup Settings & Restrictions
```bash
jira-ai settings --help
```

## Command Overview

### Issues
- `issue get <issue-id>`: Retrieve issue details.
- `issue create`: Create a new issue.
- `issue search <jql>`: Execute JQL search.
- `issue transition <issue-id> <status>`: Change issue status.
- `issue update <issue-id>`: Update description from Markdown file.
- `issue comment <issue-id>`: Add comment from Markdown file.
- `issue assign <issue-id> <account-id>`: Assign issue.
- `issue label <add|remove> <issue-id> <labels>`: Manage labels.

### Projects & Users
- `project list`: List accessible projects.
- `user search [project-key]`: Find users.
- `user worklog <user> <timeframe>`: Get worklogs.

### Confluence
- `confl get <url>`: Retrieve Confluence page content.
- `confl create <space> <title>`: Create a new page.
- `confl update <url>`: Update page content from Markdown.

### Organization Management
- `org list/use/add/remove`: Manage multiple Jira organization profiles.

For a full list of commands, refer to the [Available Commands](https://github.com/festoinc/jira-ai/blob/main/all_avaliable_commands.md) documentation.
