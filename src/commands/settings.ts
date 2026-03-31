import fs from 'fs';
import yaml from 'js-yaml';
import {
  loadSettings,
  saveSettings,
  Settings,
  DEFAULT_SETTINGS,
  migrateSettings
} from '../lib/settings.js';
import { SettingsSchema } from '../lib/validation.js';
import { getProjects } from '../lib/jira-client.js';
import { CommandError } from '../lib/errors.js';
import { validateEnvVars } from '../lib/utils.js';
import { outputResult } from '../lib/json-mode.js';

export interface SettingsOptions {
  apply?: string;
  validate?: string;
  reset?: boolean;
}

export async function settingsCommand(options: SettingsOptions): Promise<void> {
  if (options.reset) {
    try {
      saveSettings(DEFAULT_SETTINGS);
      console.log('Settings reset to default successfully!');
    } catch (error) {
      console.error(`Error resetting settings: ${error instanceof Error ? error.message : String(error)}`);
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
  outputResult(settings);
}

async function validateSettingsFile(filePath: string): Promise<Settings> {
  if (!fs.existsSync(filePath)) {
    throw new CommandError(`File not found: ${filePath}`);
  }

  let rawSettings: any;
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    rawSettings = yaml.load(content);
  } catch (error) {
    throw new CommandError(`Error parsing YAML in ${filePath}`);
  }

  // Schema Validation
  const result = SettingsSchema.safeParse(rawSettings);
  if (!result.success) {
    const messages = result.error.issues
      .map((err) => `${err.path.join('.')}: ${err.message}`)
      .join('\n');
    throw new CommandError(`Invalid settings structure:\n${messages}`);
  }

  const settings = migrateSettings(result.data);

  // Deep Validation
  try {
    validateEnvVars();
    const projects = await getProjects();
    const projectKeys = new Set(projects.map(p => p.key));

    const validateOrg = (orgSettings: any, label: string) => {
      const projectsToValidate = orgSettings['allowed-jira-projects'] || [];
      for (const p of projectsToValidate) {
        const key = typeof p === 'string' ? p : p.key;

        if (key === 'all') continue;

        if (!projectKeys.has(key)) {
          const msg = `Project "${key}" (in ${label}) not found in Jira.`;
          throw new CommandError(msg);
        }
      }
    };

    if (settings.defaults) {
      validateOrg(settings.defaults, 'defaults');
    }

    console.log('Settings are valid!');
    return settings;
  } catch (error) {
    if (error instanceof CommandError) throw error;
    throw new CommandError(`Failed to connect to Jira for validation: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function applySettings(filePath: string): Promise<void> {
  const settings = await validateSettingsFile(filePath);

  try {
    saveSettings(settings);
    console.log('Settings applied successfully!');
  } catch (error) {
    console.error(`Error applying settings: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}
