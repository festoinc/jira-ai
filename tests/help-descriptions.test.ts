import { describe, it, expect } from 'vitest';
import { program } from '../src/cli.js';

describe('CLI Help Descriptions', () => {
  it('should have updated description for auth command', () => {
    const cmd = program.commands.find(c => c.name() === 'auth');
    expect(cmd?.description()).toBe('Set up Jira authentication credentials. Supports interactive input, raw JSON string via --from-json, or .env file via --from-file.');
  });

  it('should have updated description for organization list command', () => {
    const orgCmd = program.commands.find(c => c.name() === 'organization');
    const listCmd = orgCmd?.commands.find(c => c.name() === 'list');
    expect(listCmd?.description()).toBe('List all saved Jira organization profiles, showing their aliases and associated host URLs.');
  });

  it('should have updated description for me command', () => {
    const cmd = program.commands.find(c => c.name() === 'me');
    expect(cmd?.description()).toBe('Show profile details for the currently authenticated user, including Jira host, display name, email, account ID, status, and time zone.');
  });

  it('should have updated description for task-with-details command', () => {
    const cmd = program.commands.find(c => c.name() === 'task-with-details');
    expect(cmd?.description()).toBe('Retrieve comprehensive issue data including key, summary, status (name, category), assignee, reporter, creation/update dates, due date, labels, parent/subtasks, description, and comments. Use --include-detailed-history to fetch a chronological log of all changes including field updates and status transitions.');
  });

  it('should have updated description for create-task command', () => {
    const cmd = program.commands.find(c => c.name() === 'create-task');
    expect(cmd?.description()).toBe('Create a new Jira issue with specified title, project key, and issue type. Optional --parent key for subtasks. Returns the key of the newly created issue.');
  });
});
