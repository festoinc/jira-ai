import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseTimeframe } from '../src/lib/utils.js';

describe('parseTimeframe', () => {
  beforeEach(() => {
    // Mock today's date to 2026-01-13
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-13T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should parse 7d timeframe correctly', () => {
    const { startDate, endDate } = parseTimeframe('7d');
    // 2026-01-13 minus 7 days is 2026-01-06
    expect(startDate.toISOString().split('T')[0]).toBe('2026-01-06');
    expect(endDate.toISOString().split('T')[0]).toBe('2026-01-13');
  });

  it('should parse 30d timeframe correctly', () => {
    const { startDate, endDate } = parseTimeframe('30d');
    // 2026-01-13 minus 30 days
    // Jan 13 -> Jan 1 (12 days)
    // Dec 31 -> Dec 14 (18 days)
    // Total 30 days.
    expect(startDate.toISOString().split('T')[0]).toBe('2025-12-14');
    expect(endDate.toISOString().split('T')[0]).toBe('2026-01-13');
  });

  it('should throw error for invalid timeframe format', () => {
    expect(() => parseTimeframe('invalid')).toThrow('Invalid timeframe format');
  });
});
