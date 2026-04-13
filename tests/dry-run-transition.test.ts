// ---------------------------------------------------------------------------
// RED TESTS: Dry-run for issue transition (JIR-126)
// These tests describe expected behavior BEFORE implementation.
// They WILL FAIL until dry-run logic is added to transition command.
// ---------------------------------------------------------------------------
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { transitionCommand } from '../src/commands/transition.js';
import * as jiraClient from '../src/lib/jira-client.js';

vi.mock('../src/lib/jira-client.js');
vi.mock('../src/lib/ui.js', () => ({
  ui: {
    startSpinner: vi.fn(),
    stopSpinner: vi.fn(),
    succeedSpinner: vi.fn(),
    failSpinner: vi.fn(),
  },
}));
vi.mock('marklassian', () => ({
  markdownToAdf: vi.fn((text: string) => ({
    version: 1,
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  })),
}));
vi.mock('fs');

const mockJiraClient = jiraClient as vi.Mocked<typeof jiraClient>;

describe('Transition Command — Dry-Run (JIR-126)', () => {
  let originalArgv: string[];
  const taskId = 'PROJ-123';

  const mockTransitions = [
    { id: '1', name: 'Start Progress', to: { id: '10', name: 'In Progress' } },
    { id: '2', name: 'Resolve Issue', to: { id: '20', name: 'Done' } },
  ];

  const mockCurrentIssue = {
    id: '10001',
    key: taskId,
    status: { name: 'To Do' },
  };

  beforeEach(() => {
    originalArgv = process.argv.slice();
    vi.clearAllMocks();
    console.log = vi.fn();
    console.error = vi.fn();

    mockJiraClient.getIssueTransitions.mockResolvedValue(mockTransitions);
    mockJiraClient.transitionIssue.mockResolvedValue();
    mockJiraClient.validateIssuePermissions = vi.fn().mockResolvedValue(mockCurrentIssue);
  });

  afterEach(() => {
    process.argv = originalArgv;
  });

  it('does NOT call transitionIssue when --dry-run is set', async () => {
    process.argv = ['node', 'jira-ai', 'issue', 'transition', '--dry-run'];
    await transitionCommand(taskId, 'Done');
    expect(mockJiraClient.transitionIssue).not.toHaveBeenCalled();
  });

  it('output contains dryRun: true when --dry-run is set', async () => {
    process.argv = ['node', 'jira-ai', 'issue', 'transition', '--dry-run'];
    await transitionCommand(taskId, 'Done');

    const logCalls = (console.log as any).mock.calls;
    const output = logCalls.map((c: any[]) => {
      try { return JSON.parse(c[0]); } catch { return null; }
    }).find((v: any) => v && v.dryRun === true);

    expect(output).toBeDefined();
    expect(output.dryRun).toBe(true);
  });

  it('output contains command: "issue.transition"', async () => {
    process.argv = ['node', 'jira-ai', 'issue', 'transition', '--dry-run'];
    await transitionCommand(taskId, 'Done');

    const logCalls = (console.log as any).mock.calls;
    const output = logCalls.map((c: any[]) => {
      try { return JSON.parse(c[0]); } catch { return null; }
    }).find((v: any) => v && v.dryRun === true);

    expect(output.command).toBe('issue.transition');
  });

  it('output changes shows status from and to', async () => {
    process.argv = ['node', 'jira-ai', 'issue', 'transition', '--dry-run'];
    await transitionCommand(taskId, 'Done');

    const logCalls = (console.log as any).mock.calls;
    const output = logCalls.map((c: any[]) => {
      try { return JSON.parse(c[0]); } catch { return null; }
    }).find((v: any) => v && v.dryRun === true);

    expect(output.changes).toBeDefined();
    expect(output.changes).toHaveProperty('status');
    expect(output.changes.status).toHaveProperty('from');
    expect(output.changes.status).toHaveProperty('to', 'Done');
  });
});
