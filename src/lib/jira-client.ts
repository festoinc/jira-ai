import { Version3Client } from 'jira.js';
import { calculateStatusStatistics, convertADFToMarkdown } from './utils.js';
import { loadCredentials } from './auth-storage.js';
import { applyGlobalFilters, isProjectAllowed, isCommandAllowed, validateIssueAgainstFilters, loadSettings } from './settings.js';
import { CommandError } from './errors.js';

export interface Transition {
  id: string;
  name: string;
  to: {
    id: string;
    name: string;
  };
}

export interface UserInfo {
  accountId: string;
  displayName: string;
  emailAddress: string;
  active: boolean;
  timeZone: string;
  host: string;
}

export interface IssueStatistics {
  key: string;
  summary: string;
  timeSpentSeconds: number;
  originalEstimateSeconds: number;
  statusDurations: Record<string, number>;
  currentStatus: string;
}
// ... (rest of interfaces)

export interface Project {
  id: string;
  key: string;
  name: string;
  projectTypeKey: string;
  lead?: {
    displayName: string;
  };
}

export interface Comment {
  id: string;
  author: {
    accountId: string;
    displayName: string;
    emailAddress?: string;
  };
  body: string;
  created: string;
  updated: string;
}

export interface Status {
  id: string;
  name: string;
  description?: string;
  statusCategory: {
    id: string;
    key: string;
    name: string;
  };
}

export interface LinkedIssue {
  id: string;
  key: string;
  summary: string;
  status: {
    name: string;
  };
}

export interface HistoryItem {
  field: string;
  from: string | null;
  to: string | null;
}

export interface HistoryEntry {
  id: string;
  author: string;
  created: string;
  items: HistoryItem[];
}

export interface Worklog {
  id: string;
  author: {
    accountId: string;
    displayName: string;
    emailAddress?: string;
  };
  comment?: string;
  created: string;
  updated: string;
  started: string;
  timeSpent: string;
  timeSpentSeconds: number;
  issueKey: string;
}

export interface TaskDetails {
  id: string;
  key: string;
  summary: string;
  description?: string;
  status: {
    name: string;
    category?: string;
  };
  assignee?: {
    accountId: string;
    displayName: string;
  };
  reporter?: {
    accountId: string;
    displayName: string;
  };
  created: string;
  updated: string;
  dueDate?: string;
  labels: string[];
  comments: Comment[];
  parent?: LinkedIssue;
  subtasks: LinkedIssue[];
  history?: HistoryEntry[];
  watchers?: string[]; // Array of accountIds
}

export interface HistoryOptions {
  includeHistory?: boolean;
  historyLimit?: number;
  historyOffset?: number;
}

export interface JqlIssue {
  key: string;
  summary: string;
  status: {
    name: string;
  };
  assignee: {
    displayName: string;
  } | null;
  priority: {
    name: string;
  } | null;
}

export interface IssueType {
  id: string;
  name: string;
  description?: string;
  subtask: boolean;
  hierarchyLevel: number;
}

let jiraClient: Version3Client | null = null;
let organizationOverride: string | undefined = undefined;

/**
 * Set a global organization override for the current execution
 */
export function setOrganizationOverride(alias: string): void {
  organizationOverride = alias;
  jiraClient = null; // Force client recreation
}

/**
 * Get or create Jira client instance
 */
export function getJiraClient(): Version3Client {
  if (!jiraClient) {
    const host = process.env.JIRA_HOST;
    const email = process.env.JIRA_USER_EMAIL;
    const apiToken = process.env.JIRA_API_TOKEN;

    if (host && email && apiToken) {
      jiraClient = new Version3Client({
        host,
        authentication: {
          basic: {
            email,
            apiToken,
          },
        },
      });
    } else {
      const storedCreds = loadCredentials(organizationOverride);
      if (storedCreds) {
        jiraClient = new Version3Client({
          host: storedCreds.host,
          authentication: {
            basic: {
              email: storedCreds.email,
              apiToken: storedCreds.apiToken,
            },
          },
        });
      } else {
        const errorMsg = organizationOverride 
          ? `Jira credentials for organization "${organizationOverride}" not found.`
          : 'Jira credentials not found. Please set environment variables or run "jira-ai auth"';
        throw new Error(errorMsg);
      }
    }
  }
  return jiraClient;
}

/**
 * Initialize a temporary Jira client for verification
 */
export function createTemporaryClient(host: string, email: string, apiToken: string): Version3Client {
  return new Version3Client({
    host,
    authentication: {
      basic: {
        email,
        apiToken,
      },
    },
  });
}

/**
 * Get current user information
 */
export async function getCurrentUser(): Promise<UserInfo> {
  const client = getJiraClient();
  const user = await client.myself.getCurrentUser();

  // Try to extract host from client instance
  // @ts-ignore - accessing internal property to show it in UI
  const host = client.config.host || 'N/A';

  return {
    accountId: user.accountId || '',
    displayName: user.displayName || '',
    emailAddress: user.emailAddress || '',
    active: user.active || false,
    timeZone: user.timeZone || '',
    host,
  };
}

/**
 * Get all projects
 */
export async function getProjects(): Promise<Project[]> {
  const client = getJiraClient();
  const response = await client.projects.searchProjects({
    expand: 'lead',
  });

  return response.values.map((project: any) => ({
    id: project.id,
    key: project.key,
    name: project.name,
    projectTypeKey: project.projectTypeKey,
    lead: project.lead ? {
      displayName: project.lead.displayName,
    } : undefined,
  }));
}

/**
 * Get task details with comments
 */
export async function getTaskWithDetails(
  taskId: string,
  options: HistoryOptions = {}
): Promise<TaskDetails> {
  const client = getJiraClient();
  const { includeHistory, historyLimit = 50, historyOffset = 0 } = options;

  // Get issue details
  const issue = await client.issues.getIssue({
    issueIdOrKey: taskId,
    expand: includeHistory ? 'changelog' : undefined,
    fields: [
      'summary',
      'description',
      'status',
      'assignee',
      'reporter',
      'created',
      'updated',
      'duedate',
      'comment',
      'parent',
      'subtasks',
      'labels',
      'watches',
    ],
  });

  // Extract comments
  const comments: Comment[] = issue.fields.comment?.comments?.map((comment: any) => ({
    id: comment.id,
    author: {
      accountId: comment.author?.accountId || '',
      displayName: comment.author?.displayName || 'Unknown',
      emailAddress: comment.author?.emailAddress,
    },
    body: convertADFToMarkdown(comment.body),
    created: comment.created || '',
    updated: comment.updated || '',
  })) || [];

  // Convert description from ADF to Markdown
  const descriptionMarkdown = convertADFToMarkdown(issue.fields.description);
  const description = descriptionMarkdown || undefined;

  // Extract parent if exists
  const parent: LinkedIssue | undefined = issue.fields.parent ? {
    id: issue.fields.parent.id,
    key: issue.fields.parent.key,
    summary: issue.fields.parent.fields?.summary || '',
    status: {
      name: issue.fields.parent.fields?.status?.name || 'Unknown',
    },
  } : undefined;

  // Extract subtasks
  const subtasks: LinkedIssue[] = issue.fields.subtasks?.map((subtask: any) => ({
    id: subtask.id,
    key: subtask.key,
    summary: subtask.fields?.summary || '',
    status: {
      name: subtask.fields?.status?.name || 'Unknown',
    },
  })) || [];

  // Extract history if requested
  let history: HistoryEntry[] | undefined = undefined;
  if (includeHistory && issue.changelog) {
    let allHistories = issue.changelog.histories || [];

    // If there are more histories than returned in the initial expand, we might need to fetch more
    // Jira usually returns 100 histories in the expand.
    if (issue.changelog.total && issue.changelog.total > allHistories.length && (historyOffset + historyLimit) > allHistories.length) {
      const moreHistories = await client.issues.getChangeLogs({
        issueIdOrKey: taskId,
      });
      allHistories = moreHistories.values || allHistories;
    }

    history = allHistories.map((h: any) => ({
      id: h.id,
      author: h.author?.displayName || 'Unknown',
      created: h.created,
      items: h.items?.map((item: any) => ({
        field: item.field || '',
        from: item.fromString,
        to: item.toString
      }))
    }));

    // Sort by date descending (most recent first)
    history.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());

    // Apply offset and limit
    history = history.slice(historyOffset, historyOffset + historyLimit);
  }

  // Extract watchers
  const watchers: string[] = [];
  if (issue.fields.watches?.isWatching) {
    // If we only need to know if the current user is watching, isWatching is enough.
    // But the requirement might mean "any of these roles".
    // For now, if isWatching is true, we add current user's accountId (placeholder)
    // Actually, we can fetch watchers detail if needed, but Jira's getIssue returns watches info for current user.
  }

  return {
    id: issue.id || '',
    key: issue.key || '',
    summary: issue.fields.summary || '',
    description,
    status: {
      name: issue.fields.status?.name || 'Unknown',
      category: issue.fields.status?.statusCategory?.key || 'unknown',
    },
    assignee: issue.fields.assignee ? {
      accountId: issue.fields.assignee.accountId || '',
      displayName: issue.fields.assignee.displayName || 'Unknown',
    } : undefined,
    reporter: issue.fields.reporter ? {
      accountId: issue.fields.reporter.accountId || '',
      displayName: issue.fields.reporter.displayName || 'Unknown',
    } : undefined,
    created: issue.fields.created || '',
    updated: issue.fields.updated || '',
    dueDate: issue.fields.duedate || undefined,
    labels: issue.fields.labels || [],
    comments,
    parent,
    subtasks,
    history,
    watchers: issue.fields.watches?.isWatching ? ['CURRENT_USER'] : [], // Simple flag for now
  };
}

/**
 * Get all possible statuses for a project
 */
export async function getProjectStatuses(projectIdOrKey: string): Promise<Status[]> {
  const client = getJiraClient();

  // Get all statuses for the project
  const statuses = await client.projects.getAllStatuses({
    projectIdOrKey,
  });

  // Flatten and deduplicate statuses from all issue types
  const statusMap = new Map<string, Status>();

  statuses.forEach((issueTypeStatuses: any) => {
    issueTypeStatuses.statuses?.forEach((status: any) => {
      if (!statusMap.has(status.id)) {
        statusMap.set(status.id, {
          id: status.id || '',
          name: status.name || '',
          description: status.description,
          statusCategory: {
            id: status.statusCategory?.id || '',
            key: status.statusCategory?.key || '',
            name: status.statusCategory?.name || '',
          },
        });
      }
    });
  });

  return Array.from(statusMap.values());
}

/**
 * Search for issues using JQL query
 */
export async function searchIssuesByJql(jqlQuery: string, maxResults: number): Promise<JqlIssue[]> {
  const client = getJiraClient();

  const filteredJql = applyGlobalFilters(jqlQuery);

  const response = await client.issueSearch.searchForIssuesUsingJqlEnhancedSearch({
    jql: filteredJql,
    maxResults,
    fields: ['summary', 'status', 'assignee', 'priority'],
  });

  return response.issues?.map((issue: any) => ({
    key: issue.key || '',
    summary: issue.fields?.summary || '',
    status: {
      name: issue.fields?.status?.name || 'Unknown',
    },
    assignee: issue.fields?.assignee ? {
      displayName: issue.fields.assignee.displayName || 'Unknown',
    } : null,
    priority: issue.fields?.priority ? {
      name: issue.fields.priority.name || 'Unknown',
    } : null,
  })) || [];
}

/**
 * Update the description of a Jira issue
 * @param taskId - The issue key (e.g., "PROJ-123")
 * @param adfContent - The description content in ADF format
 */
export async function updateIssueDescription(
  taskId: string,
  adfContent: any
): Promise<void> {
  const client = getJiraClient();
  await client.issues.editIssue({
    issueIdOrKey: taskId,
    fields: {
      description: adfContent,
    },
    notifyUsers: false,
  });
}

/**
 * Add a comment to a Jira issue
 * @param taskId - The issue key (e.g., "PROJ-123")
 * @param adfContent - The comment content in ADF format
 */
export async function addIssueComment(
  taskId: string,
  adfContent: any
): Promise<void> {
  const client = getJiraClient();
  await client.issueComments.addComment({
    issueIdOrKey: taskId,
    comment: adfContent,
  });
}

/**
 * Get all issue types for a project
 */
export async function getProjectIssueTypes(projectIdOrKey: string): Promise<IssueType[]> {
  const client = getJiraClient();

  const project = await client.projects.getProject({
    projectIdOrKey,
    expand: 'issueTypes',
  });

  return project.issueTypes?.map((issueType: any) => ({
    id: issueType.id || '',
    name: issueType.name || '',
    description: issueType.description,
    subtask: issueType.subtask || false,
    hierarchyLevel: issueType.hierarchyLevel || 0,
  })) || [];
}

/**
 * Create a new issue
 * @param projectKey - The project key (e.g., "PROJ")
 * @param summary - The issue title/summary
 * @param issueTypeName - The issue type name (e.g., "Task", "Epic", "Subtask")
 * @param parentKey - Optional parent issue key for subtasks
 */
export async function createIssue(
  projectKey: string,
  summary: string,
  issueTypeName: string,
  parentKey?: string
): Promise<{ key: string; id: string }> {
  const client = getJiraClient();

  const fields: any = {
    project: {
      key: projectKey,
    },
    summary,
    issuetype: {
      name: issueTypeName,
    },
  };

  // Add parent field if this is a subtask
  if (parentKey) {
    fields.parent = {
      key: parentKey,
    };
  }

  const response = await client.issues.createIssue({
    fields,
  });

  return { key: response.key || '', id: response.id || '' };
}

/**
 * Validate that the current user has permission to perform a command on an issue
 */
export async function validateIssuePermissions(
  issueKey: string, 
  commandName: string,
  options: HistoryOptions = {}
): Promise<TaskDetails> {
  const task = await getTaskWithDetails(issueKey, options);
  const projectKey = task.key.split('-')[0];

  if (!isProjectAllowed(projectKey)) {
    throw new CommandError(`Project '${projectKey}' is not allowed by your settings.`);
  }

  if (!isCommandAllowed(commandName, projectKey)) {
    throw new CommandError(`Command '${commandName}' is not allowed for project ${projectKey}.`, {
      hints: [`Update settings.yaml to enable this command for this project.`]
    });
  }

  const currentUser = await getCurrentUser();
  if (!validateIssueAgainstFilters(task, currentUser.accountId)) {
    throw new CommandError(`Access to issue ${issueKey} is restricted by project filters.`, {
      hints: [`This project has filters that you do not meet (e.g., participated roles).`]
    });
  }

  // Check JQL filters
  const settings = loadSettings();
  let project = settings.projects.find(p => typeof p !== 'string' && p.key === projectKey);
  if (!project) {
    project = settings.projects.find(p => typeof p === 'string' && (p === 'all' || p === projectKey));
  }

  if (project && typeof project !== 'string' && project.filters?.jql) {
    const client = getJiraClient();
    const jql = `key = "${issueKey}" AND (${project.filters.jql})`;
    const response = await client.issueSearch.searchForIssuesUsingJqlEnhancedSearch({
      jql,
      maxResults: 1,
      fields: ['key'],
    });

    if (!response.issues || response.issues.length === 0) {
      throw new CommandError(`Access to issue ${issueKey} is restricted by project filters.`, {
        hints: [
          `This project has a JQL filter that this issue does not meet: ${project.filters.jql}`,
        ]
      });
    }
  }

  return task;
}

/**
 * Add labels to a Jira issue

 * @param taskId - The issue key (e.g., "PROJ-123")
 * @param labels - Array of labels to add
 */
export async function addIssueLabels(
  taskId: string,
  labels: string[]
): Promise<void> {
  const client = getJiraClient();
  await client.issues.editIssue({
    issueIdOrKey: taskId,
    update: {
      labels: labels.map(label => ({
        add: label,
      })),
    },
  });
}

/**
 * Remove labels from a Jira issue
 * @param taskId - The issue key (e.g., "PROJ-123")
 * @param labels - Array of labels to remove
 */
export async function removeIssueLabels(
  taskId: string,
  labels: string[]
): Promise<void> {
  const client = getJiraClient();
  await client.issues.editIssue({
    issueIdOrKey: taskId,
    update: {
      labels: labels.map(label => ({
        remove: label,
      })),
    },
  });
}

/**
 * Get issue statistics including status transitions and time tracking
 */
export async function getIssueStatistics(issueIdOrKey: string): Promise<IssueStatistics> {
  const client = getJiraClient();

  const issue = await client.issues.getIssue({
    issueIdOrKey,
    expand: 'changelog',
    fields: ['summary', 'status', 'timetracking', 'created'],
  });

  const histories = issue.changelog?.histories || [];
  const statusName = issue.fields.status?.name || 'Unknown';
  const statusDurations = calculateStatusStatistics(
    issue.fields.created,
    histories,
    statusName
  );

  return {
    key: issue.key || '',
    summary: issue.fields.summary || '',
    timeSpentSeconds: issue.fields.timetracking?.timeSpentSeconds || 0,
    originalEstimateSeconds: issue.fields.timetracking?.originalEstimateSeconds || 0,
    statusDurations,
    currentStatus: statusName,
  };
}

/**
 * Get available transitions for an issue
 */
export async function getIssueTransitions(issueIdOrKey: string): Promise<Transition[]> {
  const client = getJiraClient();
  const response = await client.issues.getTransitions({
    issueIdOrKey,
  });

  return (response.transitions || []).map((t: any) => ({
    id: t.id || '',
    name: t.name || '',
    to: {
      id: t.to?.id || '',
      name: t.to?.name || '',
    },
  }));
}

/**
 * Perform a transition on an issue
 */
export async function transitionIssue(issueIdOrKey: string, transitionId: string): Promise<void> {
  const client = getJiraClient();
  await client.issues.doTransition({
    issueIdOrKey,
    transition: {
      id: transitionId,
    },
  });
}

/**
 * Get users, optionally filtered by project
 */
export async function getUsers(projectKey?: string): Promise<UserInfo[]> {
  const client = getJiraClient();
  let users: any[];

  if (projectKey) {
    users = await client.userSearch.findAssignableUsers({
      project: projectKey,
      maxResults: 1000,
    });
  } else {
    users = await client.userSearch.findUsers({
      query: '',
      maxResults: 1000,
    });
  }

  // Filter for active users
  return users
    .filter((user: any) => user.active && user.accountType === 'atlassian')
    .map((user: any) => ({
      accountId: user.accountId || '',
      displayName: user.displayName || '',
      emailAddress: user.emailAddress || '',
      active: user.active || false,
      timeZone: user.timeZone || '',
      // @ts-ignore
      host: client.config.host || 'N/A',
    }));
}

/**
 * Get all worklogs for an issue
 */
export async function getIssueWorklogs(issueIdOrKey: string): Promise<Worklog[]> {
  const client = getJiraClient();
  const response = await client.issueWorklogs.getIssueWorklog({
    issueIdOrKey,
  });

  return (response.worklogs || []).map((w: any) => ({
    id: w.id || '',
    author: {
      accountId: w.author?.accountId || '',
      displayName: w.author?.displayName || 'Unknown',
      emailAddress: w.author?.emailAddress,
    },
    comment: convertADFToMarkdown(w.comment),
    created: w.created || '',
    updated: w.updated || '',
    started: w.started || '',
    timeSpent: w.timeSpent || '',
    timeSpentSeconds: w.timeSpentSeconds || 0,
    issueKey: issueIdOrKey,
  }));
}

export interface WorklogWithIssue extends Worklog {
  summary: string;
}

