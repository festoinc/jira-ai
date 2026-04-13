// ---------------------------------------------------------------------------
// RED TESTS: Dry-run for issue update (JIR-126)
// These tests describe expected behavior BEFORE implementation.
// They WILL FAIL until dry-run logic is added to update-issue command.
// ---------------------------------------------------------------------------
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { updateIssueCommand } from '../src/commands/update-issue.js';
import * as jiraClient from '../src/lib/jira-client.js';
import * as settings from '../src/lib/settings.js';

vi.mock('../src/lib/jira-client.js');
vi.mock('../src/lib/utils.js');
vi.mock('../src/lib/settings.js');
vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
  })),
}));
vi.mock('fs', () => ({
  readFileSync: vi.fn().mockReturnValue('# Description'),
  existsSync: vi.fn().mockReturnValue(true),
}));
vi.mock('marklassian', () => ({
  markdownToAdf: vi.fn().mockReturnValue({ version: 1, type: 'doc', content: [] }),
}));

const mockJiraClient = jiraClient as vi.Mocked<typeof jiraClient>;
const mockSettings = settings as vi.Mocked<typeof settings>;

describe('Update Issue Command — Dry-Run (JIR-126)', () => {
  let originalArgv: string[];
  const issueKey = 'TEST-123';

  const mockTaskDetails = {
    id: '10001',
    key: issueKey,
    summary: 'Original Summary',
    status: { name: 'To Do' },
    priority: { name: 'Medium' },
    labels: [],
    comments: [],
    subtasks: [],
    created: '2025-01-01',
    updated: '2025-01-01',
  };

  beforeEach(() => {
    originalArgv = process.argv.slice();
    vi.clearAllMocks();
    console.log = vi.fn();
    console.error = vi.fn();

    mockSettings.isProjectAllowed.mockReturnValue(true);
    mockSettings.isCommandAllowed.mockReturnValue(true);
    mockJiraClient.validateIssuePermissions = vi.fn().mockResolvedValue(mockTaskDetails);
    mockJiraClient.updateIssue = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.argv = originalArgv;
  });

  it('does NOT call updateIssue when --dry-run is set', async () => {
    process.argv = ['node', 'jira-ai', 'issue', 'update', '--dry-run'];
    await updateIssueCommand(issueKey, { priority: 'High' });
    expect(mockJiraClient.updateIssue).not.toHaveBeenCalled();
  });

  it('output contains dryRun: true when --dry-run is set', async () => {
    process.argv = ['node', 'jira-ai', 'issue', 'update', '--dry-run'];
    await updateIssueCommand(issueKey, { priority: 'High' });

    const logCalls = (console.log as any).mock.calls;
    const output = logCalls.map((c: any[]) => {
      try { return JSON.parse(c[0]); } catch { return null; }
    }).find((v: any) => v && v.dryRun === true);

    expect(output).toBeDefined();
    expect(output.dryRun).toBe(true);
  });

  it('output contains command: "issue.update"', async () => {
    process.argv = ['node', 'jira-ai', 'issue', 'update', '--dry-run'];
    await updateIssueCommand(issueKey, { priority: 'High' });

    const logCalls = (console.log as any).mock.calls;
    const output = logCalls.map((c: any[]) => {
      try { return JSON.parse(c[0]); } catch { return null; }
    }).find((v: any) => v && v.dryRun === true);

    expect(output.command).toBe('issue.update');
  });

  it('output changes shows from and to values for updated fields', async () => {
    process.argv = ['node', 'jira-ai', 'issue', 'update', '--dry-run'];
    await updateIssueCommand(issueKey, { priority: 'High' });

    const logCalls = (console.log as any).mock.calls;
    const output = logCalls.map((c: any[]) => {
      try { return JSON.parse(c[0]); } catch { return null; }
    }).find((v: any) => v && v.dryRun === true);

    expect(output.changes).toBeDefined();
    // changes should show from and to for priority
    expect(output.changes).toHaveProperty('priority');
    expect(output.changes.priority).toHaveProperty('from');
    expect(output.changes.priority).toHaveProperty('to', 'High');
  });

  it('current issue state IS fetched (read calls allowed) during dry-run', async () => {
    process.argv = ['node', 'jira-ai', 'issue', 'update', '--dry-run'];
    await updateIssueCommand(issueKey, { priority: 'High' });
    // validateIssuePermissions fetches current state — it should still be called
    expect(mockJiraClient.validateIssuePermissions).toHaveBeenCalledWith(issueKey, 'update-issue');
  });
});
