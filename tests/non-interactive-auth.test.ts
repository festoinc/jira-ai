import { vi, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, test } from 'vitest';
import { authCommand } from '../src/commands/auth.js';
import * as jiraClient from '../src/lib/jira-client.js';
import * as authStorage from '../src/lib/auth-storage.js';
import ora from 'ora';
import fs from 'fs';
import path from 'path';

vi.mock('ora');
vi.mock('../src/lib/jira-client.js');
vi.mock('../src/lib/auth-storage.js');
vi.mock('readline', () => ({
  default: {
    createInterface: vi.fn().mockReturnValue({
      question: vi.fn(),
      close: vi.fn(),
    }),
  }
}));

describe('authCommand non-interactive', () => {
  let mockSpinner: any;
  let exitSpy: vi.SpyInstance;
  let consoleSpy: vi.SpyInstance;
  let errorSpy: vi.SpyInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSpinner = {
      start: vi.fn().mockReturnThis(),
      succeed: vi.fn().mockReturnThis(),
      fail: vi.fn().mockReturnThis(),
    };
    (ora as unknown as vi.Mock).mockReturnValue(mockSpinner);
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: number | string | null | undefined) => {
        throw new Error(`process.exit: ${code}`);
    });
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    exitSpy.mockRestore();
    consoleSpy.mockRestore();
    errorSpy.mockRestore();
    if (fs.existsSync('test.env')) {
        fs.unlinkSync('test.env');
    }
  });

  it('should authenticate using --from-json with valid data', async () => {
    const validJson = JSON.stringify({
      url: 'https://test.atlassian.net',
      email: 'test@example.com',
      apikey: 'test-token'
    });

    const mockUser = { displayName: 'Test User', emailAddress: 'test@example.com' };
    const mockClient = {
      myself: {
        getCurrentUser: vi.fn().mockResolvedValue(mockUser)
      }
    };
    (jiraClient.createTemporaryClient as vi.Mock).mockReturnValue(mockClient);

    await authCommand({ fromJson: validJson });

    expect(jiraClient.createTemporaryClient).toHaveBeenCalledWith(
      'https://test.atlassian.net',
      'test@example.com',
      'test-token'
    );
    expect(authStorage.saveCredentials).toHaveBeenCalledWith({
      host: 'https://test.atlassian.net',
      email: 'test@example.com',
      apiToken: 'test-token'
    });
    expect(mockSpinner.succeed).toHaveBeenCalled();
  });

  it('should authenticate using --from-file with valid .env file', async () => {
    const envContent = `
JIRA_HOST=https://file.atlassian.net
JIRA_USER_EMAIL=file@example.com
JIRA_API_TOKEN=file-token
`;
    fs.writeFileSync('test.env', envContent);

    const mockUser = { displayName: 'File User', emailAddress: 'file@example.com' };
    const mockClient = {
      myself: {
        getCurrentUser: vi.fn().mockResolvedValue(mockUser)
      }
    };
    (jiraClient.createTemporaryClient as vi.Mock).mockReturnValue(mockClient);

    await authCommand({ fromFile: 'test.env' });

    expect(jiraClient.createTemporaryClient).toHaveBeenCalledWith(
      'https://file.atlassian.net',
      'file@example.com',
      'file-token'
    );
    expect(authStorage.saveCredentials).toHaveBeenCalledWith({
      host: 'https://file.atlassian.net',
      email: 'file@example.com',
      apiToken: 'file-token'
    });
  });

  it('should fail when --from-json has invalid JSON', async () => {
    await expect(authCommand({ fromJson: '{ invalid json }' }))
        .rejects.toThrow('process.exit: 1');
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid JSON'));
  });

  it('should fail when --from-json is missing fields', async () => {
    const incompleteJson = JSON.stringify({
      url: 'https://test.atlassian.net'
      // email and apikey missing
    });

    await expect(authCommand({ fromJson: incompleteJson }))
        .rejects.toThrow('process.exit: 1');
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Missing required fields'));
  });

  it('should fail when --from-file points to non-existent file', async () => {
    await expect(authCommand({ fromFile: 'non-existent.env' }))
        .rejects.toThrow('process.exit: 1');
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('File not found'));
  });

  it('should fail when authentication fails', async () => {
    const validJson = JSON.stringify({
      url: 'https://test.atlassian.net',
      email: 'test@example.com',
      apikey: 'test-token'
    });

    const mockClient = {
      myself: {
        getCurrentUser: vi.fn().mockRejectedValue(new Error('Unauthorized'))
      }
    };
    (jiraClient.createTemporaryClient as vi.Mock).mockReturnValue(mockClient);

    await expect(authCommand({ fromJson: validJson }))
        .rejects.toThrow('process.exit: 1');
    expect(mockSpinner.fail).toHaveBeenCalledWith(expect.stringContaining('Authentication failed'));
  });
});
