import chalk from 'chalk';
import { getVersion } from '../lib/utils.js';

export async function aboutCommand() {
  console.log(chalk.bold.cyan('\n📋 Jira AI\n'));
  console.log(`${chalk.bold('Version:')} ${getVersion()}`);
  console.log(`${chalk.bold('GitHub:')}  https://github.com/festoinc/jira-ai\n`);
}