import { vi, describe, it, expect, beforeEach } from 'vitest';
import * as jiraClient from '../src/lib/jira-client.js';
import * as agileClient from '../src/lib/agile-client.js';
import * as settings from '../src/lib/settings.js';
import { buildIssueTree, buildSprintTree } from '../src/lib/tree-builder.js';
import type { TreeResult, TreeNode } from '../src/lib/tree-types.js';

vi.mock('../src/lib/jira-client.js');
vi.mock('../src/lib/agile-client.js');
vi.mock('../src/lib/settings.js');

const mockJiraClient = jiraClient as vi.Mocked<typeof jiraClient>;
const mockAgileClient = agileClient as vi.Mocked<typeof agileClient>;
const mockSettings = settings as vi.Mocked<typeof settings>;

const makeIssue = (key: string, opts: Partial<{
  summary: string;
  status: string;
  type: string;
  priority: string | null;
  assignee: string | null;
  parentKey: string | null;
  subtaskKeys: string[];
}> = {}) => ({
  key,
  summary: opts.summary ?? `Summary of ${key}`,
  status: { name: opts.status ?? 'To Do' },
  issuetype: { name: opts.type ?? 'Story' },
  priority: opts.priority ? { name: opts.priority } : null,
  assignee: opts.assignee ? { displayName: opts.assignee } : null,
  parent: opts.parentKey ? { key: opts.parentKey } : undefined,
  subtasks: (opts.subtaskKeys ?? []).map((sk) => ({ key: sk })),
});

// Sprint issue helper (BoardIssue shape from agile-client)
const makeBoardIssue = (key: string, opts: Partial<{
  summary: string;
  status: string;
  type: string;
  priority: string | null;
  assignee: string | null;
  parentKey: string | null;
  subtaskKeys: string[];
}> = {}) => ({
  key,
  fields: {
    summary: opts.summary ?? `Summary of ${key}`,
    status: { name: opts.status ?? 'To Do' },
    issuetype: { name: opts.type ?? 'Story' },
    priority: opts.priority ? { name: opts.priority } : null,
    assignee: opts.assignee ? { displayName: opts.assignee } : null,
    parent: opts.parentKey ? { key: opts.parentKey } : undefined,
    subtasks: (opts.subtaskKeys ?? []).map((sk) => ({ key: sk })),
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  mockSettings.applyGlobalFilters.mockImplementation((jql: string) => jql);
  mockSettings.isProjectAllowed.mockReturnValue(true);
  mockSettings.isCommandAllowed.mockReturnValue(true);
});

describe('buildIssueTree', () => {
  it('builds a tree from a root issue with parent epic and subtasks', async () => {
    const root = makeIssue('PROJ-10', {
      type: 'Story',
      parentKey: 'PROJ-1',
      subtaskKeys: ['PROJ-11', 'PROJ-12'],
    });
    const epic = makeIssue('PROJ-1', { type: 'Epic', summary: 'Parent Epic' });
    const child1 = makeIssue('PROJ-11', { type: 'Sub-task' });
    const child2 = makeIssue('PROJ-12', { type: 'Sub-task' });

    mockJiraClient.getTaskWithDetails.mockResolvedValue(root as any);
    mockJiraClient.searchIssuesByJql.mockResolvedValue([child1, child2] as any);
    // No need to fetch epic explicitly for this case — it's referenced from root.parent

    const result: TreeResult = await buildIssueTree('PROJ-10', {});

    expect(result.root).toBe('PROJ-10');
    expect(result.nodes.map((n: TreeNode) => n.key)).toContain('PROJ-10');
    expect(result.nodes.map((n: TreeNode) => n.key)).toContain('PROJ-11');
    expect(result.nodes.map((n: TreeNode) => n.key)).toContain('PROJ-12');
    // Parent epic should be included
    expect(result.nodes.map((n: TreeNode) => n.key)).toContain('PROJ-1');
    // Edges: root -> children
    const rootToChild1 = result.edges.find((e) => e.from === 'PROJ-10' && e.to === 'PROJ-11');
    expect(rootToChild1).toBeDefined();
    expect(rootToChild1?.relation).toBe('subtask');
  });

  it('respects --depth limit in BFS traversal', async () => {
    const root = makeIssue('PROJ-10', { subtaskKeys: ['PROJ-11'] });
    const level1 = makeIssue('PROJ-11', { subtaskKeys: ['PROJ-12'] });
    const level2 = makeIssue('PROJ-12', { subtaskKeys: ['PROJ-13'] });

    mockJiraClient.getTaskWithDetails.mockResolvedValue(root as any);
    mockJiraClient.searchIssuesByJql
      .mockResolvedValueOnce([level1] as any)
      .mockResolvedValueOnce([level2] as any);

    const result: TreeResult = await buildIssueTree('PROJ-10', { depth: 1 });

    expect(result.nodes.map((n: TreeNode) => n.key)).toContain('PROJ-10');
    expect(result.nodes.map((n: TreeNode) => n.key)).toContain('PROJ-11');
    // Depth 1 means only 1 level below root
    expect(result.nodes.map((n: TreeNode) => n.key)).not.toContain('PROJ-12');
    expect(result.nodes.map((n: TreeNode) => n.key)).not.toContain('PROJ-13');
  });

  it('detects cycles via visited keys set', async () => {
    // PROJ-10 -> PROJ-11 -> PROJ-10 (cycle)
    const root = makeIssue('PROJ-10', { subtaskKeys: ['PROJ-11'] });
    const child = makeIssue('PROJ-11', { subtaskKeys: ['PROJ-10'] });

    mockJiraClient.getTaskWithDetails.mockResolvedValue(root as any);
    mockJiraClient.searchIssuesByJql
      .mockResolvedValueOnce([child] as any)
      .mockResolvedValueOnce([] as any); // cycle should be skipped

    const result: TreeResult = await buildIssueTree('PROJ-10', { depth: 5 });

    // Should not hang, should contain each node only once
    const keys = result.nodes.map((n: TreeNode) => n.key);
    const uniqueKeys = [...new Set(keys)];
    expect(keys.length).toBe(uniqueKeys.length);
    expect(keys).toContain('PROJ-10');
    expect(keys).toContain('PROJ-11');
  });

  it('sets truncated:true when --max-nodes limit is hit', async () => {
    const root = makeIssue('PROJ-10', { subtaskKeys: ['PROJ-11', 'PROJ-12', 'PROJ-13'] });
    const children = ['PROJ-11', 'PROJ-12', 'PROJ-13'].map((k) => makeIssue(k));

    mockJiraClient.getTaskWithDetails.mockResolvedValue(root as any);
    mockJiraClient.searchIssuesByJql.mockResolvedValue(children as any);

    // maxNodes=2 means we'll exceed it quickly
    const result: TreeResult = await buildIssueTree('PROJ-10', { maxNodes: 2 });

    expect(result.truncated).toBe(true);
    expect(result.nodes.length).toBeLessThanOrEqual(2);
  });

  it('uses batched JQL queries with parent in (...) at each BFS level', async () => {
    const root = makeIssue('PROJ-10', { subtaskKeys: ['PROJ-11', 'PROJ-12'] });

    mockJiraClient.getTaskWithDetails.mockResolvedValue(root as any);
    mockJiraClient.searchIssuesByJql.mockResolvedValue([] as any);

    await buildIssueTree('PROJ-10', { depth: 2 });

    // Should have been called with a JQL that includes "parent in"
    expect(mockJiraClient.searchIssuesByJql).toHaveBeenCalledWith(
      expect.stringContaining('parent in'),
      expect.any(Number),
      ['issuetype', 'parent']
    );
  });

  it('adds linked issues as single-hop leaf nodes when --links is true', async () => {
    const root = makeIssue('PROJ-10', { subtaskKeys: [] });
    const linkedIssue = makeIssue('PROJ-99', { type: 'Bug', summary: 'Blocking bug' });

    mockJiraClient.getTaskWithDetails.mockResolvedValue(root as any);
    mockJiraClient.searchIssuesByJql.mockResolvedValue([] as any);
    mockJiraClient.getIssueLinks.mockResolvedValue([
      {
        id: 'link-1',
        type: { name: 'Blocks', inward: 'is blocked by', outward: 'blocks' },
        outwardIssue: linkedIssue,
        inwardIssue: undefined,
      },
    ] as any);

    const result: TreeResult = await buildIssueTree('PROJ-10', { links: true });

    expect(result.nodes.map((n: TreeNode) => n.key)).toContain('PROJ-99');
    const linkEdge = result.edges.find((e) => e.from === 'PROJ-10' && e.to === 'PROJ-99');
    expect(linkEdge).toBeDefined();
    expect(linkEdge?.relation).toBe('Blocks');
  });

  it('filters links by --types when specified', async () => {
    const root = makeIssue('PROJ-10', { subtaskKeys: [] });
    const blockedByIssue = makeIssue('PROJ-98');
    const relatedIssue = makeIssue('PROJ-97');

    mockJiraClient.getTaskWithDetails.mockResolvedValue(root as any);
    mockJiraClient.searchIssuesByJql.mockResolvedValue([] as any);
    mockJiraClient.getIssueLinks.mockResolvedValue([
      {
        id: 'link-1',
        type: { name: 'Blocks', inward: 'is blocked by', outward: 'blocks' },
        outwardIssue: blockedByIssue,
        inwardIssue: undefined,
      },
      {
        id: 'link-2',
        type: { name: 'Relates', inward: 'relates to', outward: 'relates to' },
        outwardIssue: relatedIssue,
        inwardIssue: undefined,
      },
    ] as any);

    // Only include Blocks links
    const result: TreeResult = await buildIssueTree('PROJ-10', {
      links: true,
      types: 'Blocks',
    });

    expect(result.nodes.map((n: TreeNode) => n.key)).toContain('PROJ-98');
    expect(result.nodes.map((n: TreeNode) => n.key)).not.toContain('PROJ-97');
  });

  it('returns TreeResult with flat adjacency list format', async () => {
    const root = makeIssue('PROJ-10', { subtaskKeys: ['PROJ-11'] });
    mockJiraClient.getTaskWithDetails.mockResolvedValue(root as any);
    mockJiraClient.searchIssuesByJql.mockResolvedValue([makeIssue('PROJ-11')] as any);

    const result: TreeResult = await buildIssueTree('PROJ-10', {});

    // Verify shape
    expect(result).toHaveProperty('root');
    expect(result).toHaveProperty('nodes');
    expect(result).toHaveProperty('edges');
    expect(result).toHaveProperty('depth');
    expect(result).toHaveProperty('truncated');
    expect(result).toHaveProperty('totalNodes');
    expect(Array.isArray(result.nodes)).toBe(true);
    expect(Array.isArray(result.edges)).toBe(true);
    result.nodes.forEach((node: TreeNode) => {
      expect(node).toHaveProperty('key');
      expect(node).toHaveProperty('summary');
      expect(node).toHaveProperty('status');
      expect(node).toHaveProperty('type');
    });
    result.edges.forEach((edge: { from: string; to: string; relation: string }) => {
      expect(edge).toHaveProperty('from');
      expect(edge).toHaveProperty('to');
      expect(edge).toHaveProperty('relation');
    });
  });

  it('applies global filters to JQL queries', async () => {
    const root = makeIssue('PROJ-10', { subtaskKeys: ['PROJ-11'] });
    mockJiraClient.getTaskWithDetails.mockResolvedValue(root as any);
    mockJiraClient.searchIssuesByJql.mockResolvedValue([] as any);
    mockSettings.applyGlobalFilters.mockImplementation((jql: string) => `${jql} AND project = PROJ`);

    await buildIssueTree('PROJ-10', {});

    expect(mockSettings.applyGlobalFilters).toHaveBeenCalled();
  });
});

describe('buildSprintTree', () => {
  it('builds a sprint tree with epics as level-1 children', async () => {
    const issues = [
      makeBoardIssue('PROJ-1', { type: 'Epic', summary: 'Epic A' }),
      makeBoardIssue('PROJ-10', { type: 'Story', parentKey: 'PROJ-1' }),
      makeBoardIssue('PROJ-11', { type: 'Story', parentKey: 'PROJ-1' }),
    ];
    mockAgileClient.getSprintIssues.mockResolvedValue({ total: issues.length, issues } as any);

    const result: TreeResult = await buildSprintTree('42', {});

    expect(result.root).toBe('sprint-42');
    const nodeKeys = result.nodes.map((n: TreeNode) => n.key);
    expect(nodeKeys).toContain('sprint-42');
    expect(nodeKeys).toContain('PROJ-1');
    expect(nodeKeys).toContain('PROJ-10');
    expect(nodeKeys).toContain('PROJ-11');

    // Epic should be connected to sprint root
    const sprintToEpic = result.edges.find((e) => e.from === 'sprint-42' && e.to === 'PROJ-1');
    expect(sprintToEpic).toBeDefined();
    // Story should be connected to epic
    const epicToStory = result.edges.find((e) => e.from === 'PROJ-1' && e.to === 'PROJ-10');
    expect(epicToStory).toBeDefined();
  });

  it('groups unparented issues under sprint root', async () => {
    const issues = [
      makeBoardIssue('PROJ-20', { type: 'Task', parentKey: null }),
      makeBoardIssue('PROJ-21', { type: 'Task', parentKey: null }),
    ];
    mockAgileClient.getSprintIssues.mockResolvedValue({ total: issues.length, issues } as any);

    const result: TreeResult = await buildSprintTree('42', {});

    // Unparented issues connect directly to sprint root
    const edge20 = result.edges.find((e) => e.from === 'sprint-42' && e.to === 'PROJ-20');
    const edge21 = result.edges.find((e) => e.from === 'sprint-42' && e.to === 'PROJ-21');
    expect(edge20).toBeDefined();
    expect(edge21).toBeDefined();
  });

  it('returns empty tree when sprint has no issues', async () => {
    mockAgileClient.getSprintIssues.mockResolvedValue({ total: 0, issues: [] } as any);

    const result: TreeResult = await buildSprintTree('99', {});

    expect(result.root).toBe('sprint-99');
    // Only the virtual sprint root node
    expect(result.nodes.length).toBe(1);
    expect(result.nodes[0].key).toBe('sprint-99');
    expect(result.edges.length).toBe(0);
    expect(result.totalNodes).toBe(1);
  });

  it('respects --depth option (subtasks at depth 3)', async () => {
    const issues = [
      makeBoardIssue('PROJ-1', { type: 'Epic' }),
      makeBoardIssue('PROJ-10', { type: 'Story', parentKey: 'PROJ-1', subtaskKeys: ['PROJ-100'] }),
      makeBoardIssue('PROJ-100', { type: 'Sub-task', parentKey: 'PROJ-10' }),
    ];
    mockAgileClient.getSprintIssues.mockResolvedValue({ total: issues.length, issues } as any);

    const resultDeep: TreeResult = await buildSprintTree('42', { depth: 3 });

    mockAgileClient.getSprintIssues.mockResolvedValue({ total: issues.length, issues } as any);
    const resultShallow: TreeResult = await buildSprintTree('42', { depth: 2 });

    const deepKeys = resultDeep.nodes.map((n: TreeNode) => n.key);
    const shallowKeys = resultShallow.nodes.map((n: TreeNode) => n.key);

    expect(deepKeys).toContain('PROJ-100');
    expect(shallowKeys).not.toContain('PROJ-100');
  });

  it('sets truncated:true when --max-nodes is hit', async () => {
    const issues = Array.from({ length: 20 }, (_, i) =>
      makeBoardIssue(`PROJ-${i + 1}`, { type: 'Task' })
    );
    mockAgileClient.getSprintIssues.mockResolvedValue({ total: issues.length, issues } as any);

    const result: TreeResult = await buildSprintTree('42', { maxNodes: 5 });

    expect(result.truncated).toBe(true);
    // +1 for the virtual root node
    expect(result.nodes.length).toBeLessThanOrEqual(6);
  });
});
