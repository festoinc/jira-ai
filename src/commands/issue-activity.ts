import { getIssueActivityFeed } from '../lib/jira-client.js';
import { CommandError } from '../lib/errors.js';
import { outputResult } from '../lib/json-mode.js';

export interface IssueActivityOptions {
  issueKey: string;
  since?: string;
  limit?: number;
  types?: string;
  author?: string;
  compact?: boolean;
}

export async function issueActivityCommand(options: IssueActivityOptions): Promise<void> {
  const { issueKey, since, limit, types, author, compact } = options;

  if (since !== undefined && isNaN(new Date(since).getTime())) {
    throw new CommandError('--since must be a valid ISO 8601 datetime (e.g. 2024-01-01T00:00:00Z)');
  }

  if (limit !== undefined && (limit < 1 || !Number.isInteger(limit))) {
    throw new CommandError('--limit must be a positive integer (>= 1)');
  }

  try {
    const result = await getIssueActivityFeed(issueKey, { since, limit, types, author });
    if (compact) {
      const compactResult = {
        ...result,
        activities: result.activities.map(({ commentBody: _omit, ...rest }) => rest),
      };
      outputResult(compactResult);
    } else {
      outputResult(result);
    }
  } catch (error: any) {
    if (error instanceof CommandError) throw error;

    const errorMsg = error.message?.toLowerCase() || '';
    const hints: string[] = [];

    if (errorMsg.includes('404')) {
      hints.push('Check that the issue key is correct');
    } else if (errorMsg.includes('403')) {
      hints.push('You may not have permission to view activity on this issue');
    }

    throw new CommandError(`Failed to get activity feed: ${error.message}`, { hints });
  }
}
