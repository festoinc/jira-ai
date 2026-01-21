import { describe, it, expect } from 'vitest';
import { formatTaskDetails } from '../src/lib/formatters.js';
import { TaskDetails } from '../src/lib/jira-client.js';

describe('Issue 100: Enhanced Task Details Formatting', () => {
  const mockTask: TaskDetails = {
    id: '10001',
    key: 'PROJ-123',
    summary: 'Test task summary',
    type: 'Bug',
    priority: 'High',
    resolution: 'Fixed',
    status: { name: 'Done', category: 'done' },
    assignee: { accountId: 'user-1', displayName: 'John Doe' },
    reporter: { accountId: 'user-2', displayName: 'Jane Smith' },
    created: '2023-01-01T10:00:00.000Z',
    updated: '2023-01-02T10:00:00.000Z',
    labels: [],
    comments: [
      {
        id: '12345',
        author: { accountId: 'user-1', displayName: 'John Doe' },
        body: 'This is a comment',
        created: '2023-01-03T10:00:00.000Z',
        updated: '2023-01-03T10:00:00.000Z'
      }
    ],
    subtasks: []
  };

  it('should include Type, Priority, and Resolution in the output', () => {
    const output = formatTaskDetails(mockTask);
    
    expect(output).toContain('Type');
    expect(output).toContain('Bug');
    expect(output).toContain('Priority');
    expect(output).toContain('High');
    expect(output).toContain('Resolution');
    expect(output).toContain('Fixed');
  });

  it('should include Comment ID in the comments section', () => {
    const output = formatTaskDetails(mockTask);
    
    expect(output).toContain('[ID: 12345]');
    expect(output).toContain('John Doe');
  });

  it('should handle missing Type, Priority, and Resolution gracefully', () => {
    const minimalTask: TaskDetails = {
      ...mockTask,
      type: undefined,
      priority: undefined,
      resolution: undefined
    };
    
    const output = formatTaskDetails(minimalTask);
    
    expect(output).toContain('Type');
    expect(output).toContain('N/A');
    expect(output).toContain('Priority');
    expect(output).toContain('N/A');
    expect(output).toContain('Resolution');
    expect(output).toContain('Unresolved');
  });
});
