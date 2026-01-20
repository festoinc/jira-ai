import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processMentionsInADF } from '../src/lib/adf-mentions.js';

describe('ADF Mentions Processor', () => {
  const mockUserResolver = {
    resolveUser: vi.fn()
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should not change ADF without mentions', async () => {
    const adf = {
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Hello world'
            }
          ]
        }
      ]
    };

    const result = await processMentionsInADF(adf, mockUserResolver.resolveUser);
    expect(result).toEqual(adf);
  });

  it('should replace @DisplayName with mention node', async () => {
    const adf = {
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Hello @Anatolii how are you'
            }
          ]
        }
      ]
    };

    mockUserResolver.resolveUser.mockImplementation(async (name) => {
      return name === 'Anatolii' ? 'account-id-123' : null;
    });

    const result = await processMentionsInADF(adf, mockUserResolver.resolveUser);

    expect(mockUserResolver.resolveUser).toHaveBeenCalledWith('Anatolii');
    expect(result.content[0].content).toHaveLength(3);
    expect(result.content[0].content[0]).toEqual({ type: 'text', text: 'Hello ' });
    expect(result.content[0].content[1]).toEqual({
      type: 'mention',
      attrs: {
        id: 'account-id-123',
        text: '@Anatolii'
      }
    });
    expect(result.content[0].content[2]).toEqual({ type: 'text', text: ' how are you' });
  });

  it('should support [[~DisplayName]] syntax', async () => {
    const adf = {
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Meeting with [[~Anatolii Fesiuk]]'
            }
          ]
        }
      ]
    };

    mockUserResolver.resolveUser.mockResolvedValue('account-id-456');

    const result = await processMentionsInADF(adf, mockUserResolver.resolveUser);

    expect(mockUserResolver.resolveUser).toHaveBeenCalledWith('Anatolii Fesiuk');
    expect(result.content[0].content[1]).toEqual({
      type: 'mention',
      attrs: {
        id: 'account-id-456',
        text: '@Anatolii Fesiuk'
      }
    });
  });

  it('should not replace if user is not resolved', async () => {
    const adf = {
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Hello @UnknownUser'
            }
          ]
        }
      ]
    };

    mockUserResolver.resolveUser.mockResolvedValue(null);

    const result = await processMentionsInADF(adf, mockUserResolver.resolveUser);

    expect(result).toEqual(adf);
  });

  it('should handle multiple mentions in same text node', async () => {
    const adf = {
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: '@UserA and @UserB'
            }
          ]
        }
      ]
    };

    mockUserResolver.resolveUser.mockImplementation(async (name) => {
      if (name === 'UserA') return 'id-a';
      if (name === 'UserB') return 'id-b';
      return null;
    });

    const result = await processMentionsInADF(adf, mockUserResolver.resolveUser);

    expect(result.content[0].content).toHaveLength(3);
    expect(result.content[0].content[0]).toEqual({
      type: 'mention',
      attrs: { id: 'id-a', text: '@UserA' }
    });
    expect(result.content[0].content[1]).toEqual({ type: 'text', text: ' and ' });
    expect(result.content[0].content[2]).toEqual({
      type: 'mention',
      attrs: { id: 'id-b', text: '@UserB' }
    });
  });
});
