import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as jiraClientModule from '../src/lib/jira-client.js';

vi.mock('../src/lib/jira-client.js');

const mockGetJiraClient = vi.fn();
vi.mocked(jiraClientModule).getJiraClient = mockGetJiraClient;

// Helper to create a mock Jira client
function createMockClient(overrides: Record<string, any> = {}) {
  return {
    issues: { getCreateIssueMeta: vi.fn() },
    issueFields: { getFields: vi.fn() },
    projects: { getProject: vi.fn() },
    ...overrides,
  };
}

describe('epic-fields module', () => {
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockClient = createMockClient();
    mockGetJiraClient.mockReturnValue(mockClient);
    // Clear cache between tests by re-importing module
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getEpicFields', () => {
    it('should discover epic fields via /rest/api/3/field (primary strategy)', async () => {
      mockClient.issueFields.getFields.mockResolvedValue([
        { id: 'customfield_10014', name: 'Epic Name', custom: true },
        { id: 'customfield_10011', name: 'Epic Link', custom: true },
        { id: 'summary', name: 'Summary', custom: false },
      ]);

      const { getEpicFields } = await import('../src/lib/epic-fields.js');
      const result = await getEpicFields('PROJ');

      expect(result).not.toBeNull();
      expect(result!.epicNameField).toBe('customfield_10014');
      expect(result!.epicLinkField).toBe('customfield_10011');
      expect(mockClient.issueFields.getFields).toHaveBeenCalled();
    });

    it('should return null when epic fields are not found', async () => {
      mockClient.issueFields.getFields.mockResolvedValue([
        { id: 'summary', name: 'Summary', custom: false },
        { id: 'description', name: 'Description', custom: false },
      ]);

      const { getEpicFields } = await import('../src/lib/epic-fields.js');
      const result = await getEpicFields('NEXTGEN');

      expect(result).toBeNull();
    });

    it('should cache results per project key', async () => {
      mockClient.issueFields.getFields.mockResolvedValue([
        { id: 'customfield_10014', name: 'Epic Name', custom: true },
        { id: 'customfield_10011', name: 'Epic Link', custom: true },
      ]);

      const { getEpicFields } = await import('../src/lib/epic-fields.js');
      await getEpicFields('PROJ');
      await getEpicFields('PROJ'); // Second call should use cache

      expect(mockClient.issueFields.getFields).toHaveBeenCalledTimes(1);
    });

    it('should fetch separately for different project keys', async () => {
      mockClient.issueFields.getFields.mockResolvedValue([
        { id: 'customfield_10014', name: 'Epic Name', custom: true },
        { id: 'customfield_10011', name: 'Epic Link', custom: true },
      ]);

      const { getEpicFields } = await import('../src/lib/epic-fields.js');
      await getEpicFields('PROJ1');
      await getEpicFields('PROJ2');

      // Fields endpoint called once (shared cache)
      expect(mockClient.issueFields.getFields).toHaveBeenCalledTimes(1);
    });

    it('should discover story point field', async () => {
      mockClient.issueFields.getFields.mockResolvedValue([
        { id: 'customfield_10014', name: 'Epic Name', custom: true },
        { id: 'customfield_10011', name: 'Epic Link', custom: true },
        { id: 'customfield_10016', name: 'Story Points', custom: true },
      ]);

      const { getEpicFields } = await import('../src/lib/epic-fields.js');
      const result = await getEpicFields('PROJ');

      expect(result).not.toBeNull();
      expect(result!.storyPointField).toBe('customfield_10016');
    });

    it('should handle case-insensitive field name matching', async () => {
      mockClient.issueFields.getFields.mockResolvedValue([
        { id: 'customfield_10014', name: 'epic name', custom: true },
        { id: 'customfield_10011', name: 'EPIC LINK', custom: true },
      ]);

      const { getEpicFields } = await import('../src/lib/epic-fields.js');
      const result = await getEpicFields('PROJ');

      expect(result).not.toBeNull();
      expect(result!.epicNameField).toBe('customfield_10014');
      expect(result!.epicLinkField).toBe('customfield_10011');
    });

    it('should handle "Story Point Estimate" as story point field name', async () => {
      mockClient.issueFields.getFields.mockResolvedValue([
        { id: 'customfield_10014', name: 'Epic Name', custom: true },
        { id: 'customfield_10011', name: 'Epic Link', custom: true },
        { id: 'customfield_10016', name: 'Story Point Estimate', custom: true },
      ]);

      const { getEpicFields } = await import('../src/lib/epic-fields.js');
      const result = await getEpicFields('PROJ');

      expect(result!.storyPointField).toBe('customfield_10016');
    });
  });

  describe('isNextGenProject', () => {
    it('should return true for next_gen project style', async () => {
      mockClient.projects.getProject.mockResolvedValue({
        id: '10001',
        key: 'NG',
        style: 'next_gen',
      });

      const { isNextGenProject } = await import('../src/lib/epic-fields.js');
      const result = await isNextGenProject('NG');

      expect(result).toBe(true);
    });

    it('should return false for classic project style', async () => {
      mockClient.projects.getProject.mockResolvedValue({
        id: '10002',
        key: 'CLASSIC',
        style: 'classic',
      });

      const { isNextGenProject } = await import('../src/lib/epic-fields.js');
      const result = await isNextGenProject('CLASSIC');

      expect(result).toBe(false);
    });

    it('should return false when style is undefined', async () => {
      mockClient.projects.getProject.mockResolvedValue({
        id: '10003',
        key: 'OLD',
      });

      const { isNextGenProject } = await import('../src/lib/epic-fields.js');
      const result = await isNextGenProject('OLD');

      expect(result).toBe(false);
    });
  });

  describe('clearEpicFieldsCache', () => {
    it('should clear cache so next call re-fetches', async () => {
      mockClient.issueFields.getFields.mockResolvedValue([
        { id: 'customfield_10014', name: 'Epic Name', custom: true },
        { id: 'customfield_10011', name: 'Epic Link', custom: true },
      ]);

      const { getEpicFields, clearEpicFieldsCache } = await import('../src/lib/epic-fields.js');
      await getEpicFields('PROJ');
      clearEpicFieldsCache();
      await getEpicFields('PROJ');

      expect(mockClient.issueFields.getFields).toHaveBeenCalledTimes(2);
    });
  });
});
