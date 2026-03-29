import fs from 'fs';
import path from 'path';
import os from 'os';

export interface AuthCredentials {
  host: string;
  email: string;
  apiToken: string;
  authType?: 'basic' | 'service_account';
  cloudId?: string;
}

export interface Config {
  host?: string;
  email?: string;
  apiToken?: string;
  authType?: 'basic' | 'service_account';
  cloudId?: string;
}

const CONFIG_DIR = path.join(os.homedir(), '.jira-ai');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

function loadConfig(): Config {
  if (!fs.existsSync(CONFIG_FILE)) {
    return {};
  }

  try {
    const data = fs.readFileSync(CONFIG_FILE, 'utf8');
    const parsed = JSON.parse(data);

    if (parsed.host && parsed.email && parsed.apiToken) {
      return {
        host: parsed.host,
        email: parsed.email,
        apiToken: parsed.apiToken,
        authType: parsed.authType,
        cloudId: parsed.cloudId,
      };
    }

    return parsed as Config;
  } catch {
    return {};
  }
}

function saveConfig(config: Config): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }

  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), {
    mode: 0o600,
  });
}

export function saveCredentials(creds: AuthCredentials): void {
  saveConfig({
    host: creds.host,
    email: creds.email,
    apiToken: creds.apiToken,
    authType: creds.authType,
    cloudId: creds.cloudId,
  });
}

export function loadCredentials(): AuthCredentials | null {
  const config = loadConfig();

  if (config.host && config.email && config.apiToken) {
    return {
      host: config.host,
      email: config.email,
      apiToken: config.apiToken,
      authType: config.authType,
      cloudId: config.cloudId,
    };
  }

  return null;
}

export function hasCredentials(): boolean {
  const config = loadConfig();
  return !!(config.host && config.email && config.apiToken);
}

export function clearCredentials(): void {
  if (fs.existsSync(CONFIG_FILE)) {
    fs.unlinkSync(CONFIG_FILE);
  }
}
