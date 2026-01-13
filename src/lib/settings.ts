import fs from 'fs';
import path from 'path';
import os from 'os';
import yaml from 'js-yaml';
import chalk from 'chalk';
import { CliError } from '../types/errors.js';

export interface Settings {
  projects: string[];
  commands: string[];
}

const CONFIG_DIR = path.join(os.homedir(), '.jira-ai');
const SETTINGS_FILE = path.join(CONFIG_DIR, 'settings.yaml');

let cachedSettings: Settings | null = null;

export function getSettingsPath(): string {
  return SETTINGS_FILE;
}

export function loadSettings(): Settings {
  if (cachedSettings) {
    return cachedSettings;
  }

  // Ensure config directory exists
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }

  if (!fs.existsSync(SETTINGS_FILE)) {
    // Check if settings.yaml exists in current working directory (migration/backward compatibility)
    const localSettingsPath = path.join(process.cwd(), 'settings.yaml');
    if (fs.existsSync(localSettingsPath)) {
      try {
        const fileContents = fs.readFileSync(localSettingsPath, 'utf8');
        fs.writeFileSync(SETTINGS_FILE, fileContents);
        console.log(chalk.cyan(`Migrated settings.yaml to ${SETTINGS_FILE}`));
      } catch (error) {
        console.error('Error migrating settings.yaml:', error);
      }
    } else {
      // Create default settings.yaml if it doesn't exist anywhere
      const defaultSettings: Settings = {
        projects: ['all'],
        commands: ['all']
      };
      try {
        const yamlStr = yaml.dump(defaultSettings);
        fs.writeFileSync(SETTINGS_FILE, yamlStr);
      } catch (error) {
        console.error('Error creating default settings.yaml:', error);
      }
      
      cachedSettings = defaultSettings;
      return cachedSettings;
    }
  }

  try {
    const fileContents = fs.readFileSync(SETTINGS_FILE, 'utf8');
    const settings = yaml.load(fileContents) as Settings;

    cachedSettings = {
      projects: settings.projects || ['all'],
      commands: settings.commands || ['all']
    };

    return cachedSettings;
  } catch (error) {
    throw new CliError(`Error loading ${SETTINGS_FILE}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function isProjectAllowed(projectKey: string): boolean {
  const settings = loadSettings();

  if (settings.projects.includes('all')) {
    return true;
  }

  return settings.projects.includes(projectKey);
}

export function isCommandAllowed(commandName: string): boolean {
  const settings = loadSettings();

  if (settings.commands.includes('all')) {
    return true;
  }

  return settings.commands.includes(commandName);
}

export function getAllowedProjects(): string[] {
  const settings = loadSettings();
  return settings.projects;
}

export function getAllowedCommands(): string[] {
  const settings = loadSettings();
  return settings.commands;
}

// For testing purposes only
export function __resetCache__(): void {
  cachedSettings = null;
}
