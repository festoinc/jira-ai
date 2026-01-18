import { describe, it, expect, vi, beforeEach } from 'vitest';
import { confluenceListSpacesCommand, confluenceGetSpacePagesHierarchyCommand } from '../src/commands/confluence.js';
import * as confluenceClient from '../src/lib/confluence-client.js';
import * as settings from '../src/lib/settings.js';
import { ui } from '../src/lib/ui.js';

vi.mock('../src/lib/confluence-client.js');
vi.mock('../src/lib/settings.js');
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
});
