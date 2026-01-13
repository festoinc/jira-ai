import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { authCommand } from '../src/commands/auth.js';
import * as jiraClient from '../src/lib/jira-client.js';
import * as authStorage from '../src/lib/auth-storage.js';
import { CommandError } from '../src/lib/errors.js';
import * as ui from '../src/lib/ui.js';
import readline from 'readline';
import fs from 'fs';
import chalk from 'chalk';

vi.mock('../src/lib/jira-client.js');
vi.mock('../src/lib/auth-storage.js');
vi.mock('../src/lib/ui.js');
vi.mock('readline');
vi.mock('fs');

describe('authCommand interactive', () => {
  let consoleLogSpy: any;
  let rlMock: any;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    rlMock = {
      question: vi.fn(),
      close: vi.fn(),
    };
    vi.mocked(readline.createInterface).mockReturnValue(rlMock);
    
    vi.mocked(ui.ui.startSpinner).mockImplementation(() => {});
    vi.mocked(ui.ui.succeedSpinner).mockImplementation(() => {});
    vi.mocked(ui.ui.failSpinner).mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('should successfully authenticate interactively', async () => {
    rlMock.question
      .mockImplementationOnce((q: string, cb: any) => cb('https://test.atlassian.net'))
      .mockImplementationOnce((q: string, cb: any) => cb('test@example.com'))
      .mockImplementationOnce((q: string, cb: any) => cb('test-token'));

    const mockUser = { displayName: 'Test User', emailAddress: 'test@example.com' };
    const mockClient = {
      myself: {
        getCurrentUser: vi.fn().mockResolvedValue(mockUser)
      }
    };
    vi.mocked(jiraClient.createTemporaryClient).mockReturnValue(mockClient as any);

    await authCommand({});

    expect(rlMock.question).toHaveBeenCalledTimes(3);
    expect(jiraClient.createTemporaryClient).toHaveBeenCalledWith(
      'https://test.atlassian.net',
      'test@example.com',
      'test-token'
    );
    expect(authStorage.saveCredentials).toHaveBeenCalled();
    expect(rlMock.close).toHaveBeenCalled();
  });

  it('should throw error if URL is missing in interactive mode', async () => {
    rlMock.question.mockImplementationOnce((q: string, cb: any) => cb(''));

    await expect(authCommand({})).rejects.toThrow('URL is required.');
    expect(rlMock.close).toHaveBeenCalled();
  });

  it('should throw error if Email is missing in interactive mode', async () => {
    rlMock.question
      .mockImplementationOnce((q: string, cb: any) => cb('https://test.atlassian.net'))
      .mockImplementationOnce((q: string, cb: any) => cb(''));

    await expect(authCommand({})).rejects.toThrow('Email is required.');
    expect(rlMock.close).toHaveBeenCalled();
  });

  it('should throw error if API Token is missing in interactive mode', async () => {
    rlMock.question
      .mockImplementationOnce((q: string, cb: any) => cb('https://test.atlassian.net'))
      .mockImplementationOnce((q: string, cb: any) => cb('test@example.com'))
      .mockImplementationOnce((q: string, cb: any) => cb(''));

    await expect(authCommand({})).rejects.toThrow('API Token is required.');
    expect(rlMock.close).toHaveBeenCalled();
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
      'test-token'
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
