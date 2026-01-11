import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

export interface Settings {
  projects: string[];
  commands: string[];
}

let cachedSettings: Settings | null = null;

export function loadSettings(): Settings {
  if (cachedSettings) {
    return cachedSettings;
  }

  const settingsPath = path.join(process.cwd(), 'settings.yaml');

  if (!fs.existsSync(settingsPath)) {
    console.warn('Warning: settings.yaml not found. Using default settings (all allowed).');
    cachedSettings = {
      projects: ['all'],
      commands: ['all']
    };
    return cachedSettings;
  }

  try {
    const fileContents = fs.readFileSync(settingsPath, 'utf8');
    const settings = yaml.load(fileContents) as Settings;

    cachedSettings = {
      projects: settings.projects || ['all'],
      commands: settings.commands || ['all']
    };

    return cachedSettings;
  } catch (error) {
    console.error('Error loading settings.yaml:', error);
    process.exit(1);
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
