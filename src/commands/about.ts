import chalk from 'chalk';
import { getVersion } from '../lib/utils.js';
import { checkForUpdate, formatUpdateMessage } from '../lib/update-check.js';

export async function aboutCommand() {
  console.log(chalk.bold.cyan('\n📋 Jira AI\n'));
  console.log(`${chalk.bold('Version:')} ${getVersion()}`);
  console.log(`${chalk.bold('GitHub:')}  https://github.com/festoinc/jira-ai\n`);

  try {
    const latestVersion = await checkForUpdate();
    if (latestVersion) {
      console.log(formatUpdateMessage(latestVersion));
      console.log();
    }
  } catch (error) {
    // Ignore update check errors in about command
  }
}