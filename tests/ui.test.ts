import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ui } from '../src/lib/ui.js';
import ora from 'ora';

vi.mock('ora', () => {
  const start = vi.fn().mockReturnThis();
  const stop = vi.fn().mockReturnThis();
  const succeed = vi.fn().mockReturnThis();
  const fail = vi.fn().mockReturnThis();
  
  return {
    default: vi.fn(() => ({
      start,
      stop,
      succeed,
      fail,
    })),
  };
});

describe('UI Spinner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should start a spinner', () => {
    ui.startSpinner('Testing...');
    expect(ora).toHaveBeenCalledWith('Testing...');
    expect(ui.spinner).toBeDefined();
  });

  it('should stop a spinner', () => {
    ui.startSpinner('Testing...');
    ui.stopSpinner();
    const spinner = ui.spinner;
    expect(spinner).toBeNull();
  });

  it('should succeed a spinner', () => {
    ui.startSpinner('Testing...');
    ui.succeedSpinner('Done!');
    expect(ui.spinner).toBeNull();
  });

  it('should fail a spinner', () => {
    ui.startSpinner('Testing...');
    ui.failSpinner('Error!');
    expect(ui.spinner).toBeNull();
  });

  it('should stop previous spinner if a new one is started', () => {
    ui.startSpinner('First');
    const firstSpinner = ui.spinner;
    ui.startSpinner('Second');
    expect(firstSpinner?.stop).toHaveBeenCalled();
    expect(ora).toHaveBeenCalledWith('Second');
  });
});
