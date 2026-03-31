import { getVersion } from '../lib/utils.js';
import { outputResult } from '../lib/json-mode.js';

export async function aboutCommand() {
  outputResult({ version: getVersion() });
}