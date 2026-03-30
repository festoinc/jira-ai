import { describe, it, expect, beforeAll } from 'vitest';
import { getProjects, getProjectIssueTypes, createIssue, getJiraClient } from '../../src/lib/jira-client.js';
// updateIssue does not exist yet — intentionally RED
import { updateIssue } from '../../src/lib/jira-client.js';
import { checkEnv } from './integration-test-utils.js';

describe('update-issue integration test (JIR-42)', () => {
  beforeAll(() => {
    checkEnv();
  });

  it('should create an issue then update its priority', async () => {
    const projects = await getProjects();
    expect(projects.length).toBeGreaterThan(0);
    const projectKey = projects[0].key;

    const issueTypes = await getProjectIssueTypes(projectKey);
    const taskType = issueTypes.find(t => !t.subtask) || issueTypes[0];

    const summary = `Integration Test Update-Priority - ${new Date().toISOString()}`;
    const created = await createIssue(projectKey, summary, taskType.name);
    expect(created.key).toBeDefined();

    try {
      await updateIssue(created.key, { priority: { name: 'Low' } });

      const client = getJiraClient();
      const updated = await client.issues.getIssue({ issueIdOrKey: created.key });
      expect((updated.fields as any).priority?.name).toBe('Low');
    } finally {
      const client = getJiraClient();
      await client.issues.deleteIssue({ issueIdOrKey: created.key });
    }
  });

  it('should create an issue then update its labels', async () => {
    const projects = await getProjects();
    const projectKey = projects[0].key;
    const issueTypes = await getProjectIssueTypes(projectKey);
    const taskType = issueTypes.find(t => !t.subtask) || issueTypes[0];

    const summary = `Integration Test Update-Labels - ${new Date().toISOString()}`;
    const created = await createIssue(projectKey, summary, taskType.name);

    try {
      await updateIssue(created.key, { labels: ['integration-test', 'jir-42'] });

      const client = getJiraClient();
      const updated = await client.issues.getIssue({ issueIdOrKey: created.key });
      expect((updated.fields as any).labels).toContain('integration-test');
    } finally {
      const client = getJiraClient();
      await client.issues.deleteIssue({ issueIdOrKey: created.key });
    }
  });

  it('should create an issue then update multiple fields', async () => {
    const projects = await getProjects();
    const projectKey = projects[0].key;
    const issueTypes = await getProjectIssueTypes(projectKey);
    const taskType = issueTypes.find(t => !t.subtask) || issueTypes[0];

    const summary = `Integration Test Update-Multi - ${new Date().toISOString()}`;
    const created = await createIssue(projectKey, summary, taskType.name);

    try {
      await updateIssue(created.key, {
        summary: `Updated: ${summary}`,
        priority: { name: 'High' },
        labels: ['multi-update'],
      });

      const client = getJiraClient();
      const updated = await client.issues.getIssue({ issueIdOrKey: created.key });
      expect((updated.fields as any).summary).toContain('Updated:');
      expect((updated.fields as any).priority?.name).toBe('High');
      expect((updated.fields as any).labels).toContain('multi-update');
    } finally {
      const client = getJiraClient();
      await client.issues.deleteIssue({ issueIdOrKey: created.key });
    }
  });
});
