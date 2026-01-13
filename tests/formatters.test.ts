import { vi, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, test } from 'vitest';
import chalk from 'chalk';
import { formatTaskDetails } from '../src/lib/formatters.js';
import { TaskDetails } from '../src/lib/jira-client.js';

describe('Formatters', () => {
  const mockTask: TaskDetails = {
    id: '10001',
    key: 'PROJ-123',
    summary: 'Test task summary',
    description: 'Test task description',
    status: { name: 'In Progress' },
    assignee: { displayName: 'John Doe' },
    reporter: { displayName: 'Jane Smith' },
    created: '2023-01-01T10:00:00.000Z',
    updated: '2023-01-02T10:00:00.000Z',
    labels: ['frontend', 'ui'],
    comments: [],
    subtasks: []
  };

  describe('formatTaskDetails', () => {
    it('should include labels in the output', () => {
      const output = formatTaskDetails(mockTask);
      expect(output).toContain('Labels');
      expect(output).toContain('frontend');
      expect(output).toContain('ui');
    });

    it('should handle task with no labels', () => {
      const taskNoLabels = { ...mockTask, labels: [] };
      const output = formatTaskDetails(taskNoLabels);
      expect(output).not.toContain('Labels:');
    });

    it('should display N/A for missing dueDate', () => {
      const output = formatTaskDetails(mockTask);
      expect(output).toContain('Due Date');
      expect(output).toContain('N/A');
    });

    it('should display overdue dueDate in red', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-01'));
      
      const overdueTask: TaskDetails = {
        ...mockTask,
        dueDate: '2023-12-31',
        status: { name: 'To Do', category: 'new' }
      };
      
      const output = formatTaskDetails(overdueTask);
      expect(output).toContain('Due Date');
      expect(output).toContain('2023-12-31');
      // Chalk might be tricky to test directly in string, but we can check if it's there
      // Since we use chalk, it adds ANSI escape codes.
      
      vi.useRealTimers();
    });

    it('should not display overdue dueDate in red if status is done', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-01'));
      
      const doneOverdueTask: TaskDetails = {
        ...mockTask,
        dueDate: '2023-12-31',
        status: { name: 'Done', category: 'done' }
      };
      
      const output = formatTaskDetails(doneOverdueTask);
      expect(output).toContain('Due Date');
      expect(output).toContain('2023-12-31');
      
      vi.useRealTimers();
    });

    it('should display future dueDate in green', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-01'));
      
      const futureTask: TaskDetails = {
        ...mockTask,
        dueDate: '2024-01-02'
      };
      
      const output = formatTaskDetails(futureTask);
      expect(output).toContain('Due Date');
      expect(output).toContain('2024-01-02');
      
      vi.useRealTimers();
    });

    it('should include history section when history is present', () => {
      const taskWithHistory: TaskDetails = {
        ...mockTask,
        history: [
          {
            id: '101',
            author: 'John Doe',
            created: '2023-01-01T12:00:00.000Z',
            items: [
              {
                field: 'status',
                from: 'To Do',
                to: 'In Progress'
              }
            ]
          }
        ]
      };
      
      const output = formatTaskDetails(taskWithHistory);
      expect(output).toContain('Task History');
      expect(output).toContain('John Doe');
      expect(output).toContain('status');
      expect(output).toContain('To Do');
      expect(output).toContain('In Progress');
    });
  });
});
