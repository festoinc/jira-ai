/**
 * RED tests for `issue transitions <key>` (JIR-63)
 *
 * These tests describe the expected behavior of the NEW `listTransitionsCommand`
 * that does not yet exist. Every test in this file should FAIL until the
 * feature is implemented.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as jiraClient from '../src/lib/jira-client.js';

// -----------------------------------------------------------------------
// The command to test — does NOT exist yet (will cause import to fail or
// throw until Step 3 of JIR-63 is implemented).
// -----------------------------------------------------------------------
import { listTransitionsCommand } from '../src/commands/transition.js';

vi.mock('../src/lib/jira-client.js');
vi.mock('../src/lib/ui.js', () => ({
  ui: {
    startSpinner: vi.fn(),
    stopSpinner: vi.fn(),
    succeedSpinner: vi.fn(),
    failSpinner: vi.fn(),
    log: vi.fn(),
  },
}));
vi.mock('../src/lib/json-mode.js', () => ({
  outputResult: vi.fn(),
  isJsonMode: vi.fn(() => false),
}));

const mockJiraClient = jiraClient as vi.Mocked<typeof jiraClient>;

// Transitions that include field metadata (expand=transitions.fields)
const mockTransitionsWithFields = [
  {
    id: '11',
    name: 'Start Progress',
    to: { id: '10', name: 'In Progress' },
    fields: {},
  },
  {
    id: '21',
    name: 'Resolve Issue',
    to: { id: '20', name: 'Done' },
    fields: {
      resolution: { required: true, name: 'Resolution', schema: { type: 'resolution' } },
    },
  },
  {
    id: '31',
    name: 'Close Issue',
    to: { id: '30', name: 'Closed' },
    fields: {
      comment: { required: true, name: 'Comment', schema: { type: 'string' } },
    },
  },
];

describe('listTransitionsCommand (JIR-63)', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockJiraClient.getIssueTransitions.mockResolvedValue(mockTransitionsWithFields as any);
    mockJiraClient.validateIssuePermissions.mockResolvedValue(undefined as any);
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  // -----------------------------------------------------------------------
  // Basic invocation
  // -----------------------------------------------------------------------
  it('should call getIssueTransitions with the issue key', async () => {
    await listTransitionsCommand('PROJ-123');

    expect(mockJiraClient.getIssueTransitions).toHaveBeenCalledWith('PROJ-123');
  });

  it('should display transition name, from/to status, and required fields', async () => {
    const { outputResult } = await import('../src/lib/json-mode.js');
    await listTransitionsCommand('PROJ-123');

    // outputResult (or console.log) should have been called with transition data
    const calls = vi.mocked(outputResult).mock.calls;
    expect(calls.length).toBeGreaterThan(0);

    const payload = calls[0][0] as any;
    expect(Array.isArray(payload)).toBe(true);
    expect(payload).toHaveLength(3);

    const resolveRow = payload.find((r: any) => r.name === 'Resolve Issue');
    expect(resolveRow).toBeDefined();
    expect(resolveRow.to).toBe('Done');
    expect(resolveRow.requiredFields).toContain('resolution');
  });

  it('should show "(none)" for transitions with no required fields', async () => {
    const { outputResult } = await import('../src/lib/json-mode.js');
    await listTransitionsCommand('PROJ-123');

    const payload = vi.mocked(outputResult).mock.calls[0][0] as any[];
    const startRow = payload.find((r: any) => r.name === 'Start Progress');
    expect(startRow).toBeDefined();
    expect(startRow.requiredFields).toMatch(/none/i);
  });

  // -----------------------------------------------------------------------
  // JSON mode
  // -----------------------------------------------------------------------
  it('should emit raw JSON array when json mode is active', async () => {
    const jsonMode = await import('../src/lib/json-mode.js');
    vi.mocked(jsonMode.isJsonMode).mockReturnValue(true);

    await listTransitionsCommand('PROJ-123');

    const outputResultMock = vi.mocked(jsonMode.outputResult);
    expect(outputResultMock).toHaveBeenCalledTimes(1);
    const payload = outputResultMock.mock.calls[0][0] as any[];

    // In JSON mode the full objects must be present (not just formatted strings)
    expect(payload[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      to: expect.any(String),
    });
  });

  // -----------------------------------------------------------------------
  // Filtering to show only transitions with required fields
  // -----------------------------------------------------------------------
  it('should support --required-only filter that hides transitions with no required fields', async () => {
    const { outputResult } = await import('../src/lib/json-mode.js');
    await listTransitionsCommand('PROJ-123', { requiredOnly: true });

    const payload = vi.mocked(outputResult).mock.calls[0][0] as any[];
    // Only "Resolve Issue" and "Close Issue" have required fields
    expect(payload).toHaveLength(2);
    expect(payload.map((r: any) => r.name)).not.toContain('Start Progress');
  });

  // -----------------------------------------------------------------------
  // Error handling
  // -----------------------------------------------------------------------
  it('should propagate errors from getIssueTransitions', async () => {
    mockJiraClient.getIssueTransitions.mockRejectedValue(new Error('Network error'));

    await expect(listTransitionsCommand('PROJ-404')).rejects.toThrow('Network error');
  });
});
