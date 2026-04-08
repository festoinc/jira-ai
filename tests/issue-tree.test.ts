import { vi, describe, it, expect, beforeEach } from 'vitest';
import * as treeBuilder from '../src/lib/tree-builder.js';
import * as jsonMode from '../src/lib/json-mode.js';
import { issueTreeCommand } from '../src/commands/issue-tree.js';

vi.mock('../src/lib/tree-builder.js');
vi.mock('../src/lib/json-mode.js');

const mockTreeBuilder = treeBuilder as vi.Mocked<typeof treeBuilder>;
const mockJsonMode = jsonMode as vi.Mocked<typeof jsonMode>;

const mockTreeResult = {
  root: 'PROJ-10',
  nodes: [
    { key: 'PROJ-10', summary: 'Root issue', status: 'To Do', type: 'Story', priority: null, assignee: null },
    { key: 'PROJ-11', summary: 'Child issue', status: 'In Progress', type: 'Sub-task', priority: 'High', assignee: 'Alice' },
  ],
  edges: [
    { from: 'PROJ-10', to: 'PROJ-11', relation: 'subtask' },
  ],
  depth: 1,
  truncated: false,
  totalNodes: 2,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockTreeBuilder.buildIssueTree.mockResolvedValue(mockTreeResult as any);
  mockJsonMode.outputResult.mockImplementation(() => {});
});

describe('issueTreeCommand', () => {
  it('parses issue tree <KEY> arg correctly', async () => {
    await issueTreeCommand('PROJ-10', {});

    expect(mockTreeBuilder.buildIssueTree).toHaveBeenCalledWith('PROJ-10', expect.any(Object));
  });

  it('passes --links option to builder', async () => {
    await issueTreeCommand('PROJ-10', { links: true });

    expect(mockTreeBuilder.buildIssueTree).toHaveBeenCalledWith(
      'PROJ-10',
      expect.objectContaining({ links: true })
    );
  });

  it('passes --depth option to builder', async () => {
    await issueTreeCommand('PROJ-10', { depth: 5 });

    expect(mockTreeBuilder.buildIssueTree).toHaveBeenCalledWith(
      'PROJ-10',
      expect.objectContaining({ depth: 5 })
    );
  });

  it('passes --types option to builder', async () => {
    await issueTreeCommand('PROJ-10', { types: 'Blocks,Relates' });

    expect(mockTreeBuilder.buildIssueTree).toHaveBeenCalledWith(
      'PROJ-10',
      expect.objectContaining({ types: 'Blocks,Relates' })
    );
  });

  it('passes --max-nodes option to builder', async () => {
    await issueTreeCommand('PROJ-10', { maxNodes: 100 });

    expect(mockTreeBuilder.buildIssueTree).toHaveBeenCalledWith(
      'PROJ-10',
      expect.objectContaining({ maxNodes: 100 })
    );
  });

  it('outputs result via outputResult()', async () => {
    await issueTreeCommand('PROJ-10', {});

    expect(mockJsonMode.outputResult).toHaveBeenCalledWith(mockTreeResult);
  });

  it('passes all options together correctly', async () => {
    await issueTreeCommand('PROJ-10', {
      links: true,
      depth: 3,
      types: 'Blocks',
      maxNodes: 200,
    });

    expect(mockTreeBuilder.buildIssueTree).toHaveBeenCalledWith('PROJ-10', {
      links: true,
      depth: 3,
      types: 'Blocks',
      maxNodes: 200,
    });
  });

  it('propagates errors from builder', async () => {
    mockTreeBuilder.buildIssueTree.mockRejectedValue(new Error('JIRA API error'));

    await expect(issueTreeCommand('PROJ-10', {})).rejects.toThrow('JIRA API error');
  });
});
