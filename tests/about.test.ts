import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { aboutCommand } from '../src/commands/about.js';
import chalk from 'chalk';

describe('About Command', () => {
  let consoleSpy: any;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should display version and GitHub URL', async () => {
    await aboutCommand();
    
    const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
    
    // Check for version (current is 0.3.17)
    expect(output).toContain('0.3.17');
    // Check for GitHub URL
    expect(output).toContain('https://github.com/festoinc/jira-ai');
  });

  it('should NOT display other information like commands and configuration', async () => {
    await aboutCommand();
    
    const output = consoleSpy.mock.calls.map(call => call[0]).join('\n');
    
    expect(output).not.toContain('Available Commands');
    expect(output).not.toContain('Configuration');
    expect(output).not.toContain('Settings file');
  });
});
