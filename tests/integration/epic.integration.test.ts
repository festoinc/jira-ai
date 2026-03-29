import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  getProjects,
  listEpics,
  getEpic,
  createEpic,
  updateEpic,
  getEpicIssues,
  linkIssueToEpic,
  unlinkIssueFromEpic,
  getEpicProgress,
  createIssue,
  getProjectIssueTypes,
  getJiraClient,
} from '../../src/lib/jira-client.js';
import { checkEnv } from './integration-test-utils.js';

// Test data cleanup registry
const createdIssueKeys: string[] = [];

describe('epic integration tests', () => {
  let projectKey: string;
  let epicKey: string;
  let linkedIssueKey: string;
  let epicProjectFound = false;

  beforeAll(async () => {
    checkEnv();

    // Find a project that supports the "Epic" issue type
    const projects = await getProjects();
    expect(projects.length).toBeGreaterThan(0);

    for (const project of projects) {
      try {
        const issueTypes = await getProjectIssueTypes(project.key);
        const hasEpic = issueTypes.some(t => t.name.toLowerCase() === 'epic');
        if (hasEpic) {
          projectKey = project.key;
          epicProjectFound = true;
          break;
        }
      } catch {
        // Skip projects we can't access
      }
    }

    if (!epicProjectFound) {
      console.warn('No project with Epic issue type found. Integration tests will be skipped.');
    }
  });

  afterAll(async () => {
    // Cleanup all test issues
    const client = getJiraClient();
    for (const key of createdIssueKeys) {
      try {
        await client.issues.deleteIssue({ issueIdOrKey: key });
      } catch {
        // Ignore cleanup failures
      }
    }
  });

  it('should list epics in a project (may be empty)', async () => {
    if (!epicProjectFound) {
      // Fallback: test with first project and expect an array back
      const projects = await getProjects();
      const epics = await listEpics(projects[0].key, { includeDone: true, max: 10 });
      expect(Array.isArray(epics)).toBe(true);
      return;
    }
    const epics = await listEpics(projectKey, { includeDone: true, max: 100 });
    expect(Array.isArray(epics)).toBe(true);

    // If epics exist, verify structure
    if (epics.length > 0) {
      const first = epics[0];
      expect(first.key).toBeDefined();
      expect(first.key).toMatch(/^[A-Z]+-\d+$/);
      expect(first.summary).toBeDefined();
      expect(first.status).toBeDefined();
      expect(first.projectKey).toBe(projectKey);
      epicKey = first.key;
    }
  });

  it('should create an epic (skipped if no epic project)', async () => {
    if (!epicProjectFound) {
      console.warn('Skipping: no project with Epic issue type found');
      return;
    }

    const epicName = `Integration Test Epic ${Date.now()}`;
    const epicSummary = `Test Epic Summary ${new Date().toISOString()}`;

    const result = await createEpic(projectKey, epicName, epicSummary);

    expect(result.key).toBeDefined();
    expect(result.key).toMatch(/^[A-Z]+-\d+$/);
    expect(result.id).toBeDefined();

    epicKey = result.key;
    createdIssueKeys.push(epicKey);
  });

  it('should get an epic by key', async () => {
    if (!epicKey) {
      console.warn('Skipping: no epic key available');
      return;
    }

    const epic = await getEpic(epicKey);

    expect(epic.key).toBe(epicKey);
    expect(epic.summary).toBeDefined();
    expect(epic.status).toBeDefined();
  });

  it('should update an epic name (skipped if no created epic)', async () => {
    // Only run update if we created an epic in this test run
    const createdEpicKey = createdIssueKeys.find(k => k === epicKey);
    if (!createdEpicKey) {
      console.warn('Skipping: no newly created epic to update');
      return;
    }

    const newName = `Updated Epic Name ${Date.now()}`;
    await expect(updateEpic(epicKey, { name: newName })).resolves.not.toThrow();
  });

  it('should create a test issue and link it to the epic', async () => {
    if (!epicKey || !projectKey) {
      console.warn('Skipping: no epic or project key available');
      return;
    }

    // Create a regular issue to link
    const issueResult = await createIssue(
      projectKey,
      `Integration Test Issue for Epic Link ${Date.now()}`,
      'Task'
    );
    linkedIssueKey = issueResult.key;
    createdIssueKeys.push(linkedIssueKey);

    await expect(linkIssueToEpic(linkedIssueKey, epicKey)).resolves.not.toThrow();
  });

  it('should list issues in the epic', async () => {
    if (!epicKey) {
      console.warn('Skipping: no epic key available');
      return;
    }

    const issues = await getEpicIssues(epicKey, { max: 50 });

    expect(Array.isArray(issues)).toBe(true);
    // Structure check if issues exist
    if (issues.length > 0) {
      expect(issues[0].key).toBeDefined();
      expect(issues[0].summary).toBeDefined();
      expect(issues[0].status).toBeDefined();
    }
  });

  it('should get epic progress', async () => {
    if (!epicKey) {
      console.warn('Skipping: no epic key available');
      return;
    }

    const progress = await getEpicProgress(epicKey);

    expect(progress.epicKey).toBe(epicKey);
    expect(progress.epicName).toBeDefined();
    expect(typeof progress.totalIssues).toBe('number');
    expect(typeof progress.doneIssues).toBe('number');
    expect(typeof progress.percentageDone).toBe('number');
    expect(progress.percentageDone).toBeGreaterThanOrEqual(0);
    expect(progress.percentageDone).toBeLessThanOrEqual(100);
  });

  it('should unlink issue from epic', async () => {
    if (!linkedIssueKey) {
      console.warn('Skipping: no linked issue key available');
      return;
    }

    await expect(unlinkIssueFromEpic(linkedIssueKey)).resolves.not.toThrow();
  });
});
