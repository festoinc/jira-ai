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