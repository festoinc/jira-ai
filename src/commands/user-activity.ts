import {
  searchIssuesByJql,
  resolveUserByName,
  buildUserActivityJql,
  getIssueActivityFeed,
  JqlIssue,
  ActivityType,
  ActivityEntry,
  ActivityFeedOptions,
  UserActivityGrouped,
} from '../lib/jira-client.js';
import { parseTimeframe, formatDateForJql } from '../lib/utils.js';
import { CommandError } from '../lib/errors.js';
import { outputResult } from '../lib/json-mode.js';

interface UserActivityEntry extends ActivityEntry {
  issueKey: string;
  issueSummary: string;
}

const BATCH_SIZE = 5;

async function fetchActivityInBatches(
  issues: JqlIssue[],
  feedOptions: ActivityFeedOptions
): Promise<{ entries: UserActivityEntry[]; skipped: number }> {
  let skipped = 0;
  const allEntries: UserActivityEntry[] = [];

  for (let i = 0; i < issues.length; i += BATCH_SIZE) {
    const batch = issues.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((issue) => getIssueActivityFeed(issue.key, feedOptions))
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      const issue = batch[j];
      if (result.status === 'fulfilled') {
        for (const entry of result.value.activities) {
          allEntries.push({ ...entry, issueKey: issue.key, issueSummary: issue.summary });
        }
      } else {
        skipped++;
      }
    }
  }

  return { entries: allEntries, skipped };
}

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
    outputResult([]);
    return;
  }

  const feedOptions = {
    since: startDate.toISOString(),
    author: accountId,
    ...(types ? { types } : {}),
    ...(limit ? { limit: limit * 2 } : {}), // fetch extra to allow for sorting + slicing
  };

  const { entries } = await fetchActivityInBatches(issues, feedOptions);

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
    outputResult(Array.from(grouped.values()));
  } else {
    outputResult(limited);
  }
}
