import chalk from 'chalk';
import { getAllowedCommands, getAllowedProjects, isCommandAllowed, getSettingsPath } from '../lib/settings';

interface CommandInfo {
  name: string;
  description: string;
  usage: string;
}

const ALL_COMMANDS: CommandInfo[] = [
  {
    name: 'me',
    description: 'Show details of current user',
    usage: 'jira-ai me --help'
  },
  {
    name: 'projects',
    description: 'List available projects',
    usage: 'jira-ai projects --help'
  },
  {
    name: 'task-with-details',
    description: 'Show task title, body, and comments',
    usage: 'jira-ai task-with-details --help'
  },
  {
    name: 'project-statuses',
    description: 'Show all possible statuses for a project',
    usage: 'jira-ai project-statuses --help'
  },
  {
    name: 'list-issue-types',
    description: 'Show all issue types for a project (e.g., Epic, Task, Subtask)',
    usage: 'jira-ai list-issue-types <project-key>'
  },
  {
    name: 'run-jql',
    description: 'Execute JQL query and display results',
    usage: 'jira-ai run-jql "<jql-query>" [-l <limit>]'
  },
  {
    name: 'update-description',
    description: 'Update task description from a Markdown file',
    usage: 'jira-ai update-description <task-id> --from-file <path>'
  },
  {
    name: 'add-comment',
    description: 'Add a comment to a Jira issue from a Markdown file',
    usage: 'jira-ai add-comment --file-path <path> --issue-key <key>'
  },
  {
    name: 'about',
    description: 'Show this help message',
    usage: 'jira-ai about'
  }
];

export async function aboutCommand() {
  console.log(chalk.bold.cyan('\n📋 Jira AI - Available Commands\n'));

  console.log(chalk.bold('Usage:'));
  console.log('  jira-ai <command> [options]\n');

  const allowedCommandsList = getAllowedCommands();
  const isAllAllowed = allowedCommandsList.includes('all');

  // Filter commands based on settings (about is always shown)
  const commandsToShow = ALL_COMMANDS.filter(cmd =>
    cmd.name === 'about' || isAllAllowed || isCommandAllowed(cmd.name)
  );

  console.log(chalk.bold('Available Commands:\n'));

  for (const cmd of commandsToShow) {
    console.log(chalk.yellow(`  ${cmd.name}`));
    console.log(`    ${cmd.description}`);
    console.log(`    Usage: ${cmd.usage}\n`);
  }

  // Show disabled commands if not all are allowed
  if (!isAllAllowed) {
    const disabledCommands = ALL_COMMANDS.filter(cmd =>
      cmd.name !== 'about' && !isCommandAllowed(cmd.name)
    );

    if (disabledCommands.length > 0) {
      console.log(chalk.bold('Disabled Commands:\n'));
      for (const cmd of disabledCommands) {
        console.log(chalk.gray(`  ${cmd.name} - ${cmd.description}`));
      }
      console.log();
    }
  }

  console.log(chalk.bold('For detailed help on any command, run:'));
  console.log(chalk.green('  jira-ai <command> --help\n'));

  console.log(chalk.bold('Configuration:'));
  console.log(`  Settings file: ${chalk.cyan(getSettingsPath())}`);
  const allowedProjects = getAllowedProjects();
  console.log(`  - Projects: ${allowedProjects.includes('all') ? 'All allowed' : allowedProjects.join(', ')}`);
  console.log(`  - Commands: ${isAllAllowed ? 'All allowed' : allowedCommandsList.join(', ')}\n`);
}
