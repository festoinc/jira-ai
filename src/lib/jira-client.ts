import { Version3Client } from 'jira.js';

export interface UserInfo {
  accountId: string;
  displayName: string;
  emailAddress: string;
  active: boolean;
  timeZone: string;
}

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
}

let jiraClient: Version3Client | null = null;

/**
 * Get or create Jira client instance
 */
export function getJiraClient(): Version3Client {
  if (!jiraClient) {
    jiraClient = new Version3Client({
      host: process.env.JIRA_HOST!,
      authentication: {
        basic: {
          email: process.env.JIRA_USER_EMAIL!,
          apiToken: process.env.JIRA_API_TOKEN!,
        },
      },
    });
  }
  return jiraClient;
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
    fields: ['summary', 'description', 'status', 'assignee', 'reporter', 'created', 'updated', 'comment'],
  });

  // Extract comments
  const comments: Comment[] = issue.fields.comment?.comments?.map((comment: any) => ({
    id: comment.id,
    author: {
      displayName: comment.author?.displayName || 'Unknown',
      emailAddress: comment.author?.emailAddress,
    },
    body: typeof comment.body === 'string' ? comment.body : JSON.stringify(comment.body),
    created: comment.created || '',
    updated: comment.updated || '',
  })) || [];

  // Convert description to string if it's an ADF Document
  let description: string | undefined;
  if (issue.fields.description) {
    if (typeof issue.fields.description === 'string') {
      description = issue.fields.description;
    } else {
      // ADF Document - convert to JSON string for now
      description = JSON.stringify(issue.fields.description, null, 2);
    }
  }

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
