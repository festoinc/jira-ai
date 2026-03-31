import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import { initJsonMode } from '../src/lib/json-mode.js';
import * as jiraClient from '../src/lib/jira-client.js';
import * as settings from '../src/lib/settings.js';

vi.mock('../src/lib/jira-client.js');
vi.mock('../src/lib/settings.js');
vi.mock('../src/lib/auth-storage.js', () => ({ hasCredentials: vi.fn(() => true) }));
vi.mock('../src/lib/update-check.js', () => ({
  checkForUpdate: vi.fn().mockResolvedValue(null),
  checkForUpdateSync: vi.fn().mockReturnValue(null),
  formatUpdateMessage: vi.fn().mockReturnValue(''),
}));

const mockJiraClient = jiraClient as vi.Mocked<typeof jiraClient>;
const mockSettings = settings as vi.Mocked<typeof settings>;

describe('JSON output integration tests', () => {
  let originalArgv: string[];
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  const mockUser = {
    accountId: 'user-1',
    displayName: 'Alice Smith',
    emailAddress: 'alice@example.com',
    active: true,
    accountType: 'atlassian',
  };

  const mockTask = {
    id: '10001',
    key: 'TEST-1',
    summary: 'Test issue',
    status: { name: 'In Progress', id: '3' },
    description: 'Test description',
    assignee: { accountId: 'user-1', displayName: 'Alice Smith' },
    reporter: { accountId: 'user-2', displayName: 'Bob Jones' },
    created: '2024-01-01T00:00:00.000Z',
    updated: '2024-01-10T00:00:00.000Z',
    labels: [],
    comments: [],
    subtasks: [],
    parent: null,
  };

  const mockProjects = [
    { id: '1001', key: 'TEST', name: 'Test Project', projectTypeKey: 'software', lead: { displayName: 'Alice Smith' } },
  ];

  const mockEpics = [
    {
      id: '10002',
      key: 'TEST-2',
      name: 'Epic One',
      summary: 'First epic',
      status: 'In Progress',
      statusCategory: 'in_progress',
      projectId: '1001',
      projectKey: 'TEST',
      description: null,
      assignee: null,
      reporter: null,
      created: '2024-01-01T00:00:00.000Z',
      updated: '2024-01-10T00:00:00.000Z',
      labels: [],
    },
  ];

  const mockJqlIssues = [
    { key: 'TEST-3', fields: { summary: 'JQL Issue One', status: { name: 'Open' } } },
    { key: 'TEST-4', fields: { summary: 'JQL Issue Two', status: { name: 'Done' } } },
  ];

  beforeEach(() => {
    originalArgv = process.argv;
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);

    mockSettings.isCommandAllowed.mockReturnValue(true);
    mockSettings.isProjectAllowed.mockReturnValue(true);
    mockSettings.getAllowedProjects.mockReturnValue(['all']);
    mockSettings.isProjectAllowed.mockReturnValue(true);
    mockSettings.validateIssueAgainstFilters.mockReturnValue(true);

    mockJiraClient.getCurrentUser.mockResolvedValue(mockUser);
    mockJiraClient.validateIssuePermissions.mockResolvedValue(mockTask as any);
    mockJiraClient.getProjects.mockResolvedValue(mockProjects as any);
    mockJiraClient.getEpics.mockResolvedValue(mockEpics as any);
    mockJiraClient.searchIssuesByJql.mockResolvedValue(mockJqlIssues as any);
    mockJiraClient.createIssue.mockResolvedValue({ key: 'TEST-99', id: '10099' });
  });

  afterEach(() => {
    process.argv = originalArgv;
    vi.restoreAllMocks();
  });

  describe('me command with --json flag', () => {
    it('should output valid JSON containing user data', async () => {
      process.argv = ['node', 'jira-ai', 'me', '--json'];
      initJsonMode();

      const { meCommand } = await import('../src/commands/me.js');
      await meCommand();

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];
      expect(() => JSON.parse(output)).not.toThrow();

      const parsed = JSON.parse(output);
      expect(parsed).toHaveProperty('accountId', mockUser.accountId);
      expect(parsed).toHaveProperty('displayName', mockUser.displayName);
    });
  });

  describe('project list with --json flag', () => {
    it('should output valid JSON array of projects', async () => {
      process.argv = ['node', 'jira-ai', 'project', 'list', '--json'];
      initJsonMode();

      const { projectsCommand } = await import('../src/commands/projects.js');
      await projectsCommand();

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];
      expect(() => JSON.parse(output)).not.toThrow();

      const parsed = JSON.parse(output);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0]).toHaveProperty('key', 'TEST');
    });
  });

  describe('epic list with --json flag', () => {
    it('should output valid JSON array of epics', async () => {
      process.argv = ['node', 'jira-ai', 'epic', 'list', 'TEST', '--json'];
      initJsonMode();

      const { epicListCommand } = await import('../src/commands/epic.js');
      await epicListCommand('TEST');

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];
      expect(() => JSON.parse(output)).not.toThrow();

      const parsed = JSON.parse(output);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0]).toHaveProperty('key', 'TEST-2');
    });
  });

  describe('run-jql (issue search) with --json flag', () => {
    it('should output valid JSON array of issues', async () => {
      process.argv = ['node', 'jira-ai', 'run-jql', 'project = TEST', '--json'];
      initJsonMode();

      const { runJqlCommand } = await import('../src/commands/run-jql.js');
      await runJqlCommand('project = TEST', {});

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];
      expect(() => JSON.parse(output)).not.toThrow();

      const parsed = JSON.parse(output);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0]).toHaveProperty('key', 'TEST-3');
    });
  });

  describe('--compact flag', () => {
    it('should produce single-line JSON output for project list', async () => {
      process.argv = ['node', 'jira-ai', 'project', 'list', '--compact'];
      initJsonMode();

      const { projectsCommand } = await import('../src/commands/projects.js');
      await projectsCommand();

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];
      expect(() => JSON.parse(output)).not.toThrow();
      expect(output).not.toContain('\n');
    });

    it('should produce single-line JSON output for me command', async () => {
      process.argv = ['node', 'jira-ai', 'me', '--compact'];
      initJsonMode();

      const { meCommand } = await import('../src/commands/me.js');
      await meCommand();

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];
      expect(() => JSON.parse(output)).not.toThrow();
      expect(output).not.toContain('\n');
    });
  });

  describe('backward compatibility — no --json flag', () => {
    it('project list still produces JSON output without --json', async () => {
      process.argv = ['node', 'jira-ai', 'project', 'list'];
      initJsonMode();

      const { projectsCommand } = await import('../src/commands/projects.js');
      await projectsCommand();

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];
      expect(() => JSON.parse(output)).not.toThrow();
    });

    it('me command still produces JSON output without --json', async () => {
      process.argv = ['node', 'jira-ai', 'me'];
      initJsonMode();

      const { meCommand } = await import('../src/commands/me.js');
      await meCommand();

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];
      expect(() => JSON.parse(output)).not.toThrow();
      const parsed = JSON.parse(output);
      expect(parsed).toHaveProperty('accountId', mockUser.accountId);
    });
  });
});
