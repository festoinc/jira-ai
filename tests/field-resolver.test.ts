import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// This module does not exist yet — these tests are intentionally RED
import {
  resolveField,
  getProjectFields,
  clearFieldCache,
  FieldResolver,
} from '../src/lib/field-resolver.js';

vi.mock('../src/lib/jira-client.js');

import * as jiraClient from '../src/lib/jira-client.js';
const mockJiraClient = jiraClient as vi.Mocked<typeof jiraClient>;

const mockFields = [
  { id: 'summary', name: 'Summary', schema: { type: 'string' }, custom: false },
  { id: 'priority', name: 'Priority', schema: { type: 'priority' }, custom: false },
  { id: 'labels', name: 'Labels', schema: { type: 'array', items: 'string' }, custom: false },
  { id: 'assignee', name: 'Assignee', schema: { type: 'user' }, custom: false },
  { id: 'duedate', name: 'Due Date', schema: { type: 'date' }, custom: false },
  { id: 'components', name: 'Component/s', schema: { type: 'array', items: 'component' }, custom: false },
  { id: 'fixVersions', name: 'Fix Version/s', schema: { type: 'array', items: 'version' }, custom: false },
  { id: 'customfield_10100', name: 'Story Points', schema: { type: 'number' }, custom: true },
  { id: 'customfield_10200', name: 'Team', schema: { type: 'string' }, custom: true },
];

describe('FieldResolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFieldCache();
    (mockJiraClient as any).getJiraClient = vi.fn().mockReturnValue({
      issueFields: {
        getFields: vi.fn().mockResolvedValue(mockFields),
      },
    });
  });

  afterEach(() => {
    clearFieldCache();
  });

  describe('resolveField', () => {
    it('should resolve a field by exact name', async () => {
      const field = await resolveField('Summary');
      expect(field).toBeDefined();
      expect(field!.id).toBe('summary');
    });

    it('should resolve a field by case-insensitive name', async () => {
      const field = await resolveField('summary');
      expect(field).toBeDefined();
      expect(field!.id).toBe('summary');
    });

    it('should resolve a field by id', async () => {
      const field = await resolveField('priority');
      expect(field).toBeDefined();
      expect(field!.name).toBe('Priority');
    });

    it('should resolve a custom field by name', async () => {
      const field = await resolveField('Story Points');
      expect(field).toBeDefined();
      expect(field!.id).toBe('customfield_10100');
      expect(field!.custom).toBe(true);
    });

    it('should return null for unknown field name', async () => {
      const field = await resolveField('NonExistentField');
      expect(field).toBeNull();
    });

    it('should return null for empty string', async () => {
      const field = await resolveField('');
      expect(field).toBeNull();
    });
  });

  describe('caching', () => {
    it('should cache field list after first call', async () => {
      await resolveField('Summary');
      await resolveField('Priority');
      await resolveField('Labels');

      // getFields should only be called once due to caching
      const client = (mockJiraClient as any).getJiraClient();
      expect(client.issueFields.getFields).toHaveBeenCalledTimes(1);
    });

    it('should clear cache when clearFieldCache is called', async () => {
      await resolveField('Summary');
      clearFieldCache();
      await resolveField('Priority');

      const client = (mockJiraClient as any).getJiraClient();
      expect(client.issueFields.getFields).toHaveBeenCalledTimes(2);
    });

    it('should cache fields per project key', async () => {
      await getProjectFields('PROJ');
      await getProjectFields('PROJ');

      const client = (mockJiraClient as any).getJiraClient();
      // Second call for same project should use cache
      expect(client.issueFields.getFields).toHaveBeenCalledTimes(1);
    });

    it('should refetch after TTL expires (30 min)', async () => {
      const now = Date.now();
      vi.spyOn(Date, 'now')
        .mockReturnValueOnce(now)
        .mockReturnValueOnce(now + 31 * 60 * 1000); // 31 minutes later

      await resolveField('Summary');
      clearFieldCache(); // simulating TTL expiry
      await resolveField('Summary');

      const client = (mockJiraClient as any).getJiraClient();
      expect(client.issueFields.getFields).toHaveBeenCalledTimes(2);
    });
  });

  describe('getProjectFields', () => {
    it('should return all fields for a project', async () => {
      const fields = await getProjectFields('PROJ');
      expect(Array.isArray(fields)).toBe(true);
      expect(fields.length).toBeGreaterThan(0);
    });

    it('should include standard fields', async () => {
      const fields = await getProjectFields('PROJ');
      const names = fields.map(f => f.name);
      expect(names).toContain('Summary');
      expect(names).toContain('Priority');
    });

    it('should include custom fields', async () => {
      const fields = await getProjectFields('PROJ');
      const customFields = fields.filter(f => f.custom);
      expect(customFields.length).toBeGreaterThan(0);
      expect(customFields.some(f => f.name === 'Story Points')).toBe(true);
    });

    it('should filter by issue type when provided', async () => {
      const fields = await getProjectFields('PROJ', 'Bug');
      expect(Array.isArray(fields)).toBe(true);
    });
  });

  describe('type coercion', () => {
    it('should coerce string value for priority field', async () => {
      const resolver = new FieldResolver();
      const coerced = await resolver.coerceValue('priority', 'High');
      expect(coerced).toEqual({ name: 'High' });
    });

    it('should coerce array of strings for labels field', async () => {
      const resolver = new FieldResolver();
      const coerced = await resolver.coerceValue('labels', 'bug,frontend');
      expect(coerced).toEqual(['bug', 'frontend']);
    });

    it('should coerce comma-separated string to array for components', async () => {
      const resolver = new FieldResolver();
      const coerced = await resolver.coerceValue('components', 'Backend,API');
      expect(coerced).toEqual([{ name: 'Backend' }, { name: 'API' }]);
    });

    it('should coerce string to array for fixVersions', async () => {
      const resolver = new FieldResolver();
      const coerced = await resolver.coerceValue('fixVersions', 'v1.0,v1.1');
      expect(coerced).toEqual([{ name: 'v1.0' }, { name: 'v1.1' }]);
    });

    it('should coerce string to number for numeric fields', async () => {
      const resolver = new FieldResolver();
      const coerced = await resolver.coerceValue('customfield_10100', '5');
      expect(coerced).toBe(5);
    });

    it('should coerce assignee to accountId object', async () => {
      const resolver = new FieldResolver();
      const coerced = await resolver.coerceValue('assignee', 'accountid:abc123');
      expect(coerced).toEqual({ accountId: 'abc123' });
    });

    it('should pass through date string for date fields', async () => {
      const resolver = new FieldResolver();
      const coerced = await resolver.coerceValue('duedate', '2025-12-31');
      expect(coerced).toBe('2025-12-31');
    });

    it('should throw for unknown custom field id', async () => {
      const resolver = new FieldResolver();
      await expect(
        resolver.coerceValue('customfield_99999', 'value')
      ).rejects.toThrow();
    });
  });
});
