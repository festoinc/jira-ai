import { getTaskWithDetails, searchIssuesByJql, getIssueLinks } from './jira-client.js';
import { getSprintIssues } from './agile-client.js';
import { applyGlobalFilters } from './settings.js';
import type { TreeNode, TreeEdge, TreeResult } from './tree-types.js';

export interface IssueTreeOptions {
  depth?: number;
  maxNodes?: number;
  links?: boolean;
  types?: string;
}

export interface SprintTreeOptions {
  depth?: number;
  maxNodes?: number;
}

export async function buildIssueTree(issueKey: string, options: IssueTreeOptions): Promise<TreeResult> {
  const { depth = 3, maxNodes = 200, links = false, types } = options;

  const nodes: TreeNode[] = [];
  const edges: TreeEdge[] = [];
  const visited = new Set<string>();
  let truncated = false;

  // Fetch root issue
  const root = await getTaskWithDetails(issueKey);

  // Add parent (epic/ancestor) if exists — derived from root.parent, no extra API call needed
  if (root.parent) {
    const parentKey = root.parent.key;
    if (!visited.has(parentKey)) {
      visited.add(parentKey);
      nodes.push({
        key: parentKey,
        summary: root.parent.summary || '',
        status: root.parent.status?.name || 'Unknown',
        type: 'Epic',
        priority: null,
        assignee: null,
      });
    }
  }

  // Add root node
  if (!visited.has(root.key)) {
    if (nodes.length < maxNodes) {
      visited.add(root.key);
      nodes.push({
        key: root.key,
        summary: root.summary,
        status: root.status.name,
        type: root.type || 'Unknown',
        priority: root.priority || null,
        assignee: root.assignee?.displayName || null,
      });
    } else {
      truncated = true;
      return { root: issueKey, nodes, edges, depth: 0, truncated: true, totalNodes: nodes.length };
    }
  }

  // BFS traversal using batched JQL: parent in (key1, key2, ...)
  let currentLevel = [root.key];
  let currentDepth = 0;

  while (currentLevel.length > 0 && currentDepth < depth) {
    if (nodes.length >= maxNodes) {
      truncated = true;
      break;
    }

    const jql = applyGlobalFilters(`parent in (${currentLevel.join(',')})`);
    const children = await searchIssuesByJql(jql, 1000);

    const nextLevel: string[] = [];

    for (const child of children) {
      if (visited.has(child.key)) continue;
      if (nodes.length >= maxNodes) {
        truncated = true;
        break;
      }

      visited.add(child.key);
      nodes.push({
        key: child.key,
        summary: child.summary,
        status: child.status.name,
        type: (child as any).issuetype?.name || 'Unknown',
        priority: child.priority?.name || null,
        assignee: child.assignee?.displayName || null,
      });

      // Determine parent for edge: when there's one parent in currentLevel all children map to it
      let parentKey: string | undefined;
      if (currentLevel.length === 1) {
        parentKey = currentLevel[0];
      } else {
        parentKey = (child as any).parent?.key;
      }
      if (parentKey) {
        edges.push({ from: parentKey, to: child.key, relation: 'subtask' });
      }

      nextLevel.push(child.key);
    }

    if (truncated) break;

    currentLevel = nextLevel;
    currentDepth++;
  }

  // Add linked issues as single-hop leaf nodes when --links is true
  if (links) {
    const issueLinks = await getIssueLinks(issueKey);
    const allowedTypes = types ? types.split(',').map((t) => t.trim()) : null;

    await Promise.all(
      issueLinks.map(async (link) => {
        const linkedIssue = link.outwardIssue || link.inwardIssue;
        if (!linkedIssue) return;

        const linkType = link.type.name;
        if (allowedTypes && !allowedTypes.includes(linkType)) return;
        if (visited.has(linkedIssue.key)) return;
        if (nodes.length >= maxNodes) {
          truncated = true;
          return;
        }

        visited.add(linkedIssue.key);
        nodes.push({
          key: linkedIssue.key,
          summary: linkedIssue.summary || '',
          status: linkedIssue.status?.name || 'Unknown',
          type: (linkedIssue as any).issuetype?.name || 'Unknown',
          priority: null,
          assignee: null,
        });

        edges.push({ from: issueKey, to: linkedIssue.key, relation: linkType });
      })
    );
  }

  return {
    root: issueKey,
    nodes,
    edges,
    depth: currentDepth,
    truncated,
    totalNodes: nodes.length,
  };
}

export async function buildSprintTree(sprintId: string, options: SprintTreeOptions): Promise<TreeResult> {
  const { depth = 3, maxNodes = 200 } = options;

  const nodes: TreeNode[] = [];
  const edges: TreeEdge[] = [];
  let truncated = false;

  // Virtual sprint root node
  const sprintRootKey = `sprint-${sprintId}`;
  nodes.push({
    key: sprintRootKey,
    summary: `Sprint ${sprintId}`,
    status: 'active',
    type: 'sprint',
    priority: null,
    assignee: null,
  });

  // Fetch all sprint issues
  const { issues } = await getSprintIssues(Number(sprintId));

  if (issues.length === 0) {
    return { root: sprintRootKey, nodes, edges, depth: 0, truncated: false, totalNodes: 1 };
  }

  // Build lookup map
  const issueMap = new Map<string, any>();
  for (const issue of issues) {
    issueMap.set(issue.key, issue);
  }

  const visited = new Set<string>([sprintRootKey]);

  // Seed BFS with top-level issues: those whose parent is absent or outside the sprint
  let queue: Array<{ key: string; d: number }> = [];
  for (const issue of issues) {
    const parentKey = (issue.fields as any).parent?.key;
    if (!parentKey || !issueMap.has(parentKey)) {
      queue.push({ key: issue.key, d: 1 });
    }
  }

  while (queue.length > 0) {
    const next: Array<{ key: string; d: number }> = [];

    for (const { key, d } of queue) {
      if (visited.has(key)) continue;
      if (d > depth) continue;
      if (nodes.length >= maxNodes + 1) {
        // maxNodes + 1 because sprint root is not counted against maxNodes
        truncated = true;
        break;
      }

      const issue = issueMap.get(key);
      if (!issue) continue;

      visited.add(key);
      const fields = issue.fields as any;
      nodes.push({
        key: issue.key,
        summary: fields.summary || '',
        status: fields.status?.name || 'Unknown',
        type: fields.issuetype?.name || 'Unknown',
        priority: fields.priority?.name || null,
        assignee: fields.assignee?.displayName || null,
      });

      // Edge: connect to parent if it's in the visited set, otherwise to sprint root
      const parentKey = fields.parent?.key;
      if (parentKey && visited.has(parentKey)) {
        edges.push({ from: parentKey, to: key, relation: 'hierarchy' });
      } else {
        edges.push({ from: sprintRootKey, to: key, relation: 'hierarchy' });
      }

      // Enqueue children (issues in sprint whose parent is this issue)
      for (const childIssue of issues) {
        const childParentKey = (childIssue.fields as any).parent?.key;
        if (childParentKey === key && !visited.has(childIssue.key)) {
          next.push({ key: childIssue.key, d: d + 1 });
        }
      }
    }

    if (truncated) break;
    queue = next;
  }

  return {
    root: sprintRootKey,
    nodes,
    edges,
    depth,
    truncated,
    totalNodes: nodes.length,
  };
}
