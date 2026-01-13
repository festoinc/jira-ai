import readline from 'readline';
import chalk from 'chalk';
import fs from 'fs';
import dotenv from 'dotenv';
import { createTemporaryClient } from '../lib/jira-client.js';
import { saveCredentials } from '../lib/auth-storage.js';
import { CommandError } from '../lib/errors.js';
import { ui } from '../lib/ui.js';

interface AuthOptions {
  fromJson?: string;
  fromFile?: string;
  alias?: string;
}

export async function authCommand(options: AuthOptions = {}): Promise<void> {
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
    console.log(chalk.cyan('\n--- Jira Authentication Setup ---\n'));

    try {
      host = await ask('Jira URL (e.g., https://your-domain.atlassian.net): ');
      if (!host) {
        throw new CommandError('URL is required.');
      }

      email = await ask('Email: ');
      if (!email) {
        throw new CommandError('Email is required.');
      }

      console.log(chalk.gray('Get your API token from: https://id.atlassian.com/manage-profile/security/api-tokens'));
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

  ui.startSpinner('Verifying credentials...');

  try {
    const tempClient = createTemporaryClient(host, email, apiToken);
    const user = await tempClient.myself.getCurrentUser();

    ui.succeedSpinner(chalk.green('Authentication successful!'));
    console.log(chalk.blue(`\nWelcome, ${user.displayName} (${user.emailAddress})`));

    saveCredentials({ host, email, apiToken }, options.alias);
    console.log(chalk.green('\nCredentials saved successfully to ~/.jira-ai/config.json'));
    console.log(chalk.gray('These credentials will be used for future commands on this machine.'));
  } catch (error: any) {
    const hints: string[] = [];
    if (error.response && error.response.status === 401) {
      hints.push('Check if your email and API token are correct.');
    }
    throw new CommandError(`Authentication failed: ${error.message}`, { hints });
  }
}