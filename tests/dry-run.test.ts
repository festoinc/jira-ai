import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isDryRun, formatDryRunResult, DryRunResult } from '../src/lib/dry-run.js';

vi.mock('../src/lib/json-mode.js', () => ({
  outputResult: vi.fn(),
}));

import * as jsonMode from '../src/lib/json-mode.js';

const mockOutputResult = jsonMode.outputResult as ReturnType<typeof vi.fn>;

describe('isDryRun()', () => {
  let originalArgv: string[];

  beforeEach(() => {
    originalArgv = process.argv.slice();
  });

  afterEach(() => {
    process.argv = originalArgv;
  });

  it('returns true when --dry-run is in process.argv', () => {
    process.argv = ['node', 'jira-ai', 'issue', 'update', 'PROJ-123', '--dry-run'];
    expect(isDryRun()).toBe(true);
  });

  it('returns false when --dry-run is NOT in process.argv', () => {
    process.argv = ['node', 'jira-ai', 'issue', 'update', 'PROJ-123'];
    expect(isDryRun()).toBe(false);
  });
});

describe('formatDryRunResult()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls outputResult with dryRun: true', () => {
    formatDryRunResult('issue.update', 'PROJ-123', {}, {});
    expect(mockOutputResult).toHaveBeenCalledOnce();
    const result: DryRunResult = mockOutputResult.mock.calls[0][0];
    expect(result.dryRun).toBe(true);
  });

  it('includes command, target, changes, preview, message fields', () => {
    const changes = { priority: { from: 'Medium', to: 'High' } };
    const preview = { key: 'PROJ-123' };
    formatDryRunResult('issue.update', 'PROJ-123', changes, preview);

    const result: DryRunResult = mockOutputResult.mock.calls[0][0];
    expect(result).toHaveProperty('command', 'issue.update');
    expect(result).toHaveProperty('target', 'PROJ-123');
    expect(result).toHaveProperty('changes');
    expect(result).toHaveProperty('preview');
    expect(result).toHaveProperty('message');
  });

  it('message contains "No changes were made"', () => {
    formatDryRunResult('issue.create', 'PROJ', {}, {});
    const result: DryRunResult = mockOutputResult.mock.calls[0][0];
    expect(result.message).toContain('No changes were made');
  });

  it('outputs valid JSON-serializable object with dryRun: true', () => {
    formatDryRunResult('issue.transition', 'PROJ-123', {}, {});
    const result: DryRunResult = mockOutputResult.mock.calls[0][0];
    // Should be JSON-serializable
    const json = JSON.parse(JSON.stringify(result));
    expect(json.dryRun).toBe(true);
  });
});
