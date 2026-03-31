import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { projectsCommand } from '../src/commands/projects.js';
import * as jiraClient from '../src/lib/jira-client.js';
import * as settings from '../src/lib/settings.js';

// Mock dependencies
vi.mock('../src/lib/jira-client.js');
vi.mock('../src/lib/settings.js');

const mockJiraClient = jiraClient as vi.Mocked<typeof jiraClient>;
const mockSettings = settings as vi.Mocked<typeof settings>;

describe('Projects Command', () => {
  const mockProjects = [
    {
      id: '1001',
      key: 'BP',
      name: 'BookingPal',
      projectTypeKey: 'software',
      lead: { displayName: 'Pavel Boiko' }
    },
    {
      id: '1002',
      key: 'PM',
      name: 'Product management',
      projectTypeKey: 'software',
      lead: { displayName: 'Anatolii Fesiuk' }
    },
    {
      id: '1003',
      key: 'PS',
      name: 'Production Support',
      projectTypeKey: 'software',
      lead: { displayName: 'Anatolii Fesiuk' }
    },
    {
      id: '1004',
      key: 'IT',
      name: 'IT Support',
      projectTypeKey: 'software',
      lead: { displayName: 'Anatolii Fesiuk' }
    },
    {
      id: '1005',
      key: 'CI',
      name: 'Channel Partner Issues',
      projectTypeKey: 'software',
      lead: { displayName: 'Pavel Boiko' }
    }
  ];

  let consoleLogSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('should display all projects when "all" is allowed', async () => {
    mockJiraClient.getProjects.mockResolvedValue(mockProjects);
    mockSettings.getAllowedProjects.mockReturnValue(['all']);

    await projectsCommand();

    expect(mockJiraClient.getProjects).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed).toHaveLength(5);
    expect(parsed[0]).toHaveProperty('key', 'BP');
  });

  it('should filter projects based on allowed list', async () => {
    mockJiraClient.getProjects.mockResolvedValue(mockProjects);
    mockSettings.getAllowedProjects.mockReturnValue(['BP', 'PM', 'PS']);
    mockSettings.isProjectAllowed.mockImplementation((key: string) =>
      ['BP', 'PM', 'PS'].includes(key)
    );

    await projectsCommand();

    const output = consoleLogSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed).toHaveLength(3);
    expect(parsed.map((p: any) => p.key)).toContain('BP');
    expect(parsed.map((p: any) => p.key)).toContain('PM');
    expect(parsed.map((p: any) => p.key)).toContain('PS');
  });

  it('should display only allowed projects (BP, PM)', async () => {
    mockJiraClient.getProjects.mockResolvedValue(mockProjects);
    mockSettings.getAllowedProjects.mockReturnValue(['BP', 'PM']);
    mockSettings.isProjectAllowed.mockImplementation((key: string) =>
      ['BP', 'PM'].includes(key)
    );

    await projectsCommand();

    const output = consoleLogSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toHaveProperty('key', 'BP');
    expect(parsed[1]).toHaveProperty('key', 'PM');
  });

  it('should show warning when no projects match settings', async () => {
    mockJiraClient.getProjects.mockResolvedValue(mockProjects);
    mockSettings.getAllowedProjects.mockReturnValue(['XYZ', 'ABC']);
    mockSettings.isProjectAllowed.mockReturnValue(false);

    await projectsCommand();

    // Returns empty array as JSON
    const output = consoleLogSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(0);
  });

  it('should handle API errors gracefully', async () => {
    const mockError = new Error('API connection failed');
    mockJiraClient.getProjects.mockRejectedValue(mockError);

    await expect(projectsCommand()).rejects.toThrow('API connection failed');
  });

  it('should filter out projects not in the allowed list', async () => {
    const allProjects = [
      {
        id: '1001',
        key: 'BP',
        name: 'BookingPal',
        projectTypeKey: 'software',
        lead: { displayName: 'Pavel Boiko' }
      },
      {
        id: '1004',
        key: 'IT',
        name: 'IT Support',
        projectTypeKey: 'software',
        lead: { displayName: 'Anatolii Fesiuk' }
      },
      {
        id: '1002',
        key: 'PM',
        name: 'Product management',
        projectTypeKey: 'software',
        lead: { displayName: 'Anatolii Fesiuk' }
      },
      {
        id: '1005',
        key: 'CI',
        name: 'Channel Partner Issues',
        projectTypeKey: 'software',
        lead: { displayName: 'Pavel Boiko' }
      },
      {
        id: '1003',
        key: 'PS',
        name: 'Production Support',
        projectTypeKey: 'software',
        lead: { displayName: 'Anatolii Fesiuk' }
      }
    ];

    mockJiraClient.getProjects.mockResolvedValue(allProjects);
    mockSettings.getAllowedProjects.mockReturnValue(['BP', 'PM', 'PS']);
    mockSettings.isProjectAllowed.mockImplementation((key: string) =>
      ['BP', 'PM', 'PS'].includes(key)
    );

    await projectsCommand();

    const output = consoleLogSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed).toHaveLength(3);
    expect(parsed.map((p: any) => p.key)).toEqual(['BP', 'PM', 'PS']);
  });
});
