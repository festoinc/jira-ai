import { describe, it, expect, vi } from 'vitest';
import { getPage } from '../src/lib/confluence-client.js';

// Mock the confluence-client dependencies
vi.mock('../src/lib/auth-storage.js', () => ({
  loadCredentials: vi.fn().mockReturnValue({
    host: 'https://test.atlassian.net',
    email: 'test@example.com',
    apiToken: 'token'
  })
}));

const mockGetContentById = vi.fn();

vi.mock('confluence.js', () => {
  return {
    ConfluenceClient: vi.fn().mockImplementation(function() {
      return {
        content: {
          getContentById: mockGetContentById
        },
        config: {
          host: 'https://test.atlassian.net/wiki'
        }
      };
    })
  };
});

describe('Confluence getPage Reproduction', () => {
  it('should handle ADF body as string', async () => {
    mockGetContentById.mockResolvedValue({
      id: '123',
      title: 'Test Page',
      body: {
        atlas_doc_format: {
          value: JSON.stringify({ version: 1, type: 'doc', content: [] })
        }
      },
      space: { name: 'Test Space' },
      history: { createdBy: { displayName: 'Author' }, lastUpdated: { when: '2023-01-01' } }
    });

    const page = await getPage('https://test.atlassian.net/wiki/spaces/TS/pages/123');
    expect(page.id).toBe('123');
  });

  it('should handle ADF body as already an object', async () => {
    mockGetContentById.mockResolvedValue({
      id: '123',
      title: 'Test Page',
      body: {
        atlas_doc_format: {
          value: { version: 1, type: 'doc', content: [] } // Object instead of string
        }
      },
      space: { name: 'Test Space' },
      history: { createdBy: { displayName: 'Author' }, lastUpdated: { when: '2023-01-01' } }
    });

    const page = await getPage('https://test.atlassian.net/wiki/spaces/TS/pages/123');
    expect(page.id).toBe('123');
  });
});
