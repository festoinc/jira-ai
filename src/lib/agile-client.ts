import { AgileClient } from 'jira.js';
import { loadCredentials } from './auth-storage.js';
import { CommandError } from './errors.js';

// TypeScript interfaces for Agile entities
export interface Board {
  id: number;
  name: string;
  type: string;
  location?: {
    projectKey?: string;
    projectName?: string;
    displayName?: string;
  };
  isPrivate?: boolean;
}

export interface BoardList {
  maxResults?: number;
  startAt?: number;
  total?: number;
  isLast?: boolean;
  values: Board[];
}

export interface BoardColumn {
  name: string;
  statuses: { id: string }[];
}

export interface BoardConfig {
  id: number;
  name: string;
  type?: string;
  columnConfig: {
    columns: BoardColumn[];
    constraintType?: string;
  };
  filter?: { id: string };
  ranking?: { rankCustomFieldId: number };
}

export interface BoardIssueFields {
  summary: string;
  status: { name: string };
  assignee?: { displayName: string } | null;
  priority?: { name: string };
}

export interface BoardIssue {
  key: string;
  fields: BoardIssueFields;
}

export interface BoardIssueList {
  total: number;
  issues: BoardIssue[];
}

export interface Sprint {
  id: number;
  name: string;
  state: string;
  startDate?: string;
  endDate?: string;
  goal?: string;
  originBoardId?: number;
}

export interface SprintList {
  values: Sprint[];
}

let agileClientInstance: AgileClient | null = null;

export function __resetAgileClient__(): void {
  agileClientInstance = null;
}

export async function getAgileClient(): Promise<AgileClient> {
  if (!agileClientInstance) {
    const creds = await loadCredentials();
    if (!creds) {
      throw new CommandError('Jira credentials not found. Please run "jira-ai auth"');
    }
    const host = creds.authType === 'service_account' && creds.cloudId
      ? `https://api.atlassian.com/ex/jira/${creds.cloudId}`
      : creds.host;

    agileClientInstance = new AgileClient({
      host,
      authentication: {
        basic: {
          email: creds.email,
          apiToken: creds.apiToken,
        },
      },
    });
  }
  return agileClientInstance;
}

// Board wrappers

export async function getBoards(options?: { projectKeyOrId?: string; type?: string; maxResults?: number }): Promise<BoardList> {
  const client = await getAgileClient();
  return client.board.getAllBoards({ ...options }) as Promise<BoardList>;
}

export async function getBoard(boardId: number): Promise<Board> {
  const client = await getAgileClient();
  return client.board.getBoard({ boardId }) as Promise<Board>;
}

export async function getBoardConfig(boardId: number): Promise<BoardConfig> {
  const client = await getAgileClient();
  return client.board.getConfiguration({ boardId }) as Promise<BoardConfig>;
}

export async function getBoardIssues(boardId: number, options?: { jql?: string; maxResults?: number }): Promise<BoardIssueList> {
  const client = await getAgileClient();
  return client.board.getIssuesForBoard({ boardId, ...options }) as Promise<BoardIssueList>;
}

// Sprint wrappers

export async function getSprints(boardId: number, options?: { state?: string; maxResults?: number }): Promise<SprintList> {
  const client = await getAgileClient();
  try {
    return await (client as any).sprint.getAllSprints({ boardId, ...options }) as SprintList;
  } catch (error: any) {
    const msg = error?.message || '';
    if (msg.toLowerCase().includes('board does not support sprints') || msg.toLowerCase().includes('does not support sprints')) {
      throw new CommandError('This board does not support sprints. Sprint operations require a Scrum board.', {
        hints: ['Use a Scrum board for sprint operations', 'Kanban boards do not support sprints'],
      });
    }
    throw error;
  }
}

export async function getSprint(sprintId: number): Promise<Sprint> {
  const client = await getAgileClient();
  return client.sprint.getSprint({ sprintId }) as Promise<Sprint>;
}

export async function createSprint(
  boardId: number,
  name: string,
  options?: { goal?: string; startDate?: string; endDate?: string }
): Promise<Sprint> {
  const client = await getAgileClient();
  return client.sprint.createSprint({
    originBoardId: boardId,
    name,
    ...options,
  }) as Promise<Sprint>;
}

export async function startSprint(sprintId: number): Promise<void> {
  const client = await getAgileClient();
  await client.sprint.partiallyUpdateSprint({ sprintId, state: 'active' });
}

export async function completeSprint(sprintId: number): Promise<void> {
  const client = await getAgileClient();
  await client.sprint.partiallyUpdateSprint({ sprintId, state: 'closed' });
}

export async function updateSprint(sprintId: number, updates: { name?: string; goal?: string; startDate?: string; endDate?: string }): Promise<void> {
  const client = await getAgileClient();
  await client.sprint.partiallyUpdateSprint({ sprintId, ...updates });
}

export async function deleteSprint(sprintId: number): Promise<void> {
  const client = await getAgileClient();
  await client.sprint.deleteSprint({ sprintId });
}

export async function getSprintIssues(sprintId: number, options?: { jql?: string; maxResults?: number }): Promise<BoardIssueList> {
  const client = await getAgileClient();
  return client.sprint.getIssuesForSprint({ sprintId, ...options }) as Promise<BoardIssueList>;
}

export async function moveIssuesToSprint(
  sprintId: number,
  issues: string[],
  options?: { rankBeforeIssue?: string; rankAfterIssue?: string }
): Promise<void> {
  if (issues.length > 50) {
    throw new CommandError('Cannot move more than 50 issues at once.', {
      hints: ['Split your issue list into batches of 50 or fewer'],
    });
  }
  const client = await getAgileClient();
  await client.sprint.moveIssuesToSprintAndRank({ sprintId, issues, ...options });
}

// Backlog wrapper

export async function moveIssuesToBacklog(issues: string[]): Promise<void> {
  if (issues.length > 50) {
    throw new CommandError('Cannot move more than 50 issues at once.', {
      hints: ['Split your issue list into batches of 50 or fewer'],
    });
  }
  const client = await getAgileClient();
  await client.backlog.moveIssuesToBacklog({ issues });
}

// Rank wrapper

export async function rankIssues(
  issues: string[],
  options: { rankBeforeIssue?: string; rankAfterIssue?: string }
): Promise<void> {
  if (issues.length > 50) {
    throw new CommandError('Cannot rank more than 50 issues at once.', {
      hints: ['Split your issue list into batches of 50 or fewer'],
    });
  }
  const client = await getAgileClient();
  await client.issue.rankIssues({ issues, ...options });
}
