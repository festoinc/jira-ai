import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, test } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mock os.homedir()
const tempDir = path.join(__dirname, 'temp-home-multi');
const homedirSpy = vi.spyOn(os, 'homedir').mockReturnValue(tempDir);

// Now import the module under test
let authStorage: any;

describe('auth-storage multi-org', () => {
  beforeAll(async () => {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }
    authStorage = await import('../src/lib/auth-storage.js');
  });

  afterAll(() => {
    homedirSpy.mockRestore();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    authStorage.clearCredentials();
  });

  test('should handle multiple organizations', () => {
    const creds1 = {
      host: 'https://org1.atlassian.net',
      email: 'user1@example.com',
      apiToken: 'token1'
    };
    const creds2 = {
      host: 'https://org2.atlassian.net',
      email: 'user2@example.com',
      apiToken: 'token2'
    };

    // @ts-ignore - we will add these functions
    authStorage.saveOrganization('org1', creds1);
    // @ts-ignore
    authStorage.saveOrganization('org2', creds2);

    // @ts-ignore
    expect(authStorage.getCurrentOrganizationAlias()).toBe('org1'); // First one added becomes current if none set? Or we set it explicitly.
    
    // @ts-ignore
    authStorage.setCurrentOrganization('org2');
    // @ts-ignore
    expect(authStorage.getCurrentOrganizationAlias()).toBe('org2');
    expect(authStorage.loadCredentials()).toEqual(creds2);

    // @ts-ignore
    const orgs = authStorage.getOrganizations();
    expect(orgs).toHaveProperty('org1');
    expect(orgs).toHaveProperty('org2');
    expect(orgs.org1).toEqual(creds1);
  });

  test('should migrate old config format', () => {
    const oldCreds = {
      host: 'https://old.atlassian.net',
      email: 'old@example.com',
      apiToken: 'old-token'
    };

    const configDir = path.join(tempDir, '.jira-ai');
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(path.join(configDir, 'config.json'), JSON.stringify(oldCreds));

    const loaded = authStorage.loadCredentials();
    expect(loaded).toEqual(oldCreds);

    // @ts-ignore
    expect(authStorage.getCurrentOrganizationAlias()).toBe('old'); // extracted from host
  });
});
