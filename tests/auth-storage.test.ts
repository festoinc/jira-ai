import fs from 'fs';
import path from 'path';
import os from 'os';

// Mock os.homedir()
const tempDir = path.join(__dirname, 'temp-home');
const homedirSpy = jest.spyOn(os, 'homedir').mockReturnValue(tempDir);

// Now import the module under test
import { saveCredentials, loadCredentials, hasCredentials, clearCredentials } from '../src/lib/auth-storage';

describe('auth-storage', () => {
  beforeAll(() => {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }
  });

  afterAll(() => {
    homedirSpy.mockRestore();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    clearCredentials();
  });
// ...

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
});
