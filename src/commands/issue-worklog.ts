import {
  getIssueWorklogsList,
  addWorklogEntry,
  updateWorklogEntry,
  deleteWorklogEntry,
} from '../lib/jira-client.js';
import { CommandError } from '../lib/errors.js';
import { outputResult } from '../lib/json-mode.js';
import { isDryRun, formatDryRunResult } from '../lib/dry-run.js';
import { parseDuration } from '../lib/utils.js';

export interface WorklogListOptions {
  issueKey: string;
}

export interface WorklogAddOptions {
  issueKey: string;
  time: string;
  comment?: string;
  started?: string;
  adjustEstimate?: 'auto' | 'new' | 'leave' | 'manual';
  newEstimate?: string;
  reduceBy?: string;
}

export interface WorklogUpdateOptions {
  issueKey: string;
  id: string;
  time?: string;
  comment?: string;
  started?: string;
  adjustEstimate?: 'auto' | 'new' | 'leave' | 'manual';
  newEstimate?: string;
}

export interface WorklogDeleteOptions {
  issueKey: string;
  id: string;
  adjustEstimate?: 'auto' | 'new' | 'leave' | 'manual';
  newEstimate?: string;
  increaseBy?: string;
}

export async function issueWorklogListCommand(options: WorklogListOptions): Promise<void> {
  const { issueKey } = options;

  try {
    const result = await getIssueWorklogsList(issueKey, {});
    outputResult(result);
  } catch (error: any) {
    if (error instanceof CommandError) throw error;

    const errorMsg = error.message?.toLowerCase() || '';
    const hints: string[] = [];

    if (errorMsg.includes('404')) {
      hints.push('Check that the issue key is correct');
    } else if (errorMsg.includes('403')) {
      hints.push('You may not have permission to view worklogs on this issue');
    }

    throw new CommandError(`Failed to list worklogs: ${error.message}`, { hints });
  }
}

export async function issueWorklogAddCommand(options: WorklogAddOptions): Promise<void> {
  const { issueKey, time, comment, started, adjustEstimate, newEstimate, reduceBy } = options;

  const timeSpentSeconds = parseDuration(time);
  if (timeSpentSeconds === null) {
    throw new CommandError(
      `Invalid duration: "${time}". Use Jira format e.g. 1h, 30m, 1d2h30m, 1w.`,
      { hints: ['Examples: 1h, 30m, 1d, 1w, 1d2h30m'] }
    );
  }

  if (isDryRun()) {
    formatDryRunResult(
      'issue worklog add',
      issueKey,
      { timeSpentSeconds, comment, started, adjustEstimate, newEstimate, reduceBy },
    );
    return;
  }

  try {
    const result = await addWorklogEntry(issueKey, {
      timeSpentSeconds,
      comment,
      started,
      adjustEstimate,
      newEstimate,
      reduceBy,
    });
    outputResult(result);
  } catch (error: any) {
    if (error instanceof CommandError) throw error;

    const errorMsg = error.message?.toLowerCase() || '';
    const hints: string[] = [];

    if (errorMsg.includes('404')) {
      hints.push('Check that the issue key is correct');
    } else if (errorMsg.includes('403')) {
      hints.push('You may not have permission to log work on this issue');
    }

    throw new CommandError(`Failed to add worklog: ${error.message}`, { hints });
  }
}

export async function issueWorklogUpdateCommand(options: WorklogUpdateOptions): Promise<void> {
  const { issueKey, id, time, comment, started, adjustEstimate, newEstimate } = options;

  if (time === undefined && comment === undefined && started === undefined) {
    throw new CommandError('At least one of --time, --comment, or --started must be provided.');
  }

  let timeSpentSeconds: number | undefined;
  if (time !== undefined) {
    const parsed = parseDuration(time);
    if (parsed === null) {
      throw new CommandError(
        `Invalid duration: "${time}". Use Jira format e.g. 1h, 30m, 1d2h30m, 1w.`,
        { hints: ['Examples: 1h, 30m, 1d, 1w, 1d2h30m'] }
      );
    }
    timeSpentSeconds = parsed;
  }

  if (isDryRun()) {
    formatDryRunResult(
      'issue worklog update',
      `${issueKey} / worklog ${id}`,
      { timeSpentSeconds, comment, started, adjustEstimate, newEstimate },
    );
    return;
  }

  try {
    const result = await updateWorklogEntry(issueKey, id, {
      timeSpentSeconds,
      comment,
      started,
      adjustEstimate,
      newEstimate,
    });
    outputResult(result);
  } catch (error: any) {
    if (error instanceof CommandError) throw error;

    const errorMsg = error.message?.toLowerCase() || '';
    const hints: string[] = [];

    if (errorMsg.includes('404')) {
      hints.push('Check that the issue key and worklog ID are correct');
    } else if (errorMsg.includes('403')) {
      hints.push('You may not have permission to update this worklog');
    }

    throw new CommandError(`Failed to update worklog: ${error.message}`, { hints });
  }
}

export async function issueWorklogDeleteCommand(options: WorklogDeleteOptions): Promise<void> {
  const { issueKey, id, adjustEstimate, newEstimate, increaseBy } = options;

  if (isDryRun()) {
    formatDryRunResult(
      'issue worklog delete',
      `${issueKey} / worklog ${id}`,
      { id, adjustEstimate, newEstimate, increaseBy },
    );
    return;
  }

  try {
    await deleteWorklogEntry(issueKey, id, { adjustEstimate, newEstimate, increaseBy });
    outputResult({ deleted: true, issueKey, id });
  } catch (error: any) {
    if (error instanceof CommandError) throw error;

    const errorMsg = error.message?.toLowerCase() || '';
    const hints: string[] = [];

    if (errorMsg.includes('404')) {
      hints.push('Check that the issue key and worklog ID are correct');
    } else if (errorMsg.includes('403')) {
      hints.push('You may not have permission to delete this worklog');
    }

    throw new CommandError(`Failed to delete worklog: ${error.message}`, { hints });
  }
}
