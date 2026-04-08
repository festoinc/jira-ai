import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import * as settingsMod from '../src/lib/settings.js';
import * as jiraClient from '../src/lib/jira-client.js';
import { runJqlCommand } from '../src/commands/run-jql.js';

vi.mock('../src/lib/jira-client.js');
vi.mock('fs');

const mockFs = fs as vi.Mocked<typeof fs>;
const mockConfigDir = path.join(os.homedir(), '.jira-ai');
const mockSettingsPath = path.join(mockConfigDir, 'settings.yaml');

function setupFsWithYaml(yaml: string) {
  mockFs.existsSync.mockImplementation((p) => {
    if (p === mockConfigDir) return true;
    if (p === mockSettingsPath) return true;
    return false;
  });
  mockFs.readFileSync.mockReturnValue(yaml);
}

describe('getSavedQuery()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settingsMod.__resetCache__();
  });

  afterEach(() => {
    settingsMod.__resetCache__();
  });

  it('returns the JQL for an existing query name', () => {
    setupFsWithYaml(`
savedQueries:
  production-bugs: "project = PS AND type = Bug AND status != Done"
`);
    expect(settingsMod.getSavedQuery('production-bugs')).toBe('project = PS AND type = Bug AND status != Done');
  });

  it('returns undefined for unknown query name', () => {
    setupFsWithYaml(`
savedQueries:
  production-bugs: "project = PS AND type = Bug"
`);
    expect(settingsMod.getSavedQuery('unknown-query')).toBeUndefined();
  });

  it('returns undefined when no savedQueries in settings', () => {
    setupFsWithYaml(`
defaults:
  allowed-jira-projects:
    - all
  allowed-commands:
    - issue
`);
    expect(settingsMod.getSavedQuery('production-bugs')).toBeUndefined();
  });
});

describe('listSavedQueries()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settingsMod.__resetCache__();
  });

  afterEach(() => {
    settingsMod.__resetCache__();
  });

  it('returns array of {name, jql} objects when saved queries exist', () => {
    setupFsWithYaml(`
savedQueries:
  production-bugs: "project = PS AND type = Bug AND status != Done"
  my-open-tasks: "assignee = currentUser() AND status != Done"
`);
    const result = settingsMod.listSavedQueries();
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ name: 'production-bugs', jql: 'project = PS AND type = Bug AND status != Done' });
    expect(result).toContainEqual({ name: 'my-open-tasks', jql: 'assignee = currentUser() AND status != Done' });
  });

  it('returns empty array when no savedQueries defined', () => {
    setupFsWithYaml(`
defaults:
  allowed-jira-projects:
    - all
`);
    expect(settingsMod.listSavedQueries()).toEqual([]);
  });
});

describe('runJqlCommand with --query option', () => {
  let consoleLogSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    settingsMod.__resetCache__();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    vi.restoreAllMocks();
    settingsMod.__resetCache__();
  });

  it('resolves saved query name and executes JQL with global filters', async () => {
    const mockIssues = [{ key: 'PS-1', fields: { summary: 'Bug 1' } }];
    vi.mocked(jiraClient.searchIssuesByJql).mockResolvedValue(mockIssues);
    vi.spyOn(settingsMod, 'getSavedQuery').mockReturnValue('project = PS AND type = Bug AND status != Done');
    vi.spyOn(settingsMod, 'applyGlobalFilters').mockImplementation((jql) => jql);

    await runJqlCommand('', { query: 'production-bugs' });

    expect(jiraClient.searchIssuesByJql).toHaveBeenCalledWith(
      'project = PS AND type = Bug AND status != Done',
      50
    );
  });

  it('applies applyGlobalFilters to saved query JQL', async () => {
    const mockIssues: any[] = [];
    vi.mocked(jiraClient.searchIssuesByJql).mockResolvedValue(mockIssues);
    vi.spyOn(settingsMod, 'getSavedQuery').mockReturnValue('type = Bug');
    vi.spyOn(settingsMod, 'applyGlobalFilters').mockReturnValue('(project = "PS") AND (type = Bug)');

    await runJqlCommand('', { query: 'my-bugs' });

    expect(settingsMod.applyGlobalFilters).toHaveBeenCalledWith('type = Bug');
    expect(jiraClient.searchIssuesByJql).toHaveBeenCalledWith(
      '(project = "PS") AND (type = Bug)',
      50
    );
  });

  it('throws error when query name not found', async () => {
    vi.spyOn(settingsMod, 'getSavedQuery').mockReturnValue(undefined);
    vi.spyOn(settingsMod, 'listSavedQueries').mockReturnValue([
      { name: 'production-bugs', jql: 'project = PS AND type = Bug' },
    ]);

    await expect(runJqlCommand('', { query: 'unknown-query' })).rejects.toThrow(
      "Saved query 'unknown-query' not found. Available: production-bugs"
    );
  });

  it('throws error when both positional JQL and --query are provided', async () => {
    await expect(
      runJqlCommand('project = TEST', { query: 'production-bugs' })
    ).rejects.toThrow('Cannot specify both JQL query and --query. Use one or the other.');
  });
});

describe('runJqlCommand with --list-queries option', () => {
  let consoleLogSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    settingsMod.__resetCache__();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    vi.restoreAllMocks();
    settingsMod.__resetCache__();
  });

  it('returns JSON list of saved queries', async () => {
    vi.spyOn(settingsMod, 'listSavedQueries').mockReturnValue([
      { name: 'production-bugs', jql: 'project = PS AND type = Bug AND status != Done' },
      { name: 'my-open-tasks', jql: 'assignee = currentUser() AND status != Done' },
    ]);

    await runJqlCommand('', { listQueries: true });

    expect(consoleLogSpy).toHaveBeenCalled();
    const parsed = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(parsed).toHaveProperty('queries');
    expect(parsed.queries).toHaveLength(2);
    expect(parsed.queries[0]).toEqual({
      name: 'production-bugs',
      jql: 'project = PS AND type = Bug AND status != Done',
    });
  });

  it('returns empty queries list when no saved queries defined', async () => {
    vi.spyOn(settingsMod, 'listSavedQueries').mockReturnValue([]);

    await runJqlCommand('', { listQueries: true });

    const parsed = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(parsed).toEqual({ queries: [] });
  });
});

describe('saved queries — SettingsSchema validation', () => {
  it('validates correct query name format', async () => {
    const { SettingsSchema } = await import('../src/lib/validation.js');

    const result = SettingsSchema.safeParse({
      savedQueries: {
        'production-bugs': 'project = PS AND type = Bug',
        'my-tasks': 'assignee = currentUser()',
        'a': 'project = A',
      },
    });

    expect(result.success).toBe(true);
  });

  it('rejects uppercase in query name', async () => {
    const { SettingsSchema } = await import('../src/lib/validation.js');

    const result = SettingsSchema.safeParse({
      savedQueries: { 'Invalid-Name': 'project = PS' },
    });

    expect(result.success).toBe(false);
  });

  it('rejects query name with leading hyphen', async () => {
    const { SettingsSchema } = await import('../src/lib/validation.js');

    const result = SettingsSchema.safeParse({
      savedQueries: { '-invalid': 'project = PS' },
    });

    expect(result.success).toBe(false);
  });

  it('rejects query name with trailing hyphen', async () => {
    const { SettingsSchema } = await import('../src/lib/validation.js');

    const result = SettingsSchema.safeParse({
      savedQueries: { 'invalid-': 'project = PS' },
    });

    expect(result.success).toBe(false);
  });

  it('rejects empty JQL string', async () => {
    const { SettingsSchema } = await import('../src/lib/validation.js');

    const result = SettingsSchema.safeParse({
      savedQueries: { 'valid-name': '' },
    });

    expect(result.success).toBe(false);
  });

  it('accepts settings without savedQueries (field is optional)', async () => {
    const { SettingsSchema } = await import('../src/lib/validation.js');

    const result = SettingsSchema.safeParse({
      defaults: {
        'allowed-jira-projects': ['all'],
        'allowed-commands': ['issue'],
        'allowed-confluence-spaces': ['all'],
      },
    });

    expect(result.success).toBe(true);
  });
});
