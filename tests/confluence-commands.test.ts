import { describe, it, expect, vi, beforeEach } from 'vitest';
import { confluenceListSpacesCommand, confluenceGetSpacePagesHierarchyCommand, confluenceAddCommentCommand, confluenceUpdateDescriptionCommand } from '../src/commands/confluence.js';
import * as confluenceClient from '../src/lib/confluence-client.js';
import * as settings from '../src/lib/settings.js';
import * as fs from 'fs';
import { markdownToAdf } from 'marklassian';

vi.mock('../src/lib/confluence-client.js');
vi.mock('../src/lib/settings.js');
vi.mock('fs');
vi.mock('marklassian');

describe('Confluence Commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('confluenceListSpacesCommand', () => {
    it('should list allowed spaces', async () => {
      const mockSpaces = [
        { key: 'ALLOWED', name: 'Allowed Space' },
        { key: 'RESTRICTED', name: 'Restricted Space' },
      ];
      vi.mocked(confluenceClient.listSpaces).mockResolvedValue(mockSpaces);
      vi.mocked(settings.isConfluenceSpaceAllowed).mockImplementation((key) => key === 'ALLOWED');

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await confluenceListSpacesCommand();

      const output = consoleSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed).toHaveLength(1);
      expect(parsed[0]).toHaveProperty('key', 'ALLOWED');
      expect(parsed[0]).toHaveProperty('name', 'Allowed Space');
      consoleSpy.mockRestore();
    });

    it('should show hint when no spaces are allowed', async () => {
      vi.mocked(confluenceClient.listSpaces).mockResolvedValue([{ key: 'S1', name: 'S1' }]);
      vi.mocked(settings.isConfluenceSpaceAllowed).mockReturnValue(false);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await confluenceListSpacesCommand();

      // Returns empty filtered array as JSON
      const output = consoleSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed).toHaveLength(0);
      consoleSpy.mockRestore();
    });
  });

  describe('confluenceGetSpacePagesHierarchyCommand', () => {
    it('should display hierarchy for allowed space', async () => {
      vi.mocked(settings.isConfluenceSpaceAllowed).mockReturnValue(true);
      const mockHierarchy = [
        { id: '1', title: 'Root', children: [] },
      ];
      vi.mocked(confluenceClient.getSpacePagesHierarchy).mockResolvedValue(mockHierarchy);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await confluenceGetSpacePagesHierarchyCommand('ALLOWED');

      const output = consoleSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed[0]).toHaveProperty('title', 'Root');
      expect(parsed[0]).toHaveProperty('id', '1');
      consoleSpy.mockRestore();
    });

    it('should throw error for restricted space', async () => {
      vi.mocked(settings.isConfluenceSpaceAllowed).mockReturnValue(false);

      await expect(confluenceGetSpacePagesHierarchyCommand('RESTRICTED'))
        .rejects.toThrow("Access to Confluence space 'RESTRICTED' is restricted by your settings.");
    });
  });

  describe('confluenceAddCommentCommand', () => {
    it('should add comment successfully', async () => {
      const url = 'https://example.atlassian.net/wiki/spaces/SPACE/pages/123/Title';
      const options = { fromFile: 'comment.md' };
      const markdown = '# Hello';
      const adf = { type: 'doc' };

      vi.mocked(confluenceClient.parseConfluenceUrl).mockReturnValue({ spaceKey: 'SPACE', pageId: '123' });
      vi.mocked(settings.isConfluenceSpaceAllowed).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(markdown);
      vi.mocked(markdownToAdf).mockReturnValue(adf);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await confluenceAddCommentCommand(url, options);

      expect(fs.readFileSync).toHaveBeenCalled();
      expect(markdownToAdf).toHaveBeenCalledWith(markdown);
      expect(confluenceClient.addPageComment).toHaveBeenCalledWith(url, adf);
      const output = consoleSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed).toHaveProperty('success', true);
      consoleSpy.mockRestore();
    });

    it('should throw error if space is restricted', async () => {
      const url = 'https://example.atlassian.net/wiki/spaces/RESTRICTED/pages/123/Title';
      vi.mocked(confluenceClient.parseConfluenceUrl).mockReturnValue({ spaceKey: 'RESTRICTED', pageId: '123' });
      vi.mocked(settings.isConfluenceSpaceAllowed).mockReturnValue(false);

      await expect(confluenceAddCommentCommand(url, { fromFile: 'test.md' }))
        .rejects.toThrow("Access to Confluence space 'RESTRICTED' is restricted by your settings.");
    });
  });

  describe('confluenceCreatePageCommand', () => {
    it('should create page successfully', async () => {
      const space = 'SPACE';
      const title = 'New Page';
      const createdUrl = 'https://test.atlassian.net/wiki/spaces/SPACE/pages/456';

      vi.mocked(settings.isConfluenceSpaceAllowed).mockReturnValue(true);
      // @ts-ignore
      vi.mocked(confluenceClient.createPage).mockResolvedValue(createdUrl);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // @ts-ignore
      const { confluenceCreatePageCommand } = await import('../src/commands/confluence.js');
      await confluenceCreatePageCommand(space, title);

      // @ts-ignore
      expect(confluenceClient.createPage).toHaveBeenCalledWith(space, title, undefined, { returnBoth: undefined });
      const output = consoleSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed).toHaveProperty('url', createdUrl);
      consoleSpy.mockRestore();
    });

    it('should create page with parent successfully', async () => {
      const space = 'SPACE';
      const title = 'Child Page';
      const parent = '123';
      const createdUrl = 'https://test.atlassian.net/wiki/spaces/SPACE/pages/456';

      vi.mocked(settings.isConfluenceSpaceAllowed).mockReturnValue(true);
      // @ts-ignore
      vi.mocked(confluenceClient.createPage).mockResolvedValue(createdUrl);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // @ts-ignore
      const { confluenceCreatePageCommand } = await import('../src/commands/confluence.js');
      await confluenceCreatePageCommand(space, title, parent);

      // @ts-ignore
      expect(confluenceClient.createPage).toHaveBeenCalledWith(space, title, parent, { returnBoth: undefined });
      consoleSpy.mockRestore();
    });

    it('should throw error if space is restricted', async () => {
      const space = 'RESTRICTED';
      vi.mocked(settings.isConfluenceSpaceAllowed).mockReturnValue(false);

      // @ts-ignore
      const { confluenceCreatePageCommand } = await import('../src/commands/confluence.js');
      await expect(confluenceCreatePageCommand(space, 'Title'))
        .rejects.toThrow("Access to Confluence space 'RESTRICTED' is restricted by your settings.");
    });
  });

  describe('confluenceUpdateDescriptionCommand', () => {
    it('should update page content successfully', async () => {
      const url = 'https://example.atlassian.net/wiki/spaces/SPACE/pages/123/Title';
      const options = { fromFile: 'content.md' };
      const markdown = '# New Content';
      const adf = { type: 'doc' };

      vi.mocked(confluenceClient.parseConfluenceUrl).mockReturnValue({ spaceKey: 'SPACE', pageId: '123' });
      vi.mocked(settings.isConfluenceSpaceAllowed).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(markdown);
      vi.mocked(markdownToAdf).mockReturnValue(adf);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await confluenceUpdateDescriptionCommand(url, options);

      expect(fs.readFileSync).toHaveBeenCalled();
      expect(markdownToAdf).toHaveBeenCalledWith(markdown);
      expect(confluenceClient.updatePageContent).toHaveBeenCalledWith(url, adf);
      const output = consoleSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed).toHaveProperty('success', true);
      consoleSpy.mockRestore();
    });

    it('should throw error if space is restricted', async () => {
      const url = 'https://example.atlassian.net/wiki/spaces/RESTRICTED/pages/123/Title';
      vi.mocked(confluenceClient.parseConfluenceUrl).mockReturnValue({ spaceKey: 'RESTRICTED', pageId: '123' });
      vi.mocked(settings.isConfluenceSpaceAllowed).mockReturnValue(false);

      await expect(confluenceUpdateDescriptionCommand(url, { fromFile: 'test.md' }))
        .rejects.toThrow("Access to Confluence space 'RESTRICTED' is restricted by your settings.");
    });
  });

  describe('confluenceSearchCommand', () => {
    it('should search and display results', async () => {
      const mockResults = [
        {
          id: '1',
          title: 'Found Page',
          space: 'SPACE',
          spaceKey: 'SPACE',
          lastUpdated: '2023-01-01T10:00:00.000Z',
          url: 'https://test.atlassian.net/wiki/spaces/SPACE/pages/1',
          author: 'Unknown',
          content: '',
        },
      ];
      // @ts-ignore
      vi.mocked(confluenceClient.searchContent).mockResolvedValue(mockResults);
      vi.mocked(settings.isConfluenceSpaceAllowed).mockReturnValue(true);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { confluenceSearchCommand } = await import('../src/commands/confluence.js');
      await confluenceSearchCommand('test query');

      expect(confluenceClient.searchContent).toHaveBeenCalledWith('test query', 20);
      const output = consoleSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed[0]).toHaveProperty('title', 'Found Page');
      expect(parsed[0]).toHaveProperty('space', 'SPACE');
      consoleSpy.mockRestore();
    });

    it('should filter results by allowed spaces', async () => {
      const mockResults = [
        {
          id: '1',
          title: 'Allowed Page',
          space: 'ALLOWED',
          spaceKey: 'ALLOWED',
          lastUpdated: '2023-01-01T10:00:00.000Z',
          url: 'https://test.atlassian.net/wiki/spaces/ALLOWED/pages/1',
          author: 'Unknown',
          content: '',
        },
        {
          id: '2',
          title: 'Restricted Page',
          space: 'RESTRICTED',
          spaceKey: 'RESTRICTED',
          lastUpdated: '2023-01-01T10:00:00.000Z',
          url: 'https://test.atlassian.net/wiki/spaces/RESTRICTED/pages/2',
          author: 'Unknown',
          content: '',
        },
      ];
      // @ts-ignore
      vi.mocked(confluenceClient.searchContent).mockResolvedValue(mockResults);
      vi.mocked(settings.isConfluenceSpaceAllowed).mockImplementation((space) => space === 'ALLOWED');

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { confluenceSearchCommand } = await import('../src/commands/confluence.js');
      await confluenceSearchCommand('test query');

      const output = consoleSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed).toHaveLength(1);
      expect(parsed[0]).toHaveProperty('title', 'Allowed Page');
      consoleSpy.mockRestore();
    });
  });
});
