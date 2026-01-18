import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { authCommand, logoutCommand } from '../src/commands/auth.js';
import * as authStorage from '../src/lib/auth-storage.js';
import chalk from 'chalk';

vi.mock('../src/lib/auth-storage.js');
vi.mock('../src/lib/ui.js');

describe('logoutCommand', () => {
  let consoleLogSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('should clear credentials and show success message', async () => {
    await logoutCommand();

    expect(authStorage.clearCredentials).toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Successfully logged out from all organizations')
    );
  });
});

describe('authCommand with --logout flag', () => {
    let consoleLogSpy: any;
  
    beforeEach(() => {
      vi.clearAllMocks();
      consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });
  
    afterEach(() => {
      consoleLogSpy.mockRestore();
    });
  
    it('should call logoutCommand when --logout flag is provided', async () => {
      // We need to implement the logic in authCommand to check for logout flag
      // or handle it in cli.ts. The requirement says:
      // "Add auth logout subcommand and auth --logout flag in src/cli.ts."
      // "Implement the logic in src/commands/auth.ts."
      
      await authCommand({ logout: true } as any);
  
      expect(authStorage.clearCredentials).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Successfully logged out from all organizations')
      );
    });
});
