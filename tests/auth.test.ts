import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { authCommand } from '../src/commands/auth.js';
import * as jiraClient from '../src/lib/jira-client.js';
import * as authStorage from '../src/lib/auth-storage.js';
import { CommandError } from '../src/lib/errors.js';
import fs from 'fs';

vi.mock('../src/lib/jira-client.js');
vi.mock('../src/lib/auth-storage.js');
vi.mock('fs');

describe('authCommand non-interactive error', () => {
  let consoleLogSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('should throw CommandError when called with no flags', async () => {
    await expect(authCommand({})).rejects.toThrow('Authentication credentials are required.');
    await expect(authCommand({})).rejects.toBeInstanceOf(CommandError);
  });

  it('should include hints when no credentials provided', async () => {
    try {
      await authCommand({});
    } catch (e: any) {
      expect(e).toBeInstanceOf(CommandError);
      expect(e.hints).toEqual(expect.arrayContaining([
        expect.stringContaining('--from-json'),
        expect.stringContaining('--from-file'),
      ]));
    }
  });

  it('should handle 401 error with hint', async () => {
    const validJson = JSON.stringify({
      url: 'https://test.atlassian.net',
      email: 'test@example.com',
      apikey: 'test-token'
    });

    const error401 = new Error('Unauthorized');
    (error401 as any).response = { status: 401 };
    
    const mockClient = {
      myself: {
        getCurrentUser: vi.fn().mockRejectedValue(error401)
      }
    };
    vi.mocked(jiraClient.createTemporaryClient).mockReturnValue(mockClient as any);

    try {
      await authCommand({ fromJson: validJson });
    } catch (e: any) {
      expect(e).toBeInstanceOf(CommandError);
      expect(e.hints).toContain('Check if your email and API token are correct.');
    }
  });

  it('should handle fromJson with host instead of url', async () => {
    const validJson = JSON.stringify({
      host: 'https://test.atlassian.net',
      email: 'test@example.com',
      apiToken: 'test-token'
    });

    const mockUser = { displayName: 'Test User', emailAddress: 'test@example.com' };
    const mockClient = {
      myself: {
        getCurrentUser: vi.fn().mockResolvedValue(mockUser)
      }
    };
    vi.mocked(jiraClient.createTemporaryClient).mockReturnValue(mockClient as any);

    await authCommand({ fromJson: validJson });

    expect(jiraClient.createTemporaryClient).toHaveBeenCalledWith(
      'https://test.atlassian.net',
      'test@example.com',
      'test-token',
      { authType: 'basic', cloudId: undefined }
    );
  });

  it('should handle fromFile with missing required variables', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('SOME_OTHER_VAR=value');

    await expect(authCommand({ fromFile: 'test.env' })).rejects.toThrow('Missing required environment variables in file.');
  });
  
  it('should handle fromFile with parsing error', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('Read error');
    });

    await expect(authCommand({ fromFile: 'test.env' })).rejects.toThrow('Failed to parse file: Read error');
  });
});
