import fs from 'fs';
import path from 'path';
import os from 'os';

export interface AuthCredentials {
  host: string;
  email: string;
  apiToken: string;
}

const CONFIG_DIR = path.join(os.homedir(), '.jira-ai');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

/**
 * Save credentials to local storage
 */
export function saveCredentials(creds: AuthCredentials): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }

  fs.writeFileSync(CONFIG_FILE, JSON.stringify(creds, null, 2), {
    mode: 0o600, // Read/write for owner only
  });
}

/**
 * Load credentials from local storage
 */
export function loadCredentials(): AuthCredentials | null {
  if (!fs.existsSync(CONFIG_FILE)) {
    return null;
  }

  try {
    const data = fs.readFileSync(CONFIG_FILE, 'utf8');
    return JSON.parse(data) as AuthCredentials;
  } catch (error) {
    return null;
  }
}

/**
 * Check if credentials exist
 */
export function hasCredentials(): boolean {
  return fs.existsSync(CONFIG_FILE);
}

/**
 * Clear stored credentials
 */
export function clearCredentials(): void {
  if (fs.existsSync(CONFIG_FILE)) {
    fs.unlinkSync(CONFIG_FILE);
  }
}
