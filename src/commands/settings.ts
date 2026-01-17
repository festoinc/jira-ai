import chalk from 'chalk';
import fs from 'fs';
import yaml from 'js-yaml';
import { loadSettings, saveSettings, Settings, DEFAULT_SETTINGS } from '../lib/settings.js';
import { formatSettings } from '../lib/formatters.js';
import { ui } from '../lib/ui.js';
import { SettingsSchema } from '../lib/validation.js';
import { getProjects, getProjectIssueTypes } from '../lib/jira-client.js';
import { CommandError } from '../lib/errors.js';
import { validateEnvVars } from '../lib/utils.js';

export interface SettingsOptions {
  apply?: string;
  validate?: string;
  reset?: boolean;
}

export async function settingsCommand(options: SettingsOptions): Promise<void> {
  if (options.reset) {
    ui.startSpinner('Resetting settings to default...');
    try {
      saveSettings(DEFAULT_SETTINGS);
      ui.succeedSpinner(chalk.green('Settings reset to default successfully!'));
    } catch (error) {
      ui.failSpinner(`Error resetting settings: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
    return;
  }

  if (options.apply) {
    await applySettings(options.apply);
    return;
  }

  if (options.validate) {
    await validateSettingsFile(options.validate);
    return;
  }

  // Default: Show current settings
  const settings = loadSettings();
  console.log(formatSettings(settings));
}

async function validateSettingsFile(filePath: string): Promise<Settings> {
  ui.startSpinner(`Validating ${filePath}...`);

  if (!fs.existsSync(filePath)) {
    ui.failSpinner(`File not found: ${filePath}`);
    throw new CommandError(`File not found: ${filePath}`);
  }

  let rawSettings: any;
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    rawSettings = yaml.load(content);
  } catch (error) {
    ui.failSpinner(`Error parsing YAML: ${error instanceof Error ? error.message : String(error)}`);
    throw new CommandError(`Error parsing YAML in ${filePath}`);
  }

  // Schema Validation
  const result = SettingsSchema.safeParse(rawSettings);
  if (!result.success) {
    ui.failSpinner('Schema validation failed');
    const messages = result.error.issues
      .map((err) => `${err.path.join('.')}: ${err.message}`)
      .join('\n');
    throw new CommandError(`Invalid settings structure:\n${messages}`);
  }

  const settings = result.data;

  // Deep Validation
  ui.updateSpinner('Performing deep validation against Jira...');
  try {
    validateEnvVars();
    const projects = await getProjects();
    const projectKeys = new Set(projects.map(p => p.key));

    for (const p of settings.projects) {
      const key = typeof p === 'string' ? p : p.key;
      
      if (key === 'all') continue;

      if (!projectKeys.has(key)) {
        ui.failSpinner(`Deep validation failed: Project "${key}" not found in Jira.`);
        throw new CommandError(`Project "${key}" not found in Jira.`);
      }

      // If project has specific commands, we could validate them too, 
      // but they are just strings matched against command names.
    }

    ui.succeedSpinner(chalk.green('Settings are valid!'));
    return settings;
  } catch (error) {
    if (error instanceof CommandError) throw error;
    ui.failSpinner(`Deep validation failed: ${error instanceof Error ? error.message : String(error)}`);
    throw new CommandError(`Failed to connect to Jira for validation: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function applySettings(filePath: string): Promise<void> {
  const settings = await validateSettingsFile(filePath);
  
  ui.startSpinner('Applying settings...');
  try {
    saveSettings(settings);
    ui.succeedSpinner(chalk.green('Settings applied successfully!'));
  } catch (error) {
    ui.failSpinner(`Error applying settings: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}
