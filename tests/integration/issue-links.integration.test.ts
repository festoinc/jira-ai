import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  getIssueLinks,
  createIssueLink,
  deleteIssueLink,
  getAvailableLinkTypes,
  getProjects,
  createIssue,
  getProjectIssueTypes,
  getJiraClient,
} from '../../src/lib/jira-client.js';
import { checkEnv } from './integration-test-utils.js';

// Track created resources for cleanup
const createdIssueKeys: string[] = [];
let createdLinkId: string | null = null;

describe('issue links integration tests', () => {
  let projectKey: string;
  let issueKey1: string;
  let issueKey2: string;
  let projectFound = false;

  beforeAll(async () => {
    checkEnv();

    const projects = await getProjects();
    expect(projects.length).toBeGreaterThan(0);
    projectKey = projects[0].key;
    projectFound = true;

    // Create two temporary test issues for link operations
    const issueTypes = await getProjectIssueTypes(projectKey);
    const taskType = issueTypes.find(
      (t) => t.name.toLowerCase() === 'task' || t.name.toLowerCase() === 'story'
    );
    if (!taskType) {
      projectFound = false;
      console.warn('No Task/Story issue type found. Integration tests will be skipped.');
      return;
    }

    const issue1 = await createIssue({
      projectKey,
      summary: '[jira-ai integration test] Link source issue',
      issueType: taskType.name,
    });
    createdIssueKeys.push(issue1.key);
    issueKey1 = issue1.key;

    const issue2 = await createIssue({
      projectKey,
      summary: '[jira-ai integration test] Link target issue',
      issueType: taskType.name,
    });
    createdIssueKeys.push(issue2.key);
    issueKey2 = issue2.key;
  });

  afterAll(async () => {
    const client = getJiraClient();
    for (const key of createdIssueKeys) {
      try {
        await client.issues.deleteIssue({ issueIdOrKey: key });
      } catch {
        // Ignore cleanup failures
      }
    }
  });

  it('should list available link types', async () => {
    const types = await getAvailableLinkTypes();
    expect(Array.isArray(types)).toBe(true);
    // Most Jira instances have at least one link type
    if (types.length > 0) {
      const first = types[0];
      expect(first.id).toBeDefined();
      expect(first.name).toBeDefined();
      expect(first.inward).toBeDefined();
      expect(first.outward).toBeDefined();
    }
  });

  it('should list links on a real issue (may be empty)', async () => {
    if (!projectFound) return;
    const links = await getIssueLinks(issueKey1);
    expect(Array.isArray(links)).toBe(true);
  });

  it('should create a link between two test issues', async () => {
    if (!projectFound) return;

    const types = await getAvailableLinkTypes();
    if (types.length === 0) {
      console.warn('No link types available. Skipping create link test.');
      return;
    }

    const linkTypeName = types[0].name;
    await createIssueLink(issueKey1, issueKey2, linkTypeName);

    // Verify the link was created
    const links = await getIssueLinks(issueKey1);
    expect(links.length).toBeGreaterThan(0);

    const matchingLink = links.find(
      (l) => l.inwardIssue?.key === issueKey2 || l.outwardIssue?.key === issueKey2
    );
    expect(matchingLink).toBeDefined();
    if (matchingLink) {
      createdLinkId = matchingLink.id;
    }
  });

  it('should delete the created link', async () => {
    if (!projectFound || !createdLinkId) return;

    await deleteIssueLink(createdLinkId);

    // Verify link is gone
    const links = await getIssueLinks(issueKey1);
    const stillExists = links.find((l) => l.id === createdLinkId);
    expect(stillExists).toBeUndefined();
  });

  it('should return error for invalid issue key when listing links', async () => {
    await expect(getIssueLinks('INVALID-99999999')).rejects.toThrow();
  });

  it('should return error when creating link with invalid issue key', async () => {
    if (!projectFound) return;
    const types = await getAvailableLinkTypes();
    if (types.length === 0) return;

    await expect(
      createIssueLink('INVALID-99999999', issueKey1, types[0].name)
    ).rejects.toThrow();
  });

  it('should return error when creating link with invalid link type', async () => {
    if (!projectFound) return;

    await expect(
      createIssueLink(issueKey1, issueKey2, '__nonexistent_link_type_xyz__')
    ).rejects.toThrow();
  });

  it('should return error when deleting non-existent link', async () => {
    await expect(deleteIssueLink('00000000-0000-0000-0000-000000000000')).rejects.toThrow();
  });
});
