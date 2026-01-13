import chalk from 'chalk';
import Table from 'cli-table3';
import { 
  getOrganizations, 
  getCurrentOrganizationAlias, 
  useOrganization, 
  removeOrganization,
  saveOrganization,
  AuthCredentials
} from '../lib/auth-storage.js';
import { CommandError } from '../lib/errors.js';
import { ui } from '../lib/ui.js';

export async function listOrganizations(): Promise<void> {
  const organizations = getOrganizations();
  const currentAlias = getCurrentOrganizationAlias();

  if (Object.keys(organizations).length === 0) {
    console.log(chalk.yellow('No organizations configured. Use "jira-ai auth" to add one.'));
    return;
  }

  const table = new Table({
    head: [chalk.cyan('Status'), chalk.cyan('Alias'), chalk.cyan('Host'), chalk.cyan('Email')],
    style: { head: [], border: [] }
  });

  for (const [alias, creds] of Object.entries(organizations)) {
    const isCurrent = alias === currentAlias;
    table.push([
      isCurrent ? chalk.green('active') : '',
      isCurrent ? chalk.bold(alias) : alias,
      creds.host,
      creds.email
    ]);
  }

  console.log(chalk.cyan('\nJira Organizations:'));
  console.log(table.toString());
}

export async function useOrganizationCommand(alias: string): Promise<void> {
  try {
    useOrganization(alias);
    console.log(chalk.green(`Switched to organization: ${chalk.bold(alias)}`));
  } catch (error: any) {
    throw new CommandError(error.message);
  }
}

export async function removeOrganizationCommand(alias: string): Promise<void> {
  const currentAlias = getCurrentOrganizationAlias();
  
  removeOrganization(alias);
  console.log(chalk.green(`Removed organization: ${chalk.bold(alias)}`));
  
  if (currentAlias === alias) {
    const newAlias = getCurrentOrganizationAlias();
    if (newAlias) {
      console.log(chalk.yellow(`Active organization switched to: ${chalk.bold(newAlias)}`));
    } else {
      console.log(chalk.yellow('No more organizations configured.'));
    }
  }
}
