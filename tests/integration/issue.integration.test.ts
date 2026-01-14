import { describe, it, expect, beforeAll } from 'vitest';
import { getProjects, searchIssuesByJql, getTaskWithDetails } from '../../src/lib/jira-client.js';
import { checkEnv } from './integration-test-utils.js';

describe('issue integration test', () => {
  beforeAll(() => {
    checkEnv();
  });

  it('should fetch issue details from Jira', async () => {
    // 1. Get a project to find an issue
    const projects = await getProjects();
    expect(projects.length).toBeGreaterThan(0);
    const projectKey = projects[0].key;

    // 2. Find an issue in that project
    const issues = await searchIssuesByJql(`project = ${projectKey}`, 1);
    
    if (issues.length > 0) {
      const issueKey = issues[0].key;
      
      // 3. Get details for that issue
      const issue = await getTaskWithDetails(issueKey);
      
      expect(issue).toBeDefined();
      expect(issue.key).toBe(issueKey);
      expect(issue.summary).toBeDefined();
      expect(issue.status).toBeDefined();
    } else {
      console.warn(`No issues found in project ${projectKey}, skipping details check`);
    }
  });
});
