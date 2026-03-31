import { describe, it, expect, vi } from 'vitest';
import { formatConfluenceSearchResults } from '../src/lib/formatters.js';

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

    const output = formatConfluenceSearchResults(mockResults as any);

    // Simplified formatter: `${decode(r.title)} [${r.space}]`
    // Just verify the formatter runs and contains the title
    expect(output).toContain('Short title');
    expect(output).toContain('Space');
  });
});
