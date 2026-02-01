import { describe, it, expect, vi } from 'vitest';
import { formatConfluenceSearchResults } from '../src/lib/formatters.js';
import Table from 'cli-table3';

// Mock Table to inspect constructor arguments
const tableCalls: any[] = [];
vi.mock('cli-table3', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    default: class MockTable extends actual.default {
      constructor(options: any) {
        super(options);
        tableCalls.push(options);
      }
    }
  };
});

describe('Issue 109: Confluence Search URL Column Width', () => {
  it('should use dynamic widths instead of fixed widths for URL column', () => {
    const longUrl = 'https://test.atlassian.net/wiki/spaces/VERYLONGSPACENAME/pages/123456789/This+is+a+very+long+page+title+that+will+definitely+exceed+fifty+characters';
    const mockResults = [
      {
        id: '1',
        title: 'Short title',
        space: 'Space',
        lastUpdated: '2023-01-01T10:00:00.000Z',
        url: longUrl,
        author: 'User',
        content: '',
      },
    ];

    formatConfluenceSearchResults(mockResults as any);
    
    const lastCall = tableCalls[tableCalls.length - 1];
    
    // Currently it's [40, 20, 22, 50]
    // We want the last element to be at least longUrl.length + 2 (for padding)
    expect(lastCall.colWidths[3]).toBeGreaterThanOrEqual(longUrl.length);
  });
});
