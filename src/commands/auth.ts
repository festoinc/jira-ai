import readline from 'readline';
import fs from 'fs';
import dotenv from 'dotenv';
import { createTemporaryClient } from '../lib/jira-client.js';
import { saveCredentials, clearCredentials } from '../lib/auth-storage.js';
import { CommandError } from '../lib/errors.js';
import { outputResult } from '../lib/json-mode.js';

interface AuthOptions {
  fromJson?: string;
  fromFile?: string;
  logout?: boolean;
  serviceAccount?: boolean;
  cloudId?: string;
}

/**
 * Auto-discover the Atlassian Cloud ID for a given site hostname.
 */
async function discoverCloudId(host: string): Promise<string> {
  const hostname = host.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const url = `https://${hostname}/_edge/tenant_info`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new CommandError(`Failed to discover Cloud ID from ${url} (HTTP ${response.status}).`, {
      hints: ['Provide the Cloud ID explicitly with --cloud-id.'],
    });
  }
  const data = (await response.json()) as any;
  if (!data.cloudId) {
    throw new CommandError(`No cloudId found in tenant_info response from ${url}.`, {
      hints: ['Provide the Cloud ID explicitly with --cloud-id.'],
    });
  }
  return data.cloudId as string;
}

export async function logoutCommand(): Promise<void> {
  clearCredentials();
  outputResult({ success: true, message: 'Successfully logged out. Authentication credentials cleared.' });
}

export async function authCommand(options: AuthOptions = {}): Promise<void> {
  if (options.logout) {
    return logoutCommand();
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  function ask(question: string): Promise<string> {
    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        resolve(answer.trim());
      });
    });
  }

  let host: string = '';
  let email: string = '';
  let apiToken: string = '';
  let authType: 'basic' | 'service_account' = options.serviceAccount ? 'service_account' : 'basic';
  let cloudId: string | undefined = options.cloudId;

  if (options.fromJson) {
    try {
      const data = JSON.parse(options.fromJson);
      host = data.url || data.host;
      email = data.email;
      apiToken = data.apikey || data.apiToken;

      if (!host || !email || !apiToken) {
        throw new CommandError('Missing required fields in JSON.', {
          hints: ['Required fields: url/host, email, apikey/apiToken.']
        });
      }
    } catch (error: any) {
      if (error instanceof CommandError) throw error;
      throw new CommandError(`Invalid JSON string: ${error.message}`);
    }
  } else if (options.fromFile) {
    if (!fs.existsSync(options.fromFile)) {
      throw new CommandError(`File not found: ${options.fromFile}`);
    }

    try {
      const content = fs.readFileSync(options.fromFile, 'utf8');
      const config = dotenv.parse(content);
      
      host = config.JIRA_HOST;
      email = config.JIRA_USER_EMAIL;
      apiToken = config.JIRA_API_TOKEN;

      // Support JIRA_AUTH_TYPE and JIRA_CLOUD_ID from .env
      if (config.JIRA_AUTH_TYPE === 'service_account') {
        authType = 'service_account';
      }
      if (config.JIRA_CLOUD_ID) {
        cloudId = config.JIRA_CLOUD_ID;
      }

      if (!host || !email || !apiToken) {
        throw new CommandError('Missing required environment variables in file.', {
          hints: ['Required: JIRA_HOST, JIRA_USER_EMAIL, JIRA_API_TOKEN.']
        });
      }
    } catch (error: any) {
      if (error instanceof CommandError) throw error;
      throw new CommandError(`Failed to parse file: ${error.message}`);
    }
  }

  if (!host || !email || !apiToken) {
    try {
      host = await ask('Jira URL (e.g., https://your-domain.atlassian.net): ');
      if (!host) {
        throw new CommandError('URL is required.');
      }

      email = await ask('Email: ');
      if (!email) {
        throw new CommandError('Email is required.');
      }

      console.log('Get your API token from: https://id.atlassian.com/manage-profile/security/api-tokens');
      apiToken = await ask('API Token: ');
      if (!apiToken) {
        throw new CommandError('API Token is required.');
      }
    } finally {
      rl.close();
    }
  } else {
    // Non-interactive mode, just close readline
    rl.close();
  }

  // Auto-discover Cloud ID for service accounts if not provided
  if (authType === 'service_account' && !cloudId) {
    try {
      cloudId = await discoverCloudId(host);
      console.log(`Discovered Cloud ID: ${cloudId}`);
    } catch (error: any) {
      throw error;
    }
  }

  try {
    const tempClient = createTemporaryClient(host, email, apiToken, { authType, cloudId });
    const user = await tempClient.myself.getCurrentUser();

    saveCredentials({ host, email, apiToken, authType, cloudId });
    outputResult({ success: true, displayName: user.displayName, email: user.emailAddress, authType });
  } catch (error: any) {
    const hints: string[] = [];
    if (error.response && error.response.status === 401) {
      hints.push('Check if your email and API token are correct.');
    }
    if (authType === 'service_account') {
      hints.push('Service accounts require the api.atlassian.com gateway. Verify your Cloud ID is correct.');
    }
    throw new CommandError(`Authentication failed: ${error.message}`, { hints });
  }
}