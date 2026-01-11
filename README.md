# Jira CLI

A TypeScript-based command-line interface for interacting with Atlassian Jira. Built with jira.js library and featuring beautiful terminal output with tables and colors.

## Features

- View your user information
- List all projects
- View task details with comments
- Show available statuses for a project
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

After installation, you can use the `jira` command from anywhere in your terminal.

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
jira me
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
jira projects
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
jira task-with-details <task-id>
```

**Example:**
```bash
jira task-with-details BP-1234
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
jira project-statuses <project-id>
```

**Example:**
```bash
jira project-statuses BP
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
│   ├── cli.ts                    # Main entry point
│   ├── commands/                 # Command implementations
│   │   ├── me.ts
│   │   ├── projects.ts
│   │   ├── project-statuses.ts
│   │   └── task-with-details.ts
│   └── lib/
│       ├── jira-client.ts        # Jira API wrapper
│       ├── formatters.ts         # Output formatting
│       └── utils.ts              # Utility functions
├── dist/                         # Compiled JavaScript
├── package.json
├── tsconfig.json
└── .env                          # Environment variables
```

## Technologies Used

- **TypeScript** - Type-safe JavaScript
- **jira.js** - Jira API client library
- **Commander.js** - CLI framework
- **cli-table3** - Beautiful terminal tables
- **chalk** - Terminal colors and styling
- **ora** - Loading spinners
- **dotenv** - Environment variable management

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
