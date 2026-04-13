// ---------------------------------------------------------------------------
// RED TESTS: Dry-run for issue create (JIR-126)
// These tests describe expected behavior BEFORE implementation.
// They WILL FAIL until dry-run logic is added to create-task command.
// ---------------------------------------------------------------------------
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createTaskCommand } from '../src/commands/create-task.js';
import * as jiraClient from '../src/lib/jira-client.js';
import * as settings from '../src/lib/settings.js';

vi.mock('../src/lib/jira-client.js');
vi.mock('../src/lib/utils.js');
vi.mock('../src/lib/settings.js');

vi.mock('fs', () => ({
  readFileSync: vi.fn().mockReturnValue('# File Description'),
  existsSync: vi.fn().mockReturnValue(true),
}));

const mockJiraClient = jiraClient as vi.Mocked<typeof jiraClient>;
const mockSettings = settings as vi.Mocked<typeof settings>;

describe('Create Issue Command — Dry-Run (JIR-126)', () => {
  let originalArgv: string[];

  const mockOptions = {
    title: 'Test Task Title',
    project: 'TEST',
    issueType: 'Task',
  };

  const mockResponse = {
    key: 'TEST-123',
    id: '10001',
  };

  beforeEach(() => {
    originalArgv = process.argv.slice();
    vi.clearAllMocks();
    console.log = vi.fn();
    console.error = vi.fn();

    mockJiraClient.createIssue = vi.fn().mockResolvedValue(mockResponse);
    mockSettings.isProjectAllowed.mockReturnValue(true);
    mockSettings.isCommandAllowed.mockReturnValue(true);
  });

  afterEach(() => {
    process.argv = originalArgv;
  });

  it('does NOT call createIssue when --dry-run is set', async () => {
    process.argv = ['node', 'jira-ai', 'issue', 'create', '--dry-run'];
    await createTaskCommand(mockOptions);
    expect(mockJiraClient.createIssue).not.toHaveBeenCalled();
  });

  it('outputs JSON with dryRun: true when --dry-run is set', async () => {
    process.argv = ['node', 'jira-ai', 'issue', 'create', '--dry-run'];
    await createTaskCommand(mockOptions);

    const logCalls = (console.log as any).mock.calls;
    const output = logCalls.map((c: any[]) => {
      try { return JSON.parse(c[0]); } catch { return null; }
    }).find((v: any) => v && v.dryRun === true);

    expect(output).toBeDefined();
    expect(output.dryRun).toBe(true);
  });

  it('output contains command: "issue.create"', async () => {
    process.argv = ['node', 'jira-ai', 'issue', 'create', '--dry-run'];
    await createTaskCommand(mockOptions);

    const logCalls = (console.log as any).mock.calls;
    const output = logCalls.map((c: any[]) => {
      try { return JSON.parse(c[0]); } catch { return null; }
    }).find((v: any) => v && v.dryRun === true);

    expect(output.command).toBe('issue.create');
  });

  it('output changes contains the fields that would be set', async () => {
    process.argv = ['node', 'jira-ai', 'issue', 'create', '--dry-run'];
    await createTaskCommand({ ...mockOptions, priority: 'High' });

    const logCalls = (console.log as any).mock.calls;
    const output = logCalls.map((c: any[]) => {
      try { return JSON.parse(c[0]); } catch { return null; }
    }).find((v: any) => v && v.dryRun === true);

    expect(output.changes).toBeDefined();
    // The changes should reflect the fields that would be created
    expect(JSON.stringify(output.changes)).toContain('TEST');
  });
});
