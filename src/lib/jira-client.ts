import { Version3Client } from 'jira.js';
import { calculateStatusStatistics, convertADFToMarkdown } from './utils.js';
import { loadCredentials } from './auth-storage.js';
import {
  applyGlobalFilters,
  isProjectAllowed,
  isCommandAllowed,
  validateIssueAgainstFilters,
  loadSettings,
  getAllowedProjects
} from './settings.js';
import { CommandError } from './errors.js';
import { getEpicFields, isNextGenProject } from './epic-fields.js';

export interface TransitionField {
  required: boolean;
  name: string;
  schema: { type: string };
}

export interface Transition {
  id: string;
  name: string;
  to: {
    id: string;
    name: string;
  };
  fields?: Record<string, TransitionField>;
}

export interface TransitionPayload {
  fields?: Record<string, any>;
  update?: {
    comment?: Array<{ add: { body: any } }>;
    [key: string]: any;
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

export interface IssueLinkType {
  id: string;
  name: string;
  inward: string;
  outward: string;
}

export interface IssueLink {
  id: string;
  type: IssueLinkType;
  inwardIssue?: {
    id: string;
    key: string;
    summary: string;
    status: { name: string };
  };
  outwardIssue?: {
    id: string;
    key: string;
    summary: string;
    status: { name: string };
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
  type?: string;
  priority?: string;
  resolution?: string;
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

export function resolveHost(creds: { host: string; authType?: string; cloudId?: string }): string {
  if (creds.authType === 'service_account' && creds.cloudId) {
    return `https://api.atlassian.com/ex/jira/${creds.cloudId}`;
  }
  return creds.host;
}

export function getJiraClient(): Version3Client {
  if (!jiraClient) {
    const storedCreds = loadCredentials();
    if (storedCreds) {
      const host = resolveHost(storedCreds);
      jiraClient = new Version3Client({
        host,
        authentication: {
          basic: {
            email: storedCreds.email,
            apiToken: storedCreds.apiToken,
          },
        },
      });
    } else {
      throw new Error('Jira credentials not found. Please run "jira-ai auth"');
    }
  }
  return jiraClient;
}

/**
 * Initialize a temporary Jira client for verification
 */
export function createTemporaryClient(
  host: string,
  email: string,
  apiToken: string,
  options?: { authType?: string; cloudId?: string }
): Version3Client {
  const effectiveHost = resolveHost({ host, ...options });
  return new Version3Client({
    host: effectiveHost,
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
      'issuetype',
      'priority',
      'resolution',
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
    type: issue.fields.issuetype?.name,
    priority: issue.fields.priority?.name,
    resolution: issue.fields.resolution?.name,
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

export interface CreateIssueOptions {
  project: string;
  summary: string;
  issueType: string;
  parent?: string;
  priority?: { name: string };
  description?: any;
  labels?: string[];
  components?: { name: string }[];
  fixVersions?: { name: string }[];
  duedate?: string;
  assignee?: { accountId: string };
  [key: string]: any;
}

/**
 * Create a new issue
 */
export async function createIssue(
  projectOrOptions: string | CreateIssueOptions,
  summary?: string,
  issueType?: string,
  parent?: string
): Promise<{ key: string; id: string }> {
  const client = getJiraClient();

  const opts: CreateIssueOptions =
    typeof projectOrOptions === 'string'
      ? { project: projectOrOptions, summary: summary!, issueType: issueType!, parent }
      : projectOrOptions;

  const { project, summary: _summary, issueType: _issueType, parent: _parent, ...rest } = opts;

  const fields: any = {
    project: { key: project },
    summary: _summary,
    issuetype: { name: _issueType },
  };

  if (_parent) {
    fields.parent = { key: _parent };
  }

  // Spread all optional rich fields (priority, description, labels, etc.)
  const { ...richFields } = rest;
  Object.assign(fields, richFields);

  const response = await client.issues.createIssue({ fields });

  return { key: response.key || '', id: response.id || '' };
}

/**
 * Update fields on an existing issue.
 * @param issueKey - The issue key (e.g., "PROJ-123")
 * @param fields - Map of Jira field keys to their new values
 */
export async function updateIssue(
  issueKey: string,
  fields: Record<string, any>
): Promise<void> {
  const client = getJiraClient();
  await client.issues.editIssue({
    issueIdOrKey: issueKey,
    fields,
    notifyUsers: false,
  });
}

/**
 * Assign or reassign an issue to a user
 * @param issueIdOrKey - The issue key (e.g., "PROJ-123")
 * @param accountId - The account ID of the user to assign the issue to, or null to unassign
 */
export async function assignIssue(
  issueIdOrKey: string,
  accountId: string | null
): Promise<void> {
  const client = getJiraClient();
  await client.issues.assignIssue({
    issueIdOrKey,
    accountId,
  });
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
  const allowedProjects = getAllowedProjects();
  let project = allowedProjects.find(p => typeof p !== 'string' && p.key === projectKey);
  if (!project) {
    project = allowedProjects.find(p => typeof p === 'string' && (p === 'all' || p === projectKey));
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
    expand: "transitions.fields",
  });

  return (response.transitions || []).map((t: any) => ({
    id: t.id || '',
    name: t.name || '',
    to: {
      id: t.to?.id || '',
      name: t.to?.name || '',
    },
    fields: t.fields,
  }));
}

/**
 * Perform a transition on an issue
 */
export async function transitionIssue(
  issueIdOrKey: string,
  transitionId: string,
  payload?: TransitionPayload
): Promise<void> {
  const client = getJiraClient();
  await client.issues.doTransition({
    issueIdOrKey,
    transition: {
      id: transitionId,
    },
    ...(payload?.fields && { fields: payload.fields }),
    ...(payload?.update && { update: payload.update }),
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
 * Search for users by name or email
 */
export async function searchUsers(query: string): Promise<UserInfo[]> {
  const client = getJiraClient();
  const users = await client.userSearch.findUsers({
    query,
    maxResults: 10,
  });

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

const userCache = new Map<string, string | null>();

/**
 * Clear the user cache (primarily for testing)
 */
export function clearUserCache(): void {
  userCache.clear();
}

/**
 * Reset the cached Jira client (primarily for testing)
 */
export function __resetJiraClient__(): void {
  jiraClient = null;
}

/**
 * Resolves a display name to an accountId with in-memory caching
 */
export async function resolveUserByName(displayName: string): Promise<string | null> {
  if (userCache.has(displayName)) {
    return userCache.get(displayName)!;
  }

  try {
    const users = await searchUsers(displayName);
    
    // Find the best match. Ideally an exact match on displayName.
    const exactMatch = users.find(u => u.displayName.toLowerCase() === displayName.toLowerCase());
    const accountId = exactMatch ? exactMatch.accountId : (users.length > 0 ? users[0].accountId : null);
    
    userCache.set(displayName, accountId);
    return accountId;
  } catch (error) {
    console.error(`Error resolving user "${displayName}":`, error);
    return null;
  }
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

// =============================================================================
// EPIC INTERFACES
// =============================================================================

export interface Epic {
  id: string;
  key: string;
  name: string;          // from epic name custom field
  summary: string;       // standard summary field
  status: string;
  statusCategory: string; // 'done', 'in_progress', 'to_do'
  done?: boolean;
  projectId: string;
  projectKey: string;
}

export interface EpicDetails extends Epic {
  description: string;
  assignee?: { displayName: string; accountId: string };
  reporter?: { displayName: string; accountId: string };
  created: string;
  updated: string;
  labels: string[];
}

export interface EpicProgress {
  epicKey: string;
  epicName: string;
  totalIssues: number;
  doneIssues: number;
  inProgressIssues: number;
  todoIssues: number;
  doneStoryPoints: number;
  totalStoryPoints: number;
  percentageDone: number; // 0-100
}

// =============================================================================
// EPIC API FUNCTIONS
// =============================================================================

/**
 * List epics in a project.
 * Uses JQL: "project = {key} AND issuetype = Epic".
 */
export async function listEpics(
  projectKey: string,
  opts?: { includeDone?: boolean; max?: number }
): Promise<Epic[]> {
  const client = getJiraClient();
  const epicFields = await getEpicFields(projectKey);

  let jql = `project = "${projectKey}" AND issuetype = Epic`;
  if (!opts?.includeDone) {
    jql += ' AND statusCategory != Done';
  }

  const fieldsToFetch = [
    'summary',
    'status',
    'project',
    ...(epicFields ? [epicFields.epicNameField] : []),
  ];

  const response = await client.issueSearch.searchForIssuesUsingJqlEnhancedSearch({
    jql,
    maxResults: opts?.max ?? 50,
    fields: fieldsToFetch,
  });

  return (response.issues || []).map((issue: any) => {
    const epicName = epicFields
      ? (issue.fields[epicFields.epicNameField] || issue.fields.summary || '')
      : (issue.fields.summary || '');

    const statusCat = (issue.fields.status?.statusCategory?.key || 'to_do').replace('-', '_');

    return {
      id: issue.id || '',
      key: issue.key || '',
      name: epicName,
      summary: issue.fields.summary || '',
      status: issue.fields.status?.name || 'Unknown',
      statusCategory: statusCat,
      done: statusCat === 'done',
      projectId: issue.fields.project?.id || '',
      projectKey: issue.fields.project?.key || projectKey,
    };
  });
}

/**
 * Get full details of a single epic.
 */
export async function getEpic(epicKey: string): Promise<EpicDetails> {
  const client = getJiraClient();
  const projectKey = epicKey.split('-')[0];
  const epicFields = await getEpicFields(projectKey);

  const fieldsToFetch = [
    'summary',
    'description',
    'status',
    'assignee',
    'reporter',
    'created',
    'updated',
    'labels',
    'project',
    ...(epicFields ? [epicFields.epicNameField] : []),
  ];

  const issue = await client.issues.getIssue({
    issueIdOrKey: epicKey,
    fields: fieldsToFetch,
  });

  const epicName = epicFields
    ? ((issue.fields as any)[epicFields.epicNameField] || issue.fields.summary || '')
    : (issue.fields.summary || '');

  const statusCat = ((issue.fields as any).status?.statusCategory?.key || 'to_do').replace('-', '_');

  return {
    id: issue.id || '',
    key: issue.key || '',
    name: epicName,
    summary: issue.fields.summary || '',
    status: (issue.fields as any).status?.name || 'Unknown',
    statusCategory: statusCat,
    done: statusCat === 'done',
    projectId: (issue.fields as any).project?.id || '',
    projectKey: (issue.fields as any).project?.key || projectKey,
    description: convertADFToMarkdown((issue.fields as any).description) || '',
    assignee: (issue.fields as any).assignee ? {
      displayName: (issue.fields as any).assignee.displayName || 'Unknown',
      accountId: (issue.fields as any).assignee.accountId || '',
    } : undefined,
    reporter: (issue.fields as any).reporter ? {
      displayName: (issue.fields as any).reporter.displayName || 'Unknown',
      accountId: (issue.fields as any).reporter.accountId || '',
    } : undefined,
    created: (issue.fields as any).created || '',
    updated: (issue.fields as any).updated || '',
    labels: (issue.fields as any).labels || [],
  };
}

/**
 * Create a new epic in a project.
 */
export async function createEpic(
  projectKey: string,
  name: string,
  summary: string,
  opts?: { description?: string; labels?: string[] }
): Promise<{ key: string; id: string }> {
  const client = getJiraClient();
  const epicFields = await getEpicFields(projectKey);

  const fields: any = {
    project: { key: projectKey },
    summary,
    issuetype: { name: 'Epic' },
  };

  if (epicFields) {
    fields[epicFields.epicNameField] = name;
  }

  if (opts?.description) {
    fields.description = {
      type: 'doc',
      version: 1,
      content: [{
        type: 'paragraph',
        content: [{ type: 'text', text: opts.description }],
      }],
    };
  }

  if (opts?.labels && opts.labels.length > 0) {
    fields.labels = opts.labels;
  }

  const response = await client.issues.createIssue({ fields });
  return { key: response.key || '', id: response.id || '' };
}

/**
 * Update epic name and/or summary.
 */
export async function updateEpic(
  epicKey: string,
  opts: { name?: string; summary?: string }
): Promise<void> {
  const client = getJiraClient();
  const projectKey = epicKey.split('-')[0];
  const epicFields = await getEpicFields(projectKey);

  const fields: any = {};

  if (opts.summary) {
    fields.summary = opts.summary;
  }

  if (opts.name && epicFields) {
    fields[epicFields.epicNameField] = opts.name;
  } else if (opts.name && !epicFields && !opts.summary) {
    // For next-gen projects, the epic name is the summary.
    // Only fall back to name when no explicit summary was provided.
    fields.summary = opts.name;
  }

  await client.issues.editIssue({
    issueIdOrKey: epicKey,
    fields,
    notifyUsers: false,
  });
}

/**
 * List issues belonging to an epic.
 * Handles both classic (Epic Link) and next-gen (parent) projects.
 * NOTE: Jira caps JQL results at ~1000 issues per query.
 */
export async function getEpicIssues(
  epicKey: string,
  opts?: { max?: number }
): Promise<JqlIssue[]> {
  const client = getJiraClient();
  const projectKey = epicKey.split('-')[0];
  const epicFields = await getEpicFields(projectKey);

  let jql: string;
  if (epicFields) {
    // Classic project: use Epic Link field
    jql = `"${epicFields.epicLinkField}" = ${epicKey} OR parent = ${epicKey}`;
  } else {
    // Next-gen: use parent only
    jql = `parent = ${epicKey}`;
  }

  const response = await client.issueSearch.searchForIssuesUsingJqlEnhancedSearch({
    jql,
    maxResults: opts?.max ?? 50,
    fields: ['summary', 'status', 'assignee', 'priority', 'issuetype'],
  });

  return (response.issues || []).map((issue: any) => ({
    key: issue.key || '',
    summary: issue.fields?.summary || '',
    status: { name: issue.fields?.status?.name || 'Unknown' },
    assignee: issue.fields?.assignee ? { displayName: issue.fields.assignee.displayName || 'Unknown' } : null,
    priority: issue.fields?.priority ? { name: issue.fields.priority.name || 'Unknown' } : null,
  }));
}

/**
 * Link an existing issue to an epic.
 */
export async function linkIssueToEpic(issueKey: string, epicKey: string): Promise<void> {
  const client = getJiraClient();
  const projectKey = issueKey.split('-')[0];
  const epicFields = await getEpicFields(projectKey);
  const nextGen = await isNextGenProject(projectKey);

  const fields: any = {};
  if (nextGen) {
    fields.parent = { key: epicKey };
  } else if (epicFields) {
    fields[epicFields.epicLinkField] = { key: epicKey };
  } else {
    fields.parent = { key: epicKey };
  }

  await client.issues.editIssue({
    issueIdOrKey: issueKey,
    fields,
    notifyUsers: false,
  });
}

/**
 * Unlink an issue from its epic.
 */
export async function unlinkIssueFromEpic(issueKey: string): Promise<void> {
  const client = getJiraClient();
  const projectKey = issueKey.split('-')[0];
  const epicFields = await getEpicFields(projectKey);
  const nextGen = await isNextGenProject(projectKey);

  const fields: any = {};
  if (nextGen) {
    fields.parent = null;
  } else if (epicFields) {
    fields[epicFields.epicLinkField] = null;
  } else {
    fields.parent = null;
  }

  await client.issues.editIssue({
    issueIdOrKey: issueKey,
    fields,
    notifyUsers: false,
  });
}

/**
 * Get epic completion progress.
 * NOTE: Jira caps JQL results at ~1000 issues. For large epics this may be incomplete.
 */
export async function getEpicProgress(epicKey: string): Promise<EpicProgress> {
  const client = getJiraClient();
  const projectKey = epicKey.split('-')[0];
  const epicFields = await getEpicFields(projectKey);

  // Get the epic itself for name
  const epicIssue = await getEpic(epicKey);

  // Fetch all issues in the epic
  const issues = await getEpicIssues(epicKey, { max: 1000 });

  let doneIssues = 0;
  let inProgressIssues = 0;
  let todoIssues = 0;

  for (const issue of issues) {
    const statusName = issue.status.name.toLowerCase();
    if (statusName.includes('done') || statusName.includes('closed') || statusName.includes('resolved')) {
      doneIssues++;
    } else if (statusName.includes('progress') || statusName.includes('review') || statusName.includes('testing')) {
      inProgressIssues++;
    } else {
      todoIssues++;
    }
  }

  const totalIssues = issues.length;
  const percentageDone = totalIssues > 0 ? Math.round((doneIssues / totalIssues) * 100) : 0;

  // Story points: attempt to fetch with story point field
  let doneStoryPoints = 0;
  let totalStoryPoints = 0;

  if (epicFields?.storyPointField) {
    try {
      const spField = epicFields.storyPointField;
      const spJql = epicFields
        ? `"${epicFields.epicLinkField}" = ${epicKey} OR parent = ${epicKey}`
        : `parent = ${epicKey}`;
      const spResponse = await client.issueSearch.searchForIssuesUsingJqlEnhancedSearch({
        jql: spJql,
        maxResults: 1000,
        fields: ['status', spField],
      });

      for (const issue of (spResponse.issues || [])) {
        const sp = (issue.fields as any)[spField] || 0;
        totalStoryPoints += sp;
        const statusName = ((issue.fields as any).status?.name || '').toLowerCase();
        if (statusName.includes('done') || statusName.includes('closed') || statusName.includes('resolved')) {
          doneStoryPoints += sp;
        }
      }
    } catch {
      // Story points not available — fall through with zeros
    }
  }

  return {
    epicKey,
    epicName: epicIssue.name,
    totalIssues,
    doneIssues,
    inProgressIssues,
    todoIssues,
    doneStoryPoints,
    totalStoryPoints,
    percentageDone,
  };
}

export async function getIssueLinks(issueIdOrKey: string): Promise<IssueLink[]> {
  const client = await getJiraClient();

  const issue = await client.issues.getIssue({
    issueIdOrKey,
    fields: ['issuelinks'],
  });

  const raw: any[] = issue.fields?.issuelinks ?? [];

  return raw.map((link: any) => ({
    id: link.id,
    type: {
      id: link.type.id,
      name: link.type.name,
      inward: link.type.inward,
      outward: link.type.outward,
    },
    inwardIssue: link.inwardIssue
      ? {
          id: link.inwardIssue.id,
          key: link.inwardIssue.key,
          summary: link.inwardIssue.fields?.summary ?? '',
          status: { name: link.inwardIssue.fields?.status?.name ?? '' },
        }
      : undefined,
    outwardIssue: link.outwardIssue
      ? {
          id: link.outwardIssue.id,
          key: link.outwardIssue.key,
          summary: link.outwardIssue.fields?.summary ?? '',
          status: { name: link.outwardIssue.fields?.status?.name ?? '' },
        }
      : undefined,
  }));
}

export async function createIssueLink(
  inwardIssueKey: string,
  outwardIssueKey: string,
  linkTypeName: string
): Promise<void> {
  const client = await getJiraClient();

  await client.issueLinks.linkIssues({
    type: { name: linkTypeName },
    inwardIssue: { key: inwardIssueKey },
    outwardIssue: { key: outwardIssueKey },
  });
}

export async function deleteIssueLink(linkId: string): Promise<void> {
  const client = await getJiraClient();
  await client.issueLinks.deleteIssueLink({ linkId });
}

export async function getAvailableLinkTypes(): Promise<IssueLinkType[]> {
  const client = await getJiraClient();
  const response = await client.issueLinkTypes.getIssueLinkTypes();
  const types: any[] = (response as any).issueLinkTypes ?? [];
  return types.map((t: any) => ({
    id: t.id,
    name: t.name,
    inward: t.inward,
    outward: t.outward,
  }));
}

export const getEpics = listEpics;

// =============================================================================
// ATTACHMENT FUNCTIONS
// =============================================================================

export interface AttachmentInfo {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  created: string;
  author: {
    displayName: string;
    emailAddress?: string;
  };
  content: string;
}

/**
 * Upload one or more files as attachments to a Jira issue
 */
export async function addIssueAttachment(
  issueKey: string,
  filePaths: string[]
): Promise<AttachmentInfo[]> {
  const client = getJiraClient();
  const fs = await import('fs');
  const path = await import('path');

  const attachments = filePaths.map((filePath) => ({
    filename: path.basename(filePath),
    file: fs.readFileSync(filePath) as Buffer,
  }));

  const result = await client.issueAttachments.addAttachment({
    issueIdOrKey: issueKey,
    attachment: attachments,
  });

  const items: any[] = Array.isArray(result) ? result : [result];
  return items.map((att: any) => ({
    id: att.id || '',
    filename: att.filename || '',
    mimeType: att.mimeType || '',
    size: att.size || 0,
    created: att.created || '',
    author: {
      displayName: att.author?.displayName || '',
      emailAddress: att.author?.emailAddress,
    },
    content: att.content || '',
  }));
}

/**
 * List all attachments for a Jira issue
 */
export async function getIssueAttachments(issueKey: string): Promise<AttachmentInfo[]> {
  const client = getJiraClient();
  const issue = await client.issues.getIssue({
    issueIdOrKey: issueKey,
    fields: ['attachment'],
  });

  const attachments: any[] = issue.fields?.attachment || [];
  return attachments.map((att: any) => ({
    id: att.id || '',
    filename: att.filename || '',
    mimeType: att.mimeType || '',
    size: att.size || 0,
    created: att.created || '',
    author: {
      displayName: att.author?.displayName || '',
      emailAddress: att.author?.emailAddress,
    },
    content: att.content || '',
  }));
}

/**
 * Download an attachment by ID, saving to outputPath (or current dir if not specified)
 * Returns the path where the file was saved
 */
export async function downloadAttachment(
  issueKey: string,
  attachmentId: string,
  outputPath?: string
): Promise<string> {
  const client = getJiraClient();
  const fs = await import('fs');
  const path = await import('path');

  // Get attachment metadata to find the filename
  const issue = await client.issues.getIssue({
    issueIdOrKey: issueKey,
    fields: ['attachment'],
  });
  const attachments: any[] = issue.fields?.attachment || [];
  const meta = attachments.find((a: any) => a.id === attachmentId);
  const rawFilename = meta?.filename || attachmentId;
  const safeFilename = path.basename(rawFilename).replace(/\.\./g, '');

  const destPath = outputPath || path.join(process.cwd(), safeFilename);

  const content = await client.issueAttachments.getAttachmentContent(attachmentId);
  fs.writeFileSync(destPath, Buffer.from(content as ArrayBuffer));

  return destPath;
}

/**
 * Delete an attachment by ID
 */
export async function deleteAttachment(
  issueKey: string,
  attachmentId: string
): Promise<void> {
  const client = getJiraClient();
  await client.issueAttachments.removeAttachment(attachmentId);
}
