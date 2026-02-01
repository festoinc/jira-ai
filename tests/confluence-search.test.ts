import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchContent } from '../src/lib/confluence-client.js';

const mockSearchContent = vi.fn();

vi.mock('confluence.js', () => ({
  ConfluenceClient: vi.fn().mockImplementation(function() {
    return {
      config: { host: 'https://test.atlassian.net' },
      search: {
        searchContent: mockSearchContent,
      },
    };
  }),
}));

vi.mock('../src/lib/auth-storage.js', () => ({
  loadCredentials: vi.fn(() => ({ host: 'https://test.atlassian.net', email: 'test@example.com', apiToken: 'token' })),
  getCurrentOrganizationAlias: vi.fn(() => 'test-org'),
  setOrganizationOverride: vi.fn(),
}));

describe('Confluence Search Content', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call searchContent with correct parameters', async () => {
    mockSearchContent.mockResolvedValue({
      results: [
        {
          content: {
            id: '123',
            title: 'Test Page',
            type: 'page',
            _links: { webui: '/spaces/TS/pages/123/Test+Page' },
          },
          lastModified: '2023-01-01T00:00:00.000Z',
          resultGlobalContainer: { title: 'Test Space', displayUrl: '/spaces/TS' },
        },
      ],
    });

    const results = await searchContent('test query', 10);

    expect(mockSearchContent).toHaveBeenCalledWith({
      cql: 'text ~ "test query"',
      limit: 10,
    });
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      id: '123',
      title: 'Test Page',
      space: 'Test Space',
      lastUpdated: '2023-01-01T00:00:00.000Z',
      url: 'https://test.atlassian.net/spaces/TS/pages/123/Test+Page',
      author: 'Unknown',
      content: '',
    });
  });
});
