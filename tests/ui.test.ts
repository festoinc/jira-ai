import { describe, it, expect, beforeEach } from 'vitest';
import { ui } from '../src/lib/ui.js';

describe('UI Spinner', () => {
  beforeEach(() => {
    // no-op spinner - nothing to reset
  });

  it('should start a spinner (no-op, returns null)', () => {
    const result = ui.startSpinner('Testing...');
    expect(result).toBeNull();
    expect(ui.spinner).toBeNull();
  });

  it('should stop a spinner (no-op)', () => {
    ui.startSpinner('Testing...');
    ui.stopSpinner();
    expect(ui.spinner).toBeNull();
  });

  it('should succeed a spinner (no-op)', () => {
    ui.startSpinner('Testing...');
    ui.succeedSpinner('Done!');
    expect(ui.spinner).toBeNull();
  });

  it('should fail a spinner (no-op)', () => {
    ui.startSpinner('Testing...');
    ui.failSpinner('Error!');
    expect(ui.spinner).toBeNull();
  });

  it('should handle multiple startSpinner calls without throwing', () => {
    expect(() => {
      ui.startSpinner('First');
      ui.startSpinner('Second');
    }).not.toThrow();
    expect(ui.spinner).toBeNull();
  });
});
