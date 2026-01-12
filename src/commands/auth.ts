import readline from 'readline';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs';
import dotenv from 'dotenv';
import { createTemporaryClient } from '../lib/jira-client.js';
import { saveCredentials } from '../lib/auth-storage.js';
import { CliError } from '../types/errors.js';

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

function askSecret(question: string): Promise<string> {
  return new Promise((resolve) => {
    // Hide input for secret (basic implementation)
    const stdin = process.stdin;
    process.stdout.write(question);
    
    // We can't easily hide characters in standard readline without some complex logic
    // or external libraries. For now, we'll just use regular question but we'll 
    // mention it's a secret.
    rl.question('', (answer) => {
      resolve(answer.trim());
    });
  });
}

interface AuthOptions {
  fromJson?: string;
  fromFile?: string;
}

export async function authCommand(options: AuthOptions = {}): Promise<void> {
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
        throw new CliError('Missing required fields in JSON. Required: url/host, email, apikey/apiToken.');
      }
    } catch (error: any) {
      if (error instanceof CliError) throw error;
      throw new CliError(`Invalid JSON string: ${error.message}`);
    }
  } else if (options.fromFile) {
    if (!fs.existsSync(options.fromFile)) {
      throw new CliError(`File not found: ${options.fromFile}`);
    }

    try {
      const content = fs.readFileSync(options.fromFile, 'utf8');
      const config = dotenv.parse(content);
      
      host = config.JIRA_HOST;
      email = config.JIRA_USER_EMAIL;
      apiToken = config.JIRA_API_TOKEN;

      if (!host || !email || !apiToken) {
        throw new CliError('Missing required environment variables in file. Required: JIRA_HOST, JIRA_USER_EMAIL, JIRA_API_TOKEN.');
      }
    } catch (error: any) {
      if (error instanceof CliError) throw error;
      throw new CliError(`Failed to parse file: ${error.message}`);
    }
  }

  if (!host || !email || !apiToken) {
    console.log(chalk.cyan('\n--- Jira Authentication Setup ---\n'));

    try {
      host = await ask('Jira URL (e.g., https://your-domain.atlassian.net): ');
      if (!host) {
        throw new CliError('URL is required.');
      }

      email = await ask('Email: ');
      if (!email) {
        throw new CliError('Email is required.');
      }

      console.log(chalk.gray('Get your API token from: https://id.atlassian.com/manage-profile/security/api-tokens'));
      apiToken = await ask('API Token: ');
      if (!apiToken) {
        throw new CliError('API Token is required.');
      }
    } finally {
      rl.close();
    }
  } else {
    // Non-interactive mode, just close readline
    rl.close();
  }

  const spinner = ora('Verifying credentials...').start();

  try {
    const tempClient = createTemporaryClient(host, email, apiToken);
    const user = await tempClient.myself.getCurrentUser();

    spinner.succeed(chalk.green('Authentication successful!'));
    console.log(chalk.blue(`\nWelcome, ${user.displayName} (${user.emailAddress})`));

    saveCredentials({ host, email, apiToken });
    console.log(chalk.green('\nCredentials saved successfully to ~/.jira-ai/config.json'));
    console.log(chalk.gray('These credentials will be used for future commands on this machine.'));
  } catch (error: any) {
    spinner.fail(chalk.red('Authentication failed.'));
    if (error.response && error.response.status === 401) {
      console.error(chalk.yellow('Hint: Check if your email and API token are correct.'));
    }
    throw error;
  }
}
