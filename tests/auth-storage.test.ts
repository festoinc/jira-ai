import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, test } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const tempDir = path.join(__dirname, 'temp-home');

vi.mock('os', async () => {
  const actual = await vi.importActual('os');
  return {
    ...actual,
    homedir: () => tempDir,
  };
});

import {
  saveCredentials,
  loadCredentials,
  hasCredentials,
  clearCredentials,
} from '../src/lib/auth-storage.js';

describe('auth-storage', () => {
  beforeAll(() => {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }
  });

  afterAll(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    clearCredentials();
  });

  test('should save and load flat credentials', () => {
    const creds = {
      host: 'https://test.atlassian.net',
      email: 'test@example.com',
      apiToken: 'token123'
    };

    saveCredentials(creds);
    expect(hasCredentials()).toBe(true);

    const loaded = loadCredentials();
    expect(loaded).toEqual(creds);
  });

  test('should save and load credentials with optional fields', () => {
    const creds = {
      host: 'https://test.atlassian.net',
      email: 'test@example.com',
      apiToken: 'token123',
      authType: 'service_account' as const,
      cloudId: 'cloud-123'
    };

    saveCredentials(creds);
    const loaded = loadCredentials();
    expect(loaded).toEqual(creds);
  });

  test('should return null if no credentials exist', () => {
    expect(loadCredentials()).toBeNull();
    expect(hasCredentials()).toBe(false);
  });

  test('should clear credentials', () => {
    const creds = {
      host: 'https://test.atlassian.net',
      email: 'test@example.com',
      apiToken: 'token123'
    };

    saveCredentials(creds);
    expect(hasCredentials()).toBe(true);

    clearCredentials();

    expect(hasCredentials()).toBe(false);
    expect(loadCredentials()).toBeNull();
  });

  test('should read flat config without migration', () => {
    const configDir = path.join(os.homedir(), '.jira-ai');
    const configFile = path.join(configDir, 'config.json');

    const config = {
      host: 'https://test-org.atlassian.net',
      email: 'old@example.com',
      apiToken: 'old-token'
    };

    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(configFile, JSON.stringify(config));

    expect(hasCredentials()).toBe(true);

    const loaded = loadCredentials();
    expect(loaded).toEqual({
      host: 'https://test-org.atlassian.net',
      email: 'old@example.com',
      apiToken: 'old-token'
    });
  });

  test('should handle corrupted config file', () => {
    const configDir = path.join(os.homedir(), '.jira-ai');
    const configFile = path.join(configDir, 'config.json');

    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(configFile, 'invalid json');

    expect(hasCredentials()).toBe(false);
  });

  test('saveCredentials overwrites previous credentials', () => {
    const creds1 = {
      host: 'https://first.atlassian.net',
      email: 'first@example.com',
      apiToken: 'token1'
    };
    const creds2 = {
      host: 'https://second.atlassian.net',
      email: 'second@example.com',
      apiToken: 'token2'
    };

    saveCredentials(creds1);
    saveCredentials(creds2);

    const loaded = loadCredentials();
    expect(loaded).toEqual(creds2);
  });
});
