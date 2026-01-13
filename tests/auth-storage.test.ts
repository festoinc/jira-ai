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

// Now import the module under test
import { 
  saveCredentials, 
  loadCredentials, 
  hasCredentials, 
  clearCredentials,
  useOrganization,
  removeOrganization,
  getCurrentOrganizationAlias,
  extractAliasFromHost
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

  test('should save and load credentials', () => {
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

    

      test('should handle organization switch and removal', () => {

        const creds1 = { host: 'https://org1.atlassian.net', email: 'e1', apiToken: 't1' };

        const creds2 = { host: 'https://org2.atlassian.net', email: 'e2', apiToken: 't2' };

    

            saveCredentials(creds1, 'org1');

    

            saveCredentials(creds2, 'org2');

    

        

    

            expect(getCurrentOrganizationAlias()).toBe('org1');

    

        

        

        useOrganization('org2');

        expect(getCurrentOrganizationAlias()).toBe('org2');

        expect(loadCredentials()).toEqual(creds2);

    

        expect(() => useOrganization('non-existent')).toThrow('Organization "non-existent" not found.');

    

            removeOrganization('org2');

    

            expect(getCurrentOrganizationAlias()).toBe('org1');

    

            expect(loadCredentials()).toEqual(creds1);

    

        

    

            useOrganization('org1');

    

                removeOrganization('org1');

    

                expect(hasCredentials()).toBe(false);

    

            

    

                // Remove non-existent

    

                removeOrganization('non-existent');

    

              });

    

            

    

        

    

        test('should handle old config format migration', () => {

    

          const configDir = path.join(os.homedir(), '.jira-ai');

    

          const configFile = path.join(configDir, 'config.json');

    

          const oldConfig = {

    

            host: 'https://test-org.atlassian.net',

    

            email: 'old@example.com',

    

            apiToken: 'old-token'

    

          };

    

      

    

          if (!fs.existsSync(configDir)) {

    

            fs.mkdirSync(configDir, { recursive: true });

    

          }

    

              fs.writeFileSync(configFile, JSON.stringify(oldConfig));

    

          

    

              expect(fs.existsSync(configFile)).toBe(true);

    

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

    

      

    

      

    

      

    

            test('should handle invalid host in extractAliasFromHost', () => {

    

      

    

      

    

      

    

              // This is hard to trigger with new URL() as it accepts many things

    

      

    

      

    

      

    

              // but we can try something that definitely fails or just call it directly if exported

    

      

    

      

    

      

    

              expect(extractAliasFromHost('!!!')).toBe('!!!');

    

      

    

      

    

      

    

              expect(extractAliasFromHost('')).toBe('default');

    

      

    

      

    

      

    

            });

    

      

    

      

    

      

    

          

    

      

    

      

    

      

    

        

    

      

    

      });

    

      

    

      

    