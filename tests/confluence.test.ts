import { describe, it, expect, vi } from 'vitest';
import { parseConfluenceUrl } from '../src/lib/confluence-client.js';

describe('Confluence URL Parsing', () => {
  it('should parse standard wiki pages URL', () => {
    const url = 'https://example.atlassian.net/wiki/spaces/SPACE/pages/123456789/Page+Title';
    expect(parseConfluenceUrl(url)).toBe('123456789');
  });

  it('should parse viewpage.action URL with pageId', () => {
    const url = 'https://example.atlassian.net/wiki/pages/viewpage.action?pageId=987654321';
    expect(parseConfluenceUrl(url)).toBe('987654321');
  });

  it('should parse viewpage.action URL with space and pageId', () => {
    const url = 'https://example.atlassian.net/wiki/spaces/TS/pages/viewpage.action?pageId=456';
    expect(parseConfluenceUrl(url)).toBe('456');
  });

  it('should throw error for invalid URL', () => {
    const url = 'https://example.com/not-confluence';
    expect(() => parseConfluenceUrl(url)).toThrow('Could not extract Page ID from URL');
  });
});
