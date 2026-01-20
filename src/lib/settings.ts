import fs from 'fs';
import path from 'path';
import os from 'os';
import yaml from 'js-yaml';
import chalk from 'chalk';
import { CliError } from '../types/errors.js';
import { SettingsSchema } from './validation.js';
import { getCurrentOrganizationAlias } from './auth-storage.js';

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

export interface OrganizationSettings {
  'allowed-jira-projects': ProjectSetting[];
  'allowed-commands': string[];
  'allowed-confluence-spaces': string[];
}

export interface Settings {
  defaults?: OrganizationSettings;
  organizations?: Record<string, OrganizationSettings>;
}

// Mapping from old flat command names to new hierarchical paths
export const LEGACY_COMMAND_MAP: Record<string, string> = {
  'me': 'user.me',
  'projects': 'project.list',
  'task-with-details': 'issue.get',
  'project-statuses': 'project.statuses',
  'list-issue-types': 'project.types',
  'list-colleagues': 'user.search',
  'run-jql': 'issue.search',
  'update-description': 'issue.update',
  'add-comment': 'issue.comment',
  'add-label-to-issue': 'issue.label.add',
  'delete-label-from-issue': 'issue.label.remove',
  'create-task': 'issue.create',
  'transition': 'issue.transition',
  'get-issue-statistics': 'issue.stats',
  'get-person-worklog': 'user.worklog',
  'organization': 'org',
  'confluence': 'confl',
  // Already hierarchical, keep as-is
  'issue': 'issue',
  'org': 'org',
  'confl': 'confl'
};

/**
 * Migrate legacy command names to new hierarchical format
 */
export function migrateCommandNames(commands: string[]): string[] {
  return commands.map(cmd => LEGACY_COMMAND_MAP[cmd] || cmd);
}

export const DEFAULT_ORG_SETTINGS: OrganizationSettings = {
  'allowed-jira-projects': ['all'],
  'allowed-commands': [
    'issue',      // All issue commands (get, create, search, transition, update, comment, stats, assign, label)
    'project',    // All project commands (list, statuses, types)
    'user',       // All user commands (me, search, worklog)
    'org',        // Organization management
    'confl'       // Confluence commands
  ],
  'allowed-confluence-spaces': ['all']
};

export const DEFAULT_SETTINGS: Settings = {
  defaults: DEFAULT_ORG_SETTINGS
};

const CONFIG_DIR = path.join(os.homedir(), '.jira-ai');
const SETTINGS_FILE = path.join(CONFIG_DIR, 'settings.yaml');

let cachedSettings: Settings | null = null;

export function getSettingsPath(): string {
  return SETTINGS_FILE;
}

export function migrateSettings(settings: any): Settings {
  // Migration logic: if old structure exists, move it to defaults
  // Note: We keep command names as-is in storage (don't migrate them here)
  // Command name migration happens at runtime in isCommandAllowed()
  if (settings.projects || settings.commands) {
    const migratedDefaults: OrganizationSettings = {
      'allowed-jira-projects': settings.projects || DEFAULT_ORG_SETTINGS['allowed-jira-projects'],
      'allowed-commands': settings.commands || DEFAULT_ORG_SETTINGS['allowed-commands'],
      'allowed-confluence-spaces': DEFAULT_ORG_SETTINGS['allowed-confluence-spaces']
    };

    const newSettings = {
      ...settings,
      defaults: migratedDefaults,
    };
    // Remove old fields
    delete newSettings.projects;
    delete newSettings.commands;
    return newSettings;
  }
  return settings;
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
        cachedSettings = { ...DEFAULT_SETTINGS };
        return cachedSettings;
      }
    } else {
      // Create default settings.yaml if it doesn't exist anywhere
      try {
        const yamlStr = yaml.dump(DEFAULT_SETTINGS);
        fs.writeFileSync(SETTINGS_FILE, yamlStr);
      } catch (error) {
        console.error('Error creating default settings.yaml:', error);
      }

      cachedSettings = { ...DEFAULT_SETTINGS };
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
      // Fallback to defaults if parsing fails completely
      return DEFAULT_SETTINGS;
    }
    
    let settings = result.data as any;
    settings = migrateSettings(settings);

    cachedSettings = settings;
    return settings;
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

function getEffectiveSettings(orgAlias?: string): OrganizationSettings | null {
  const settings = loadSettings();
  const alias = orgAlias || getCurrentOrganizationAlias();

  if (alias && settings.organizations && settings.organizations[alias]) {
    return settings.organizations[alias];
  }

  return settings.defaults || null;
}

export function isProjectAllowed(projectKey: string, orgAlias?: string): boolean {
  const settings = getEffectiveSettings(orgAlias);
  if (!settings) return false;

  const isAllowed = settings['allowed-jira-projects'].some(p => {
    if (typeof p === 'string') {
      return p === 'all' || p === projectKey;
    }
    return p.key === projectKey;
  });

  return isAllowed;
}

/**
 * Check if a command matches any allowed command using hierarchical matching.
 * e.g., if 'issue' is allowed, then 'issue.get', 'issue.label.add' are all allowed.
 * If 'issue.label' is allowed, then 'issue.label.add' and 'issue.label.remove' are allowed.
 */
function matchesHierarchicalCommand(commandPath: string, allowedCommands: string[]): boolean {
  // Check for 'all' permission
  if (allowedCommands.includes('all')) return true;

  // Check hierarchical permissions (most specific to least specific)
  const parts = commandPath.split('.');
  for (let i = parts.length; i > 0; i--) {
    const checkPath = parts.slice(0, i).join('.');
    if (allowedCommands.includes(checkPath)) return true;
  }

  return false;
}

export function isCommandAllowed(commandName: string, projectKey?: string, orgAlias?: string): boolean {
  // about, auth, and settings are always allowed
  if (['about', 'auth', 'settings'].includes(commandName)) {
    return true;
  }

  const settings = getEffectiveSettings(orgAlias);
  if (!settings) return false;

  // Normalize the command name being checked (convert legacy to new format)
  const normalizedCommandName = LEGACY_COMMAND_MAP[commandName] || commandName;

  // Migrate legacy command names in settings to new format for checking
  const migratedAllowedCommands = migrateCommandNames(settings['allowed-commands']);

  if (projectKey) {
    let project = settings['allowed-jira-projects'].find(p => typeof p !== 'string' && p.key === projectKey);
    if (!project) {
      project = settings['allowed-jira-projects'].find(p => typeof p === 'string' && (p === 'all' || p === projectKey));
    }

    if (project && typeof project !== 'string' && project.commands) {
      const migratedProjectCommands = migrateCommandNames(project.commands);
      return matchesHierarchicalCommand(normalizedCommandName, migratedProjectCommands);
    }
  } else {
    // For visibility/global check: allowed if in global list OR in any project-specific list
    if (matchesHierarchicalCommand(normalizedCommandName, migratedAllowedCommands)) {
      return true;
    }

    const allowedInAnyProject = settings['allowed-jira-projects'].some(p => {
      if (typeof p !== 'string' && p.commands) {
        const migratedProjectCommands = migrateCommandNames(p.commands);
        return matchesHierarchicalCommand(normalizedCommandName, migratedProjectCommands);
      }
      return false;
    });
    if (allowedInAnyProject) {
      return true;
    }

    return false;
  }

  return matchesHierarchicalCommand(normalizedCommandName, migratedAllowedCommands);
}

export function isConfluenceSpaceAllowed(spaceKey: string, orgAlias?: string): boolean {
  const settings = getEffectiveSettings(orgAlias);
  if (!settings) return false;

  return settings['allowed-confluence-spaces'].some(s => s === 'all' || s === spaceKey);
}

export function getAllowedProjects(orgAlias?: string): ProjectSetting[] {
  const settings = getEffectiveSettings(orgAlias);
  return settings ? settings['allowed-jira-projects'] : [];
}

export function getAllowedCommands(orgAlias?: string): string[] {
  const settings = getEffectiveSettings(orgAlias);
  return settings ? settings['allowed-commands'] : [];
}

export function applyGlobalFilters(jql: string, orgAlias?: string): string {
  const settings = getEffectiveSettings(orgAlias);
  if (!settings) return jql;
  
  const allAllowed = settings['allowed-jira-projects'].some(p => p === 'all');
  if (allAllowed) {
    return jql;
  }

  // Handle ORDER BY
  let filterPart = jql;
  let orderByPart = '';
  const orderByMatch = jql.match(/(.*)\bORDER BY\b(.*)/i);
  if (orderByMatch) {
    filterPart = orderByMatch[1].trim();
    orderByPart = ` ORDER BY ${orderByMatch[2].trim()}`;
  }
  
  const projectFilters = settings['allowed-jira-projects'].map(p => {
    const key = typeof p === 'string' ? p : p.key;
    const projectJql = typeof p === 'string' ? null : p.filters?.jql;
    
    if (projectJql) {
      return `(project = "${key}" AND (${projectJql}))`;
    } else {
      return `project = "${key}"`;
    }
  });
  
  if (projectFilters.length === 0) {
    const filterJql = filterPart.trim() ? ` AND (${filterPart})` : '';
    return `project = "NONE"${filterJql}${orderByPart}`;
  }
  
  const combinedProjectFilter = projectFilters.join(' OR ');
  const filterJql = filterPart.trim() ? ` AND (${filterPart})` : '';
  return `(${combinedProjectFilter})${filterJql}${orderByPart}`;
}

export function validateIssueAgainstFilters(issue: any, currentUserId: string, orgAlias?: string): boolean {
  const settings = getEffectiveSettings(orgAlias);
  if (!settings) return false;

  const projectKey = issue.key.split('-')[0];
  
  // Find specific project config first
  let project = settings['allowed-jira-projects'].find(p => typeof p !== 'string' && p.key === projectKey);
  
  // If not found, look for string match (exact project key or 'all')
  if (!project) {
    project = settings['allowed-jira-projects'].find(p => typeof p === 'string' && (p === 'all' || p === projectKey));
  }

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
