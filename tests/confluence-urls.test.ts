import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPage, createPage } from '../src/lib/confluence-client.js';

const mockGetContentById = vi.fn();
const mockCreateContent = vi.fn();

vi.mock('confluence.js', () => ({
  ConfluenceClient: vi.fn().mockImplementation(function() {
    return {
      config: { host: 'https://test.atlassian.net' },
      content: {
        getContentById: mockGetContentById,
        createContent: mockCreateContent,
      },
    };
  }),
}));

vi.mock('../src/lib/auth-storage.js', () => ({
  loadCredentials: vi.fn(() => ({ host: 'https://test.atlassian.net', email: 'test@example.com', apiToken: 'token' })),
  getCurrentOrganizationAlias: vi.fn(() => 'test-org'),
  setOrganizationOverride: vi.fn(),
}));

describe('Confluence URL Generation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPage', () => {
    it('should return full URL using _links by default', async () => {
      mockGetContentById.mockResolvedValue({
        id: '123',
        title: 'Test Page',
        space: { name: 'Test Space', key: 'TS' },
        _links: {
          base: 'https://test.atlassian.net/wiki',
          webui: '/spaces/TS/pages/123/Test+Page'
        }
      });

      const page = await getPage('https://test.atlassian.net/wiki/spaces/TS/pages/123/Test+Page');
      expect(page.url).toBe('https://test.atlassian.net/wiki/spaces/TS/pages/123/Test+Page');
    });

    it('should fallback to short URL if _links are missing', async () => {
      mockGetContentById.mockResolvedValue({
        id: '123',
        title: 'Test Page',
        space: { name: 'Test Space', key: 'TS' }
      });

      const page = await getPage('https://test.atlassian.net/wiki/spaces/TS/pages/123/Test+Page');
      expect(page.url).toBe('https://test.atlassian.net/pages/123');
    });

    it('should return both URLs when returnBoth is true', async () => {
      mockGetContentById.mockResolvedValue({
        id: '123',
        title: 'Test Page',
        space: { name: 'Test Space', key: 'TS' },
        _links: {
          base: 'https://test.atlassian.net/wiki',
          webui: '/spaces/TS/pages/123/Test+Page'
        }
      });

      const page = await getPage('https://test.atlassian.net/wiki/spaces/TS/pages/123/Test+Page', { returnBoth: true });
      expect(page.url).toBe('https://test.atlassian.net/wiki/spaces/TS/pages/123/Test+Page');
      expect(page.shortUrl).toBe('https://test.atlassian.net/wiki/pages/123');
    });
  });

  describe('createPage', () => {
    it('should return full URL using _links by default', async () => {
      mockCreateContent.mockResolvedValue({
        id: '456',
        _links: {
          base: 'https://test.atlassian.net/wiki',
          webui: '/spaces/TS/pages/456/New+Page'
        }
      });

      const url = await createPage('TS', 'New+Page');
      expect(url).toBe('https://test.atlassian.net/wiki/spaces/TS/pages/456/New+Page');
    });

    it('should fallback to short URL if _links are missing', async () => {
      mockCreateContent.mockResolvedValue({
        id: '456'
      });

      const url = await createPage('TS', 'New+Page');
      expect(url).toBe('https://test.atlassian.net/pages/456');
    });

    it('should return both URLs when returnBoth is true', async () => {
      mockCreateContent.mockResolvedValue({
        id: '456',
        _links: {
          base: 'https://test.atlassian.net/wiki',
          webui: '/spaces/TS/pages/456/New+Page'
        }
      });

      const result = await createPage('TS', 'New+Page', undefined, { returnBoth: true });
      expect(result).toEqual({
        url: 'https://test.atlassian.net/wiki/spaces/TS/pages/456/New+Page',
        shortUrl: 'https://test.atlassian.net/wiki/pages/456'
      });
    });
  });
});
