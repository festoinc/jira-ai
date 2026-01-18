import { describe, it, expect, vi, beforeEach } from 'vitest';
import { confluenceListSpacesCommand, confluenceGetSpacePagesHierarchyCommand, confluenceAddCommentCommand } from '../src/commands/confluence.js';
import * as confluenceClient from '../src/lib/confluence-client.js';
import * as settings from '../src/lib/settings.js';
import { ui } from '../src/lib/ui.js';
import * as fs from 'fs';
import { markdownToAdf } from 'marklassian';

vi.mock('../src/lib/confluence-client.js');
vi.mock('../src/lib/settings.js');
vi.mock('fs');
vi.mock('marklassian');
vi.mock('../src/lib/ui.js', () => ({
  ui: {
    startSpinner: vi.fn(),
    succeedSpinner: vi.fn(),
    failSpinner: vi.fn(),
  },
}));

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

      expect(ui.startSpinner).toHaveBeenCalled();
      expect(ui.succeedSpinner).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('ALLOWED'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Allowed Space'));
      expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('RESTRICTED'));
    });

    it('should show hint when no spaces are allowed', async () => {
      vi.mocked(confluenceClient.listSpaces).mockResolvedValue([{ key: 'S1', name: 'S1' }]);
      vi.mocked(settings.isConfluenceSpaceAllowed).mockReturnValue(false);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await confluenceListSpacesCommand();

      expect(ui.failSpinner).toHaveBeenCalledWith('No allowed Confluence spaces found.');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Hint: Add allowed spaces'));
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

      expect(ui.startSpinner).toHaveBeenCalledWith(expect.stringContaining('ALLOWED'));
      expect(ui.succeedSpinner).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Root'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('ID: 1'));
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
      expect(ui.succeedSpinner).toHaveBeenCalledWith(expect.stringContaining('successfully'));
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

      expect(ui.startSpinner).toHaveBeenCalledWith(expect.stringContaining('Creating Confluence page'));
      // @ts-ignore
      expect(confluenceClient.createPage).toHaveBeenCalledWith(space, title, undefined);
      expect(ui.succeedSpinner).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining(createdUrl));
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
      expect(confluenceClient.createPage).toHaveBeenCalledWith(space, title, parent);
      expect(ui.succeedSpinner).toHaveBeenCalled();
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
});
