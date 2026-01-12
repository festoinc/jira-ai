import { describe, it, expect } from 'vitest';
import { CommandError } from '../src/lib/errors.js';

describe('CommandError', () => {
  it('should create an error with default values', () => {
    const error = new CommandError('Test error');
    expect(error.message).toBe('Test error');
    expect(error.exitCode).toBe(1);
    expect(error.hints).toEqual([]);
    expect(error.name).toBe('CommandError');
  });

  it('should create an error with custom exit code and hints', () => {
    const hints = ['Try checking your connection', 'Verify API token'];
    const error = new CommandError('Test error', { exitCode: 2, hints });
    expect(error.message).toBe('Test error');
    expect(error.exitCode).toBe(2);
    expect(error.hints).toEqual(hints);
  });
});
