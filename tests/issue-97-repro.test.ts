import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPageComments } from '../src/lib/confluence-client.js';

const mockGetDescendantsOfType = vi.fn();

vi.mock('confluence.js', () => ({
  ConfluenceClient: vi.fn().mockImplementation(function() {
    return {
      contentChildrenAndDescendants: {
        getDescendantsOfType: mockGetDescendantsOfType,
      },
    };
  }),
}));

vi.mock('../src/lib/auth-storage.js', () => ({
  loadCredentials: vi.fn(() => ({ host: 'https://test.atlassian.net', email: 'test@example.com', apiToken: 'token' })),
  getCurrentOrganizationAlias: vi.fn(() => 'test-org'),
}));

describe('Issue 97 Repro', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call getDescendantsOfType instead of getContentDescendantsByType', async () => {
    mockGetDescendantsOfType.mockResolvedValue({
      results: [],
    });

    const url = 'https://test.atlassian.net/wiki/spaces/SPACE/pages/123/Title';
    
    // This should fail if it still calls getContentDescendantsByType
    await getPageComments(url);

    expect(mockGetDescendantsOfType).toHaveBeenCalledWith(expect.objectContaining({
      id: '123',
      type: 'comment',
    }));
  });
});
