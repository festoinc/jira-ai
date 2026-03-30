import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// isJsonMode is imported from the (not yet existing) json-mode module.
// Tests are intentionally RED until the implementation is created.
import { initJsonMode } from '../src/lib/json-mode.js';
import { ui } from '../src/lib/ui.js';

vi.mock('ora', () => {
  const start = vi.fn().mockReturnThis();
  const stop = vi.fn().mockReturnThis();
  const succeed = vi.fn().mockReturnThis();
  const fail = vi.fn().mockReturnThis();

  return {
    default: vi.fn(() => ({ start, stop, succeed, fail })),
  };
});

describe('UI spinner in JSON mode', () => {
  let originalArgv: string[];

  beforeEach(() => {
    originalArgv = process.argv;
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.argv = originalArgv;
    vi.restoreAllMocks();
  });

  it('should not create an ora spinner when isJsonMode() returns true', async () => {
    process.argv = ['node', 'jira-ai', 'me', '--json'];
    initJsonMode();

    const ora = (await import('ora')).default;
    ui.startSpinner('Loading...');

    expect(ora).not.toHaveBeenCalled();
  });

  it('startSpinner is a no-op in JSON mode', () => {
    process.argv = ['node', 'jira-ai', 'me', '--json'];
    initJsonMode();

    // Should not throw and should not create a spinner
    expect(() => ui.startSpinner('Loading...')).not.toThrow();
    expect(ui.spinner).toBeNull();
  });

  it('stopSpinner is a no-op in JSON mode', () => {
    process.argv = ['node', 'jira-ai', 'me', '--json'];
    initJsonMode();

    expect(() => ui.stopSpinner()).not.toThrow();
    expect(ui.spinner).toBeNull();
  });

  it('succeedSpinner is a no-op in JSON mode', () => {
    process.argv = ['node', 'jira-ai', 'me', '--json'];
    initJsonMode();

    expect(() => ui.succeedSpinner('Done!')).not.toThrow();
    expect(ui.spinner).toBeNull();
  });

  it('failSpinner is a no-op in JSON mode', () => {
    process.argv = ['node', 'jira-ai', 'me', '--json'];
    initJsonMode();

    expect(() => ui.failSpinner('Failed!')).not.toThrow();
    expect(ui.spinner).toBeNull();
  });

  it('updateSpinner is a no-op in JSON mode', () => {
    process.argv = ['node', 'jira-ai', 'me', '--json'];
    initJsonMode();

    expect(() => ui.updateSpinner('Updating...')).not.toThrow();
  });

  it('spinner works normally when not in JSON mode', async () => {
    process.argv = ['node', 'jira-ai', 'me'];
    initJsonMode();

    const ora = (await import('ora')).default;
    ui.startSpinner('Loading...');

    expect(ora).toHaveBeenCalledWith('Loading...');
  });
});
