import { Version3Client } from 'jira.js';
import { convertADFToMarkdown } from './utils';
import { loadCredentials } from './auth-storage';

export interface UserInfo {
  accountId: string;
  displayName: string;
  emailAddress: string;
  active: boolean;
  timeZone: string;
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

export interface TaskDetails {
  id: string;
  key: string;
  summary: string;
  description?: string;
  status: {
    name: string;
  };
  assignee?: {
    displayName: string;
  };
  reporter?: {
    displayName: string;
  };
  created: string;
  updated: string;
  comments: Comment[];
  parent?: LinkedIssue;
  subtasks: LinkedIssue[];
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
      const storedCreds = loadCredentials();
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
        throw new Error('Jira credentials not found. Please set environment variables or run "jira-ai auth"');
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

  return {
    accountId: user.accountId || '',
    displayName: user.displayName || '',
    emailAddress: user.emailAddress || '',
    active: user.active || false,
    timeZone: user.timeZone || '',
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
export async function getTaskWithDetails(taskId: string): Promise<TaskDetails> {
  const client = getJiraClient();

  // Get issue details
  const issue = await client.issues.getIssue({
    issueIdOrKey: taskId,
    fields: [
      'summary',
      'description',
      'status',
      'assignee',
      'reporter',
      'created',
      'updated',
      'comment',
      'parent',
      'subtasks',
    ],
  });

  // Extract comments
  const comments: Comment[] = issue.fields.comment?.comments?.map((comment: any) => ({
    id: comment.id,
    author: {
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

  return {
    id: issue.id || '',
    key: issue.key || '',
    summary: issue.fields.summary || '',
    description,
    status: {
      name: issue.fields.status?.name || 'Unknown',
    },
    assignee: issue.fields.assignee ? {
      displayName: issue.fields.assignee.displayName || 'Unknown',
    } : undefined,
    reporter: issue.fields.reporter ? {
      displayName: issue.fields.reporter.displayName || 'Unknown',
    } : undefined,
    created: issue.fields.created || '',
    updated: issue.fields.updated || '',
    comments,
    parent,
    subtasks,
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

  const response = await client.issueSearch.searchForIssuesUsingJqlEnhancedSearch({
    jql: jqlQuery,
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
