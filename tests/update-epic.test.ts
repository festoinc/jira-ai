import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { updateEpic, __resetJiraClient__ } from '../src/lib/jira-client.js';

const {
  mockEditIssue,
  mockGetEpicFields,
} = vi.hoisted(() => ({
  mockEditIssue: vi.fn(),
  mockGetEpicFields: vi.fn(),
}));

vi.mock('jira.js', () => ({
  Version3Client: vi.fn().mockImplementation(function () {
    return {
      issues: { editIssue: mockEditIssue },
      config: { host: 'https://test.atlassian.net' },
    };
  }),
}));

vi.mock('../src/lib/epic-fields.js', () => ({
  getEpicFields: mockGetEpicFields,
  isNextGenProject: vi.fn().mockResolvedValue(false),
}));

vi.mock('../src/lib/settings.js', () => ({
  applyGlobalFilters: vi.fn((jql: string) => jql),
  isProjectAllowed: vi.fn().mockReturnValue(true),
  isCommandAllowed: vi.fn().mockReturnValue(true),
  validateIssueAgainstFilters: vi.fn().mockReturnValue(true),
}));

vi.mock('../src/lib/auth-storage.js', () => ({
  loadCredentials: vi.fn().mockReturnValue({
    host: 'https://test.atlassian.net',
    email: 'test@example.com',
    apiToken: 'test-token',
  }),
}));

describe('updateEpic', () => {
  beforeAll(() => {
    process.env.JIRA_HOST = 'https://test.atlassian.net';
    process.env.JIRA_USER_EMAIL = 'test@example.com';
    process.env.JIRA_API_TOKEN = 'test-token';
  });

  beforeEach(() => {
    vi.clearAllMocks();
    __resetJiraClient__();
    mockEditIssue.mockResolvedValue(undefined);
  });

  describe('next-gen project (no epicFields)', () => {
    beforeEach(() => {
      mockGetEpicFields.mockResolvedValue(null);
    });

    it('uses name as summary when only --name is provided', async () => {
      await updateEpic('NG-1', { name: 'Epic Name' });

      expect(mockEditIssue).toHaveBeenCalledWith(
        expect.objectContaining({
          issueIdOrKey: 'NG-1',
          fields: { summary: 'Epic Name' },
        })
      );
    });

    it('uses explicit summary and ignores name for summary when both --name and --summary are provided', async () => {
      await updateEpic('NG-1', { name: 'Epic Name', summary: 'Explicit Summary' });

      expect(mockEditIssue).toHaveBeenCalledWith(
        expect.objectContaining({
          issueIdOrKey: 'NG-1',
          fields: { summary: 'Explicit Summary' },
        })
      );
    });

    it('uses only summary when only --summary is provided', async () => {
      await updateEpic('NG-1', { summary: 'Only Summary' });

      expect(mockEditIssue).toHaveBeenCalledWith(
        expect.objectContaining({
          issueIdOrKey: 'NG-1',
          fields: { summary: 'Only Summary' },
        })
      );
    });
  });

  describe('classic project (has epicFields)', () => {
    beforeEach(() => {
      mockGetEpicFields.mockResolvedValue({
        epicNameField: 'customfield_10014',
        epicLinkField: 'customfield_10011',
      });
    });

    it('sets epicNameField and summary independently when both are provided', async () => {
      await updateEpic('CL-1', { name: 'Epic Name', summary: 'Explicit Summary' });

      expect(mockEditIssue).toHaveBeenCalledWith(
        expect.objectContaining({
          issueIdOrKey: 'CL-1',
          fields: {
            summary: 'Explicit Summary',
            customfield_10014: 'Epic Name',
          },
        })
      );
    });
  });
});
