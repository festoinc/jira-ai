import { convertADFToMarkdown as adfToMarkdown } from 'adf-to-markdown';
import { hasCredentials } from './auth-storage.js';
import { CommandError } from './errors.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

/**
 * Get the version from package.json
 */
export function getVersion(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const packageJsonPath = join(__dirname, '..', '..', 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  return packageJson.version;
}

/**
 * Validate required environment variables or stored credentials
 */
export function validateEnvVars(): void {
  const required = [
    'JIRA_HOST',
    'JIRA_USER_EMAIL',
    'JIRA_API_TOKEN',
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0 && !hasCredentials()) {
    throw new CommandError('Jira credentials not found.', {
      hints: [
        'Run jira-ai auth to set up your credentials.',
        'Alternatively, set environment variables: ' + required.join(', ')
      ]
    });
  }
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Truncate text to max length with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Convert Atlassian Document Format (ADF) to Markdown
 * Handles both string content and ADF JSON objects
 */
export function convertADFToMarkdown(content: any): string {
  // If content is already a string, return it as-is
  if (typeof content === 'string') {
    return content;
  }

  // If content is null or undefined, return empty string
  if (!content) {
    return '';
  }

  try {
    return adfToMarkdown(content).trim();
  } catch (error) {
    // If conversion fails, fall back to JSON string representation
    console.error('Failed to convert ADF to Markdown:', error);
    return JSON.stringify(content, null, 2);
  }
}

/**
 * Calculate time spent in each status
 */
export function calculateStatusStatistics(
  created: string,
  histories: any[],
  currentStatus: string,
  now: number = Date.now()
): Record<string, number> {
  const stats: Record<string, number> = {};

  // Sort histories by date
  const sortedHistories = [...histories].sort((a, b) =>
    new Date(a.created).getTime() - new Date(b.created).getTime()
  );

  let lastTransitionTime = new Date(created).getTime();
  let lastStatus = '';

  const statusHistories = sortedHistories.filter(h =>
    h.items.some((item: any) => item.field === 'status')
  );

  if (statusHistories.length > 0) {
    const firstStatusItem = statusHistories[0].items.find((item: any) => item.field === 'status');
    lastStatus = firstStatusItem.fromString;
  } else {
    lastStatus = currentStatus;
  }

      for (const history of statusHistories) {

        const statusItem = history.items.find((item: any) => item.field === 'status');

  

        const transitionTime = new Date(history.created).getTime();

  
    const durationSeconds = Math.max(0, Math.floor((transitionTime - lastTransitionTime) / 1000));

    stats[lastStatus] = (stats[lastStatus] || 0) + durationSeconds;

    lastStatus = statusItem.toString;
    lastTransitionTime = transitionTime;
  }

  // Add time for the current status
  const finalDurationSeconds = Math.max(0, Math.floor((now - lastTransitionTime) / 1000));
  stats[lastStatus] = (stats[lastStatus] || 0) + finalDurationSeconds;

  return stats;
}

/**
 * Format duration in seconds to Jira human-readable format
 * @param seconds - Duration in seconds
 * @param hoursPerDay - Hours in a working day (default 24 for brutto time)
 */
export function formatDuration(seconds: number, hoursPerDay: number = 24): string {
  if (seconds <= 0) return '0m';

  const daysPerWeek = hoursPerDay === 24 ? 7 : 5;
  const secondsInDay = hoursPerDay * 3600;
  const secondsInWeek = daysPerWeek * secondsInDay;

  const w = Math.floor(seconds / secondsInWeek);
  seconds %= secondsInWeek;
  const d = Math.floor(seconds / secondsInDay);
  seconds %= secondsInDay;
  const h = Math.floor(seconds / 3600);
  seconds %= 3600;
  const m = Math.floor(seconds / 60);

  const parts = [];
  if (w > 0) parts.push(`${w}w`);
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
      if (m > 0) parts.push(`${m}m`);
  
      return parts.join(' ');
    }
  /**
 * Parse relative timeframe (e.g., '7d', '30d') into start and end dates
 */
export function parseTimeframe(timeframe: string): { startDate: Date; endDate: Date } {
  const match = timeframe.match(/^(\d+)d$/);
  if (!match) {
    throw new CommandError('Invalid timeframe format. Use e.g., "7d" or "30d".');
  }

  const days = parseInt(match[1], 10);
  const endDate = new Date();
  const startDate = new Date();
  
  // Use UTC to avoid timezone issues during calculations
  startDate.setUTCDate(endDate.getUTCDate() - days);

  // Set to start of day for startDate and end of day for endDate to be inclusive
  startDate.setUTCHours(0, 0, 0, 0);
  endDate.setUTCHours(23, 59, 59, 999);

  return { startDate, endDate };
}

/**
 * Format Date object to JQL compatible string (YYYY-MM-DD)
 */
export function formatDateForJql(date: Date): string {
  return date.toISOString().split('T')[0];
}
