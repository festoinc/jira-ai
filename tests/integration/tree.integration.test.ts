import { describe, it, expect, beforeAll } from 'vitest';
import { getProjects, searchIssuesByJql } from '../../src/lib/jira-client.js';
import { buildIssueTree, buildSprintTree } from '../../src/lib/tree-builder.js';
import { getBoards, getSprints } from '../../src/lib/agile-client.js';
import type { TreeResult } from '../../src/lib/tree-types.js';
import { checkEnv } from './integration-test-utils.js';

describe('tree integration tests', () => {
  beforeAll(() => {
    checkEnv();
  });

  describe('issue tree', () => {
    it('returns valid TreeResult JSON for a known issue', async () => {
      // Find any issue to use as the root
      const projects = await getProjects();
      expect(projects.length).toBeGreaterThan(0);
      const projectKey = projects[0].key;

      const issues = await searchIssuesByJql(`project = ${projectKey}`, 1);
      if (issues.length === 0) {
        console.warn(`No issues found in project ${projectKey}, skipping tree test`);
        return;
      }

      const issueKey = issues[0].key;
      const result: TreeResult = await buildIssueTree(issueKey, { depth: 2, maxNodes: 50 });

      // Validate shape
      expect(result).toHaveProperty('root', issueKey);
      expect(result).toHaveProperty('nodes');
      expect(result).toHaveProperty('edges');
      expect(result).toHaveProperty('depth');
      expect(result).toHaveProperty('truncated');
      expect(result).toHaveProperty('totalNodes');

      expect(Array.isArray(result.nodes)).toBe(true);
      expect(Array.isArray(result.edges)).toBe(true);
      expect(result.nodes.length).toBeGreaterThan(0);

      // Root node must be in nodes list
      const rootNode = result.nodes.find((n) => n.key === issueKey);
      expect(rootNode).toBeDefined();
      expect(rootNode?.summary).toBeDefined();
      expect(rootNode?.status).toBeDefined();
      expect(rootNode?.type).toBeDefined();

      // All edge endpoints must reference nodes in the nodes list
      const nodeKeys = new Set(result.nodes.map((n) => n.key));
      result.edges.forEach((edge) => {
        expect(nodeKeys.has(edge.from)).toBe(true);
        expect(nodeKeys.has(edge.to)).toBe(true);
        expect(edge.relation).toBeDefined();
        expect(typeof edge.relation).toBe('string');
      });

      expect(result.totalNodes).toBe(result.nodes.length);
    });
  });

  describe('sprint tree', () => {
    it('returns valid TreeResult JSON for a known sprint', async () => {
      // Find a board and sprint to use
      const projects = await getProjects();
      expect(projects.length).toBeGreaterThan(0);

      let sprintId: string | null = null;

      // Try to find an active sprint via boards
      try {
        const boardList = await getBoards({ maxResults: 5 });
        for (const board of boardList.values ?? []) {
          try {
            const sprintList = await getSprints(board.id, { state: 'active', maxResults: 1 });
            if (sprintList.values && sprintList.values.length > 0) {
              sprintId = String(sprintList.values[0].id);
              break;
            }
          } catch {
            // Board may not support sprints
          }
        }
      } catch {
        // Agile API may not be available
      }

      if (!sprintId) {
        console.warn('No active sprints found in any project, skipping sprint tree test');
        return;
      }

      const result: TreeResult = await buildSprintTree(sprintId, { depth: 3, maxNodes: 100 });

      // Validate shape
      expect(result).toHaveProperty('root', `sprint-${sprintId}`);
      expect(result).toHaveProperty('nodes');
      expect(result).toHaveProperty('edges');
      expect(result).toHaveProperty('depth');
      expect(result).toHaveProperty('truncated');
      expect(result).toHaveProperty('totalNodes');

      expect(Array.isArray(result.nodes)).toBe(true);
      expect(Array.isArray(result.edges)).toBe(true);

      // Virtual sprint root node must exist
      const sprintRoot = result.nodes.find((n) => n.key === `sprint-${sprintId}`);
      expect(sprintRoot).toBeDefined();
      expect(sprintRoot?.type).toBe('sprint');

      // All edge endpoints must reference nodes in the nodes list
      const nodeKeys = new Set(result.nodes.map((n) => n.key));
      result.edges.forEach((edge) => {
        expect(nodeKeys.has(edge.from)).toBe(true);
        expect(nodeKeys.has(edge.to)).toBe(true);
      });

      expect(result.totalNodes).toBe(result.nodes.length);
    });
  });
});
