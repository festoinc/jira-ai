import { buildSprintTree } from '../lib/tree-builder.js';
import { outputResult } from '../lib/json-mode.js';
import type { SprintTreeOptions } from '../lib/tree-builder.js';

export async function sprintTreeCommand(sprintId: string, options: SprintTreeOptions): Promise<void> {
  const result = await buildSprintTree(sprintId, options);
  outputResult(result);
}
