import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { listIssueLinksCommand } from '../src/commands/list-issue-links.js';
import { createIssueLinkCommand } from '../src/commands/create-issue-link.js';
import { deleteIssueLinkCommand } from '../src/commands/delete-issue-link.js';
import { listLinkTypesCommand } from '../src/commands/list-link-types.js';
import * as jiraClient from '../src/lib/jira-client.js';
import * as formatters from '../src/lib/formatters.js';
import * as ui from '../src/lib/ui.js';
import { CommandError } from '../src/lib/errors.js';

vi.mock('../src/lib/jira-client.js');
vi.mock('../src/lib/formatters.js');
vi.mock('../src/lib/ui.js');

const mockJiraClient = jiraClient as vi.Mocked<typeof jiraClient>;
const mockFormatters = formatters as vi.Mocked<typeof formatters>;

const mockLink1 = {
  id: 'link-1',
  type: { id: 't1', name: 'Blocks', inward: 'is blocked by', outward: 'blocks' },
  inwardIssue: { id: '100', key: 'PROJ-1', summary: 'First issue', status: { name: 'To Do' } },
  outwardIssue: { id: '200', key: 'PROJ-2', summary: 'Second issue', status: { name: 'Done' } },
};

const mockLink2 = {
  id: 'link-2',
  type: { id: 't2', name: 'Relates', inward: 'is related to', outward: 'relates to' },
  inwardIssue: { id: '300', key: 'PROJ-3', summary: 'Third issue', status: { name: 'In Progress' } },
  outwardIssue: undefined,
};

const mockLinkType1 = { id: '1', name: 'Blocks', inward: 'is blocked by', outward: 'blocks' };
const mockLinkType2 = { id: '2', name: 'Relates', inward: 'is related to', outward: 'relates to' };

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.mocked(ui.ui.startSpinner).mockImplementation(() => {});
  vi.mocked(ui.ui.succeedSpinner).mockImplementation(() => {});
  vi.mocked(ui.ui.failSpinner).mockImplementation(() => {});
  mockJiraClient.validateIssuePermissions.mockResolvedValue({} as any);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// listIssueLinksCommand
// ---------------------------------------------------------------------------

describe('listIssueLinksCommand', () => {
  it('should start spinner, fetch links and display formatted output', async () => {
    mockJiraClient.getIssueLinks.mockResolvedValue([mockLink1, mockLink2]);
    mockFormatters.formatIssueLinks.mockReturnValue('formatted links');

    await listIssueLinksCommand('PROJ-3');

    expect(ui.ui.startSpinner).toHaveBeenCalledWith(expect.stringContaining('PROJ-3'));
    expect(mockJiraClient.getIssueLinks).toHaveBeenCalledWith('PROJ-3');
    expect(mockFormatters.formatIssueLinks).toHaveBeenCalledWith('PROJ-3', [mockLink1, mockLink2]);
    expect(console.log).toHaveBeenCalledWith('formatted links');
  });

  it('should succeed spinner on success', async () => {
    mockJiraClient.getIssueLinks.mockResolvedValue([mockLink1]);
    mockFormatters.formatIssueLinks.mockReturnValue('one link');

    await listIssueLinksCommand('PROJ-1');

    expect(ui.ui.succeedSpinner).toHaveBeenCalled();
  });

  it('should handle empty links list', async () => {
    mockJiraClient.getIssueLinks.mockResolvedValue([]);
    mockFormatters.formatIssueLinks.mockReturnValue('No links found');

    await listIssueLinksCommand('PROJ-1');

    expect(mockFormatters.formatIssueLinks).toHaveBeenCalledWith('PROJ-1', []);
  });

  it('should throw CommandError with 404 hint when issue not found', async () => {
    mockJiraClient.getIssueLinks.mockRejectedValue(new Error('404 Not Found'));

    await expect(listIssueLinksCommand('PROJ-999')).rejects.toThrow(CommandError);
    await expect(listIssueLinksCommand('PROJ-999')).rejects.toMatchObject({
      message: expect.stringContaining('Failed to list issue links'),
    });
  });

  it('should throw CommandError with 403 hint when lacking permissions', async () => {
    mockJiraClient.getIssueLinks.mockRejectedValue(new Error('403 Forbidden'));

    await expect(listIssueLinksCommand('PROJ-1')).rejects.toThrow(CommandError);
  });

  it('should throw ValidationError for invalid issue key', async () => {
    await expect(listIssueLinksCommand('invalid-key')).rejects.toThrow();
  });

  it('should re-throw CommandError as-is', async () => {
    const original = new CommandError('Already a CommandError');
    mockJiraClient.getIssueLinks.mockRejectedValue(original);

    await expect(listIssueLinksCommand('PROJ-1')).rejects.toBe(original);
  });
});

// ---------------------------------------------------------------------------
// createIssueLinkCommand
// ---------------------------------------------------------------------------

describe('createIssueLinkCommand', () => {
  it('should create a link and display success message', async () => {
    mockJiraClient.createIssueLink.mockResolvedValue(undefined);

    await createIssueLinkCommand('PROJ-1', 'Blocks', 'PROJ-2');

    expect(mockJiraClient.validateIssuePermissions).toHaveBeenCalledWith('PROJ-1', 'issue.link.create');
    expect(mockJiraClient.createIssueLink).toHaveBeenCalledWith('PROJ-1', 'PROJ-2', 'Blocks');
    expect(ui.ui.succeedSpinner).toHaveBeenCalled();
  });

  it('should start spinner before creating link', async () => {
    mockJiraClient.createIssueLink.mockResolvedValue(undefined);

    await createIssueLinkCommand('PROJ-1', 'Relates', 'PROJ-2');

    expect(ui.ui.startSpinner).toHaveBeenCalledWith(expect.stringContaining('PROJ-1'));
  });

  it('should trim whitespace from link type', async () => {
    mockJiraClient.createIssueLink.mockResolvedValue(undefined);

    await createIssueLinkCommand('PROJ-1', '  Blocks  ', 'PROJ-2');

    expect(mockJiraClient.createIssueLink).toHaveBeenCalledWith('PROJ-1', 'PROJ-2', 'Blocks');
  });

  it('should throw CommandError when link type is empty', async () => {
    await expect(createIssueLinkCommand('PROJ-1', '', 'PROJ-2')).rejects.toThrow(CommandError);
    await expect(createIssueLinkCommand('PROJ-1', '   ', 'PROJ-2')).rejects.toThrow(CommandError);
  });

  it('should throw ValidationError for invalid inward issue key', async () => {
    await expect(createIssueLinkCommand('not-a-key', 'Blocks', 'PROJ-2')).rejects.toThrow();
  });

  it('should throw ValidationError for invalid outward issue key', async () => {
    await expect(createIssueLinkCommand('PROJ-1', 'Blocks', 'not-a-key')).rejects.toThrow();
  });

  it('should throw CommandError with 404 hint when issue not found', async () => {
    mockJiraClient.createIssueLink.mockRejectedValue(new Error('404 Not Found'));

    await expect(createIssueLinkCommand('PROJ-1', 'Blocks', 'PROJ-999')).rejects.toThrow(
      CommandError
    );
  });

  it('should throw CommandError with 400 hint for invalid link type', async () => {
    mockJiraClient.createIssueLink.mockRejectedValue(new Error('400 Bad Request'));

    await expect(createIssueLinkCommand('PROJ-1', 'FakeType', 'PROJ-2')).rejects.toMatchObject({
      message: expect.stringContaining('Failed to create issue link'),
    });
  });

  it('should re-throw CommandError as-is', async () => {
    const original = new CommandError('Already a CommandError');
    mockJiraClient.createIssueLink.mockRejectedValue(original);

    await expect(createIssueLinkCommand('PROJ-1', 'Blocks', 'PROJ-2')).rejects.toBe(original);
  });
});

// ---------------------------------------------------------------------------
// deleteIssueLinkCommand
// ---------------------------------------------------------------------------

describe('deleteIssueLinkCommand', () => {
  it('should find link by target key and delete it', async () => {
    mockJiraClient.getIssueLinks.mockResolvedValue([mockLink1]);
    mockJiraClient.deleteIssueLink.mockResolvedValue(undefined);

    await deleteIssueLinkCommand('PROJ-1', 'PROJ-2');

    expect(mockJiraClient.getIssueLinks).toHaveBeenCalledWith('PROJ-1');
    expect(mockJiraClient.deleteIssueLink).toHaveBeenCalledWith('link-1');
    expect(ui.ui.succeedSpinner).toHaveBeenCalled();
  });

  it('should match link by outwardIssue key', async () => {
    mockJiraClient.getIssueLinks.mockResolvedValue([
      { ...mockLink1, inwardIssue: undefined, outwardIssue: { id: '200', key: 'PROJ-2', summary: 'Second', status: { name: 'Done' } } },
    ]);
    mockJiraClient.deleteIssueLink.mockResolvedValue(undefined);

    await deleteIssueLinkCommand('PROJ-1', 'PROJ-2');

    expect(mockJiraClient.deleteIssueLink).toHaveBeenCalledWith('link-1');
  });

  it('should throw CommandError when no link found between the two issues', async () => {
    mockJiraClient.getIssueLinks.mockResolvedValue([mockLink1]);

    await expect(deleteIssueLinkCommand('PROJ-1', 'PROJ-99')).rejects.toThrow(CommandError);
    await expect(deleteIssueLinkCommand('PROJ-1', 'PROJ-99')).rejects.toMatchObject({
      message: expect.stringContaining('No link found'),
    });
  });

  it('should throw CommandError when multiple links found between same issues', async () => {
    const duplLink = { ...mockLink1, id: 'link-dupe' };
    mockJiraClient.getIssueLinks.mockResolvedValue([mockLink1, duplLink]);

    await expect(deleteIssueLinkCommand('PROJ-1', 'PROJ-2')).rejects.toThrow(CommandError);
    await expect(deleteIssueLinkCommand('PROJ-1', 'PROJ-2')).rejects.toMatchObject({
      message: expect.stringContaining('Multiple links found'),
    });
  });

  it('should throw ValidationError for invalid source issue key', async () => {
    await expect(deleteIssueLinkCommand('bad-key', 'PROJ-2')).rejects.toThrow();
  });

  it('should throw ValidationError for invalid target issue key', async () => {
    await expect(deleteIssueLinkCommand('PROJ-1', 'bad-key')).rejects.toThrow();
  });

  it('should throw CommandError with 404 hint when issue not found during lookup', async () => {
    mockJiraClient.getIssueLinks.mockRejectedValue(new Error('404 Not Found'));

    await expect(deleteIssueLinkCommand('PROJ-1', 'PROJ-2')).rejects.toThrow(CommandError);
  });

  it('should re-throw CommandError as-is', async () => {
    const original = new CommandError('Already a CommandError');
    mockJiraClient.getIssueLinks.mockRejectedValue(original);

    await expect(deleteIssueLinkCommand('PROJ-1', 'PROJ-2')).rejects.toBe(original);
  });
});

// ---------------------------------------------------------------------------
// listLinkTypesCommand
// ---------------------------------------------------------------------------

describe('listLinkTypesCommand', () => {
  it('should fetch link types and display formatted output', async () => {
    mockJiraClient.getAvailableLinkTypes.mockResolvedValue([mockLinkType1, mockLinkType2]);
    mockFormatters.formatLinkTypes.mockReturnValue('formatted link types');

    await listLinkTypesCommand();

    expect(mockJiraClient.getAvailableLinkTypes).toHaveBeenCalled();
    expect(mockFormatters.formatLinkTypes).toHaveBeenCalledWith([mockLinkType1, mockLinkType2]);
    expect(console.log).toHaveBeenCalledWith('formatted link types');
  });

  it('should start and succeed spinner', async () => {
    mockJiraClient.getAvailableLinkTypes.mockResolvedValue([mockLinkType1]);
    mockFormatters.formatLinkTypes.mockReturnValue('types');

    await listLinkTypesCommand();

    expect(ui.ui.startSpinner).toHaveBeenCalledWith(expect.stringContaining('link type'));
    expect(ui.ui.succeedSpinner).toHaveBeenCalled();
  });

  it('should handle empty link types list', async () => {
    mockJiraClient.getAvailableLinkTypes.mockResolvedValue([]);
    mockFormatters.formatLinkTypes.mockReturnValue('No link types');

    await listLinkTypesCommand();

    expect(mockFormatters.formatLinkTypes).toHaveBeenCalledWith([]);
  });

  it('should throw CommandError on API failure', async () => {
    mockJiraClient.getAvailableLinkTypes.mockRejectedValue(new Error('500 Server Error'));

    await expect(listLinkTypesCommand()).rejects.toThrow(CommandError);
    await expect(listLinkTypesCommand()).rejects.toMatchObject({
      message: expect.stringContaining('Failed to list link types'),
    });
  });

  it('should throw CommandError with 403 hint when lacking permissions', async () => {
    mockJiraClient.getAvailableLinkTypes.mockRejectedValue(new Error('403 Forbidden'));

    await expect(listLinkTypesCommand()).rejects.toThrow(CommandError);
  });

  it('should re-throw CommandError as-is', async () => {
    const original = new CommandError('Already a CommandError');
    mockJiraClient.getAvailableLinkTypes.mockRejectedValue(original);

    await expect(listLinkTypesCommand()).rejects.toBe(original);
  });
});
