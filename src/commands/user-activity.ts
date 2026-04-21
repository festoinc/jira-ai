import {
  searchIssuesByJql,
  resolveUserByName,
  buildUserActivityJql,
  getUserActivity,
  ActivityType,
  ActivityFeedOptions,
  UserActivityEntry,
  UserActivityGrouped,
} from '../lib/jira-client.js';
import { parseTimeframe, formatDateForJql } from '../lib/utils.js';
import { CommandError } from '../lib/errors.js';
import { outputResult } from '../lib/json-mode.js';

const VALID_ACTIVITY_TYPES: ActivityType[] = [
  'status_change',
  'field_change',
  'link_added',
  'link_removed',
  'attachment_added',
  'attachment_removed',
  'comment_added',
  'comment_updated',
];

export interface UserActivityOptions {
  project?: string;
  types?: string;
  limit?: number;
  groupByIssue?: boolean;
}

export async function userActivityCommand(
  person: string,
  timeframe: string,
  options: UserActivityOptions
): Promise<void> {
  const { project, types, limit, groupByIssue } = options;

  if (limit !== undefined && limit <= 0) {
    throw new CommandError('--limit must be greater than 0');
  }

  if (types) {
    const requestedTypes = types.split(',').map((t) => t.trim());
    const invalid = requestedTypes.filter((t) => !VALID_ACTIVITY_TYPES.includes(t as ActivityType));
    if (invalid.length > 0) {
      throw new CommandError(
        `Invalid --types value(s): ${invalid.join(', ')}. Valid types: ${VALID_ACTIVITY_TYPES.join(', ')}`
      );
    }
  }

  const { startDate, endDate } = parseTimeframe(timeframe);
  const startJql = formatDateForJql(startDate);
  const endJql = formatDateForJql(endDate);

  // Resolve person to accountId, fall back to raw string
  const accountId = (await resolveUserByName(person)) ?? person;

  const jql = buildUserActivityJql(accountId, startJql, endJql, project);
  const issues = await searchIssuesByJql(jql, 100);

  if (issues.length === 0) {
    outputResult({ activities: [], skipped: 0 });
    return;
  }

  const feedOptions = {
    since: startDate.toISOString(),
    author: accountId,
    ...(types ? { types } : {}),
    ...(limit ? { limit: limit * 2 } : {}), // fetch extra to allow for sorting + slicing
  };

  const { entries, skipped } = await getUserActivity(accountId, issues, feedOptions);

  // Sort by timestamp descending
  entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Apply limit (applies to activities, not issues)
  const limited = limit ? entries.slice(0, limit) : entries;

  if (groupByIssue) {
    const grouped = new Map<string, UserActivityGrouped>();
    for (const entry of limited) {
      if (!grouped.has(entry.issueKey)) {
        grouped.set(entry.issueKey, {
          issueKey: entry.issueKey,
          summary: entry.issueSummary,
          activities: [],
        });
      }
      const { issueKey: _k, issueSummary: _s, ...rest } = entry;
      grouped.get(entry.issueKey)!.activities.push(rest);
    }
    outputResult({ issues: Array.from(grouped.values()), skipped });
  } else {
    outputResult({ activities: limited, skipped });
  }
}
