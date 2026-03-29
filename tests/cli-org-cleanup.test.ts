import { vi, describe, it, expect } from 'vitest';

vi.mock('../src/lib/auth-storage.js');
vi.mock('../src/lib/settings.js');
vi.mock('../src/lib/ui.js', () => ({
  ui: { startSpinner: vi.fn(), succeedSpinner: vi.fn(), failSpinner: vi.fn() }
}));
vi.mock('../src/lib/update-check.js', () => ({
  checkForUpdate: vi.fn().mockResolvedValue(null),
  checkForUpdateSync: vi.fn().mockReturnValue(null),
  formatUpdateMessage: vi.fn().mockReturnValue(''),
}));
vi.mock('../src/lib/utils.js', () => ({
  validateEnvVars: vi.fn(),
  getVersion: vi.fn().mockReturnValue('1.0.0'),
}));

describe('CLI auth command - multi-org cleanup', () => {
  it('auth --logout option description should say "Logout from Jira" not "from all organizations"', async () => {
    const { program } = await import('../src/cli.js');
    const authCmd = program.commands.find(c => c.name() === 'auth');
    const logoutOption = authCmd?.options.find(o => o.long === '--logout');

    expect(logoutOption).toBeDefined();
    expect(logoutOption?.description).not.toContain('all organizations');
    expect(logoutOption?.description).toContain('Logout from Jira');
  });

  it('auth logout subcommand description should say "Logout from Jira" not "from all organizations"', async () => {
    const { program } = await import('../src/cli.js');
    const authCmd = program.commands.find(c => c.name() === 'auth');
    const logoutCmd = authCmd?.commands.find(c => c.name() === 'logout');

    expect(logoutCmd).toBeDefined();
    expect(logoutCmd?.description()).not.toContain('all organizations');
    expect(logoutCmd?.description()).toContain('Logout from Jira');
  });
});
