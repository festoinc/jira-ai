import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchContent } from '../src/lib/confluence-client.js';

const mockSearchByCQL = vi.fn();

vi.mock('confluence.js', () => ({
  ConfluenceClient: vi.fn().mockImplementation(function() {
    return {
      config: { host: 'https://test.atlassian.net' },
      search: {
        searchByCQL: mockSearchByCQL,
      },
    };
  }),
}));

vi.mock('../src/lib/auth-storage.js', () => ({
  loadCredentials: vi.fn(() => ({ host: 'https://test.atlassian.net', email: 'test@example.com', apiToken: 'token' })),
  getCurrentOrganizationAlias: vi.fn(() => 'test-org'),
  setOrganizationOverride: vi.fn(),
}));

vi.mock('../src/lib/settings.js', () => ({
  isConfluenceSpaceAllowed: vi.fn(() => true),
  getAllowedConfluenceSpaces: vi.fn(() => ['all']),
}));

import { getAllowedConfluenceSpaces } from '../src/lib/settings.js';

describe('Confluence Search Content', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call searchByCQL with correct parameters when all spaces allowed', async () => {
    vi.mocked(getAllowedConfluenceSpaces).mockReturnValue(['all']);
    mockSearchByCQL.mockResolvedValue({
      results: [
        {
          content: {
            id: '123',
            title: 'Test Page',
            type: 'page',
            _links: { webui: '/spaces/TS/pages/123/Test+Page' },
            space: { key: 'TS', name: 'Test Space' },
          },
          lastModified: '2023-01-01T00:00:00.000Z',
          title: 'Test Page',
        },
      ],
    });

    const results = await searchContent('test query', 10);

    expect(mockSearchByCQL).toHaveBeenCalledWith({
      cql: 'text ~ "test query"',
      limit: 10,
      expand: ['content.space'],
    });
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      id: '123',
      title: 'Test Page',
      space: 'Test Space',
      spaceKey: 'TS',
      lastUpdated: '2023-01-01T00:00:00.000Z',
      url: 'https://test.atlassian.net/spaces/TS/pages/123/Test+Page',
      author: 'Unknown',
      content: '',
    });
  });

  it('should call searchByCQL with space filtering when restricted', async () => {
    vi.mocked(getAllowedConfluenceSpaces).mockReturnValue(['TS1', 'TS2']);
    mockSearchByCQL.mockResolvedValue({
      results: [],
    });

    await searchContent('test query', 10);

    expect(mockSearchByCQL).toHaveBeenCalledWith({
      cql: 'text ~ "test query" AND space in ("TS1","TS2")',
      limit: 10,
      expand: ['content.space'],
    });
  });
});

