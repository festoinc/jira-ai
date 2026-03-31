import {
  getSprints,
  getSprint,
  createSprint,
  startSprint,
  completeSprint,
  updateSprint,
  deleteSprint,
  getSprintIssues,
  moveIssuesToSprint,
} from '../lib/agile-client.js';
import { requirePermission } from '../lib/permissions.js';
import { CommandError } from '../lib/errors.js';
import { outputResult } from '../lib/json-mode.js';

export async function sprintListCommand(boardId: number, options?: { state?: string }): Promise<void> {
  requirePermission('sprint.list');
  const params: { state?: string } = {};
  if (options?.state) params.state = options.state;

  const result = await getSprints(boardId, params);

  if (!result.values || result.values.length === 0) {
    outputResult({ sprints: [], total: 0 });
    return;
  }

  outputResult({ sprints: result.values, total: result.values.length });
}

export async function sprintGetCommand(sprintId: number): Promise<void> {
  requirePermission('sprint.get');
  if (sprintId == null) {
    throw new CommandError('Sprint ID is required.', { hints: ['Provide a numeric sprint ID'] });
  }
  const sprint = await getSprint(sprintId);
  outputResult(sprint);
}

export async function sprintCreateCommand(
  boardId: number,
  name: string,
  options?: { goal?: string; start?: string; end?: string }
): Promise<void> {
  requirePermission('sprint.create');
  if (boardId == null) {
    throw new CommandError('Board ID is required.', { hints: ['Provide a numeric board ID'] });
  }
  if (!name) {
    throw new CommandError('Sprint name is required.', { hints: ['Provide a sprint name with --name'] });
  }

  const params: { goal?: string; startDate?: string; endDate?: string } = {};
  if (options?.goal) params.goal = options.goal;
  if (options?.start) params.startDate = options.start;
  if (options?.end) params.endDate = options.end;

  const sprint = await createSprint(boardId, name, params);
  outputResult({ success: true, sprint: { id: sprint.id, name: sprint.name } });
}

export async function sprintStartCommand(sprintId: number): Promise<void> {
  requirePermission('sprint.start');
  if (sprintId == null) {
    throw new CommandError('Sprint ID is required.', { hints: ['Provide a numeric sprint ID'] });
  }
  const sprintToStart = await getSprint(sprintId);
  if (sprintToStart.state !== 'future') {
    throw new CommandError(
      `Cannot start sprint in state '${sprintToStart.state}'. Only 'future' sprints can be started.`,
      { hints: ['Use sprint list to see available sprints and their states'] }
    );
  }
  if (!sprintToStart.startDate || !sprintToStart.endDate) {
    throw new CommandError(
      'Cannot start sprint: start and end dates are required. Use sprint update <id> --start <date> --end <date> first.',
      { hints: ['Example: jira-ai sprint update <id> --start 2024-01-01 --end 2024-01-14'] }
    );
  }
  await startSprint(sprintId);
  outputResult({ success: true, message: `Sprint ${sprintId} started successfully.` });
}

export async function sprintCompleteCommand(sprintId: number): Promise<void> {
  requirePermission('sprint.complete');
  if (sprintId == null) {
    throw new CommandError('Sprint ID is required.', { hints: ['Provide a numeric sprint ID'] });
  }
  const sprintToComplete = await getSprint(sprintId);
  if (sprintToComplete.state !== 'active') {
    throw new CommandError(
      `Cannot complete sprint in state '${sprintToComplete.state}'. Only 'active' sprints can be completed.`,
      { hints: ['Use sprint list to see available sprints and their states'] }
    );
  }
  await completeSprint(sprintId);
  outputResult({ success: true, message: `Sprint ${sprintId} completed successfully.` });
}

export async function sprintUpdateCommand(
  sprintId: number,
  options: { name?: string; goal?: string; start?: string; end?: string }
): Promise<void> {
  requirePermission('sprint.update');
  if (sprintId == null) {
    throw new CommandError('Sprint ID is required.', { hints: ['Provide a numeric sprint ID'] });
  }
  if (!options?.name && !options?.goal && !options?.start && !options?.end) {
    throw new CommandError('At least one field is required.', {
      hints: ['Provide one or more of: --name, --goal, --start, --end'],
    });
  }

  const updates: { name?: string; goal?: string; startDate?: string; endDate?: string } = {};
  if (options?.name) updates.name = options.name;
  if (options?.goal) updates.goal = options.goal;
  if (options?.start) updates.startDate = options.start;
  if (options?.end) updates.endDate = options.end;

  await updateSprint(sprintId, updates);
  outputResult({ success: true, message: `Sprint ${sprintId} updated successfully.` });
}

export async function sprintDeleteCommand(sprintId: number): Promise<void> {
  requirePermission('sprint.delete');
  if (sprintId == null) {
    throw new CommandError('Sprint ID is required.', { hints: ['Provide a numeric sprint ID'] });
  }

  await deleteSprint(sprintId);
  outputResult({ success: true, message: `Sprint ${sprintId} deleted successfully.` });
}

export async function sprintIssuesCommand(sprintId: number, options?: { jql?: string; max?: number }): Promise<void> {
  requirePermission('sprint.issues');
  const params: { jql?: string; maxResults?: number } = {};
  if (options?.jql) params.jql = options.jql;
  if (options?.max) params.maxResults = options.max;

  const result = await getSprintIssues(sprintId, params);

  if (!result.issues || result.issues.length === 0) {
    outputResult({ issues: [], total: 0 });
    return;
  }

  outputResult({ issues: result.issues, total: result.total });
}

export async function sprintMoveCommand(
  sprintId: number,
  options: { issues: string[]; before?: string; after?: string }
): Promise<void> {
  requirePermission('sprint.move');
  if (!options.issues || options.issues.length === 0) {
    throw new CommandError('At least one issue key is required.', { hints: ['Provide issue keys with --issues'] });
  }
  if (options.issues.length > 50) {
    throw new CommandError('Cannot move more than 50 issues at once.', {
      hints: ['Split your issue list into batches of 50 or fewer'],
    });
  }

  const rankOptions: { rankBeforeIssue?: string; rankAfterIssue?: string } = {};
  if (options.before) rankOptions.rankBeforeIssue = options.before;
  if (options.after) rankOptions.rankAfterIssue = options.after;

  await moveIssuesToSprint(sprintId, options.issues, rankOptions);
  outputResult({ success: true, message: `Moved ${options.issues.length} issue(s) to sprint ${sprintId}.` });
}
