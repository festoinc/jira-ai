import { describe, it, expect } from 'vitest';
import { program } from '../src/cli.js';

describe('CLI Help Descriptions', () => {
  it('should have updated description for auth command', () => {
    const cmd = program.commands.find(c => c.name() === 'auth');
    expect(cmd?.description()).toBe('Set up Jira authentication credentials. Supports interactive input, raw JSON string via --from-json, or .env file via --from-file.');
  });

  it('should have updated description for org list command', () => {
    const orgCmd = program.commands.find(c => c.name() === 'org');
    const listCmd = orgCmd?.commands.find(c => c.name() === 'list');
    expect(listCmd?.description()).toBe('List all saved Jira organization profiles.');
  });

  it('should have updated description for user me command', () => {
    const userCmd = program.commands.find(c => c.name() === 'user');
    const meCmd = userCmd?.commands.find(c => c.name() === 'me');
    expect(meCmd?.description()).toBe('Show profile details for the currently authenticated user.');
  });

  it('should have updated description for issue get command', () => {
    const issueCmd = program.commands.find(c => c.name() === 'issue');
    const getCmd = issueCmd?.commands.find(c => c.name() === 'get');
    expect(getCmd?.description()).toBe('Retrieve comprehensive issue data including key, summary, status, assignee, reporter, dates, labels, description, and comments.');
  });

  it('should have updated description for issue create command', () => {
    const issueCmd = program.commands.find(c => c.name() === 'issue');
    const createCmd = issueCmd?.commands.find(c => c.name() === 'create');
    expect(createCmd?.description()).toBe('Create a new Jira issue with specified title, project key, and issue type.');
  });
});
