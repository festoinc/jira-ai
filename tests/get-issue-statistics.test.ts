import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getIssueStatisticsCommand } from '../src/commands/get-issue-statistics.js';
import * as jiraClient from '../src/lib/jira-client.js';

vi.mock('../src/lib/jira-client.js');

describe('getIssueStatisticsCommand', () => {
  let consoleLogSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(jiraClient.validateIssuePermissions).mockResolvedValue({} as any);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('should display error when no issue IDs are provided', async () => {
    await getIssueStatisticsCommand('');

    expect(vi.mocked(jiraClient.getIssueStatistics)).not.toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty('error', true);
    expect(parsed).toHaveProperty('message');
    expect(parsed.message).toContain('at least one issue ID');
  });

  it('should display error when only whitespace is provided', async () => {
    await getIssueStatisticsCommand('   ,  , ');

    expect(vi.mocked(jiraClient.getIssueStatistics)).not.toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty('error', true);
  });

  it('should fetch statistics for a single issue', async () => {
    const mockStats = {
      key: 'TEST-123',
      summary: 'Test issue',
      statusDurations: { 'To Do': 3600, 'In Progress': 7200 }
    } as any;

    vi.mocked(jiraClient.getIssueStatistics).mockResolvedValue(mockStats);

    await getIssueStatisticsCommand('TEST-123');

    expect(jiraClient.validateIssuePermissions).toHaveBeenCalledWith('TEST-123', 'get-issue-statistics');
    expect(jiraClient.getIssueStatistics).toHaveBeenCalledWith('TEST-123');
    const output = consoleLogSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0]).toHaveProperty('key', 'TEST-123');
  });

  it('should fetch statistics for multiple issues', async () => {
    const mockStats1 = {
      key: 'TEST-123',
      summary: 'Test issue 1',
      statusDurations: { 'To Do': 3600 }
    } as any;
    const mockStats2 = {
      key: 'TEST-456',
      summary: 'Test issue 2',
      statusDurations: { 'In Progress': 7200 }
    } as any;

    vi.mocked(jiraClient.getIssueStatistics).mockResolvedValueOnce(mockStats1).mockResolvedValueOnce(mockStats2);

    await getIssueStatisticsCommand('TEST-123, TEST-456');

    expect(jiraClient.getIssueStatistics).toHaveBeenCalledWith('TEST-123');
    expect(jiraClient.getIssueStatistics).toHaveBeenCalledWith('TEST-456');
    const output = consoleLogSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed).toHaveLength(2);
  });

  it('should handle errors for individual issues and continue', async () => {
    const mockStats1 = {
      key: 'TEST-123',
      summary: 'Test issue 1',
      statusDurations: { 'To Do': 3600 }
    } as any;

    vi.mocked(jiraClient.getIssueStatistics)
      .mockResolvedValueOnce(mockStats1)
      .mockRejectedValueOnce(new Error('Issue not found'));

    await getIssueStatisticsCommand('TEST-123, TEST-999');

    expect(jiraClient.getIssueStatistics).toHaveBeenCalledWith('TEST-123');
    expect(jiraClient.getIssueStatistics).toHaveBeenCalledWith('TEST-999');
    const output = consoleLogSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toHaveProperty('key', 'TEST-123');
  });

  it('should output empty array when all issues fail to fetch', async () => {
    vi.mocked(jiraClient.getIssueStatistics).mockRejectedValue(new Error('Network error'));

    await getIssueStatisticsCommand('TEST-123');

    const output = consoleLogSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(0);
  });

  it('should trim whitespace from issue IDs', async () => {
    const mockStats = {
      key: 'TEST-123',
      summary: 'Test issue',
      statusDurations: {}
    } as any;

    vi.mocked(jiraClient.getIssueStatistics).mockResolvedValue(mockStats);

    await getIssueStatisticsCommand('  TEST-123  ,  TEST-456  ');

    expect(jiraClient.getIssueStatistics).toHaveBeenCalledWith('TEST-123');
    expect(jiraClient.getIssueStatistics).toHaveBeenCalledWith('TEST-456');
  });
});
