import { describe, it, expect, beforeAll } from 'vitest';
import { getProjects } from '../../src/lib/jira-client.js';
// getProjectFields does not exist yet — intentionally RED
import { getProjectFields } from '../../src/lib/field-resolver.js';
import { checkEnv } from './integration-test-utils.js';

describe('project-fields integration test (JIR-42)', () => {
  beforeAll(() => {
    checkEnv();
  });

  it('should list fields for a real project', async () => {
    const projects = await getProjects();
    expect(projects.length).toBeGreaterThan(0);
    const projectKey = projects[0].key;

    const fields = await getProjectFields(projectKey);

    expect(Array.isArray(fields)).toBe(true);
    expect(fields.length).toBeGreaterThan(0);

    // Every field should have at minimum id and name
    for (const field of fields) {
      expect(field.id).toBeDefined();
      expect(field.name).toBeDefined();
    }
  });

  it('should always include core fields (summary, priority)', async () => {
    const projects = await getProjects();
    const projectKey = projects[0].key;

    const fields = await getProjectFields(projectKey);
    const ids = fields.map(f => f.id);

    expect(ids).toContain('summary');
    expect(ids).toContain('priority');
  });

  it('should return results from cache on second call', async () => {
    const projects = await getProjects();
    const projectKey = projects[0].key;

    const firstCall = await getProjectFields(projectKey);
    const secondCall = await getProjectFields(projectKey);

    expect(secondCall).toEqual(firstCall);
  });

  it('should filter fields by issue type', async () => {
    const projects = await getProjects();
    const projectKey = projects[0].key;

    // We just verify it returns a non-empty array; filtering behaviour
    // is tested in unit tests — here we confirm it doesn't throw.
    const fields = await getProjectFields(projectKey, 'Task');
    expect(Array.isArray(fields)).toBe(true);
  });

  it('should create a task with rich fields against real Jira', async () => {
    const projects = await getProjects();
    const projectKey = projects[0].key;

    // createIssue with new optional fields — the extended signature doesn't exist yet
    const { createIssue, getJiraClient } = await import('../../src/lib/jira-client.js');
    const summary = `Integration Rich Create - ${new Date().toISOString()}`;

    const result = await (createIssue as any)(projectKey, summary, 'Task', undefined, {
      priority: { name: 'Low' },
      labels: ['jir-42-integration'],
    });

    expect(result.key).toBeDefined();

    try {
      const client = getJiraClient();
      const issue = await client.issues.getIssue({ issueIdOrKey: result.key });
      expect((issue.fields as any).priority?.name).toBe('Low');
      expect((issue.fields as any).labels).toContain('jir-42-integration');
    } finally {
      const client = getJiraClient();
      await client.issues.deleteIssue({ issueIdOrKey: result.key });
    }
  });
});
