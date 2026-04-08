import { buildIssueTree } from '../lib/tree-builder.js';
import { outputResult } from '../lib/json-mode.js';
import type { IssueTreeOptions } from '../lib/tree-builder.js';

export async function issueTreeCommand(issueKey: string, options: IssueTreeOptions): Promise<void> {
  const result = await buildIssueTree(issueKey, options);
  outputResult(result);
}
