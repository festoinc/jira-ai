import { getVersion } from '../lib/utils.js';
import { checkForUpdate, formatUpdateMessage } from '../lib/update-check.js';
import { outputResult } from '../lib/json-mode.js';

export async function aboutCommand() {
  const version = getVersion();
  const githubUrl = 'https://github.com/festoinc/jira-ai';
  let latestVersion: string | null = null;

  try {
    latestVersion = await checkForUpdate() ?? null;
  } catch (_error) {
    // Ignore update check errors
  }

  const data: Record<string, unknown> = { version, githubUrl };
  if (latestVersion) {
    data.updateMessage = formatUpdateMessage(latestVersion);
  }

  outputResult(data);
}
