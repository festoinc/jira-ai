import { getBoards, getBoard, getBoardConfig, getBoardIssues, rankIssues } from '../lib/agile-client.js';
import { requirePermission } from '../lib/permissions.js';
import { CommandError } from '../lib/errors.js';

// board list [--project <key>] [--type <type>]
export async function boardListCommand(options?: { projectKey?: string; type?: string }): Promise<void> {
  requirePermission('board.list');
  const params: { projectKeyOrId?: string; type?: string } = {};
  if (options?.projectKey) params.projectKeyOrId = options.projectKey;
  if (options?.type) params.type = options.type;

  const result = await getBoards(Object.keys(params).length ? params : undefined);

  if (!result.values || result.values.length === 0) {
    console.log('No boards found.');
    return;
  }

  console.log(`\nBoards (${result.values.length} total)\n`);
  result.values.forEach(board => {
    const location = board.location?.displayName ? ` — ${board.location.displayName}` : '';
    console.log(`  ${String(board.id)}  ${board.name}${location}  [${board.type}]`);
  });
  if (!result.isLast) {
    console.log('\n  (More results available — use --max to fetch more)');
  }
  console.log();
}

// board get <board-id>
export async function boardGetCommand(boardId: number): Promise<void> {
  requirePermission('board.get');
  if (boardId == null) {
    throw new CommandError('Board ID is required.', { hints: ['Provide a numeric board ID'] });
  }
  const board = await getBoard(boardId);

  console.log(`\nBoard: ${board.name}\n`);
  console.log(`  ID:       ${String(board.id)}`);
  console.log(`  Type:     ${board.type}`);
  if (board.location?.projectKey) console.log(`  Project:  ${board.location.projectKey}`);
  if (board.location?.displayName) console.log(`  Location: ${board.location.displayName}`);
  if (board.isPrivate !== undefined) console.log(`  Private:  ${board.isPrivate ? 'Yes' : 'No'}`);
  console.log();
}

// board config <board-id>
export async function boardConfigCommand(boardId: number): Promise<void> {
  requirePermission('board.config');
  if (boardId == null) {
    throw new CommandError('Board ID is required.', { hints: ['Provide a numeric board ID'] });
  }
  const config = await getBoardConfig(boardId);

  console.log(`\nBoard Config: ${config.name}\n`);
  console.log(`  ID:   ${String(config.id)}`);
  if (config.type) console.log(`  Type: ${config.type}`);
  if (config.filter) console.log(`  Filter ID: ${config.filter.id}`);
  if (config.ranking) console.log(`  Rank Field: ${config.ranking.rankCustomFieldId}`);

  if (config.columnConfig?.columns?.length) {
    console.log(`\n  Columns:`);
    config.columnConfig.columns.forEach(col => {
      const statuses = col.statuses?.map(s => s.id).join(', ') || 'none';
      console.log(`    ${col.name}  [statuses: ${statuses}]`);
    });
  }
  console.log();
}

// board issues <board-id> [--jql <jql>] [--max <n>]
export async function boardIssuesCommand(boardId: number, options?: { jql?: string; max?: number }): Promise<void> {
  requirePermission('board.issues');
  const params: { jql?: string; maxResults?: number } = {};
  if (options?.jql) params.jql = options.jql;
  if (options?.max) params.maxResults = options.max;

  const result = await getBoardIssues(boardId, params);

  if (!result.issues || result.issues.length === 0) {
    console.log('No issues found on this board.');
    return;
  }

  console.log(`\nBoard Issues (${result.total} total)\n`);
  result.issues.forEach(issue => {
    const status = `[${issue.fields.status.name}]`;
    const assignee = issue.fields.assignee ? ` @${issue.fields.assignee.displayName}` : '';
    console.log(`  ${issue.key}  ${issue.fields.summary}  ${status}${assignee}`);
  });
  console.log();
}

// board rank --issues <keys> --before <key> | --after <key>
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
  console.log(`Ranked ${options.issues.length} issue(s) successfully.`);
  console.log();
}
