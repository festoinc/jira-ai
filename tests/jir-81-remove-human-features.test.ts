/**
 * JIR-81: Remove all human features
 *
 * RED tests — these tests define the desired end state after all human-facing
 * features (chalk colors, spinners, human-readable formatters) are removed.
 * They are intentionally written to FAIL on the current codebase and will go
 * GREEN only after the implementation is complete.
 *
 * Regression tests (marked [REGRESSION]) should remain GREEN throughout.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

// ---------------------------------------------------------------------------
// Top-level mocks (hoisted by vitest)
// ---------------------------------------------------------------------------
vi.mock('../src/lib/update-check.js', () => ({
  checkForUpdate: vi.fn().mockResolvedValue(null),
  formatUpdateMessage: vi.fn().mockReturnValue(''),
}));

// ---------------------------------------------------------------------------
// Static imports used across tests
// ---------------------------------------------------------------------------
import {
  initJsonMode,
  isJsonMode,
  isCompactMode,
  outputResult,
  outputError,
} from '../src/lib/json-mode.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SRC_DIR = resolve(__dirname, '../src');

/** Recursively collect all .ts source files under a directory. */
function collectTsFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...collectTsFiles(full));
    } else if (entry.endsWith('.ts')) {
      files.push(full);
    }
  }
  return files;
}

// ---------------------------------------------------------------------------
// 1. No chalk imports in source files
// ---------------------------------------------------------------------------
describe('JIR-81 [RED] No chalk imports in source files', () => {
  it('should have no src files importing chalk', () => {
    const files = collectTsFiles(SRC_DIR);
    const violations = files.filter(f =>
      /import\s+.*\bchalk\b.*from\s+['"]chalk['"]/.test(readFileSync(f, 'utf-8'))
    );
    expect(violations, `Files still importing chalk:\n${violations.join('\n')}`).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 2. No spinner / ui.ts imports in source files
// ---------------------------------------------------------------------------
describe('JIR-81 [RED] No ui.ts spinner imports in source files', () => {
  it('should have no src files importing from ui.ts', () => {
    const files = collectTsFiles(SRC_DIR);
    const violations = files.filter(f =>
      /from\s+['"](\.\.\/)*lib\/ui(\.js)?['"]/.test(readFileSync(f, 'utf-8'))
    );
    expect(violations, `Files still importing ui.ts:\n${violations.join('\n')}`).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 3. No formatters.ts imports in source files
// ---------------------------------------------------------------------------
describe('JIR-81 [RED] No formatters.ts imports in source files', () => {
  it('should have no src files importing from formatters.ts', () => {
    const files = collectTsFiles(SRC_DIR);
    const violations = files.filter(f =>
      /from\s+['"](\.\.\/)*lib\/formatters(\.js)?['"]/.test(readFileSync(f, 'utf-8'))
    );
    expect(violations, `Files still importing formatters.ts:\n${violations.join('\n')}`).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 4. No removed dependencies in package.json
// ---------------------------------------------------------------------------
describe('JIR-81 [RED] Human-facing dependencies removed from package.json', () => {
  const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf-8'));
  const allDeps = Object.keys({ ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) });

  it('should not have chalk in dependencies', () => {
    expect(allDeps).not.toContain('chalk');
  });

  it('should not have cli-table3 in dependencies', () => {
    expect(allDeps).not.toContain('cli-table3');
  });

  it('should not have ora in dependencies', () => {
    expect(allDeps).not.toContain('ora');
  });

  it('should not have inquirer in dependencies', () => {
    expect(allDeps).not.toContain('inquirer');
  });
});

// ---------------------------------------------------------------------------
// 5. json-mode.ts: outputResult always outputs JSON (no human formatter path)
// ---------------------------------------------------------------------------
describe('JIR-81 [RED] json-mode outputResult always outputs JSON', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let originalArgv: string[];

  beforeEach(() => {
    originalArgv = [...process.argv];
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    process.argv = originalArgv;
    vi.restoreAllMocks();
  });

  it('should output JSON even when no --json flag is set (formatter must be ignored)', () => {
    process.argv = ['node', 'jira-ai', 'me'];
    initJsonMode();

    const data = { accountId: 'abc', displayName: 'Alice' };
    const formatter = vi.fn().mockReturnValue('Human formatted output');

    outputResult(data, formatter);

    // After the fix: formatter is never called
    expect(formatter).not.toHaveBeenCalled();

    // Output must be valid JSON
    const output = consoleLogSpy.mock.calls[0]?.[0];
    expect(output).toBeDefined();
    expect(() => JSON.parse(output)).not.toThrow();
    expect(JSON.parse(output)).toEqual(data);
  });

  it('should output compact single-line JSON with --compact flag (new flag after refactor)', () => {
    // After the implementation, --compact replaces --json-compact
    process.argv = ['node', 'jira-ai', 'me', '--compact'];
    initJsonMode();

    // isCompactMode() should return true with --compact flag
    expect(isCompactMode()).toBe(true);

    const data = { id: 1, name: 'Test' };
    outputResult(data);

    const output = consoleLogSpy.mock.calls[0]?.[0];
    expect(output).toBeDefined();
    expect(() => JSON.parse(output)).not.toThrow();
    expect(output).not.toContain('\n');
  });
});

// ---------------------------------------------------------------------------
// 6. json-mode.ts: outputError always outputs JSON (no chalk path)
// ---------------------------------------------------------------------------
describe('JIR-81 [RED] json-mode outputError always outputs JSON', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;
  let originalArgv: string[];

  beforeEach(() => {
    originalArgv = [...process.argv];
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
  });

  afterEach(() => {
    process.argv = originalArgv;
    vi.restoreAllMocks();
  });

  it('should output JSON error even when no --json flag is set (never chalk)', () => {
    process.argv = ['node', 'jira-ai', 'me'];
    initJsonMode();

    outputError('Something went wrong', ['Check credentials'], 1);

    // Must output to stdout as structured JSON
    const logOutput = consoleLogSpy.mock.calls[0]?.[0];
    expect(logOutput).toBeDefined();
    const parsed = JSON.parse(logOutput);
    expect(parsed).toEqual({
      error: true,
      message: 'Something went wrong',
      hints: ['Check credentials'],
      exitCode: 1,
    });

    expect(processExitSpy).toHaveBeenCalledWith(1);
  });
});

// ---------------------------------------------------------------------------
// 7. about command: outputs { "version": "X.Y.Z" } JSON always (no chalk)
// ---------------------------------------------------------------------------
describe('JIR-81 [RED] about command: source must not pass chalk formatter to outputResult', () => {
  it('about.ts should not contain a chalk-based formatter function', () => {
    const content = readFileSync(resolve(SRC_DIR, 'commands/about.ts'), 'utf-8');
    // After the fix, about.ts should call outputResult(data) with no formatter argument
    // The formatter currently contains chalk references — check it's gone
    expect(content).not.toMatch(/chalk\s*\.\s*(bold|red|green|yellow|cyan|blue)/);
  });

  it('about.ts should not import chalk', () => {
    const content = readFileSync(resolve(SRC_DIR, 'commands/about.ts'), 'utf-8');
    expect(content).not.toMatch(/import\s+.*chalk.*from\s+['"]chalk['"]/);
  });
});

describe('JIR-81 [RED] about command outputs pure JSON at runtime', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let originalArgv: string[];

  beforeEach(() => {
    originalArgv = [...process.argv];
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    process.argv = originalArgv;
    vi.restoreAllMocks();
  });

  it('should output valid JSON with a "version" field even without --json flag', async () => {
    process.argv = ['node', 'jira-ai', 'about'];
    initJsonMode();

    const { aboutCommand } = await import('../src/commands/about.js');
    await aboutCommand();

    const output = consoleLogSpy.mock.calls[0]?.[0];
    expect(output).toBeDefined();

    let parsed: any;
    expect(() => { parsed = JSON.parse(output); }).not.toThrow();
    expect(parsed).toHaveProperty('version');
    expect(typeof parsed.version).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// 8. --json-compact flag: single-line JSON output (existing behavior preserved)
// ---------------------------------------------------------------------------
describe('JIR-81 --compact flag produces single-line JSON', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let originalArgv: string[];

  beforeEach(() => {
    originalArgv = [...process.argv];
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    process.argv = originalArgv;
    vi.restoreAllMocks();
  });

  it('should produce single-line JSON with --compact flag', () => {
    process.argv = ['node', 'jira-ai', 'issue', 'get', 'TEST-1', '--compact'];
    initJsonMode();

    const data = { key: 'TEST-1', summary: 'Test issue', status: 'To Do' };
    outputResult(data);

    const output = consoleLogSpy.mock.calls[0]?.[0];
    expect(() => JSON.parse(output)).not.toThrow();
    expect(output).not.toContain('\n');
    expect(JSON.parse(output)).toEqual(data);
  });
});

// ---------------------------------------------------------------------------
// 9. Regression: settings command still works
// ---------------------------------------------------------------------------
describe('JIR-81 [REGRESSION] settings command still works', () => {
  it('should export settingsCommand function', async () => {
    const mod = await import('../src/commands/settings.js');
    expect(typeof mod.settingsCommand).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// 10. Regression: auth command works in non-interactive mode
// ---------------------------------------------------------------------------
describe('JIR-81 [REGRESSION] auth command still exports correctly', () => {
  it('should export authCommand function', async () => {
    const mod = await import('../src/commands/auth.js');
    expect(typeof mod.authCommand).toBe('function');
  });

  it('should export logoutCommand function', async () => {
    const mod = await import('../src/commands/auth.js');
    expect(typeof mod.logoutCommand).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// 11. Regression: existing outputResult JSON mode still works
// ---------------------------------------------------------------------------
describe('JIR-81 [REGRESSION] outputResult JSON mode still outputs JSON', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let originalArgv: string[];

  beforeEach(() => {
    originalArgv = [...process.argv];
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    process.argv = originalArgv;
    vi.restoreAllMocks();
  });

  it('should output indented JSON with --json flag', () => {
    process.argv = ['node', 'jira-ai', 'me', '--json'];
    initJsonMode();

    const data = { accountId: 'abc', displayName: 'Alice' };
    outputResult(data);

    const output = consoleLogSpy.mock.calls[0]?.[0];
    expect(() => JSON.parse(output)).not.toThrow();
    expect(JSON.parse(output)).toEqual(data);
    expect(output).toContain('\n'); // indented has newlines
  });
});
