import { vi, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, test } from 'vitest';
import { projectsCommand } from '../src/commands/projects.js';
import * as jiraClient from '../src/lib/jira-client.js';
import * as settings from '../src/lib/settings.js';
import * as formatters from '../src/lib/formatters.js';

// Mock dependencies
vi.mock('../src/lib/jira-client.js');
vi.mock('../src/lib/settings.js');
vi.mock('../src/lib/formatters.js');
vi.mock('ora', () => {
  return {
    default: vi.fn(() => ({
      start: vi.fn().mockReturnThis(),
      succeed: vi.fn().mockReturnThis(),
      fail: vi.fn().mockReturnThis(),
    })),
  };
});

const mockJiraClient = jiraClient as vi.Mocked<typeof jiraClient>;
const mockSettings = settings as vi.Mocked<typeof settings>;
const mockFormatters = formatters as vi.Mocked<typeof formatters>;

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

  beforeEach(() => {
    vi.clearAllMocks();
    console.log = vi.fn();
    console.error = vi.fn();
  });

  it('should display all projects when "all" is allowed', async () => {
    mockJiraClient.getProjects.mockResolvedValue(mockProjects);
    mockSettings.getAllowedProjects.mockReturnValue(['all']);
    mockFormatters.formatProjects.mockReturnValue('Formatted projects');

    await projectsCommand();

    expect(mockJiraClient.getProjects).toHaveBeenCalled();
    expect(mockFormatters.formatProjects).toHaveBeenCalledWith(mockProjects);
    expect(console.log).toHaveBeenCalledWith('Formatted projects');
  });

  it('should filter projects based on allowed list', async () => {
    mockJiraClient.getProjects.mockResolvedValue(mockProjects);
    mockSettings.getAllowedProjects.mockReturnValue(['BP', 'PM', 'PS']);
    mockSettings.isProjectAllowed.mockImplementation((key: string) =>
      ['BP', 'PM', 'PS'].includes(key)
    );
    mockFormatters.formatProjects.mockReturnValue('Filtered projects');

    await projectsCommand();

    const filteredProjects = mockProjects.filter(p => ['BP', 'PM', 'PS'].includes(p.key));
    expect(mockFormatters.formatProjects).toHaveBeenCalledWith(filteredProjects);
    expect(console.log).toHaveBeenCalledWith('Filtered projects');
  });

  it('should display only allowed projects (BP, PM)', async () => {
    mockJiraClient.getProjects.mockResolvedValue(mockProjects);
    mockSettings.getAllowedProjects.mockReturnValue(['BP', 'PM']);
    mockSettings.isProjectAllowed.mockImplementation((key: string) =>
      ['BP', 'PM'].includes(key)
    );
    mockFormatters.formatProjects.mockReturnValue('BP and PM projects');

    await projectsCommand();

    const expectedProjects = [
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
      }
    ];
    expect(mockFormatters.formatProjects).toHaveBeenCalledWith(expectedProjects);
  });

  it('should show warning when no projects match settings', async () => {
    mockJiraClient.getProjects.mockResolvedValue(mockProjects);
    mockSettings.getAllowedProjects.mockReturnValue(['XYZ', 'ABC']);
    mockSettings.isProjectAllowed.mockReturnValue(false);

    await projectsCommand();

    expect(mockFormatters.formatProjects).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('No projects match'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('XYZ, ABC'));
  });

  it('should handle API errors gracefully', async () => {
    const mockError = new Error('API connection failed');
    mockJiraClient.getProjects.mockRejectedValue(mockError);
    const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('Process exit');
    });

    await expect(projectsCommand()).rejects.toThrow('Process exit');
    expect(console.error).toHaveBeenCalled();
    expect(processExitSpy).toHaveBeenCalledWith(1);

    processExitSpy.mockRestore();
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
    mockFormatters.formatProjects.mockImplementation((projects) =>
      `Showing ${projects.length} projects`
    );

    await projectsCommand();

    expect(mockFormatters.formatProjects).toHaveBeenCalledTimes(1);
    const calledWith = mockFormatters.formatProjects.mock.calls[0][0];
    expect(calledWith).toHaveLength(3);
    expect(calledWith.map(p => p.key)).toEqual(['BP', 'PM', 'PS']);
    expect(console.log).toHaveBeenCalledWith('Showing 3 projects');
  });
});
