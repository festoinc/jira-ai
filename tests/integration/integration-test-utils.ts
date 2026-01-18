import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { saveCredentials } from '../../src/lib/auth-storage.js';

// Load .env file from the project root
dotenv.config({ path: resolve(__dirname, '../../.env') });

export function checkEnv() {
  const host = process.env.JIRA_HOST;
  const email = process.env.JIRA_USER_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN;

  if (!host || !email || !apiToken) {
    throw new Error('JIRA_HOST, JIRA_USER_EMAIL, and JIRA_API_TOKEN must be set in .env for integration tests');
  }

  // Set up credentials in storage because the tool no longer reads from process.env
  saveCredentials({ host, email, apiToken });
}
