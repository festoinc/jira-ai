import { vi, describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { applyGlobalFilters, __resetCache__ } from '../src/lib/settings.js';

vi.mock('fs');
const mockFs = fs as vi.Mocked<typeof fs>;

describe('Issue 66 Reproduction: applyGlobalFilters with ORDER BY', () => {
  const mockConfigDir = path.join(os.homedir(), '.jira-ai');
  const mockSettingsPath = path.join(mockConfigDir, 'settings.yaml');

  beforeEach(() => {
    vi.clearAllMocks();
    __resetCache__();
  });

  it('should incorrectly wrap JQL with ORDER BY (Current failing behavior)', () => {
    const mockYaml = `
projects:
  - PROJ
`;
    mockFs.existsSync.mockImplementation((path) => {
      if (path === mockConfigDir) return true;
      if (path === mockSettingsPath) return true;
      return false;
    });
    mockFs.readFileSync.mockReturnValue(mockYaml);

    const jql = 'assignee = currentUser() ORDER BY updated DESC';
    const result = applyGlobalFilters(jql);

    // Expected behavior: (project = "PROJ") AND (assignee = currentUser()) ORDER BY updated DESC
    expect(result).toBe('(project = "PROJ") AND (assignee = currentUser()) ORDER BY updated DESC');
  });

  it('should handle JQL without ORDER BY correctly', () => {
    const mockYaml = `
projects:
  - PROJ
`;
    mockFs.existsSync.mockImplementation((path) => {
      if (path === mockConfigDir) return true;
      if (path === mockSettingsPath) return true;
      return false;
    });
    mockFs.readFileSync.mockReturnValue(mockYaml);

    const jql = 'assignee = currentUser()';
    const result = applyGlobalFilters(jql);

    expect(result).toBe('(project = "PROJ") AND (assignee = currentUser())');
  });

  it('should handle empty JQL with only ORDER BY', () => {
    const mockYaml = `
projects:
  - PROJ
`;
    mockFs.existsSync.mockImplementation((path) => {
      if (path === mockConfigDir) return true;
      if (path === mockSettingsPath) return true;
      return false;
    });
    mockFs.readFileSync.mockReturnValue(mockYaml);

    const jql = 'ORDER BY updated DESC';
    const result = applyGlobalFilters(jql);

    expect(result).toBe('(project = "PROJ") ORDER BY updated DESC');
  });
});

describe('applyGlobalFilters: globalParticipationFilter injects JQL for my-tasks preset', () => {
  const mockConfigDir = path.join(os.homedir(), '.jira-ai');
  const mockSettingsPath = path.join(mockConfigDir, 'settings.yaml');

  beforeEach(() => {
    vi.clearAllMocks();
    __resetCache__();
    mockFs.existsSync.mockImplementation((p) => p === mockConfigDir || p === mockSettingsPath);
  });

  it('should inject all participation conditions when all flags are true', () => {
    const mockYaml = `
defaults:
  allowed-jira-projects:
    - all
  allowed-commands:
    - all
  allowed-confluence-spaces:
    - all
  globalParticipationFilter:
    was_assignee: true
    was_reporter: true
    was_commenter: true
    is_watcher: true
`;
    mockFs.readFileSync.mockReturnValue(mockYaml);
    const result = applyGlobalFilters('priority = High');
    expect(result).toBe(
      '(assignee was currentUser() OR reporter = currentUser() OR issue in issueHistory() OR issue in watchedIssues()) AND (priority = High)'
    );
  });

  it('should inject only was_assignee when only that flag is true', () => {
    const mockYaml = `
defaults:
  allowed-jira-projects:
    - all
  allowed-commands:
    - all
  allowed-confluence-spaces:
    - all
  globalParticipationFilter:
    was_assignee: true
    was_reporter: false
    was_commenter: false
    is_watcher: false
`;
    mockFs.readFileSync.mockReturnValue(mockYaml);
    const result = applyGlobalFilters('priority = High');
    expect(result).toBe('(assignee was currentUser()) AND (priority = High)');
  });

  it('should preserve ORDER BY when injecting participation JQL', () => {
    const mockYaml = `
defaults:
  allowed-jira-projects:
    - all
  allowed-commands:
    - all
  allowed-confluence-spaces:
    - all
  globalParticipationFilter:
    was_assignee: true
    was_reporter: true
    was_commenter: false
    is_watcher: false
`;
    mockFs.readFileSync.mockReturnValue(mockYaml);
    const result = applyGlobalFilters('status = Open ORDER BY updated DESC');
    expect(result).toBe(
      '(assignee was currentUser() OR reporter = currentUser()) AND (status = Open) ORDER BY updated DESC'
    );
  });

  it('should wrap bare JQL (no filter) with participation clause only', () => {
    const mockYaml = `
defaults:
  allowed-jira-projects:
    - all
  allowed-commands:
    - all
  allowed-confluence-spaces:
    - all
  globalParticipationFilter:
    was_assignee: true
    was_reporter: false
    was_commenter: false
    is_watcher: false
`;
    mockFs.readFileSync.mockReturnValue(mockYaml);
    const result = applyGlobalFilters('');
    expect(result).toBe('(assignee was currentUser())');
  });

  it('should pass through JQL unchanged when allowed-jira-projects is all but no globalParticipationFilter', () => {
    const mockYaml = `
defaults:
  allowed-jira-projects:
    - all
  allowed-commands:
    - all
  allowed-confluence-spaces:
    - all
`;
    mockFs.readFileSync.mockReturnValue(mockYaml);
    const result = applyGlobalFilters('priority = High');
    expect(result).toBe('priority = High');
  });
});