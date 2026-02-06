import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { authCommand } from '../src/commands/auth.js';
import * as jiraClient from '../src/lib/jira-client.js';
import * as authStorage from '../src/lib/auth-storage.js';
import { CommandError } from '../src/lib/errors.js';
import * as ui from '../src/lib/ui.js';
import readline from 'readline';
import fs from 'fs';

vi.mock('../src/lib/jira-client.js');
vi.mock('../src/lib/auth-storage.js');
vi.mock('../src/lib/ui.js');
vi.mock('readline');
vi.mock('fs');

describe('Service Account Authentication', () => {
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

  it('should pass authType basic and cloudId undefined when serviceAccount is not set', async () => {
    const validJson = JSON.stringify({
      url: 'https://test.atlassian.net',
      email: 'test@example.com',
      apikey: 'test-token'
    });

    const mockUser = { displayName: 'Test User', emailAddress: 'test@example.com' };
    const mockClient = {
      myself: { getCurrentUser: vi.fn().mockResolvedValue(mockUser) }
    };
    vi.mocked(jiraClient.createTemporaryClient).mockReturnValue(mockClient as any);

    await authCommand({ fromJson: validJson });

    expect(jiraClient.createTemporaryClient).toHaveBeenCalledWith(
      'https://test.atlassian.net',
      'test@example.com',
      'test-token',
      { authType: 'basic', cloudId: undefined }
    );
    expect(authStorage.saveCredentials).toHaveBeenCalledWith(
      expect.objectContaining({ authType: 'basic', cloudId: undefined }),
      undefined
    );
  });

  it('should pass authType service_account with explicit cloudId', async () => {
    const validJson = JSON.stringify({
      url: 'https://test.atlassian.net',
      email: 'bot@example.com',
      apikey: 'service-token'
    });

    const mockUser = { displayName: 'Bot User', emailAddress: 'bot@example.com' };
    const mockClient = {
      myself: { getCurrentUser: vi.fn().mockResolvedValue(mockUser) }
    };
    vi.mocked(jiraClient.createTemporaryClient).mockReturnValue(mockClient as any);

    await authCommand({ fromJson: validJson, serviceAccount: true, cloudId: 'cloud-123' });

    expect(jiraClient.createTemporaryClient).toHaveBeenCalledWith(
      'https://test.atlassian.net',
      'bot@example.com',
      'service-token',
      { authType: 'service_account', cloudId: 'cloud-123' }
    );
    expect(authStorage.saveCredentials).toHaveBeenCalledWith(
      expect.objectContaining({
        authType: 'service_account',
        cloudId: 'cloud-123'
      }),
      undefined
    );
  });

  it('should auto-discover cloudId when serviceAccount is set without cloudId', async () => {
    const validJson = JSON.stringify({
      url: 'https://test.atlassian.net',
      email: 'bot@example.com',
      apikey: 'service-token'
    });

    // Mock fetch for cloud ID discovery
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ cloudId: 'discovered-cloud-id' })
    });
    vi.stubGlobal('fetch', mockFetch);

    const mockUser = { displayName: 'Bot User', emailAddress: 'bot@example.com' };
    const mockClient = {
      myself: { getCurrentUser: vi.fn().mockResolvedValue(mockUser) }
    };
    vi.mocked(jiraClient.createTemporaryClient).mockReturnValue(mockClient as any);

    await authCommand({ fromJson: validJson, serviceAccount: true });

    expect(mockFetch).toHaveBeenCalledWith('https://test.atlassian.net/_edge/tenant_info');
    expect(jiraClient.createTemporaryClient).toHaveBeenCalledWith(
      'https://test.atlassian.net',
      'bot@example.com',
      'service-token',
      { authType: 'service_account', cloudId: 'discovered-cloud-id' }
    );
    expect(authStorage.saveCredentials).toHaveBeenCalledWith(
      expect.objectContaining({ cloudId: 'discovered-cloud-id' }),
      undefined
    );

    vi.unstubAllGlobals();
  });

  it('should throw CommandError when cloud ID discovery fails with HTTP error', async () => {
    const validJson = JSON.stringify({
      url: 'https://test.atlassian.net',
      email: 'bot@example.com',
      apikey: 'service-token'
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(authCommand({ fromJson: validJson, serviceAccount: true }))
      .rejects.toThrow(CommandError);

    vi.unstubAllGlobals();
  });

  it('should throw CommandError when tenant_info has no cloudId', async () => {
    const validJson = JSON.stringify({
      url: 'https://test.atlassian.net',
      email: 'bot@example.com',
      apikey: 'service-token'
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({})
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(authCommand({ fromJson: validJson, serviceAccount: true }))
      .rejects.toThrow(CommandError);

    vi.unstubAllGlobals();
  });

  it('should read JIRA_AUTH_TYPE and JIRA_CLOUD_ID from .env file', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      'JIRA_HOST=https://test.atlassian.net\n' +
      'JIRA_USER_EMAIL=bot@example.com\n' +
      'JIRA_API_TOKEN=service-token\n' +
      'JIRA_AUTH_TYPE=service_account\n' +
      'JIRA_CLOUD_ID=env-cloud-id\n'
    );

    const mockUser = { displayName: 'Bot User', emailAddress: 'bot@example.com' };
    const mockClient = {
      myself: { getCurrentUser: vi.fn().mockResolvedValue(mockUser) }
    };
    vi.mocked(jiraClient.createTemporaryClient).mockReturnValue(mockClient as any);

    await authCommand({ fromFile: 'test.env' });

    expect(jiraClient.createTemporaryClient).toHaveBeenCalledWith(
      'https://test.atlassian.net',
      'bot@example.com',
      'service-token',
      { authType: 'service_account', cloudId: 'env-cloud-id' }
    );
    expect(authStorage.saveCredentials).toHaveBeenCalledWith(
      expect.objectContaining({
        authType: 'service_account',
        cloudId: 'env-cloud-id'
      }),
      undefined
    );
  });

  it('should include service account hint on 401 error', async () => {
    const validJson = JSON.stringify({
      url: 'https://test.atlassian.net',
      email: 'bot@example.com',
      apikey: 'service-token'
    });

    const error401 = new Error('Unauthorized');
    (error401 as any).response = { status: 401 };

    const mockClient = {
      myself: { getCurrentUser: vi.fn().mockRejectedValue(error401) }
    };
    vi.mocked(jiraClient.createTemporaryClient).mockReturnValue(mockClient as any);

    try {
      await authCommand({ fromJson: validJson, serviceAccount: true, cloudId: 'cloud-123' });
    } catch (e: any) {
      expect(e).toBeInstanceOf(CommandError);
      expect(e.hints).toContain('Check if your email and API token are correct.');
      expect(e.hints).toContain('Service accounts require the api.atlassian.com gateway. Verify your Cloud ID is correct.');
    }
  });

  it('should log service account auth type on successful auth', async () => {
    const validJson = JSON.stringify({
      url: 'https://test.atlassian.net',
      email: 'bot@example.com',
      apikey: 'service-token'
    });

    const mockUser = { displayName: 'Bot User', emailAddress: 'bot@example.com' };
    const mockClient = {
      myself: { getCurrentUser: vi.fn().mockResolvedValue(mockUser) }
    };
    vi.mocked(jiraClient.createTemporaryClient).mockReturnValue(mockClient as any);

    await authCommand({ fromJson: validJson, serviceAccount: true, cloudId: 'cloud-123' });

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('service_account')
    );
  });
});
