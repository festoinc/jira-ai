import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { aboutCommand } from '../src/commands/about.js';
import { getVersion } from '../src/lib/utils.js';

vi.mock('../src/lib/update-check.js', () => ({
  checkForUpdate: vi.fn().mockResolvedValue(null),
  formatUpdateMessage: vi.fn().mockReturnValue('Update available: 1.0.0'),
}));

describe('About Command', () => {
  let consoleSpy: any;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should display version only', async () => {
    await aboutCommand();
    
    const output = consoleSpy.mock.calls[0]?.[0];
    expect(output).toBeDefined();

    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty('version', getVersion());
    expect(parsed).not.toHaveProperty('githubUrl');
    expect(parsed).not.toHaveProperty('updateMessage');
  });

  it('should output valid JSON', async () => {
    await aboutCommand();
    
    const output = consoleSpy.mock.calls[0]?.[0];
    expect(() => JSON.parse(output)).not.toThrow();
  });

  it('should output only the version field', async () => {
    await aboutCommand();
    
    const output = consoleSpy.mock.calls[0]?.[0];
    const parsed = JSON.parse(output);
    expect(Object.keys(parsed)).toEqual(['version']);
  });
});
