import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env file from the project root
dotenv.config({ path: resolve(__dirname, '../../.env') });

export function checkEnv() {
  const host = process.env.JIRA_HOST;
  const email = process.env.JIRA_USER_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN;

  if (!host || !email || !apiToken) {
    throw new Error('JIRA_HOST, JIRA_USER_EMAIL, and JIRA_API_TOKEN must be set in .env for integration tests');
  }
}
