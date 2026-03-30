import chalk from 'chalk';
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
import { ui } from '../lib/ui.js';

// sprint list <board-id> [--state <state>]
export async function sprintListCommand(boardId: number, options?: { state?: string }): Promise<void> {
  requirePermission('sprint.list');
  ui.startSpinner(`Fetching sprints for board ${boardId}...`);
  const params: { state?: string } = {};
  if (options?.state) params.state = options.state;

  const result = await getSprints(boardId, params);
  ui.stopSpinner();

  if (!result.values || result.values.length === 0) {
    console.log(chalk.yellow('No sprints found for this board.'));
    return;
  }

  console.log(chalk.bold(`\nSprints (${result.values.length} total)\n`));
  result.values.forEach(sprint => {
    const stateColor = sprint.state === 'active' ? chalk.green : sprint.state === 'closed' ? chalk.gray : chalk.yellow;
    const dates = sprint.startDate ? ` ${chalk.gray(`${sprint.startDate} → ${sprint.endDate || '?'}`)}` : '';
    console.log(`  ${chalk.cyan(String(sprint.id))}  ${sprint.name}  ${stateColor(`[${sprint.state}]`)}${dates}`);
  });
  console.log();
}

// sprint get <sprint-id>
export async function sprintGetCommand(sprintId: number): Promise<void> {
  requirePermission('sprint.get');
  if (sprintId == null) {
    throw new CommandError('Sprint ID is required.', { hints: ['Provide a numeric sprint ID'] });
  }
  ui.startSpinner(`Fetching sprint ${sprintId}...`);
  const sprint = await getSprint(sprintId);
  ui.stopSpinner();

  const stateColor = sprint.state === 'active' ? chalk.green : sprint.state === 'closed' ? chalk.gray : chalk.yellow;
  console.log(chalk.bold(`\nSprint: ${sprint.name}`) + '\n');
  console.log(`  ID:     ${chalk.cyan(String(sprint.id))}`);
  console.log(`  State:  ${stateColor(sprint.state)}`);
  if (sprint.startDate) console.log(`  Start:  ${sprint.startDate}`);
  if (sprint.endDate) console.log(`  End:    ${sprint.endDate}`);
  if (sprint.goal) console.log(`  Goal:   ${sprint.goal}`);
  if (sprint.originBoardId) console.log(`  Board:  ${sprint.originBoardId}`);
  console.log();
}

// sprint create <board-id> --name <name> [--goal <goal>] [--start <date>] [--end <date>]
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

  ui.startSpinner(`Creating sprint "${name}"...`);
  const params: { goal?: string; startDate?: string; endDate?: string } = {};
  if (options?.goal) params.goal = options.goal;
  if (options?.start) params.startDate = options.start;
  if (options?.end) params.endDate = options.end;

  const sprint = await createSprint(boardId, name, params);
  ui.succeedSpinner(chalk.green(`Sprint created: ${sprint.name} (ID: ${sprint.id})`));
  console.log();
}

// sprint start <sprint-id>
export async function sprintStartCommand(sprintId: number): Promise<void> {
  requirePermission('sprint.start');
  if (sprintId == null) {
    throw new CommandError('Sprint ID is required.', { hints: ['Provide a numeric sprint ID'] });
  }
  ui.startSpinner(`Validating sprint ${sprintId}...`);
  const sprintToStart = await getSprint(sprintId);
  if (sprintToStart.state !== 'future') {
    ui.failSpinner();
    throw new CommandError(
      `Cannot start sprint in state '${sprintToStart.state}'. Only 'future' sprints can be started.`,
      { hints: ['Use sprint list to see available sprints and their states'] }
    );
  }
  ui.startSpinner(`Starting sprint ${sprintId}...`);
  await startSprint(sprintId);
  ui.succeedSpinner(chalk.green(`Sprint ${sprintId} started successfully.`));
  console.log();
}

// sprint complete <sprint-id>
export async function sprintCompleteCommand(sprintId: number): Promise<void> {
  requirePermission('sprint.complete');
  if (sprintId == null) {
    throw new CommandError('Sprint ID is required.', { hints: ['Provide a numeric sprint ID'] });
  }
  ui.startSpinner(`Validating sprint ${sprintId}...`);
  const sprintToComplete = await getSprint(sprintId);
  if (sprintToComplete.state !== 'active') {
    ui.failSpinner();
    throw new CommandError(
      `Cannot complete sprint in state '${sprintToComplete.state}'. Only 'active' sprints can be completed.`,
      { hints: ['Use sprint list to see available sprints and their states'] }
    );
  }
  ui.startSpinner(`Completing sprint ${sprintId}...`);
  await completeSprint(sprintId);
  ui.succeedSpinner(chalk.green(`Sprint ${sprintId} completed successfully.`));
  console.log();
}

// sprint update <sprint-id> [--name <name>] [--goal <goal>]
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

  ui.startSpinner(`Updating sprint ${sprintId}...`);
  const updates: { name?: string; goal?: string; startDate?: string; endDate?: string } = {};
  if (options?.name) updates.name = options.name;
  if (options?.goal) updates.goal = options.goal;
  if (options?.start) updates.startDate = options.start;
  if (options?.end) updates.endDate = options.end;

  await updateSprint(sprintId, updates);
  ui.succeedSpinner(chalk.green(`Sprint ${sprintId} updated successfully.`));
  console.log();
}

// sprint delete <sprint-id>
export async function sprintDeleteCommand(sprintId: number): Promise<void> {
  requirePermission('sprint.delete');
  if (sprintId == null) {
    throw new CommandError('Sprint ID is required.', { hints: ['Provide a numeric sprint ID'] });
  }

  ui.startSpinner(`Deleting sprint ${sprintId}...`);
  await deleteSprint(sprintId);
  ui.succeedSpinner(chalk.green(`Sprint ${sprintId} deleted successfully.`));
  console.log();
}

// sprint issues <sprint-id> [--jql <jql>] [--max <n>]
export async function sprintIssuesCommand(sprintId: number, options?: { jql?: string; max?: number }): Promise<void> {
  requirePermission('sprint.issues');
  ui.startSpinner(`Fetching issues for sprint ${sprintId}...`);
  const params: { jql?: string; maxResults?: number } = {};
  if (options?.jql) params.jql = options.jql;
  if (options?.max) params.maxResults = options.max;

  const result = await getSprintIssues(sprintId, params);
  ui.stopSpinner();

  if (!result.issues || result.issues.length === 0) {
    console.log(chalk.yellow('No issues found in this sprint.'));
    return;
  }

  console.log(chalk.bold(`\nSprint Issues (${result.total} total)\n`));
  result.issues.forEach(issue => {
    const status = chalk.gray(`[${issue.fields.status.name}]`);
    console.log(`  ${chalk.cyan(issue.key)}  ${issue.fields.summary}  ${status}`);
  });
  console.log();
}

// sprint move <sprint-id> --issues <keys> [--before <key>] [--after <key>]
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

  ui.startSpinner(`Moving ${options.issues.length} issue(s) to sprint ${sprintId}...`);
  const rankOptions: { rankBeforeIssue?: string; rankAfterIssue?: string } = {};
  if (options.before) rankOptions.rankBeforeIssue = options.before;
  if (options.after) rankOptions.rankAfterIssue = options.after;

  await moveIssuesToSprint(sprintId, options.issues, rankOptions);
  ui.succeedSpinner(chalk.green(`Moved ${options.issues.length} issue(s) to sprint ${sprintId}.`));
  console.log();
}
