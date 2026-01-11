# Jira AI

A TypeScript-based command-line interface for interacting with Atlassian Jira. Built with jira.js library and featuring beautiful terminal output with tables and colors.

## Features

- View your user information
- List all projects
- View task details with comments
- Show available statuses for a project
- Update issue descriptions from Markdown files
- Execute JQL queries with formatted results
- Beautiful table formatting with cli-table3
- Colored output for better readability
- Loading spinners for async operations

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Jira account with API access

## Installation

1. Clone or navigate to the project directory:
```bash
cd /home/manager/jira-service
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

4. Install globally:
```bash
sudo npm link
```

After installation, you can use the `jira-ai` command from anywhere in your terminal.

## Configuration

Create a `.env` file in the project root with your Jira credentials:

```env
JIRA_HOST=https://your-domain.atlassian.net
JIRA_USER_EMAIL=your-email@example.com
JIRA_API_TOKEN=your-api-token
```

### Getting Your API Token

1. Go to [Atlassian API Tokens](https://id.atlassian.com/manage-profile/security/api-tokens)
2. Click "Create API token"
3. Give it a label and copy the generated token
4. Add the token to your `.env` file

## Available Commands

### Show User Information

Display your basic Jira user information including host, display name, email, account ID, status, and timezone.

```bash
jira-ai me
```

**Output:**
```
User Information:
┌────────────────────┬──────────────────────────────────────────────────┐
│ Property           │ Value                                            │
├────────────────────┼──────────────────────────────────────────────────┤
│ Host               │ https://your-domain.atlassian.net                │
├────────────────────┼──────────────────────────────────────────────────┤
│ Display Name       │ Your Name                                        │
├────────────────────┼──────────────────────────────────────────────────┤
│ Email              │ your-email@example.com                           │
├────────────────────┼──────────────────────────────────────────────────┤
│ Account ID         │ 557058:xxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx         │
├────────────────────┼──────────────────────────────────────────────────┤
│ Status             │ Active                                           │
├────────────────────┼──────────────────────────────────────────────────┤
│ Time Zone          │ Europe/Kiev                                      │
└────────────────────┴──────────────────────────────────────────────────┘
```

### List Projects

Show all projects you have access to in a formatted table.

```bash
jira-ai projects
```

**Output:**
```
Projects (25 total)

┌────────────┬───────────────────────────────────┬───────────────┬─────────────────────────┐
│ Key        │ Name                              │ Type          │ Lead                    │
├────────────┼───────────────────────────────────┼───────────────┼─────────────────────────┤
│ BP         │ BookingPal                        │ software      │ Pavel Boiko             │
├────────────┼───────────────────────────────────┼───────────────┼─────────────────────────┤
│ IT         │ IT Support                        │ software      │ Anatolii Fesiuk         │
└────────────┴───────────────────────────────────┴───────────────┴─────────────────────────┘
```

### View Task Details

Display detailed information about a specific task including title, status, assignee, reporter, description, and all comments.

```bash
jira-ai task-with-details <task-id>
```

**Example:**
```bash
jira-ai task-with-details BP-1234
```

**Output:**
```
BP-1234: Configure new production server

┌───────────────┬─────────────────────────────────────────────────────────────────┐
│ Property      │ Value                                                           │
├───────────────┼─────────────────────────────────────────────────────────────────┤
│ Status        │ In Progress                                                     │
├───────────────┼─────────────────────────────────────────────────────────────────┤
│ Assignee      │ John Doe                                                        │
├───────────────┼─────────────────────────────────────────────────────────────────┤
│ Reporter      │ Jane Smith                                                      │
├───────────────┼─────────────────────────────────────────────────────────────────┤
│ Created       │ Jan 10, 2026, 02:30 PM                                          │
├───────────────┼─────────────────────────────────────────────────────────────────┤
│ Updated       │ Jan 10, 2026, 04:15 PM                                          │
└───────────────┴─────────────────────────────────────────────────────────────────┘

Description:
────────────────────────────────────────────────────────────────────────────────
We need to configure the production server...
────────────────────────────────────────────────────────────────────────────────

Comments (2):

1. John Doe - Jan 10, 2026, 03:00 PM
────────────────────────────────────────────────────────────────────────────────
Started working on this task...
────────────────────────────────────────────────────────────────────────────────
```

### Show Project Statuses

Display all possible issue statuses available in a specific project.

```bash
jira-ai project-statuses <project-id>
```

**Example:**
```bash
jira-ai project-statuses BP
```

**Output:**
```
Project BP - Available Statuses (21 total)

┌─────────────────────────┬────────────────────┬─────────────────────────────────────────────┐
│ Status Name             │ Category           │ Description                                 │
├─────────────────────────┼────────────────────┼─────────────────────────────────────────────┤
│ Open                    │ To Do              │ The work item is open and ready for work    │
├─────────────────────────┼────────────────────┼─────────────────────────────────────────────┤
│ In Progress             │ In Progress        │ This work item is being actively worked on  │
├─────────────────────────┼────────────────────┼─────────────────────────────────────────────┤
│ Closed                  │ Done               │ The work item is considered finished        │
└─────────────────────────┴────────────────────┴─────────────────────────────────────────────┘
```

### Execute JQL Query

Run a JQL (Jira Query Language) query and display results in a formatted table.

```bash
jira-ai run-jql <jql-query> [--limit <number>]
```

**Example:**
```bash
jira-ai run-jql "project = BP AND status = 'In Progress'" --limit 10
```

**Output:**
```
JQL Query Results (5 issues found)

┌────────────┬──────────────────────────┬─────────────┬────────────┬──────────┐
│ Key        │ Summary                  │ Status      │ Assignee   │ Priority │
├────────────┼──────────────────────────┼─────────────┼────────────┼──────────┤
│ BP-1234    │ Configure production...  │ In Progress │ John Doe   │ High     │
├────────────┼──────────────────────────┼─────────────┼────────────┼──────────┤
│ BP-5678    │ Update documentation     │ In Progress │ Jane Smith │ Medium   │
└────────────┴──────────────────────────┴─────────────┴────────────┴──────────┘
```

### Update Issue Description

Update a Jira issue's description from a Markdown file. The Markdown content is automatically converted to Atlassian Document Format (ADF).

```bash
jira-ai update-description <task-id> --from-file <path-to-markdown-file>
```

**Example:**
```bash
jira-ai update-description BP-1234 --from-file ./description.md
```

**Requirements:**
- The command must be enabled in `settings.yaml` (commented out by default for safety)
- You must have edit permissions for the issue in Jira
- The Markdown file must exist and be non-empty

**Supported Markdown:**
- Headings (# H1, ## H2, etc.)
- Bold, italic, strikethrough
- Lists (ordered and unordered)
- Code blocks with syntax highlighting
- Links and images
- Tables
- Blockquotes

**Output:**
```
✔ Description updated successfully for BP-1234

File: /path/to/description.md
```

**Note:** This command replaces the entire issue description with the content from the file.

## Settings

The CLI uses a `settings.yaml` file to control which commands and projects are allowed. This provides an additional security layer.

**Example settings.yaml:**
```yaml
# Projects: List of allowed projects (use "all" to allow all projects)
projects:
  - all

# Commands: List of allowed commands (use "all" to allow all commands)
commands:
  - me
  - projects
  - run-jql
  - task-with-details
  # - update-description  # Uncomment to enable description updates
  # - project-statuses
```

**Important:** The `update-description` command is commented out by default since it's a WRITE operation. Uncomment it only if you need to update issue descriptions.

## Development

### Scripts

- `npm run dev` - Run in development mode with ts-node
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Run the compiled version
- `npm run link` - Build and install globally

### Project Structure

```
jira-service/
├── src/
│   ├── cli.ts                       # Main entry point
│   ├── commands/                    # Command implementations
│   │   ├── about.ts
│   │   ├── me.ts
│   │   ├── projects.ts
│   │   ├── project-statuses.ts
│   │   ├── run-jql.ts
│   │   ├── task-with-details.ts
│   │   └── update-description.ts    # Update issue descriptions
│   ├── lib/
│   │   ├── jira-client.ts           # Jira API wrapper
│   │   ├── formatters.ts            # Output formatting
│   │   ├── settings.ts              # Settings management
│   │   └── utils.ts                 # Utility functions
│   └── types/
│       └── md-to-adf.d.ts           # Type definitions for md-to-adf
├── tests/                           # Test files
│   ├── __mocks__/                   # Jest mocks
│   ├── cli-permissions.test.ts
│   ├── projects.test.ts
│   ├── settings.test.ts
│   └── update-description.test.ts
├── dist/                            # Compiled JavaScript
├── package.json
├── tsconfig.json
├── jest.config.js
├── settings.yaml                    # Command/project permissions
└── .env                             # Environment variables
```

## Technologies Used

- **TypeScript** - Type-safe JavaScript
- **jira.js** - Jira API client library
- **Commander.js** - CLI framework
- **cli-table3** - Beautiful terminal tables
- **chalk** - Terminal colors and styling
- **ora** - Loading spinners
- **dotenv** - Environment variable management
- **md-to-adf** - Markdown to Atlassian Document Format conversion
- **Jest** - Testing framework

## Error Handling

The CLI provides helpful error messages:

- Missing environment variables with instructions
- API errors with detailed messages
- Invalid task IDs or project keys
- Network connectivity issues

## Troubleshooting

### Command not found after installation

Make sure you ran `sudo npm link` and that your npm global bin directory is in your PATH.

### Authentication errors

Verify your `.env` file has the correct:
- JIRA_HOST (with https://)
- JIRA_USER_EMAIL
- JIRA_API_TOKEN

Regenerate your API token if needed.

### Permission denied

If you get permission errors, make sure the CLI is executable:
```bash
chmod +x dist/cli.js
```

## License

ISC

## Contributing

Feel free to submit issues and enhancement requests.
