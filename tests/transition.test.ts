import { vi, describe, it, expect, beforeEach } from 'vitest';
import { transitionCommand } from '../src/commands/transition.js';
import * as jiraClient from '../src/lib/jira-client.js';
import { CommandError } from '../src/lib/errors.js';

// Mock dependencies
vi.mock('../src/lib/jira-client.js');
vi.mock('../src/lib/ui.js', () => ({
  ui: {
    startSpinner: vi.fn(),
    stopSpinner: vi.fn(),
    succeedSpinner: vi.fn(),
    failSpinner: vi.fn(),
  }
}));

const mockJiraClient = jiraClient as vi.Mocked<typeof jiraClient>;

describe('Transition Command', () => {
  const taskId = 'PROJ-123';
  const mockTransitions = [
    {
      id: '1',
      name: 'Start Progress',
      to: { id: '10', name: 'In Progress' }
    },
    {
      id: '2',
      name: 'Resolve Issue',
      to: { id: '20', name: 'Done' }
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockJiraClient.getIssueTransitions.mockResolvedValue(mockTransitions);
    mockJiraClient.transitionIssue.mockResolvedValue();
  });

  it('should successfully transition an issue when match is found (case-insensitive)', async () => {
    await transitionCommand(taskId, 'in progress');

    expect(mockJiraClient.getIssueTransitions).toHaveBeenCalledWith(taskId);
    expect(mockJiraClient.transitionIssue).toHaveBeenCalledWith(taskId, '1');
  });

  it('should throw error when no matching transition is found', async () => {
    await expect(transitionCommand(taskId, 'Non Existent'))
      .rejects.toThrow('No transition found to status "Non Existent"');
  });

  it('should throw error when multiple transitions lead to the same status name', async () => {
    const ambiguousTransitions = [
      ...mockTransitions,
      {
        id: '3',
        name: 'Another Transition to In Progress',
        to: { id: '10', name: 'In Progress' }
      }
    ];
    mockJiraClient.getIssueTransitions.mockResolvedValue(ambiguousTransitions);

    await expect(transitionCommand(taskId, 'In Progress'))
      .rejects.toThrow('Multiple transitions found to status "In Progress"');
  });

  it('should handle API errors during transition', async () => {
    const apiError = new Error('Transition failed');
    mockJiraClient.transitionIssue.mockRejectedValue(apiError);

    await expect(transitionCommand(taskId, 'Done'))
      .rejects.toThrow('Failed to transition issue: Transition failed');
  });

  it('should provide hints for mandatory fields on failure', async () => {
    const apiError: any = new Error('Transition failed');
    apiError.response = {
      data: {
        errors: {
          resolution: 'Resolution is required'
        }
      }
    };
    mockJiraClient.transitionIssue.mockRejectedValue(apiError);

    const promise = transitionCommand(taskId, 'Done');
    await expect(promise).rejects.toThrow();
    
    const error = await promise.catch(e => e);
    expect(error.hints).toContain('Missing fields: resolution');
  });
});
