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
  });
});
