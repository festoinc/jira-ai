import { describe, it, expect, beforeAll } from 'vitest';
import { getProjects, getProjectIssueTypes, createIssue, getJiraClient } from '../../src/lib/jira-client.js';
import { checkEnv } from './integration-test-utils.js';

describe('create-task integration test', () => {
  beforeAll(() => {
    checkEnv();
  });

  it('should create and then delete a task in Jira', async () => {
    // 1. Get a project
    const projects = await getProjects();
    expect(projects.length).toBeGreaterThan(0);
    const projectKey = projects[0].key;

    // 2. Get issue types for the project
    const issueTypes = await getProjectIssueTypes(projectKey);
    const taskType = issueTypes.find(t => !t.subtask) || issueTypes[0];
    
    // 3. Create an issue
    const summary = `Integration Test Task - ${new Date().toISOString()}`;
    const result = await createIssue(projectKey, summary, taskType.name);
    
    expect(result.key).toBeDefined();
    expect(result.id).toBeDefined();
    
    // 4. Cleanup: Delete the issue
    const client = getJiraClient();
    await client.issues.deleteIssue({ issueIdOrKey: result.key });
  });
});
