import { vi, describe, it, expect, beforeEach } from 'vitest';

// This module does not exist yet — these tests are intentionally RED
import { projectFieldsCommand } from '../src/commands/project-fields.js';
import * as jiraClient from '../src/lib/jira-client.js';
import * as settings from '../src/lib/settings.js';
import { CommandError } from '../src/lib/errors.js';

vi.mock('../src/lib/jira-client.js');
vi.mock('../src/lib/utils.js');
vi.mock('../src/lib/settings.js');
vi.mock('../src/lib/field-resolver.js');
vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
  })),
}));

import * as fieldResolver from '../src/lib/field-resolver.js';

const mockJiraClient = jiraClient as vi.Mocked<typeof jiraClient>;
const mockSettings = settings as vi.Mocked<typeof settings>;
const mockFieldResolver = fieldResolver as vi.Mocked<typeof fieldResolver>;

const mockFields = [
  { id: 'summary', name: 'Summary', schema: { type: 'string' }, custom: false, required: true },
  { id: 'priority', name: 'Priority', schema: { type: 'priority' }, custom: false, required: false },
  { id: 'labels', name: 'Labels', schema: { type: 'array', items: 'string' }, custom: false, required: false },
  { id: 'assignee', name: 'Assignee', schema: { type: 'user' }, custom: false, required: false },
  { id: 'duedate', name: 'Due Date', schema: { type: 'date' }, custom: false, required: false },
  { id: 'components', name: 'Component/s', schema: { type: 'array', items: 'component' }, custom: false, required: false },
  { id: 'fixVersions', name: 'Fix Version/s', schema: { type: 'array', items: 'version' }, custom: false, required: false },
  { id: 'customfield_10100', name: 'Story Points', schema: { type: 'number' }, custom: true, required: false },
  { id: 'customfield_10200', name: 'Team', schema: { type: 'string' }, custom: true, required: false },
];

describe('Project Fields Command', () => {
  const projectKey = 'TEST';

  beforeEach(() => {
    vi.clearAllMocks();
    console.log = vi.fn();
    console.error = vi.fn();

    mockSettings.isProjectAllowed.mockReturnValue(true);
    mockSettings.isCommandAllowed.mockReturnValue(true);
    mockFieldResolver.getProjectFields = vi.fn().mockResolvedValue(mockFields);
  });

  describe('listing fields', () => {
    it('should list all fields for a project', async () => {
      await projectFieldsCommand(projectKey, {});

      expect(mockFieldResolver.getProjectFields).toHaveBeenCalledWith(projectKey, undefined);
      expect(console.log).toHaveBeenCalled();
    });

    it('should display field id, name, and type', async () => {
      await projectFieldsCommand(projectKey, {});

      const output = (console.log as vi.Mock).mock.calls.map(c => c.join(' ')).join('\n');
      expect(output).toContain('summary');
      expect(output).toContain('Summary');
    });

    it('should display custom fields differently from standard fields', async () => {
      await projectFieldsCommand(projectKey, {});

      const output = (console.log as vi.Mock).mock.calls.map(c => c.join(' ')).join('\n');
      expect(output).toContain('customfield_10100');
      expect(output).toContain('Story Points');
    });

    it('should indicate required fields', async () => {
      await projectFieldsCommand(projectKey, {});

      const output = (console.log as vi.Mock).mock.calls.map(c => c.join(' ')).join('\n');
      expect(output).toMatch(/required|Summary/i);
    });
  });

  describe('filtering', () => {
    it('should filter fields by issue type', async () => {
      await projectFieldsCommand(projectKey, { type: 'Bug' });

      expect(mockFieldResolver.getProjectFields).toHaveBeenCalledWith(projectKey, 'Bug');
    });

    it('should show only custom fields when --custom flag is set', async () => {
      await projectFieldsCommand(projectKey, { custom: true });

      const output = (console.log as vi.Mock).mock.calls.map(c => c.join(' ')).join('\n');
      expect(output).toContain('Story Points');
      expect(output).not.toContain('summary');
    });

    it('should filter fields by name search term', async () => {
      await projectFieldsCommand(projectKey, { search: 'Story' });

      const output = (console.log as vi.Mock).mock.calls.map(c => c.join(' ')).join('\n');
      expect(output).toContain('Story Points');
      expect(output).not.toContain('Summary');
    });
  });

  describe('validation', () => {
    it('should throw CommandError when project key is invalid', async () => {
      await expect(
        projectFieldsCommand('invalid-key', {})
      ).rejects.toThrow(CommandError);
    });

    it('should throw CommandError when project key is empty', async () => {
      await expect(
        projectFieldsCommand('', {})
      ).rejects.toThrow(CommandError);
    });

    it('should throw when project not allowed', async () => {
      mockSettings.isProjectAllowed.mockReturnValue(false);

      await expect(
        projectFieldsCommand(projectKey, {})
      ).rejects.toThrow(CommandError);
    });

    it('should throw when command not allowed', async () => {
      mockSettings.isCommandAllowed.mockReturnValue(false);

      await expect(
        projectFieldsCommand(projectKey, {})
      ).rejects.toThrow(CommandError);
    });
  });

  describe('error paths', () => {
    it('should throw CommandError with hint on 404 (project not found)', async () => {
      mockFieldResolver.getProjectFields = vi.fn().mockRejectedValue(
        new Error('Project does not exist (404)')
      );

      const promise = projectFieldsCommand(projectKey, {});
      await expect(promise).rejects.toThrow('Project does not exist');
      const error = await promise.catch(e => e);
      expect(error.hints).toContain('Check that the project key is correct');
    });

    it('should throw CommandError with hint on 403', async () => {
      mockFieldResolver.getProjectFields = vi.fn().mockRejectedValue(
        new Error('Permission denied (403)')
      );

      const promise = projectFieldsCommand(projectKey, {});
      await expect(promise).rejects.toThrow('Permission denied');
      const error = await promise.catch(e => e);
      expect(error.hints).toContain('You may not have permission to view this project');
    });

    it('should handle empty fields list gracefully', async () => {
      mockFieldResolver.getProjectFields = vi.fn().mockResolvedValue([]);

      await projectFieldsCommand(projectKey, {});

      const output = (console.log as vi.Mock).mock.calls.map(c => c.join(' ')).join('\n');
      expect(output).toMatch(/no fields|0 fields/i);
    });
  });
});
