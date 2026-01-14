import fs from 'fs';
import path from 'path';
import os from 'os';
import yaml from 'js-yaml';
import chalk from 'chalk';
import { CliError } from '../types/errors.js';
import { SettingsSchema } from './validation.js';

export interface ProjectFilters {
  participated?: {
    was_assignee?: boolean;
    was_reporter?: boolean;
    was_commenter?: boolean;
    is_watcher?: boolean;
  };
  jql?: string;
}

export interface ProjectConfig {
  key: string;
  commands?: string[];
  filters?: ProjectFilters;
}

export type ProjectSetting = string | ProjectConfig;

export interface Settings {
  projects: ProjectSetting[];
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
                const defaultSettings: Settings = {
                  projects: ['all'],
                  commands: ['all']
                };
                cachedSettings = defaultSettings;
                return cachedSettings;
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
    const rawSettings = yaml.load(fileContents);
    
    const result = SettingsSchema.safeParse(rawSettings);
    if (!result.success) {
      console.warn(chalk.yellow(`Warning: ${SETTINGS_FILE} has validation errors:`));
      result.error.issues.forEach(issue => {
        console.warn(chalk.yellow(`  - ${issue.path.join('.')}: ${issue.message}`));
      });
      // Fallback to raw settings or default if parsing fails completely
      const settings = rawSettings as any;
      cachedSettings = {
        projects: settings?.projects || ['all'],
        commands: settings?.commands || ['all']
      };
    } else {
      cachedSettings = result.data;
    }

    return cachedSettings;
  } catch (error) {
    throw new CliError(`Error loading ${SETTINGS_FILE}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function saveSettings(settings: Settings): void {
  // Ensure config directory exists
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }

  try {
    const yamlStr = yaml.dump(settings);
    fs.writeFileSync(SETTINGS_FILE, yamlStr);
    cachedSettings = settings;
  } catch (error) {
    throw new CliError(`Error saving ${SETTINGS_FILE}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function isProjectAllowed(projectKey: string): boolean {
  const settings = loadSettings();

  const isAllowed = settings.projects.some(p => {
    if (typeof p === 'string') {
      return p === 'all' || p === projectKey;
    }
    return p.key === projectKey;
  });

  return isAllowed;
}

export function isCommandAllowed(commandName: string, projectKey?: string): boolean {
  const settings = loadSettings();

  // about, auth, and settings are always allowed
  if (['about', 'auth', 'settings'].includes(commandName)) {
    return true;
  }

  if (projectKey) {
    const project = settings.projects.find(p => 
      (typeof p === 'string' ? p : p.key) === projectKey
    );
    
    if (project && typeof project !== 'string' && project.commands) {
      return project.commands.includes(commandName);
    }
  } else {
    // For visibility/global check: allowed if in global list OR in any project-specific list
    const allowedGlobally = settings.commands.includes('all') || settings.commands.includes(commandName);
    if (allowedGlobally) {
      return true;
    }

    const allowedInAnyProject = settings.projects.some(p => 
      typeof p !== 'string' && p.commands && p.commands.includes(commandName)
    );
    if (allowedInAnyProject) {
      return true;
    }
    
    return false;
  }

  if (settings.commands.includes('all')) {
    return true;
  }

  return settings.commands.includes(commandName);
}

export function getAllowedProjects(): ProjectSetting[] {
  const settings = loadSettings();
  return settings.projects;
}

export function getAllowedCommands(): string[] {
  const settings = loadSettings();
  return settings.commands;
}

export function applyGlobalFilters(jql: string): string {
  const settings = loadSettings();
  
  const allAllowed = settings.projects.some(p => p === 'all');
  if (allAllowed) {
    return jql;
  }
  
  const projectFilters = settings.projects.map(p => {
    const key = typeof p === 'string' ? p : p.key;
    const projectJql = typeof p === 'string' ? null : p.filters?.jql;
    
    if (projectJql) {
      return `(project = "${key}" AND (${projectJql}))`;
    } else {
      return `project = "${key}"`;
    }
  });
  
  if (projectFilters.length === 0) {
    return `project = "NONE" AND (${jql})`;
  }
  
  const combinedProjectFilter = `(${projectFilters.join(' OR ')})`;
  return `(${combinedProjectFilter}) AND (${jql})`;
}

export function validateIssueAgainstFilters(issue: any, currentUserId: string): boolean {
  const settings = loadSettings();
  const projectKey = issue.key.split('-')[0];
  
  const project = settings.projects.find(p => {
    if (typeof p === 'string') return p === 'all' || p === projectKey;
    return p.key === projectKey;
  });

  if (!project) {
    return false;
  }

  if (typeof project === 'string') return true;

  if (project.filters?.participated) {
    const { participated } = project.filters;
    let hasParticipated = false;

    if (participated.was_assignee && issue.assignee?.accountId === currentUserId) hasParticipated = true;
    if (participated.was_reporter && issue.reporter?.accountId === currentUserId) hasParticipated = true;
    if (participated.was_commenter && issue.comments?.some((c: any) => c.author?.accountId === currentUserId)) hasParticipated = true;
    if (participated.is_watcher && issue.watchers?.includes('CURRENT_USER')) hasParticipated = true;

    if (!hasParticipated) return false;
  }

  return true;
}

// For testing purposes only
export function __resetCache__(): void {
  cachedSettings = null;
}
