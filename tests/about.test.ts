import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { aboutCommand } from '../src/commands/about.js';
import { getVersion } from '../src/lib/utils.js';
import chalk from 'chalk';

vi.mock('../src/lib/update-check.js', () => ({
  checkForUpdate: vi.fn().mockResolvedValue(null),
  formatUpdateMessage: vi.fn().mockReturnValue('Update available: 1.0.0'),
}));

import { checkForUpdate } from '../src/lib/update-check.js';

describe('About Command', () => {
  let consoleSpy: any;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(checkForUpdate).mockResolvedValue(null);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should display version and GitHub URL', async () => {
    await aboutCommand();
    
    const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');

    // Check for version
    expect(output).toContain(getVersion());
    // Check for GitHub URL
    expect(output).toContain('https://github.com/festoinc/jira-ai');
  });

  it('should display update message when available', async () => {
    vi.mocked(checkForUpdate).mockResolvedValue('1.0.0');
    
    await aboutCommand();
    
    const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
    expect(output).toContain('Update available: 1.0.0');
  });

  it('should NOT display other information like commands and configuration', async () => {
    await aboutCommand();
    
    const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
    
    expect(output).not.toContain('Available Commands');
    expect(output).not.toContain('Configuration');
    expect(output).not.toContain('Settings file');
  });
});
