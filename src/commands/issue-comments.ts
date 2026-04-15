import { getIssueCommentsList } from '../lib/jira-client.js';
import { CommandError } from '../lib/errors.js';
import { outputResult } from '../lib/json-mode.js';

export interface IssueCommentsOptions {
  issueKey: string;
  limit?: number;
  since?: string;
  reverse?: boolean;
}

export async function issueCommentsCommand(options: IssueCommentsOptions): Promise<void> {
  const { issueKey, limit, since, reverse } = options;

  if (since !== undefined && isNaN(new Date(since).getTime())) {
    throw new CommandError('--since must be a valid ISO 8601 datetime (e.g. 2024-01-01T00:00:00Z)');
  }

  if (limit !== undefined && (limit < 1 || !Number.isInteger(limit))) {
    throw new CommandError('--limit must be a positive integer (>= 1)');
  }

  try {
    const result = await getIssueCommentsList(issueKey, { limit, since, reverse });
    outputResult(result);
  } catch (error: any) {
    if (error instanceof CommandError) throw error;

    const errorMsg = error.message?.toLowerCase() || '';
    const hints: string[] = [];

    if (errorMsg.includes('404')) {
      hints.push('Check that the issue key is correct');
    } else if (errorMsg.includes('403')) {
      hints.push('You may not have permission to view comments on this issue');
    }

    throw new CommandError(`Failed to get comments: ${error.message}`, { hints });
  }
}
