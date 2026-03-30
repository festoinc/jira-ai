import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// These imports will fail because src/lib/json-mode.ts does not exist yet.
// Tests are intentionally RED until the implementation is created.
import {
  initJsonMode,
  isJsonMode,
  isCompactMode,
  outputResult,
  outputError,
} from '../src/lib/json-mode.js';

describe('json-mode module', () => {
  let processExitSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let originalArgv: string[];

  beforeEach(() => {
    originalArgv = process.argv;
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    process.argv = originalArgv;
    vi.restoreAllMocks();
  });

  describe('initJsonMode()', () => {
    it('should set json mode when --json is in process.argv', () => {
      process.argv = ['node', 'jira-ai', 'issue', 'get', 'TEST-1', '--json'];
      initJsonMode();
      expect(isJsonMode()).toBe(true);
    });

    it('should set compact mode when --json-compact is in process.argv', () => {
      process.argv = ['node', 'jira-ai', 'project', 'list', '--json-compact'];
      initJsonMode();
      expect(isJsonMode()).toBe(true);
      expect(isCompactMode()).toBe(true);
    });

    it('should not set json mode when neither flag is present', () => {
      process.argv = ['node', 'jira-ai', 'issue', 'get', 'TEST-1'];
      initJsonMode();
      expect(isJsonMode()).toBe(false);
    });

    it('should not set compact mode when only --json is present', () => {
      process.argv = ['node', 'jira-ai', 'me', '--json'];
      initJsonMode();
      expect(isCompactMode()).toBe(false);
    });
  });

  describe('isJsonMode()', () => {
    it('should return false by default', () => {
      process.argv = ['node', 'jira-ai', 'project', 'list'];
      initJsonMode();
      expect(isJsonMode()).toBe(false);
    });

    it('should return true after initJsonMode() with --json flag', () => {
      process.argv = ['node', 'jira-ai', 'project', 'list', '--json'];
      initJsonMode();
      expect(isJsonMode()).toBe(true);
    });
  });

  describe('isCompactMode()', () => {
    it('should return false by default', () => {
      process.argv = ['node', 'jira-ai', 'project', 'list'];
      initJsonMode();
      expect(isCompactMode()).toBe(false);
    });

    it('should return true only when --json-compact flag is present', () => {
      process.argv = ['node', 'jira-ai', 'project', 'list', '--json-compact'];
      initJsonMode();
      expect(isCompactMode()).toBe(true);
    });
  });

  describe('outputResult()', () => {
    it('should call formatter function and log result in normal mode', () => {
      process.argv = ['node', 'jira-ai', 'me'];
      initJsonMode();

      const data = { accountId: 'abc', displayName: 'Alice' };
      const formatter = vi.fn().mockReturnValue('Formatted output');

      outputResult(data, formatter);

      expect(formatter).toHaveBeenCalledWith(data);
      expect(consoleLogSpy).toHaveBeenCalledWith('Formatted output');
    });

    it('should call JSON.stringify with indentation in JSON mode', () => {
      process.argv = ['node', 'jira-ai', 'me', '--json'];
      initJsonMode();

      const data = { accountId: 'abc', displayName: 'Alice' };
      const formatter = vi.fn();

      outputResult(data, formatter);

      expect(formatter).not.toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];
      expect(() => JSON.parse(output)).not.toThrow();
      const parsed = JSON.parse(output);
      expect(parsed).toEqual(data);
      expect(output).toContain('\n'); // indented JSON has newlines
    });

    it('should produce single-line JSON in compact mode', () => {
      process.argv = ['node', 'jira-ai', 'me', '--json-compact'];
      initJsonMode();

      const data = { accountId: 'abc', displayName: 'Alice' };
      const formatter = vi.fn();

      outputResult(data, formatter);

      expect(formatter).not.toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];
      expect(() => JSON.parse(output)).not.toThrow();
      expect(output).not.toContain('\n'); // compact JSON has no newlines
    });
  });

  describe('outputError()', () => {
    it('should output structured JSON error and exit in JSON mode', () => {
      process.argv = ['node', 'jira-ai', 'me', '--json'];
      initJsonMode();

      outputError('Something went wrong', ['Check credentials'], 1);

      expect(processExitSpy).toHaveBeenCalledWith(1);
      const output = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed).toEqual({
        error: true,
        message: 'Something went wrong',
        hints: ['Check credentials'],
        exitCode: 1,
      });
    });

    it('should output structured JSON error with empty hints when none provided', () => {
      process.argv = ['node', 'jira-ai', 'me', '--json'];
      initJsonMode();

      outputError('Not found');

      const output = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.error).toBe(true);
      expect(parsed.message).toBe('Not found');
      expect(parsed.hints).toEqual([]);
    });

    it('should use exitCode 1 by default', () => {
      process.argv = ['node', 'jira-ai', 'me', '--json'];
      initJsonMode();

      outputError('Error message');

      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });
});
