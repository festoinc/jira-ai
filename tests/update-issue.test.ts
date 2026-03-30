import { vi, describe, it, expect, beforeEach } from 'vitest';

// This module does not exist yet — these tests are intentionally RED
import { updateIssueCommand } from '../src/commands/update-issue.js';
import * as jiraClient from '../src/lib/jira-client.js';
import * as settings from '../src/lib/settings.js';
import { CommandError } from '../src/lib/errors.js';

vi.mock('../src/lib/jira-client.js');
vi.mock('../src/lib/utils.js');
vi.mock('../src/lib/settings.js');
vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
  })),
}));
vi.mock('fs', () => ({
  readFileSync: vi.fn().mockReturnValue('# Description'),
  existsSync: vi.fn().mockReturnValue(true),
}));
vi.mock('marklassian', () => ({
  markdownToAdf: vi.fn().mockReturnValue({ version: 1, type: 'doc', content: [] }),
}));

const mockJiraClient = jiraClient as vi.Mocked<typeof jiraClient>;
const mockSettings = settings as vi.Mocked<typeof settings>;

describe('Update Issue Command', () => {
  const issueKey = 'TEST-123';

  const mockTaskDetails = {
    id: '10001',
    key: issueKey,
    summary: 'Original Summary',
    status: { name: 'To Do' },
    labels: [],
    comments: [],
    subtasks: [],
    created: '2025-01-01',
    updated: '2025-01-01',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    console.log = vi.fn();
    console.error = vi.fn();

    mockSettings.isProjectAllowed.mockReturnValue(true);
    mockSettings.isCommandAllowed.mockReturnValue(true);
    mockJiraClient.validateIssuePermissions = vi.fn().mockResolvedValue(mockTaskDetails);
    mockJiraClient.updateIssue = vi.fn().mockResolvedValue(undefined);
  });

  describe('single field updates', () => {
    it('should update priority', async () => {
      await updateIssueCommand(issueKey, { priority: 'High' });

      expect(mockJiraClient.updateIssue).toHaveBeenCalledWith(
        issueKey,
        expect.objectContaining({ priority: { name: 'High' } })
      );
    });

    it('should update summary', async () => {
      await updateIssueCommand(issueKey, { summary: 'New Summary' });

      expect(mockJiraClient.updateIssue).toHaveBeenCalledWith(
        issueKey,
        expect.objectContaining({ summary: 'New Summary' })
      );
    });

    it('should update labels', async () => {
      await updateIssueCommand(issueKey, { labels: 'bug,frontend' });

      expect(mockJiraClient.updateIssue).toHaveBeenCalledWith(
        issueKey,
        expect.objectContaining({ labels: ['bug', 'frontend'] })
      );
    });

    it('should clear labels when --clear-labels is set', async () => {
      await updateIssueCommand(issueKey, { clearLabels: true });

      expect(mockJiraClient.updateIssue).toHaveBeenCalledWith(
        issueKey,
        expect.objectContaining({ labels: [] })
      );
    });

    it('should update components', async () => {
      await updateIssueCommand(issueKey, { component: 'Backend,API' });

      expect(mockJiraClient.updateIssue).toHaveBeenCalledWith(
        issueKey,
        expect.objectContaining({
          components: [{ name: 'Backend' }, { name: 'API' }],
        })
      );
    });

    it('should update fix versions', async () => {
      await updateIssueCommand(issueKey, { fixVersion: 'v1.0,v1.1' });

      expect(mockJiraClient.updateIssue).toHaveBeenCalledWith(
        issueKey,
        expect.objectContaining({
          fixVersions: [{ name: 'v1.0' }, { name: 'v1.1' }],
        })
      );
    });

    it('should update due date', async () => {
      await updateIssueCommand(issueKey, { dueDate: '2025-12-31' });

      expect(mockJiraClient.updateIssue).toHaveBeenCalledWith(
        issueKey,
        expect.objectContaining({ duedate: '2025-12-31' })
      );
    });

    it('should update assignee by account id', async () => {
      await updateIssueCommand(issueKey, { assignee: 'accountid:abc123' });

      expect(mockJiraClient.updateIssue).toHaveBeenCalledWith(
        issueKey,
        expect.objectContaining({
          assignee: { accountId: 'abc123' },
        })
      );
    });

    it('should resolve assignee by display name', async () => {
      mockJiraClient.resolveUserByName = vi.fn().mockResolvedValue('resolved-account-id');

      await updateIssueCommand(issueKey, { assignee: 'John Doe' });

      expect(mockJiraClient.resolveUserByName).toHaveBeenCalledWith('John Doe');
      expect(mockJiraClient.updateIssue).toHaveBeenCalledWith(
        issueKey,
        expect.objectContaining({
          assignee: { accountId: 'resolved-account-id' },
        })
      );
    });

    it('should update a custom field', async () => {
      await updateIssueCommand(issueKey, { customField: ['customfield_10100=5'] });

      expect(mockJiraClient.updateIssue).toHaveBeenCalledWith(
        issueKey,
        expect.objectContaining({ customfield_10100: 5 })
      );
    });
  });

  describe('combined field updates', () => {
    it('should update multiple fields at once', async () => {
      await updateIssueCommand(issueKey, {
        priority: 'High',
        summary: 'Updated Summary',
        labels: 'bug',
        dueDate: '2025-12-31',
      });

      expect(mockJiraClient.updateIssue).toHaveBeenCalledWith(
        issueKey,
        expect.objectContaining({
          priority: { name: 'High' },
          summary: 'Updated Summary',
          labels: ['bug'],
          duedate: '2025-12-31',
        })
      );
    });

    it('should merge --from-file description with other field updates', async () => {
      const mockAdf = { version: 1, type: 'doc', content: [] };
      const { markdownToAdf } = await import('marklassian');
      vi.mocked(markdownToAdf).mockReturnValue(mockAdf as any);

      await updateIssueCommand(issueKey, {
        priority: 'Low',
        fromFile: '/path/to/desc.md',
      });

      expect(mockJiraClient.updateIssue).toHaveBeenCalledWith(
        issueKey,
        expect.objectContaining({
          priority: { name: 'Low' },
          description: mockAdf,
        })
      );
    });

    it('should update all supported fields simultaneously', async () => {
      await updateIssueCommand(issueKey, {
        summary: 'Full Update',
        priority: 'Critical',
        labels: 'critical,urgent',
        component: 'Core',
        fixVersion: 'v2.0',
        dueDate: '2026-01-01',
        assignee: 'accountid:user123',
        customField: ['customfield_10100=8'],
      });

      expect(mockJiraClient.updateIssue).toHaveBeenCalledWith(
        issueKey,
        expect.objectContaining({
          summary: 'Full Update',
          priority: { name: 'Critical' },
          labels: ['critical', 'urgent'],
          components: [{ name: 'Core' }],
          fixVersions: [{ name: 'v2.0' }],
          duedate: '2026-01-01',
          assignee: { accountId: 'user123' },
          customfield_10100: 8,
        })
      );
    });
  });

  describe('validation', () => {
    it('should throw if issue key is invalid', async () => {
      await expect(
        updateIssueCommand('invalid-key', { priority: 'High' })
      ).rejects.toThrow(CommandError);
    });

    it('should throw if no fields are provided', async () => {
      await expect(
        updateIssueCommand(issueKey, {})
      ).rejects.toThrow(CommandError);
    });

    it('should throw if priority value is invalid', async () => {
      await expect(
        updateIssueCommand(issueKey, { priority: '' })
      ).rejects.toThrow(CommandError);
    });

    it('should throw if due date format is invalid', async () => {
      await expect(
        updateIssueCommand(issueKey, { dueDate: 'not-a-date' })
      ).rejects.toThrow(CommandError);
    });

    it('should throw if custom field format is invalid (missing =)', async () => {
      await expect(
        updateIssueCommand(issueKey, { customField: ['customfield_10100'] })
      ).rejects.toThrow(CommandError);
    });
  });

  describe('error paths', () => {
    it('should throw CommandError with hint on 404', async () => {
      mockJiraClient.updateIssue = vi.fn().mockRejectedValue(new Error('Issue not found (404)'));

      const promise = updateIssueCommand(issueKey, { priority: 'High' });
      await expect(promise).rejects.toThrow('Issue not found (404)');
      const error = await promise.catch(e => e);
      expect(error.hints).toContain('Check that the issue key is correct');
    });

    it('should throw CommandError with hint on 403', async () => {
      mockJiraClient.updateIssue = vi.fn().mockRejectedValue(new Error('Permission denied (403)'));

      const promise = updateIssueCommand(issueKey, { priority: 'High' });
      await expect(promise).rejects.toThrow('Permission denied (403)');
      const error = await promise.catch(e => e);
      expect(error.hints).toContain('You may not have permission to edit this issue');
    });

    it('should throw CommandError when assignee name cannot be resolved', async () => {
      mockJiraClient.resolveUserByName = vi.fn().mockResolvedValue(null);

      await expect(
        updateIssueCommand(issueKey, { assignee: 'Unknown Person' })
      ).rejects.toThrow(CommandError);
    });

    it('should throw when project not allowed', async () => {
      mockSettings.isProjectAllowed.mockReturnValue(false);

      await expect(
        updateIssueCommand(issueKey, { priority: 'High' })
      ).rejects.toThrow(CommandError);
    });

    it('should throw when command not allowed', async () => {
      mockSettings.isCommandAllowed.mockReturnValue(false);

      await expect(
        updateIssueCommand(issueKey, { priority: 'High' })
      ).rejects.toThrow(CommandError);
    });
  });
});
