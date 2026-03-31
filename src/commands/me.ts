import { getCurrentUser } from '../lib/jira-client.js';
import { outputResult } from '../lib/json-mode.js';

export async function meCommand(): Promise<void> {
  const user = await getCurrentUser();
  outputResult(user);
}
