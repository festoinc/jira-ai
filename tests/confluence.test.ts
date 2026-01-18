import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseConfluenceUrl, listSpaces, getSpacePagesHierarchy, addPageComment } from '../src/lib/confluence-client.js';

const mockGetSpaces = vi.fn();
const mockGetContent = vi.fn();
const mockGetContentById = vi.fn();
const mockUpdateContent = vi.fn();
const mockGetContentChildrenByType = vi.fn();
const mockCreateContent = vi.fn();

vi.mock('confluence.js', () => ({
  ConfluenceClient: vi.fn().mockImplementation(function() {
    return {
      config: { host: 'https://test.atlassian.net' },
      space: {
        getSpaces: mockGetSpaces,
      },
      content: {
        getContent: mockGetContent,
        getContentById: mockGetContentById,
        updateContent: mockUpdateContent,
        createContent: mockCreateContent,
      },
      contentChildrenAndDescendants: {
        getContentChildrenByType: mockGetContentChildrenByType,
      },
    };
  }),
}));

vi.mock('../src/lib/auth-storage.js', () => ({
  loadCredentials: vi.fn(() => ({ host: 'https://test.atlassian.net', email: 'test@example.com', apiToken: 'token' })),
  getCurrentOrganizationAlias: vi.fn(() => 'test-org'),
  setOrganizationOverride: vi.fn(),
}));

describe('Confluence Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Confluence URL Parsing', () => {
    it('should parse standard wiki pages URL', () => {
      const url = 'https://example.atlassian.net/wiki/spaces/SPACE/pages/123456789/Page+Title';
      expect(parseConfluenceUrl(url)).toEqual({ pageId: '123456789', spaceKey: 'SPACE' });
    });

    it('should parse viewpage.action URL with pageId', () => {
      const url = 'https://example.atlassian.net/wiki/pages/viewpage.action?pageId=987654321';
      expect(parseConfluenceUrl(url)).toEqual({ pageId: '987654321', spaceKey: undefined });
    });

    it('should parse viewpage.action URL with space and pageId', () => {
      const url = 'https://example.atlassian.net/wiki/spaces/TS/pages/viewpage.action?pageId=456';
      expect(parseConfluenceUrl(url)).toEqual({ pageId: '456', spaceKey: 'TS' });
    });

    it('should throw error for invalid URL', () => {
      const url = 'https://example.com/not-confluence';
      expect(() => parseConfluenceUrl(url)).toThrow('Could not extract Page ID from URL');
    });

    it('should parse URL with multiple query parameters', () => {
      const url = 'https://example.atlassian.net/wiki/pages/viewpage.action?pageId=123&focusedCommentId=456';
      expect(parseConfluenceUrl(url)).toEqual({ pageId: '123', spaceKey: undefined });
    });

    it('should parse URL with trailing slash', () => {
      const url = 'https://example.atlassian.net/wiki/spaces/SPACE/pages/123456789/';
      expect(parseConfluenceUrl(url)).toEqual({ pageId: '123456789', spaceKey: 'SPACE' });
    });

    it('should parse URL without /wiki prefix', () => {
      const url = 'https://example.atlassian.net/spaces/SPACE/pages/123456789/Page+Title';
      expect(parseConfluenceUrl(url)).toEqual({ pageId: '123456789', spaceKey: 'SPACE' });
    });
  });

  describe('listSpaces', () => {
    it('should fetch and format spaces', async () => {
      mockGetSpaces.mockResolvedValue({
        results: [
          { key: 'SPACE1', name: 'Space One' },
          { key: 'SPACE2', name: 'Space Two' },
        ],
      });

      const spaces = await listSpaces();
      expect(spaces).toEqual([
        { key: 'SPACE1', name: 'Space One' },
        { key: 'SPACE2', name: 'Space Two' },
      ]);
      expect(mockGetSpaces).toHaveBeenCalledWith({ limit: 50 });
    });
  });

  describe('getSpacePagesHierarchy', () => {
    it('should fetch root pages and their children', async () => {
      mockGetContent.mockResolvedValue({
        results: [
          { id: '1', title: 'Root Page', ancestors: [] },
          { id: '2', title: 'Child Page', ancestors: [{ id: '1' }] },
        ],
      });

      mockGetContentChildrenByType.mockResolvedValueOnce({
        results: [
          { id: '2', title: 'Child Page' },
        ],
      });
      mockGetContentChildrenByType.mockResolvedValue({ results: [] });

      const hierarchy = await getSpacePagesHierarchy('SPACE1', 2);
      
      expect(hierarchy).toHaveLength(1);
      expect(hierarchy[0].id).toBe('1');
      expect(hierarchy[0].children).toHaveLength(1);
      expect(hierarchy[0].children[0].id).toBe('2');
    });
  });

  describe('addPageComment', () => {
    it('should call createContent with correct parameters', async () => {
      const url = 'https://example.atlassian.net/wiki/spaces/SPACE/pages/123456789/Page+Title';
      const adfContent = { type: 'doc', content: [] };
      
      mockCreateContent.mockResolvedValue({ id: 'comment-1' });

      await addPageComment(url, adfContent);

      expect(mockCreateContent).toHaveBeenCalledWith({
        type: 'comment',
        container: { id: '123456789', type: 'page' },
        body: {
          atlas_doc_format: {
            value: JSON.stringify(adfContent),
            representation: 'atlas_doc_format',
          },
        },
      });
    });
  });

  describe('createPage', () => {
    it('should call createContent with correct parameters for a root page', async () => {
      const spaceKey = 'SPACE';
      const title = 'New Page';
      const createdId = '789';
      
      mockCreateContent.mockResolvedValue({ id: createdId });

      // @ts-ignore - we'll implement this soon
      const { createPage } = await import('../src/lib/confluence-client.js');
      const url = await createPage(spaceKey, title);

      expect(mockCreateContent).toHaveBeenCalledWith({
        type: 'page',
        title: title,
        space: { key: spaceKey },
        body: {
          atlas_doc_format: {
            value: JSON.stringify({ type: 'doc', version: 1, content: [] }),
            representation: 'atlas_doc_format',
          },
        },
      });
      expect(url).toBe(`https://test.atlassian.net/pages/${createdId}`);
    });

    it('should call createContent with ancestors when parentId is provided', async () => {
      const spaceKey = 'SPACE';
      const title = 'Sub Page';
      const parentId = '123';
      const createdId = '456';
      
      mockCreateContent.mockResolvedValue({ id: createdId });

      // @ts-ignore
      const { createPage } = await import('../src/lib/confluence-client.js');
      await createPage(spaceKey, title, parentId);

      expect(mockCreateContent).toHaveBeenCalledWith({
        type: 'page',
        title: title,
        space: { key: spaceKey },
        ancestors: [{ id: parentId }],
        body: {
          atlas_doc_format: {
            value: JSON.stringify({ type: 'doc', version: 1, content: [] }),
            representation: 'atlas_doc_format',
          },
        },
      });
    });
  });

  describe('updatePageContent', () => {
    it('should call updateContent with correct parameters', async () => {
      const url = 'https://example.atlassian.net/wiki/spaces/SPACE/pages/123/Title';
      const adfContent = { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [] }] };
      const pageId = '123';
      
      mockGetContentById.mockResolvedValue({
        id: pageId,
        version: { number: 1 },
        title: 'Original Title',
        space: { key: 'SPACE' }
      });
      mockUpdateContent.mockResolvedValue({ id: pageId });

      // @ts-ignore
      const { updatePageContent } = await import('../src/lib/confluence-client.js');
      await updatePageContent(url, adfContent);

      expect(mockGetContentById).toHaveBeenCalledWith({
        id: pageId,
        expand: ['version', 'space'],
      });

      expect(mockUpdateContent).toHaveBeenCalledWith({
        id: pageId,
        version: { number: 2 },
        title: 'Original Title',
        type: 'page',
        body: {
          atlas_doc_format: {
            value: JSON.stringify(adfContent),
            representation: 'atlas_doc_format',
          },
        },
      });
    });

    it('should throw CommandError when 409 conflict occurs', async () => {
      const url = 'https://example.atlassian.net/wiki/spaces/SPACE/pages/123/Title';
      const adfContent = { type: 'doc', content: [] };
      
      mockGetContentById.mockResolvedValue({
        id: '123',
        version: { number: 1 },
        title: 'Title',
        space: { key: 'SPACE' }
      });
      mockUpdateContent.mockRejectedValue({
        message: 'Conflict',
        status: 409
      });

      // @ts-ignore
      const { updatePageContent } = await import('../src/lib/confluence-client.js');
      await expect(updatePageContent(url, adfContent)).rejects.toThrow(/version mismatch/i);
    });
  });
});