import fs from 'fs';
import path from 'path';
import os from 'node:os';
import chalk from 'chalk';
import { getVersion } from './utils.js';

const CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

interface Cache {
  lastCheck: number;
  latestVersion: string;
}

/**
 * Fetch the latest version from npm registry
 */
export async function getLatestVersion(): Promise<string | null> {
  try {
    const response = await fetch('https://registry.npmjs.org/jira-ai/latest');
    if (!response.ok) return null;
    const data = await response.json() as { version: string };
    return data.version;
  } catch (error) {
    return null;
  }
}

/**
 * Check if an update is available, using a 24-hour cache
 */
export async function checkForUpdate(homedir: string = os.homedir()): Promise<string | null> {
  const currentVersion = getVersion();
  const configDir = path.join(homedir, '.jira-ai');
  const cacheFile = path.join(configDir, 'cache.json');
  let cache: Cache = { lastCheck: 0, latestVersion: '' };

  if (fs.existsSync(cacheFile)) {
    try {
      cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    } catch (e) {
      // Ignore cache read errors
    }
  }

  const now = Date.now();
  if (now - cache.lastCheck < CHECK_INTERVAL && cache.latestVersion) {
    return isNewer(cache.latestVersion, currentVersion) ? cache.latestVersion : null;
  }

  const latestVersion = await getLatestVersion();
  if (latestVersion) {
    cache = { lastCheck: now, latestVersion };
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(cacheFile, JSON.stringify(cache));
    
    return isNewer(latestVersion, currentVersion) ? latestVersion : null;
  }

  return null;
}

/**
 * Check for update in cache synchronously (does not fetch)
 */
export function checkForUpdateSync(homedir: string = os.homedir()): string | null {
  const currentVersion = getVersion();
  const configDir = path.join(homedir, '.jira-ai');
  const cacheFile = path.join(configDir, 'cache.json');

  if (fs.existsSync(cacheFile)) {
    try {
      const cache: Cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      if (cache.latestVersion && isNewer(cache.latestVersion, currentVersion)) {
        return cache.latestVersion;
      }
    } catch (e) {
      // Ignore cache read errors
    }
  }

  return null;
}

/**
 * Simple semver comparison (latest > current)
 */
function isNewer(latest: string, current: string): boolean {
  const latestParts = latest.split('.').map(v => parseInt(v, 10));
  const currentParts = current.split('.').map(v => parseInt(v, 10));

  for (let i = 0; i < 3; i++) {
    const l = latestParts[i] || 0;
    const c = currentParts[i] || 0;
    if (l > c) return true;
    if (l < c) return false;
  }
  return false;
}

/**
 * Format the update message with colors
 */
export function formatUpdateMessage(latestVersion: string): string {
  const currentVersion = getVersion();
  return chalk.yellow(`Update available: ${chalk.green(latestVersion)} (current: ${currentVersion}). Run 'npm install -g jira-ai' to update.`);
}