import { getBoards, getBoard, getBoardConfig, getBoardIssues, rankIssues } from '../lib/agile-client.js';
import { requirePermission } from '../lib/permissions.js';
import { CommandError } from '../lib/errors.js';
import { outputResult } from '../lib/json-mode.js';

export async function boardListCommand(options?: { projectKey?: string; type?: string }): Promise<void> {
  requirePermission('board.list');
  const params: { projectKeyOrId?: string; type?: string } = {};
  if (options?.projectKey) params.projectKeyOrId = options.projectKey;
  if (options?.type) params.type = options.type;

  const result = await getBoards(Object.keys(params).length ? params : undefined);

  if (!result.values || result.values.length === 0) {
    outputResult({ boards: [], total: 0 });
    return;
  }

  outputResult({ boards: result.values, total: result.values.length, isLast: result.isLast });
}

export async function boardGetCommand(boardId: number): Promise<void> {
  requirePermission('board.get');
  if (boardId == null) {
    throw new CommandError('Board ID is required.', { hints: ['Provide a numeric board ID'] });
  }
  const board = await getBoard(boardId);
  outputResult(board);
}

export async function boardConfigCommand(boardId: number): Promise<void> {
  requirePermission('board.config');
  if (boardId == null) {
    throw new CommandError('Board ID is required.', { hints: ['Provide a numeric board ID'] });
  }
  const config = await getBoardConfig(boardId);
  outputResult(config);
}

export async function boardIssuesCommand(boardId: number, options?: { jql?: string; max?: number }): Promise<void> {
  requirePermission('board.issues');
  const params: { jql?: string; maxResults?: number } = {};
  if (options?.jql) params.jql = options.jql;
  if (options?.max) params.maxResults = options.max;

  const result = await getBoardIssues(boardId, params);

  if (!result.issues || result.issues.length === 0) {
    outputResult({ issues: [], total: 0 });
    return;
  }

  outputResult({ issues: result.issues, total: result.total });
}

export async function boardRankCommand(options: { issues: string[]; before?: string; after?: string }): Promise<void> {
  requirePermission('board.rank');
  if (!options.issues || options.issues.length === 0) {
    throw new CommandError('At least one issue key is required.', { hints: ['Provide issue keys with --issues'] });
  }
  if (!options.before && !options.after) {
    throw new CommandError('Either --before or --after must be specified.', {
      hints: ['Use --before <issue-key> or --after <issue-key>'],
    });
  }

  const rankOptions: { rankBeforeIssue?: string; rankAfterIssue?: string } = {};
  if (options.before) rankOptions.rankBeforeIssue = options.before;
  if (options.after) rankOptions.rankAfterIssue = options.after;

  await rankIssues(options.issues, rankOptions);
  outputResult({ success: true, message: `Ranked ${options.issues.length} issue(s) successfully.` });
}
