import { vi, describe, it, expect, beforeEach } from 'vitest';
import { transitionCommand } from '../src/commands/transition.js';
import * as jiraClient from '../src/lib/jira-client.js';
import { CommandError } from '../src/lib/errors.js';
import * as fs from 'fs';

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
vi.mock('marklassian', () => ({
  markdownToAdf: vi.fn((text: string) => ({
    version: 1,
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  })),
}));
vi.mock('fs');

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

// ---------------------------------------------------------------------------
// RED TESTS: Enhanced transition with optional fields (JIR-63)
// These tests describe the expected behavior BEFORE implementation.
// They will fail until the feature is implemented.
// ---------------------------------------------------------------------------
describe('Transition Command — Enhanced Fields (JIR-63)', () => {
  const taskId = 'PROJ-123';
  const mockTransitions = [
    { id: '1', name: 'Start Progress', to: { id: '10', name: 'In Progress' } },
    { id: '2', name: 'Resolve Issue',  to: { id: '20', name: 'Done' } },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockJiraClient.getIssueTransitions.mockResolvedValue(mockTransitions);
    mockJiraClient.transitionIssue.mockResolvedValue();
    mockJiraClient.resolveUserByName.mockResolvedValue('account-id-123');
    mockJiraClient.validateIssuePermissions.mockResolvedValue(undefined as any);
  });

  // -------------------------------------------------------------------------
  // --resolution flag
  // -------------------------------------------------------------------------
  it('should pass resolution field when --resolution flag is provided', async () => {
    await transitionCommand(taskId, 'Done', { resolution: "Won't Do" });

    expect(mockJiraClient.transitionIssue).toHaveBeenCalledWith(
      taskId,
      '2',
      expect.objectContaining({
        fields: expect.objectContaining({
          resolution: { name: "Won't Do" },
        }),
      })
    );
  });

  // -------------------------------------------------------------------------
  // --comment flag
  // -------------------------------------------------------------------------
  it('should convert --comment markdown to ADF and include in update.comment', async () => {
    const { markdownToAdf } = await import('marklassian');

    await transitionCommand(taskId, 'Done', { comment: '**Resolved** via automation' });

    expect(markdownToAdf).toHaveBeenCalledWith('**Resolved** via automation');
    expect(mockJiraClient.transitionIssue).toHaveBeenCalledWith(
      taskId,
      '2',
      expect.objectContaining({
        update: expect.objectContaining({
          comment: expect.arrayContaining([
            expect.objectContaining({ add: expect.objectContaining({ body: expect.any(Object) }) }),
          ]),
        }),
      })
    );
  });

  // -------------------------------------------------------------------------
  // --comment-file flag
  // -------------------------------------------------------------------------
  it('should read --comment-file, convert to ADF and include in update.comment', async () => {
    const { markdownToAdf } = await import('marklassian');
    vi.mocked(fs.readFileSync).mockReturnValue('# File comment\nSome text' as any);

    await transitionCommand(taskId, 'Done', { commentFile: '/tmp/comment.md' });

    expect(fs.readFileSync).toHaveBeenCalledWith('/tmp/comment.md', 'utf-8');
    expect(markdownToAdf).toHaveBeenCalledWith('# File comment\nSome text');
    expect(mockJiraClient.transitionIssue).toHaveBeenCalledWith(
      taskId,
      '2',
      expect.objectContaining({
        update: expect.objectContaining({
          comment: expect.arrayContaining([
            expect.objectContaining({ add: expect.any(Object) }),
          ]),
        }),
      })
    );
  });

  // -------------------------------------------------------------------------
  // mutual exclusivity of --comment and --comment-file
  // -------------------------------------------------------------------------
  it('should throw a CommandError when both --comment and --comment-file are provided', async () => {
    await expect(
      transitionCommand(taskId, 'Done', {
        comment: 'some text',
        commentFile: '/tmp/comment.md',
      })
    ).rejects.toThrow(CommandError);

    await expect(
      transitionCommand(taskId, 'Done', {
        comment: 'some text',
        commentFile: '/tmp/comment.md',
      })
    ).rejects.toThrow(/cannot use both.*comment.*comment-file/i);
  });

  // -------------------------------------------------------------------------
  // --assignee flag — accountid: prefix
  // -------------------------------------------------------------------------
  it('should pass assignee field directly when --assignee uses accountid: prefix', async () => {
    await transitionCommand(taskId, 'Done', { assignee: 'accountid:abc123' });

    expect(mockJiraClient.resolveUserByName).not.toHaveBeenCalled();
    expect(mockJiraClient.transitionIssue).toHaveBeenCalledWith(
      taskId,
      '2',
      expect.objectContaining({
        fields: expect.objectContaining({
          assignee: { accountId: 'abc123' },
        }),
      })
    );
  });

  // -------------------------------------------------------------------------
  // --assignee flag — display name (resolved via resolveUserByName)
  // -------------------------------------------------------------------------
  it('should resolve --assignee display name via resolveUserByName', async () => {
    await transitionCommand(taskId, 'Done', { assignee: 'Jane Doe' });

    expect(mockJiraClient.resolveUserByName).toHaveBeenCalledWith('Jane Doe');
    expect(mockJiraClient.transitionIssue).toHaveBeenCalledWith(
      taskId,
      '2',
      expect.objectContaining({
        fields: expect.objectContaining({
          assignee: { accountId: 'account-id-123' },
        }),
      })
    );
  });

  it('should throw CommandError when --assignee display name cannot be resolved', async () => {
    mockJiraClient.resolveUserByName.mockResolvedValue(null);

    await expect(
      transitionCommand(taskId, 'Done', { assignee: 'Unknown Person' })
    ).rejects.toThrow(CommandError);

    await expect(
      transitionCommand(taskId, 'Done', { assignee: 'Unknown Person' })
    ).rejects.toThrow(/could not resolve.*user/i);
  });

  // -------------------------------------------------------------------------
  // --fix-version flag
  // -------------------------------------------------------------------------
  it('should build fixVersions array when --fix-version is provided', async () => {
    await transitionCommand(taskId, 'Done', { fixVersion: '2.0.0' });

    expect(mockJiraClient.transitionIssue).toHaveBeenCalledWith(
      taskId,
      '2',
      expect.objectContaining({
        fields: expect.objectContaining({
          fixVersions: [{ name: '2.0.0' }],
        }),
      })
    );
  });

  // -------------------------------------------------------------------------
  // --custom-field flag (type coercion via FieldResolver)
  // -------------------------------------------------------------------------
  it('should pass --custom-field values through FieldResolver.coerceValue', async () => {
    await transitionCommand(taskId, 'Done', {
      customFields: ['Story Points=5', 'Priority=High'],
    });

    expect(mockJiraClient.transitionIssue).toHaveBeenCalledWith(
      taskId,
      '2',
      expect.objectContaining({
        fields: expect.objectContaining({
          // values coerced by FieldResolver — exact shape depends on field schema
          'Story Points': expect.anything(),
          'Priority': expect.anything(),
        }),
      })
    );
  });

  // -------------------------------------------------------------------------
  // Backward compatibility
  // -------------------------------------------------------------------------
  it('should send only { transition: { id } } when no optional flags are provided', async () => {
    await transitionCommand(taskId, 'Done');

    expect(mockJiraClient.transitionIssue).toHaveBeenCalledWith(taskId, '2', undefined);
  });

  // -------------------------------------------------------------------------
  // Combined flags
  // -------------------------------------------------------------------------
  it('should combine resolution + comment + assignee in a single transition payload', async () => {
    vi.mocked(fs.readFileSync).mockReturnValue('note' as any);

    await transitionCommand(taskId, 'Done', {
      resolution: 'Done',
      comment: 'Closing now',
      assignee: 'accountid:user-42',
    });

    expect(mockJiraClient.transitionIssue).toHaveBeenCalledWith(
      taskId,
      '2',
      expect.objectContaining({
        fields: expect.objectContaining({
          resolution: { name: 'Done' },
          assignee: { accountId: 'user-42' },
        }),
        update: expect.objectContaining({
          comment: expect.any(Array),
        }),
      })
    );
  });
});
