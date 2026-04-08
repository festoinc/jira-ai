import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest';
import {
  getIssueLinks,
  createIssueLink,
  deleteIssueLink,
  getAvailableLinkTypes,
  __resetJiraClient__,
} from '../src/lib/jira-client.js';
import * as authStorage from '../src/lib/auth-storage.js';
import * as settings from '../src/lib/settings.js';

const {
  mockGetIssue,
  mockLinkIssues,
  mockDeleteIssueLink,
  mockGetIssueLinkTypes,
  mockConfig,
} = vi.hoisted(() => ({
  mockGetIssue: vi.fn(),
  mockLinkIssues: vi.fn(),
  mockDeleteIssueLink: vi.fn(),
  mockGetIssueLinkTypes: vi.fn(),
  mockConfig: { host: 'https://test.atlassian.net' },
}));

vi.mock('jira.js', () => ({
  Version3Client: vi.fn().mockImplementation(function () {
    return {
      issues: {
        getIssue: mockGetIssue,
      },
      issueLinks: {
        linkIssues: mockLinkIssues,
        deleteIssueLink: mockDeleteIssueLink,
      },
      issueLinkTypes: {
        getIssueLinkTypes: mockGetIssueLinkTypes,
      },
      config: mockConfig,
    };
  }),
}));

vi.mock('../src/lib/settings.js');
vi.mock('../src/lib/auth-storage.js');

describe('Issue Link Client Functions', () => {
  beforeAll(() => {
    process.env.JIRA_HOST = 'https://test.atlassian.net';
    process.env.JIRA_USER_EMAIL = 'test@example.com';
    process.env.JIRA_API_TOKEN = 'test-token';
  });

  beforeEach(() => {
    vi.clearAllMocks();
    __resetJiraClient__();
    vi.mocked(authStorage.loadCredentials).mockReturnValue({
      host: 'https://test.atlassian.net',
      email: 'test@example.com',
      apiToken: 'test-token',
    });
    vi.mocked(settings.isProjectAllowed).mockReturnValue(true);
    vi.mocked(settings.isCommandAllowed).mockReturnValue(true);
  });

  describe('getIssueLinks', () => {
    it('should return mapped IssueLink array from raw issue links', async () => {
      mockGetIssue.mockResolvedValue({
        fields: {
          issuelinks: [
            {
              id: 'link-1',
              type: { id: 't1', name: 'Blocks', inward: 'is blocked by', outward: 'blocks' },
              inwardIssue: {
                id: '100',
                key: 'PROJ-1',
                fields: { summary: 'Inward summary', status: { name: 'To Do' } },
              },
              outwardIssue: {
                id: '200',
                key: 'PROJ-2',
                fields: { summary: 'Outward summary', status: { name: 'In Progress' } },
              },
            },
          ],
        },
      });

      const links = await getIssueLinks('PROJ-3');

      expect(mockGetIssue).toHaveBeenCalledWith({ issueIdOrKey: 'PROJ-3', fields: ['issuelinks', 'issuetype'] });
      expect(links).toHaveLength(1);
      expect(links[0].id).toBe('link-1');
      expect(links[0].type.name).toBe('Blocks');
      expect(links[0].inwardIssue?.key).toBe('PROJ-1');
      expect(links[0].inwardIssue?.summary).toBe('Inward summary');
      expect(links[0].outwardIssue?.key).toBe('PROJ-2');
      expect(links[0].outwardIssue?.summary).toBe('Outward summary');
    });

    it('should return empty array when issue has no links', async () => {
      mockGetIssue.mockResolvedValue({ fields: { issuelinks: [] } });

      const links = await getIssueLinks('PROJ-1');

      expect(links).toEqual([]);
    });

    it('should handle missing issuelinks field gracefully', async () => {
      mockGetIssue.mockResolvedValue({ fields: {} });

      const links = await getIssueLinks('PROJ-1');

      expect(links).toEqual([]);
    });

    it('should handle links with only inwardIssue (no outward)', async () => {
      mockGetIssue.mockResolvedValue({
        fields: {
          issuelinks: [
            {
              id: 'link-2',
              type: { id: 't2', name: 'Cloners', inward: 'is cloned by', outward: 'clones' },
              inwardIssue: {
                id: '300',
                key: 'PROJ-4',
                fields: { summary: 'Inward only', status: { name: 'Done' } },
              },
            },
          ],
        },
      });

      const links = await getIssueLinks('PROJ-5');

      expect(links[0].outwardIssue).toBeUndefined();
      expect(links[0].inwardIssue?.key).toBe('PROJ-4');
    });

    it('should throw when Jira API returns an error', async () => {
      mockGetIssue.mockRejectedValue(new Error('404: Issue not found'));

      await expect(getIssueLinks('INVALID-999')).rejects.toThrow('404: Issue not found');
    });
  });

  describe('createIssueLink', () => {
    it('should call linkIssues with correct parameters', async () => {
      mockLinkIssues.mockResolvedValue(undefined);

      await createIssueLink('PROJ-1', 'PROJ-2', 'Blocks');

      expect(mockLinkIssues).toHaveBeenCalledWith({
        type: { name: 'Blocks' },
        inwardIssue: { key: 'PROJ-1' },
        outwardIssue: { key: 'PROJ-2' },
      });
    });

    it('should propagate errors from linkIssues', async () => {
      mockLinkIssues.mockRejectedValue(new Error('400: Bad Request'));

      await expect(createIssueLink('PROJ-1', 'PROJ-2', 'InvalidType')).rejects.toThrow(
        '400: Bad Request'
      );
    });

    it('should pass exact link type name to Jira API', async () => {
      mockLinkIssues.mockResolvedValue(undefined);

      await createIssueLink('KEY-10', 'KEY-20', 'Relates');

      expect(mockLinkIssues).toHaveBeenCalledWith(
        expect.objectContaining({ type: { name: 'Relates' } })
      );
    });
  });

  describe('deleteIssueLink', () => {
    it('should call deleteIssueLink with the correct linkId', async () => {
      mockDeleteIssueLink.mockResolvedValue(undefined);

      await deleteIssueLink('link-abc-123');

      expect(mockDeleteIssueLink).toHaveBeenCalledWith({ linkId: 'link-abc-123' });
    });

    it('should throw when link does not exist', async () => {
      mockDeleteIssueLink.mockRejectedValue(new Error('404: Link not found'));

      await expect(deleteIssueLink('nonexistent-link')).rejects.toThrow('404: Link not found');
    });

    it('should throw when lacking delete permission', async () => {
      mockDeleteIssueLink.mockRejectedValue(new Error('403: Forbidden'));

      await expect(deleteIssueLink('link-forbidden')).rejects.toThrow('403: Forbidden');
    });
  });

  describe('getAvailableLinkTypes', () => {
    it('should map issueLinkTypes response to IssueLinkType array', async () => {
      mockGetIssueLinkTypes.mockResolvedValue({
        issueLinkTypes: [
          { id: '1', name: 'Blocks', inward: 'is blocked by', outward: 'blocks' },
          { id: '2', name: 'Cloners', inward: 'is cloned by', outward: 'clones' },
        ],
      });

      const types = await getAvailableLinkTypes();

      expect(types).toHaveLength(2);
      expect(types[0]).toEqual({ id: '1', name: 'Blocks', inward: 'is blocked by', outward: 'blocks' });
      expect(types[1]).toEqual({ id: '2', name: 'Cloners', inward: 'is cloned by', outward: 'clones' });
    });

    it('should return empty array when no link types exist', async () => {
      mockGetIssueLinkTypes.mockResolvedValue({ issueLinkTypes: [] });

      const types = await getAvailableLinkTypes();

      expect(types).toEqual([]);
    });

    it('should handle missing issueLinkTypes field', async () => {
      mockGetIssueLinkTypes.mockResolvedValue({});

      const types = await getAvailableLinkTypes();

      expect(types).toEqual([]);
    });

    it('should throw when Jira API returns an error', async () => {
      mockGetIssueLinkTypes.mockRejectedValue(new Error('403: Forbidden'));

      await expect(getAvailableLinkTypes()).rejects.toThrow('403: Forbidden');
    });
  });
});
