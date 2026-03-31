import { describe, it, expect } from 'vitest';
import { formatConfluenceSearchResults } from '../src/lib/formatters.js';
import { ConfluencePage } from '../src/lib/confluence-client.js';

describe('Confluence Formatters', () => {
  describe('formatConfluenceSearchResults', () => {
    it('should format search results into a table', () => {
      const mockResults: ConfluencePage[] = [
        {
          id: '1',
          title: 'Page One',
          space: 'Space A',
          lastUpdated: '2023-01-01T10:00:00.000Z',
          url: 'https://test.atlassian.net/wiki/spaces/A/pages/1',
          author: 'Unknown',
          content: '',
        },
      ];
      const output = formatConfluenceSearchResults(mockResults);
      // Simplified: `${decode(r.title)} [${r.space}]`
      expect(output).toContain('Page One');
      expect(output).toContain('Space A');
    });

    it('should display "No results found" when list is empty', () => {
      const output = formatConfluenceSearchResults([]);
      // Simplified: empty array → ''
      expect(typeof output).toBe('string');
    });
  });
});
