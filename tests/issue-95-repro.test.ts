import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPage, getPageComments } from '../src/lib/confluence-client.js';

const mockGetContentById = vi.fn();
const mockGetContentDescendantsByType = vi.fn();

vi.mock('confluence.js', () => ({
  ConfluenceClient: vi.fn().mockImplementation(function() {
    return {
      config: { host: 'https://test.atlassian.net' },
      content: {
        getContentById: mockGetContentById,
      },
      contentChildrenAndDescendants: {
        getContentDescendantsByType: mockGetContentDescendantsByType,
      },
    };
  }),
}));

vi.mock('../src/lib/auth-storage.js', () => ({
  loadCredentials: vi.fn(() => ({ host: 'https://test.atlassian.net', email: 'test@example.com', apiToken: 'token' })),
  getCurrentOrganizationAlias: vi.fn(() => 'test-org'),
  setOrganizationOverride: vi.fn(),
}));

describe('Issue 95 Reproduction: Confluence comments and metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPage', () => {
    it('should correctly extract author and timestamp using broader history expansion', async () => {
      const url = 'https://test.atlassian.net/wiki/spaces/SPACE/pages/123/Title';
      mockGetContentById.mockResolvedValue({
        id: '123',
        title: 'Test Page',
        space: { name: 'Space Name' },
        history: {
          createdBy: { displayName: 'John Doe' },
          createdDate: '2023-01-01T00:00:00.000Z',
          lastUpdated: { when: '2023-01-02T00:00:00.000Z' }
        },
        version: { when: '2023-01-02T00:00:00.000Z' },
        body: {
          atlas_doc_format: { value: JSON.stringify({ type: 'doc', content: [] }) }
        }
      });

      const page = await getPage(url);

      expect(page.author).toBe('John Doe');
      expect(page.lastUpdated).toBe('2023-01-02T00:00:00.000Z');
      expect(mockGetContentById).toHaveBeenCalledWith(expect.objectContaining({
        expand: expect.arrayContaining(['history'])
      }));
    });

    it('should fallback to version.when if history is missing', async () => {
        const url = 'https://test.atlassian.net/wiki/spaces/SPACE/pages/123/Title';
        mockGetContentById.mockResolvedValue({
          id: '123',
          title: 'Test Page',
          version: { when: '2023-01-02T00:00:00.000Z' },
          body: {
            atlas_doc_format: { value: JSON.stringify({ type: 'doc', content: [] }) }
          }
        });
  
        const page = await getPage(url);
        expect(page.lastUpdated).toBe('2023-01-02T00:00:00.000Z');
      });

    it('should extract author from version.by if history.createdBy is missing', async () => {
      const url = 'https://test.atlassian.net/wiki/spaces/SPACE/pages/123/Title';
      mockGetContentById.mockResolvedValue({
        id: '123',
        title: 'Test Page',
        version: { 
          when: '2023-01-02T00:00:00.000Z',
          by: { displayName: 'Jane Author' }
        },
        body: {
          atlas_doc_format: { value: JSON.stringify({ type: 'doc', content: [] }) }
        }
      });

      const page = await getPage(url);
      expect(page.author).toBe('Jane Author');
    });
  });

  describe('getPageComments', () => {
    it('should fetch comments with correct author and timestamp', async () => {
      const url = 'https://test.atlassian.net/wiki/spaces/SPACE/pages/123/Title';
      mockGetContentDescendantsByType.mockResolvedValue({
        results: [
          {
            id: 'comment-1',
            history: {
              createdBy: { displayName: 'Jane Smith' },
              createdDate: '2023-01-05T10:00:00.000Z'
            },
            body: {
              atlas_doc_format: { value: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }] }) }
            }
          }
        ]
      });

      const comments = await getPageComments(url);

      expect(comments).toHaveLength(1);
      expect(comments[0].author).toBe('Jane Smith');
      expect(comments[0].created).toBe('2023-01-05T10:00:00.000Z');
      expect(comments[0].body).toContain('Hello');
      expect(mockGetContentDescendantsByType).toHaveBeenCalledWith(expect.objectContaining({
        expand: expect.arrayContaining(['history'])
      }));
    });

    it('should handle author in version.by for comments', async () => {
      const url = 'https://test.atlassian.net/wiki/spaces/SPACE/pages/123/Title';
      mockGetContentDescendantsByType.mockResolvedValue({
        results: [
          {
            id: 'comment-2',
            version: { 
              when: '2023-01-06T10:00:00.000Z',
              by: { displayName: 'Commenter X' }
            },
            body: {
              storage: { value: 'Some storage content' }
            }
          }
        ]
      });

      const comments = await getPageComments(url);
      expect(comments[0].author).toBe('Commenter X');
      expect(comments[0].created).toBe('2023-01-06T10:00:00.000Z');
    });

    it('should handle missing ADF by falling back to storage format', async () => {
        const url = 'https://test.atlassian.net/wiki/spaces/SPACE/pages/123/Title';
        mockGetContentDescendantsByType.mockResolvedValue({
          results: [
            {
              id: 'comment-2',
              history: { createdBy: { displayName: 'Ghost' } },
              body: {
                storage: { value: '<p>Some HTML content</p>' }
              }
            }
          ]
        });
  
        const comments = await getPageComments(url);
        expect(comments[0].body).toBe('<p>Some HTML content</p>');
      });
  });
});
