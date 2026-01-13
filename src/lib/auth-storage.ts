import fs from 'fs';
import path from 'path';
import os from 'os';

export interface AuthCredentials {
  host: string;
  email: string;
  apiToken: string;
}

export interface Config {
  current?: string;
  organizations: Record<string, AuthCredentials>;
}

const CONFIG_DIR = path.join(os.homedir(), '.jira-ai');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

/**
 * Extract default alias from Jira host
 */
export function extractAliasFromHost(host: string): string {
  try {
    const url = new URL(host.startsWith('http') ? host : `https://${host}`);
    const hostname = url.hostname;
    const parts = hostname.split('.');
    // For xxxx.atlassian.net
    if (parts.length >= 3 && parts[parts.length - 1] === 'net' && parts[parts.length - 2] === 'atlassian') {
      return parts[0];
    }
    return hostname;
  } catch {
    return host.replace(/https?:\/\//, '').split(/[./]/)[0] || 'default';
  }
}

function loadConfig(): Config {
  if (!fs.existsSync(CONFIG_FILE)) {
    return { organizations: {} };
  }

  try {
    const data = fs.readFileSync(CONFIG_FILE, 'utf8');
    const parsed = JSON.parse(data);

    // Migration logic for old format
    if (parsed.host && parsed.email && parsed.apiToken) {
      const alias = extractAliasFromHost(parsed.host);
      return {
        current: alias,
        organizations: {
          [alias]: {
            host: parsed.host,
            email: parsed.email,
            apiToken: parsed.apiToken,
          },
        },
      };
    }

    return parsed as Config;
  } catch (error) {
    return { organizations: {} };
  }
}

function saveConfig(config: Config): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }

  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), {
    mode: 0o600, // Read/write for owner only
  });
}

/**
 * Save credentials to local storage
 */
export function saveCredentials(creds: AuthCredentials, alias?: string): void {
  const config = loadConfig();
  const effectiveAlias = alias || extractAliasFromHost(creds.host);
  
  config.organizations[effectiveAlias] = creds;
  if (!config.current) {
    config.current = effectiveAlias;
  }
  
  saveConfig(config);
}

/**
 * Load credentials from local storage
 */
export function loadCredentials(alias?: string): AuthCredentials | null {
  const config = loadConfig();
  const targetAlias = alias || config.current;
  
  if (!targetAlias || !config.organizations[targetAlias]) {
    return null;
  }
  
  return config.organizations[targetAlias];
}

/**
 * Check if credentials exist
 */
export function hasCredentials(): boolean {
  const config = loadConfig();
  return Object.keys(config.organizations).length > 0;
}

/**
 * Clear stored credentials
 */
export function clearCredentials(): void {
  if (fs.existsSync(CONFIG_FILE)) {
    fs.unlinkSync(CONFIG_FILE);
  }
}

/**
 * Save organization credentials
 */
export function saveOrganization(alias: string, creds: AuthCredentials): void {
  saveCredentials(creds, alias);
}

/**
 * Switch the active organization
 */
export function useOrganization(alias: string): void {
  const config = loadConfig();
  if (!config.organizations[alias]) {
    throw new Error(`Organization "${alias}" not found.`);
  }
  config.current = alias;
  saveConfig(config);
}

/**
 * Alias for useOrganization to match test expectations
 */
export function setCurrentOrganization(alias: string): void {
  useOrganization(alias);
}

/**
 * Remove an organization's credentials
 */
export function removeOrganization(alias: string): void {
  const config = loadConfig();
  if (config.organizations[alias]) {
    delete config.organizations[alias];
    if (config.current === alias) {
      config.current = Object.keys(config.organizations)[0];
    }
    saveConfig(config);
  }
}

/**
 * Get all saved organizations
 */
export function getOrganizations(): Record<string, AuthCredentials> {
  const config = loadConfig();
  return config.organizations;
}

/**
 * Get the currently active organization alias
 */
export function getCurrentOrganizationAlias(): string | undefined {
  const config = loadConfig();
  return config.current;
}