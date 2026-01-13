import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Command } from 'commander';
import { configureCommandVisibility } from '../src/cli.js';
import * as authStorage from '../src/lib/auth-storage.js';
import * as settings from '../src/lib/settings.js';

vi.mock('../src/lib/auth-storage.js');
vi.mock('../src/lib/settings.js');
vi.mock('../src/lib/ui.js', () => ({
  ui: {
    addHelpText: vi.fn(),
  }
}));

describe('Dynamic Help Structure', () => {
  let program: Command;

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    program.command('auth');
    program.command('about');
    program.command('me');
    program.command('projects');
    
    // Default mock behavior
    vi.mocked(authStorage.hasCredentials).mockReturnValue(false);
    vi.mocked(settings.isCommandAllowed).mockReturnValue(true);
    vi.mocked(settings.getAllowedCommands).mockReturnValue(['all']);
    
    // Clear environment variables
    delete process.env.JIRA_HOST;
    delete process.env.JIRA_USER_EMAIL;
    delete process.env.JIRA_API_TOKEN;
  });

  it('should show only auth and about when not authorized', () => {
    vi.mocked(authStorage.hasCredentials).mockReturnValue(false);
    
    configureCommandVisibility(program);
    
    const authCmd = program.commands.find(c => c.name() === 'auth');
    const aboutCmd = program.commands.find(c => c.name() === 'about');
    const meCmd = program.commands.find(c => c.name() === 'me');
    const projectsCmd = program.commands.find(c => c.name() === 'projects');
    
    expect(authCmd?._hidden).toBe(false);
    expect(aboutCmd?._hidden).toBe(false);
    expect(meCmd?._hidden).toBe(true);
    expect(projectsCmd?._hidden).toBe(true);
  });

  it('should add "not authorized" message when not authorized', () => {
    vi.mocked(authStorage.hasCredentials).mockReturnValue(false);
    const addHelpTextSpy = vi.spyOn(program, 'addHelpText');
    
    configureCommandVisibility(program);
    
    expect(addHelpTextSpy).toHaveBeenCalledWith('after', expect.stringContaining('You are not authorized'));
  });

  it('should show allowed commands when authorized', () => {
    vi.mocked(authStorage.hasCredentials).mockReturnValue(true);
    vi.mocked(settings.isCommandAllowed).mockImplementation((name) => ['me'].includes(name) || name === 'auth' || name === 'about');
    vi.mocked(settings.getAllowedCommands).mockReturnValue(['me']);
    
    configureCommandVisibility(program);
    
    const authCmd = program.commands.find(c => c.name() === 'auth');
    const aboutCmd = program.commands.find(c => c.name() === 'about');
    const meCmd = program.commands.find(c => c.name() === 'me');
    const projectsCmd = program.commands.find(c => c.name() === 'projects');
    
    expect(authCmd?._hidden).toBe(false);
    expect(aboutCmd?._hidden).toBe(false);
    expect(meCmd?._hidden).toBe(false);
    expect(projectsCmd?._hidden).toBe(true);
  });

  it('should show all commands when authorized and commands is all', () => {
    vi.mocked(authStorage.hasCredentials).mockReturnValue(true);
    vi.mocked(settings.isCommandAllowed).mockReturnValue(true);
    vi.mocked(settings.getAllowedCommands).mockReturnValue(['all']);
    
    configureCommandVisibility(program);
    
    program.commands.forEach(cmd => {
      expect(cmd._hidden).toBe(false);
    });
  });

  it('should show authorized if environment variables are set', () => {
    process.env.JIRA_HOST = 'test.atlassian.net';
    process.env.JIRA_USER_EMAIL = 'test@example.com';
    process.env.JIRA_API_TOKEN = 'token';
    vi.mocked(authStorage.hasCredentials).mockReturnValue(false);
    
    configureCommandVisibility(program);
    
    const meCmd = program.commands.find(c => c.name() === 'me');
    expect(meCmd?._hidden).toBe(false);
  });
});
