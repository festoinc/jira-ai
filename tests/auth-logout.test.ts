import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { authCommand, logoutCommand } from '../src/commands/auth.js';
import * as authStorage from '../src/lib/auth-storage.js';

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

  it('should clear credentials and show success message without "all organizations"', async () => {
    await logoutCommand();

    expect(authStorage.clearCredentials).toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Successfully logged out. Authentication credentials cleared.')
    );
    expect(consoleLogSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('from all organizations')
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
      await authCommand({ logout: true } as any);

      expect(authStorage.clearCredentials).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Successfully logged out. Authentication credentials cleared.')
      );
    });
});
