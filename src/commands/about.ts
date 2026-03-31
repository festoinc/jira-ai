import { getVersion } from '../lib/utils.js';
import { outputResult } from '../lib/json-mode.js';

export async function aboutCommand() {
  const version = getVersion();
  outputResult({ version });
}
