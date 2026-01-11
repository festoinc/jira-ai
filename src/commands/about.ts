import chalk from 'chalk';
import { getAllowedCommands, getAllowedProjects, isCommandAllowed } from '../lib/settings';

interface CommandInfo {
  name: string;
  description: string;
  usage: string;
}

const ALL_COMMANDS: CommandInfo[] = [
  {
    name: 'me',
    description: 'Show details of current user',
    usage: 'jira me --help'
  },
  {
    name: 'projects',
    description: 'List available projects',
    usage: 'jira projects --help'
  },
  {
    name: 'task-with-details',
    description: 'Show task title, body, and comments',
    usage: 'jira task-with-details --help'
  },
  {
    name: 'project-statuses',
    description: 'Show all possible statuses for a project',
    usage: 'jira project-statuses --help'
  },
  {
    name: 'about',
    description: 'Show this help message',
    usage: 'jira about'
  }
];

export async function aboutCommand() {
  console.log(chalk.bold.cyan('\n📋 Jira CLI - Available Commands\n'));

  console.log(chalk.bold('Usage:'));
  console.log('  jira <command> [options]\n');

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
  console.log(chalk.green('  jira <command> --help\n'));

  console.log(chalk.bold('Configuration:'));
  console.log('  Settings are managed in settings.yaml');
  const allowedProjects = getAllowedProjects();
  console.log(`  - Projects: ${allowedProjects.includes('all') ? 'All allowed' : allowedProjects.join(', ')}`);
  console.log(`  - Commands: ${isAllAllowed ? 'All allowed' : allowedCommandsList.join(', ')}\n`);
}
