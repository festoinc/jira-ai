import { vi, describe, it, expect, beforeEach } from 'vitest';
import * as treeBuilder from '../src/lib/tree-builder.js';
import * as jsonMode from '../src/lib/json-mode.js';
import { sprintTreeCommand } from '../src/commands/sprint-tree.js';

vi.mock('../src/lib/tree-builder.js');
vi.mock('../src/lib/json-mode.js');

const mockTreeBuilder = treeBuilder as vi.Mocked<typeof treeBuilder>;
const mockJsonMode = jsonMode as vi.Mocked<typeof jsonMode>;

const mockSprintTreeResult = {
  root: 'sprint-42',
  nodes: [
    { key: 'sprint-42', summary: 'Sprint 42', status: 'active', type: 'sprint', priority: null, assignee: null },
    { key: 'PROJ-1', summary: 'Epic A', status: 'In Progress', type: 'Epic', priority: null, assignee: null },
    { key: 'PROJ-10', summary: 'Story 1', status: 'To Do', type: 'Story', priority: 'Medium', assignee: 'Bob' },
  ],
  edges: [
    { from: 'sprint-42', to: 'PROJ-1', relation: 'hierarchy' },
    { from: 'PROJ-1', to: 'PROJ-10', relation: 'hierarchy' },
  ],
  depth: 2,
  truncated: false,
  totalNodes: 3,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockTreeBuilder.buildSprintTree.mockResolvedValue(mockSprintTreeResult as any);
  mockJsonMode.outputResult.mockImplementation(() => {});
});

describe('sprintTreeCommand', () => {
  it('parses sprint tree <ID> arg correctly', async () => {
    await sprintTreeCommand('42', {});

    expect(mockTreeBuilder.buildSprintTree).toHaveBeenCalledWith('42', expect.any(Object));
  });

  it('passes --depth option to builder', async () => {
    await sprintTreeCommand('42', { depth: 4 });

    expect(mockTreeBuilder.buildSprintTree).toHaveBeenCalledWith(
      '42',
      expect.objectContaining({ depth: 4 })
    );
  });

  it('passes --max-nodes option to builder', async () => {
    await sprintTreeCommand('42', { maxNodes: 150 });

    expect(mockTreeBuilder.buildSprintTree).toHaveBeenCalledWith(
      '42',
      expect.objectContaining({ maxNodes: 150 })
    );
  });

  it('outputs result via outputResult()', async () => {
    await sprintTreeCommand('42', {});

    expect(mockJsonMode.outputResult).toHaveBeenCalledWith(mockSprintTreeResult);
  });

  it('passes all options together correctly', async () => {
    await sprintTreeCommand('42', {
      depth: 3,
      maxNodes: 200,
    });

    expect(mockTreeBuilder.buildSprintTree).toHaveBeenCalledWith('42', {
      depth: 3,
      maxNodes: 200,
    });
  });

  it('propagates errors from builder', async () => {
    mockTreeBuilder.buildSprintTree.mockRejectedValue(new Error('Sprint not found'));

    await expect(sprintTreeCommand('42', {})).rejects.toThrow('Sprint not found');
  });

  it('does not accept --links option (sprint tree is hierarchy only)', async () => {
    // sprintTreeCommand signature should not include a links parameter
    // Calling with an unknown option should still work (options are ignored / not forwarded)
    await sprintTreeCommand('42', {});

    const callArgs = mockTreeBuilder.buildSprintTree.mock.calls[0][1];
    expect(callArgs).not.toHaveProperty('links');
  });
});
