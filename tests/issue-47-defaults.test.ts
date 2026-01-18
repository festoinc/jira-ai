import { vi, describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { loadSettings, __resetCache__ } from '../src/lib/settings.js';

// Mock fs module
vi.mock('fs');
const mockFs = fs as vi.Mocked<typeof fs>;

describe('Issue 47: Initial Settings Defaults', () => {
  const mockConfigDir = path.join(os.homedir(), '.jira-ai');
  const mockSettingsPath = path.join(mockConfigDir, 'settings.yaml');

  beforeEach(() => {
    vi.clearAllMocks();
    __resetCache__();
  });

  it('should have correct default projects and commands when file does not exist', () => {
    // Mock that neither config dir nor settings files exist
    mockFs.existsSync.mockReturnValue(false);
    mockFs.mkdirSync.mockReturnValue(undefined);
    mockFs.writeFileSync.mockReturnValue(undefined);

    const settings = loadSettings();

    expect(settings.projects).toEqual(['all']);
    expect(settings.commands).toEqual([
      'me',
      'projects',
      'task-with-details',
      'run-jql',
      'list-issue-types',
      'project-statuses',
      'create-task',
      'list-colleagues',
      'add-comment',
      'add-label-to-issue',
      'delete-label-from-issue',
      'get-issue-statistics',
      'get-person-worklog',
      'organization',
      'transition',
      'update-description',
      'confl'
    ]);
  });

  it('should default commands to the specified list when commands are null or undefined in YAML', () => {
    const mockYaml = `
projects:
  - all
commands:
`;
    mockFs.existsSync.mockImplementation((p) => {
      if (p === mockConfigDir) return true;
      if (p === mockSettingsPath) return true;
      return false;
    });
    mockFs.readFileSync.mockReturnValue(mockYaml);

    const settings = loadSettings();

    expect(settings.projects).toEqual(['all']);
    expect(settings.commands).toEqual([
      'me',
      'projects',
      'task-with-details',
      'run-jql',
      'list-issue-types',
      'project-statuses',
      'create-task',
      'list-colleagues',
      'add-comment',
      'add-label-to-issue',
      'delete-label-from-issue',
      'get-issue-statistics',
      'get-person-worklog',
      'organization',
      'transition',
      'update-description',
      'confl'
    ]);
  });
});
