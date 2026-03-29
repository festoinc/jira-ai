import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  formatEpicList,
  formatEpicDetails,
  formatEpicProgress,
  formatEpicIssues,
} from '../src/lib/formatters.js';
import type { Epic, EpicDetails, EpicProgress } from '../src/lib/jira-client.js';
import type { JqlIssue } from '../src/lib/jira-client.js';

vi.mock('chalk', () => ({
  default: {
    bold: Object.assign((s: string) => s, {
      cyan: (s: string) => s,
      green: (s: string) => s,
      yellow: (s: string) => s,
    }),
    cyan: Object.assign((s: string) => s, {
      bold: (s: string) => s,
    }),
    green: (s: string) => s,
    red: (s: string) => s,
    yellow: (s: string) => s,
    gray: (s: string) => s,
    blue: (s: string) => s,
    magenta: (s: string) => s,
    white: (s: string) => s,
    dim: (s: string) => s,
    bgGreen: Object.assign((s: string) => s, { black: (s: string) => s }),
    bgRed: Object.assign((s: string) => s, { white: (s: string) => s }),
  },
}));

vi.mock('cli-table3', () => {
  return {
    default: class MockTable {
      rows: any[] = [];
      options: any;
      constructor(opts: any) { this.options = opts; }
      push(...rows: any[]) { this.rows.push(...rows); }
      toString() {
        return this.rows.map(r => {
          if (Array.isArray(r)) return r.join(' | ');
          return JSON.stringify(r);
        }).join('\n');
      }
    }
  };
});

describe('formatEpicList', () => {
  const mockEpics: Epic[] = [
    {
      id: '10001',
      key: 'PROJ-1',
      name: 'Authentication Epic',
      summary: 'Implement user authentication',
      status: 'In Progress',
      statusCategory: 'in_progress',
      projectId: 'proj1',
      projectKey: 'PROJ',
    },
    {
      id: '10002',
      key: 'PROJ-2',
      name: 'Dashboard Epic',
      summary: 'Build the main dashboard',
      status: 'To Do',
      statusCategory: 'to_do',
      projectId: 'proj1',
      projectKey: 'PROJ',
    },
  ];

  it('should return a string', () => {
    const result = formatEpicList(mockEpics);
    expect(typeof result).toBe('string');
  });

  it('should include epic keys in output', () => {
    const result = formatEpicList(mockEpics);
    expect(result).toContain('PROJ-1');
    expect(result).toContain('PROJ-2');
  });

  it('should include epic names in output', () => {
    const result = formatEpicList(mockEpics);
    expect(result).toContain('Authentication Epic');
    expect(result).toContain('Dashboard Epic');
  });

  it('should show message when no epics found', () => {
    const result = formatEpicList([]);
    expect(result).toContain('No epics found');
  });

  it('should include status information', () => {
    const result = formatEpicList(mockEpics);
    expect(result).toContain('In Progress');
  });
});

describe('formatEpicDetails', () => {
  const mockEpicDetails: EpicDetails = {
    id: '10001',
    key: 'PROJ-1',
    name: 'Authentication Epic',
    summary: 'Implement user authentication',
    status: 'In Progress',
    statusCategory: 'in_progress',
    projectId: 'proj1',
    projectKey: 'PROJ',
    description: 'This epic covers all authentication features',
    assignee: { displayName: 'John Doe', accountId: 'acc123' },
    reporter: { displayName: 'Jane Smith', accountId: 'acc456' },
    created: '2024-01-01T00:00:00.000Z',
    updated: '2024-01-15T00:00:00.000Z',
    labels: ['auth', 'security'],
  };

  it('should return a string', () => {
    const result = formatEpicDetails(mockEpicDetails);
    expect(typeof result).toBe('string');
  });

  it('should include epic key and name', () => {
    const result = formatEpicDetails(mockEpicDetails);
    expect(result).toContain('PROJ-1');
    expect(result).toContain('Authentication Epic');
  });

  it('should include assignee information', () => {
    const result = formatEpicDetails(mockEpicDetails);
    expect(result).toContain('John Doe');
  });

  it('should include description when present', () => {
    const result = formatEpicDetails(mockEpicDetails);
    expect(result).toContain('This epic covers all authentication features');
  });

  it('should handle missing assignee gracefully', () => {
    const withoutAssignee = { ...mockEpicDetails, assignee: undefined };
    const result = formatEpicDetails(withoutAssignee);
    expect(typeof result).toBe('string');
    expect(result).toContain('Unassigned');
  });

  it('should include labels when present', () => {
    const result = formatEpicDetails(mockEpicDetails);
    expect(result).toContain('auth');
  });
});

describe('formatEpicProgress', () => {
  const mockProgress: EpicProgress = {
    epicKey: 'PROJ-1',
    epicName: 'Authentication Epic',
    totalIssues: 10,
    doneIssues: 4,
    inProgressIssues: 3,
    todoIssues: 3,
    doneStoryPoints: 20,
    totalStoryPoints: 50,
    percentageDone: 40,
  };

  it('should return a string', () => {
    const result = formatEpicProgress(mockProgress);
    expect(typeof result).toBe('string');
  });

  it('should include epic key', () => {
    const result = formatEpicProgress(mockProgress);
    expect(result).toContain('PROJ-1');
  });

  it('should include issue counts', () => {
    const result = formatEpicProgress(mockProgress);
    expect(result).toContain('10');
    expect(result).toContain('4');
  });

  it('should include percentage', () => {
    const result = formatEpicProgress(mockProgress);
    expect(result).toContain('40');
  });

  it('should include story points when available', () => {
    const result = formatEpicProgress(mockProgress);
    expect(result).toContain('20');
    expect(result).toContain('50');
  });

  it('should handle zero total issues', () => {
    const emptyProgress: EpicProgress = {
      ...mockProgress,
      totalIssues: 0,
      doneIssues: 0,
      inProgressIssues: 0,
      todoIssues: 0,
      doneStoryPoints: 0,
      totalStoryPoints: 0,
      percentageDone: 0,
    };
    const result = formatEpicProgress(emptyProgress);
    expect(typeof result).toBe('string');
  });
});

describe('formatEpicIssues', () => {
  const mockIssues: JqlIssue[] = [
    {
      key: 'PROJ-10',
      summary: 'Login page implementation',
      status: { name: 'In Progress' },
      assignee: { displayName: 'John Doe' },
      priority: { name: 'High' },
    },
    {
      key: 'PROJ-11',
      summary: 'Session management',
      status: { name: 'To Do' },
      assignee: null,
      priority: { name: 'Medium' },
    },
  ];

  it('should return a string', () => {
    const result = formatEpicIssues(mockIssues);
    expect(typeof result).toBe('string');
  });

  it('should include issue keys', () => {
    const result = formatEpicIssues(mockIssues);
    expect(result).toContain('PROJ-10');
    expect(result).toContain('PROJ-11');
  });

  it('should include summaries', () => {
    const result = formatEpicIssues(mockIssues);
    expect(result).toContain('Login page implementation');
  });

  it('should show message when no issues', () => {
    const result = formatEpicIssues([]);
    expect(result).toContain('No issues found');
  });

  it('should handle null assignee gracefully', () => {
    const result = formatEpicIssues(mockIssues);
    expect(typeof result).toBe('string');
  });
});
