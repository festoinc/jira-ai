import { authCommand } from '../src/commands/auth';
import * as jiraClient from '../src/lib/jira-client';
import * as authStorage from '../src/lib/auth-storage';
import ora from 'ora';
import fs from 'fs';
import path from 'path';

jest.mock('ora');
jest.mock('../src/lib/jira-client');
jest.mock('../src/lib/auth-storage');
jest.mock('readline', () => ({
  createInterface: jest.fn().mockReturnValue({
    question: jest.fn(),
    close: jest.fn(),
  }),
}));

describe('authCommand non-interactive', () => {
  let mockSpinner: any;
  let exitSpy: jest.SpyInstance;
  let consoleSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSpinner = {
      start: jest.fn().mockReturnThis(),
      succeed: jest.fn().mockReturnThis(),
      fail: jest.fn().mockReturnThis(),
    };
    (ora as unknown as jest.Mock).mockReturnValue(mockSpinner);
    exitSpy = jest.spyOn(process, 'exit').mockImplementation((code?: number | string | null | undefined) => {
        throw new Error(`process.exit: ${code}`);
    });
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
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
        getCurrentUser: jest.fn().mockResolvedValue(mockUser)
      }
    };
    (jiraClient.createTemporaryClient as jest.Mock).mockReturnValue(mockClient);

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
        getCurrentUser: jest.fn().mockResolvedValue(mockUser)
      }
    };
    (jiraClient.createTemporaryClient as jest.Mock).mockReturnValue(mockClient);

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
        getCurrentUser: jest.fn().mockRejectedValue(new Error('Unauthorized'))
      }
    };
    (jiraClient.createTemporaryClient as jest.Mock).mockReturnValue(mockClient);

    await expect(authCommand({ fromJson: validJson }))
        .rejects.toThrow('process.exit: 1');
    expect(mockSpinner.fail).toHaveBeenCalledWith(expect.stringContaining('Authentication failed'));
  });
});
