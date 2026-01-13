import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getPersonWorklogCommand } from '../src/commands/get-person-worklog.js';
import * as jiraClient from '../src/lib/jira-client.js';
import * as formatters from '../src/lib/formatters.js';
import * as ui from '../src/lib/ui.js';
import * as utils from '../src/lib/utils.js';
import chalk from 'chalk';

vi.mock('../src/lib/jira-client.js');
vi.mock('../src/lib/formatters.js');
vi.mock('../src/lib/ui.js');
vi.mock('../src/lib/utils.js');

describe('getPersonWorklogCommand', () => {
  let consoleLogSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(ui.ui.startSpinner).mockImplementation(() => {});
    vi.mocked(ui.ui.stopSpinner).mockImplementation(() => {});
    vi.mocked(ui.ui.failSpinner).mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('should successfully fetch and display worklogs', async () => {
    const startDate = new Date('2023-01-01T00:00:00Z');
    const endDate = new Date('2023-01-31T23:59:59Z');
    vi.mocked(utils.parseTimeframe).mockReturnValue({ startDate, endDate });
    vi.mocked(utils.formatDateForJql).mockReturnValue('2023-01-01');

    const mockClient = {
      issueSearch: {
        searchForIssuesUsingJqlEnhancedSearch: vi.fn().mockResolvedValue({
          issues: [
            { key: 'TEST-1', fields: { summary: 'Issue 1' } }
          ]
        })
      }
    };
    vi.mocked(jiraClient.getJiraClient).mockReturnValue(mockClient as any);

    const mockWorklogs = [
      {
        id: '1',
        author: { accountId: 'user1', emailAddress: 'user1@example.com' },
        started: '2023-01-15T10:00:00.000+0000',
        timeSpentSeconds: 3600
      }
    ];
    vi.mocked(jiraClient.getIssueWorklogs).mockResolvedValue(mockWorklogs as any);
    vi.mocked(formatters.formatWorklogs).mockReturnValue('Formatted worklogs');

    await getPersonWorklogCommand('user1', 'january', {});

    expect(ui.ui.startSpinner).toHaveBeenCalledWith('Fetching worklogs for user1...');
    expect(utils.parseTimeframe).toHaveBeenCalledWith('january');
    expect(mockClient.issueSearch.searchForIssuesUsingJqlEnhancedSearch).toHaveBeenCalled();
    expect(jiraClient.getIssueWorklogs).toHaveBeenCalledWith('TEST-1');
    expect(ui.ui.stopSpinner).toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith('Formatted worklogs');
  });

  it('should handle no issues found', async () => {
    const startDate = new Date('2023-01-01');
    const endDate = new Date('2023-01-31');
    vi.mocked(utils.parseTimeframe).mockReturnValue({ startDate, endDate });
    vi.mocked(utils.formatDateForJql).mockReturnValue('2023-01-01');

    const mockClient = {
      issueSearch: {
        searchForIssuesUsingJqlEnhancedSearch: vi.fn().mockResolvedValue({
          issues: []
        })
      }
    };
    vi.mocked(jiraClient.getJiraClient).mockReturnValue(mockClient as any);

    await getPersonWorklogCommand('user1', 'january', {});

    expect(ui.ui.stopSpinner).toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('No worklogs found for user1'));
  });

  it('should handle no worklogs found after filtering', async () => {
    const startDate = new Date('2023-01-01');
    const endDate = new Date('2023-01-31');
    vi.mocked(utils.parseTimeframe).mockReturnValue({ startDate, endDate });
    vi.mocked(utils.formatDateForJql).mockReturnValue('2023-01-01');

    const mockClient = {
      issueSearch: {
        searchForIssuesUsingJqlEnhancedSearch: vi.fn().mockResolvedValue({
          issues: [
            { key: 'TEST-1', fields: { summary: 'Issue 1' } }
          ]
        })
      }
    };
    vi.mocked(jiraClient.getJiraClient).mockReturnValue(mockClient as any);

    // Worklog from different user
    const mockWorklogs = [
      {
        id: '1',
        author: { accountId: 'user2', emailAddress: 'user2@example.com' },
        started: '2023-01-15T10:00:00.000+0000',
        timeSpentSeconds: 3600
      }
    ];
    vi.mocked(jiraClient.getIssueWorklogs).mockResolvedValue(mockWorklogs as any);

    await getPersonWorklogCommand('user1', 'january', {});

    expect(ui.ui.stopSpinner).toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('No worklogs found for user1 after detailed filtering'));
  });

  it('should handle errors', async () => {
    vi.mocked(utils.parseTimeframe).mockImplementation(() => {
      throw new Error('Parse error');
    });

    await expect(getPersonWorklogCommand('user1', 'invalid', {})).rejects.toThrow('Parse error');

    expect(ui.ui.failSpinner).toHaveBeenCalledWith(expect.stringContaining('Failed to fetch worklogs: Parse error'));
  });

  it('should match person by emailAddress', async () => {
    const startDate = new Date('2023-01-01T00:00:00Z');
    const endDate = new Date('2023-01-31T23:59:59Z');
    vi.mocked(utils.parseTimeframe).mockReturnValue({ startDate, endDate });
    vi.mocked(utils.formatDateForJql).mockReturnValue('2023-01-01');

    const mockClient = {
      issueSearch: {
        searchForIssuesUsingJqlEnhancedSearch: vi.fn().mockResolvedValue({
          issues: [
            { key: 'TEST-1', fields: { summary: 'Issue 1' } }
          ]
        })
      }
    };
    vi.mocked(jiraClient.getJiraClient).mockReturnValue(mockClient as any);

    const mockWorklogs = [
      {
        id: '1',
        author: { accountId: 'other-id', emailAddress: 'user1@example.com' },
        started: '2023-01-15T10:00:00.000+0000',
        timeSpentSeconds: 3600
      }
    ];
    vi.mocked(jiraClient.getIssueWorklogs).mockResolvedValue(mockWorklogs as any);
    vi.mocked(formatters.formatWorklogs).mockReturnValue('Formatted worklogs');

    await getPersonWorklogCommand('user1@example.com', 'january', {});

    expect(consoleLogSpy).toHaveBeenCalledWith('Formatted worklogs');
  });

  it('should handle issues being undefined in response', async () => {
    const startDate = new Date('2023-01-01');
    const endDate = new Date('2023-01-31');
    vi.mocked(utils.parseTimeframe).mockReturnValue({ startDate, endDate });
    vi.mocked(utils.formatDateForJql).mockReturnValue('2023-01-01');

    const mockClient = {
      issueSearch: {
        searchForIssuesUsingJqlEnhancedSearch: vi.fn().mockResolvedValue({})
      }
    };
    vi.mocked(jiraClient.getJiraClient).mockReturnValue(mockClient as any);

    await getPersonWorklogCommand('user1', 'january', {});

    expect(ui.ui.stopSpinner).toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('No worklogs found for user1'));
  });

  it('should handle missing summary in issue fields', async () => {
    const startDate = new Date('2023-01-01T00:00:00Z');
    const endDate = new Date('2023-01-31T23:59:59Z');
    vi.mocked(utils.parseTimeframe).mockReturnValue({ startDate, endDate });
    vi.mocked(utils.formatDateForJql).mockReturnValue('2023-01-01');

    const mockClient = {
      issueSearch: {
        searchForIssuesUsingJqlEnhancedSearch: vi.fn().mockResolvedValue({
          issues: [
            { key: 'TEST-1', fields: {} }
          ]
        })
      }
    };
    vi.mocked(jiraClient.getJiraClient).mockReturnValue(mockClient as any);

    const mockWorklogs = [
      {
        id: '1',
        author: { accountId: 'user1', emailAddress: 'user1@example.com' },
        started: '2023-01-15T10:00:00.000+0000',
        timeSpentSeconds: 3600
      }
    ];
    vi.mocked(jiraClient.getIssueWorklogs).mockResolvedValue(mockWorklogs as any);
    vi.mocked(formatters.formatWorklogs).mockReturnValue('Formatted worklogs');

    await getPersonWorklogCommand('user1', 'january', {});

    expect(formatters.formatWorklogs).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ summary: '' })
      ]),
      undefined
    );
  });
});
