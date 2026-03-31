import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import { initJsonMode } from '../src/lib/json-mode.js';
import { ui } from '../src/lib/ui.js';

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

  it('startSpinner is a no-op in JSON mode', () => {
    process.argv = ['node', 'jira-ai', 'me', '--json'];
    initJsonMode();

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

  it('startSpinner is a no-op regardless of JSON mode', () => {
    process.argv = ['node', 'jira-ai', 'me'];
    initJsonMode();

    expect(() => ui.startSpinner('Loading...')).not.toThrow();
    expect(ui.spinner).toBeNull();
  });
});
