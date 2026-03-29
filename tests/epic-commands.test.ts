import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  epicListCommand,
  epicGetCommand,
  epicCreateCommand,
  epicUpdateCommand,
  epicIssuesCommand,
  epicLinkCommand,
  epicUnlinkCommand,
  epicProgressCommand,
} from '../src/commands/epic.js';
import * as jiraClient from '../src/lib/jira-client.js';
import * as settings from '../src/lib/settings.js';
import { CommandError } from '../src/lib/errors.js';

vi.mock('../src/lib/jira-client.js');
vi.mock('../src/lib/settings.js');
vi.mock('../src/lib/formatters.js', () => ({
  formatEpicList: vi.fn(() => 'formatted epic list'),
  formatEpicDetails: vi.fn(() => 'formatted epic details'),
  formatEpicProgress: vi.fn(() => 'formatted progress'),
  formatEpicIssues: vi.fn(() => 'formatted issues'),
  formatJqlResults: vi.fn(() => 'formatted jql'),
}));
vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
  })),
}));

const mockJiraClient = jiraClient as vi.Mocked<typeof jiraClient>;
const mockSettings = settings as vi.Mocked<typeof settings>;

const mockEpic = {
  id: '10001',
  key: 'PROJ-1',
  name: 'Authentication Epic',
  summary: 'Implement user authentication',
  status: 'In Progress',
  statusCategory: 'in_progress',
  projectId: 'proj1',
  projectKey: 'PROJ',
  description: 'Auth epic description',
  assignee: { displayName: 'John Doe', accountId: 'acc123' },
  reporter: { displayName: 'Jane Smith', accountId: 'acc456' },
  created: '2024-01-01T00:00:00.000Z',
  updated: '2024-01-15T00:00:00.000Z',
  labels: [],
};

const mockProgress = {
  epicKey: 'PROJ-1',
  epicName: 'Authentication Epic',
  totalIssues: 10,
  doneIssues: 4,
  inProgressIssues: 3,
  todoIssues: 3,
  doneStoryPoints: 0,
  totalStoryPoints: 0,
  percentageDone: 40,
};

beforeEach(() => {
  vi.clearAllMocks();
  console.log = vi.fn();
  console.error = vi.fn();
  mockSettings.isProjectAllowed.mockReturnValue(true);
  mockSettings.isCommandAllowed.mockReturnValue(true);
});

describe('epicListCommand', () => {
  it('should list epics for a project', async () => {
    mockJiraClient.listEpics = vi.fn().mockResolvedValue([mockEpic]);

    await epicListCommand('PROJ', {});

    expect(mockJiraClient.listEpics).toHaveBeenCalledWith('PROJ', expect.objectContaining({ includeDone: false }));
  });

  it('should pass includeDone option when --done flag set', async () => {
    mockJiraClient.listEpics = vi.fn().mockResolvedValue([]);

    await epicListCommand('PROJ', { done: true });

    expect(mockJiraClient.listEpics).toHaveBeenCalledWith('PROJ', expect.objectContaining({ includeDone: true }));
  });

  it('should respect --max option', async () => {
    mockJiraClient.listEpics = vi.fn().mockResolvedValue([]);

    await epicListCommand('PROJ', { max: 25 });

    expect(mockJiraClient.listEpics).toHaveBeenCalledWith('PROJ', expect.objectContaining({ max: 25 }));
  });

  it('should throw CommandError on API failure', async () => {
    mockJiraClient.listEpics = vi.fn().mockRejectedValue(new Error('Network error'));

    await expect(epicListCommand('PROJ', {})).rejects.toThrow(CommandError);
  });

  it('should throw CommandError on 404', async () => {
    mockJiraClient.listEpics = vi.fn().mockRejectedValue(new Error('404 Project not found'));

    const err = await epicListCommand('PROJ', {}).catch(e => e);
    expect(err).toBeInstanceOf(CommandError);
    expect(err.hints.length).toBeGreaterThan(0);
  });
});

describe('epicGetCommand', () => {
  it('should get epic details', async () => {
    mockJiraClient.getEpic = vi.fn().mockResolvedValue(mockEpic);

    await epicGetCommand('PROJ-1');

    expect(mockJiraClient.getEpic).toHaveBeenCalledWith('PROJ-1');
  });

  it('should throw CommandError on 404', async () => {
    mockJiraClient.getEpic = vi.fn().mockRejectedValue(new Error('404 Not Found'));

    const err = await epicGetCommand('PROJ-999').catch(e => e);
    expect(err).toBeInstanceOf(CommandError);
    expect(err.hints.some((h: string) => h.includes('epic key'))).toBe(true);
  });

  it('should throw CommandError on 403', async () => {
    mockJiraClient.getEpic = vi.fn().mockRejectedValue(new Error('403 Forbidden'));

    const err = await epicGetCommand('PROJ-1').catch(e => e);
    expect(err).toBeInstanceOf(CommandError);
    expect(err.hints.some((h: string) => h.includes('permission'))).toBe(true);
  });
});

describe('epicCreateCommand', () => {
  it('should create an epic', async () => {
    mockJiraClient.createEpic = vi.fn().mockResolvedValue({ key: 'PROJ-100', id: '10100' });

    await epicCreateCommand('PROJ', { name: 'New Epic', summary: 'Epic summary' });

    expect(mockJiraClient.createEpic).toHaveBeenCalledWith(
      'PROJ',
      'New Epic',
      'Epic summary',
      expect.any(Object)
    );
  });

  it('should pass optional description', async () => {
    mockJiraClient.createEpic = vi.fn().mockResolvedValue({ key: 'PROJ-100', id: '10100' });

    await epicCreateCommand('PROJ', { name: 'New Epic', summary: 'Summary', description: 'Detailed desc' });

    expect(mockJiraClient.createEpic).toHaveBeenCalledWith(
      'PROJ',
      'New Epic',
      'Summary',
      expect.objectContaining({ description: 'Detailed desc' })
    );
  });

  it('should parse comma-separated labels', async () => {
    mockJiraClient.createEpic = vi.fn().mockResolvedValue({ key: 'PROJ-100', id: '10100' });

    await epicCreateCommand('PROJ', { name: 'New Epic', summary: 'Summary', labels: 'auth,security' });

    expect(mockJiraClient.createEpic).toHaveBeenCalledWith(
      'PROJ',
      'New Epic',
      'Summary',
      expect.objectContaining({ labels: ['auth', 'security'] })
    );
  });

  it('should log success with issue key', async () => {
    mockJiraClient.createEpic = vi.fn().mockResolvedValue({ key: 'PROJ-100', id: '10100' });

    await epicCreateCommand('PROJ', { name: 'New Epic', summary: 'Summary' });

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('PROJ-100'));
  });

  it('should throw CommandError on API failure', async () => {
    mockJiraClient.createEpic = vi.fn().mockRejectedValue(new Error('403 Forbidden'));

    const err = await epicCreateCommand('PROJ', { name: 'N', summary: 'S' }).catch(e => e);
    expect(err).toBeInstanceOf(CommandError);
    expect(err.hints.some((h: string) => h.includes('permission'))).toBe(true);
  });
});

describe('epicUpdateCommand', () => {
  it('should update epic name', async () => {
    mockJiraClient.updateEpic = vi.fn().mockResolvedValue(undefined);

    await epicUpdateCommand('PROJ-1', { name: 'Updated Name' });

    expect(mockJiraClient.updateEpic).toHaveBeenCalledWith('PROJ-1', expect.objectContaining({ name: 'Updated Name' }));
  });

  it('should update epic summary', async () => {
    mockJiraClient.updateEpic = vi.fn().mockResolvedValue(undefined);

    await epicUpdateCommand('PROJ-1', { summary: 'Updated Summary' });

    expect(mockJiraClient.updateEpic).toHaveBeenCalledWith('PROJ-1', expect.objectContaining({ summary: 'Updated Summary' }));
  });

  it('should throw CommandError when 404', async () => {
    mockJiraClient.updateEpic = vi.fn().mockRejectedValue(new Error('404 Not Found'));

    const err = await epicUpdateCommand('PROJ-999', { name: 'X' }).catch(e => e);
    expect(err).toBeInstanceOf(CommandError);
  });
});

describe('epicIssuesCommand', () => {
  it('should get issues for an epic', async () => {
    mockJiraClient.getEpicIssues = vi.fn().mockResolvedValue([
      { key: 'PROJ-10', summary: 'Issue 1', status: { name: 'To Do' }, assignee: null, priority: null },
    ]);

    await epicIssuesCommand('PROJ-1', {});

    expect(mockJiraClient.getEpicIssues).toHaveBeenCalledWith('PROJ-1', expect.any(Object));
  });

  it('should respect --max option', async () => {
    mockJiraClient.getEpicIssues = vi.fn().mockResolvedValue([]);

    await epicIssuesCommand('PROJ-1', { max: 20 });

    expect(mockJiraClient.getEpicIssues).toHaveBeenCalledWith('PROJ-1', expect.objectContaining({ max: 20 }));
  });

  it('should throw CommandError on failure', async () => {
    mockJiraClient.getEpicIssues = vi.fn().mockRejectedValue(new Error('404'));

    await expect(epicIssuesCommand('PROJ-999', {})).rejects.toThrow(CommandError);
  });
});

describe('epicLinkCommand', () => {
  it('should link issue to epic', async () => {
    mockJiraClient.linkIssueToEpic = vi.fn().mockResolvedValue(undefined);

    await epicLinkCommand('PROJ-10', 'PROJ-1');

    expect(mockJiraClient.linkIssueToEpic).toHaveBeenCalledWith('PROJ-10', 'PROJ-1');
  });

  it('should throw CommandError on 404', async () => {
    mockJiraClient.linkIssueToEpic = vi.fn().mockRejectedValue(new Error('404 Not Found'));

    const err = await epicLinkCommand('PROJ-10', 'PROJ-999').catch(e => e);
    expect(err).toBeInstanceOf(CommandError);
  });

  it('should throw CommandError on 400 (already linked)', async () => {
    mockJiraClient.linkIssueToEpic = vi.fn().mockRejectedValue(new Error('400 Bad Request'));

    const err = await epicLinkCommand('PROJ-10', 'PROJ-1').catch(e => e);
    expect(err).toBeInstanceOf(CommandError);
  });
});

describe('epicUnlinkCommand', () => {
  it('should unlink issue from epic', async () => {
    mockJiraClient.unlinkIssueFromEpic = vi.fn().mockResolvedValue(undefined);

    await epicUnlinkCommand('PROJ-10');

    expect(mockJiraClient.unlinkIssueFromEpic).toHaveBeenCalledWith('PROJ-10');
  });

  it('should throw CommandError on failure', async () => {
    mockJiraClient.unlinkIssueFromEpic = vi.fn().mockRejectedValue(new Error('404'));

    await expect(epicUnlinkCommand('PROJ-999')).rejects.toThrow(CommandError);
  });
});

describe('epicProgressCommand', () => {
  it('should get epic progress', async () => {
    mockJiraClient.getEpicProgress = vi.fn().mockResolvedValue(mockProgress);

    await epicProgressCommand('PROJ-1');

    expect(mockJiraClient.getEpicProgress).toHaveBeenCalledWith('PROJ-1');
  });

  it('should throw CommandError on 404', async () => {
    mockJiraClient.getEpicProgress = vi.fn().mockRejectedValue(new Error('404 Not Found'));

    const err = await epicProgressCommand('PROJ-999').catch(e => e);
    expect(err).toBeInstanceOf(CommandError);
    expect(err.hints.some((h: string) => h.includes('epic key'))).toBe(true);
  });
});
