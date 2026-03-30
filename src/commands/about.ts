import chalk from 'chalk';
import { getVersion } from '../lib/utils.js';
import { checkForUpdate, formatUpdateMessage } from '../lib/update-check.js';
import { outputResult, isJsonMode } from '../lib/json-mode.js';

export async function aboutCommand() {
  const version = getVersion();
  let latestVersion: string | null = null;

  try {
    latestVersion = await checkForUpdate() ?? null;
  } catch (error) {
    // Ignore update check errors in about command
  }

  outputResult(
    { version, updateAvailable: latestVersion ?? undefined },
    (data) => {
      let out = chalk.bold.cyan('\n📋 Jira AI\n');
      out += `${chalk.bold('Version:')} ${data.version}\n`;
      out += `${chalk.bold('GitHub:')}  https://github.com/festoinc/jira-ai\n`;
      if (data.updateAvailable) {
        out += `\n${formatUpdateMessage(data.updateAvailable)}\n`;
      }
      return out;
    }
  );
}