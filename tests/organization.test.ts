import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { listOrganizations, useOrganizationCommand, removeOrganizationCommand } from '../src/commands/organization.js';
import * as authStorage from '../src/lib/auth-storage.js';
import { CommandError } from '../src/lib/errors.js';
import chalk from 'chalk';

vi.mock('../src/lib/auth-storage.js');

describe('Organization Commands', () => {
  let consoleLogSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('listOrganizations', () => {
    it('should display message when no organizations are configured', async () => {
      vi.mocked(authStorage.getOrganizations).mockReturnValue({});

      await listOrganizations();

      expect(consoleLogSpy).toHaveBeenCalledWith(chalk.yellow('No organizations configured. Use "jira-ai auth" to add one.'));
    });

    it('should display list of organizations', async () => {
      const mockOrgs = {
        'org1': { host: 'https://org1.atlassian.net', email: 'user1@example.com', apiToken: 'token1' },
        'org2': { host: 'https://org2.atlassian.net', email: 'user2@example.com', apiToken: 'token2' }
      };
      vi.mocked(authStorage.getOrganizations).mockReturnValue(mockOrgs);
      vi.mocked(authStorage.getCurrentOrganizationAlias).mockReturnValue('org1');

      await listOrganizations();

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls.map((call: any) => call[0]).join('\n');
      expect(output).toContain('Jira Organizations:');
    });

    it('should highlight active organization', async () => {
      const mockOrgs = {
        'active-org': { host: 'https://active.atlassian.net', email: 'active@example.com', apiToken: 'token' }
      };
      vi.mocked(authStorage.getOrganizations).mockReturnValue(mockOrgs);
      vi.mocked(authStorage.getCurrentOrganizationAlias).mockReturnValue('active-org');

      await listOrganizations();

      expect(authStorage.getCurrentOrganizationAlias).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should display all organizations without active marker when no current org', async () => {
      const mockOrgs = {
        'org1': { host: 'https://org1.atlassian.net', email: 'user@example.com', apiToken: 'token' }
      };
      vi.mocked(authStorage.getOrganizations).mockReturnValue(mockOrgs);
      vi.mocked(authStorage.getCurrentOrganizationAlias).mockReturnValue(null);

      await listOrganizations();

      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('useOrganizationCommand', () => {
    it('should switch to specified organization', async () => {
      vi.mocked(authStorage.useOrganization).mockImplementation(() => {});

      await useOrganizationCommand('org1');

      expect(authStorage.useOrganization).toHaveBeenCalledWith('org1');
      expect(consoleLogSpy).toHaveBeenCalledWith(chalk.green(`Switched to organization: ${chalk.bold('org1')}`));
    });

    it('should throw CommandError when organization does not exist', async () => {
      vi.mocked(authStorage.useOrganization).mockImplementation(() => {
        throw new Error('Organization "invalid" not found');
      });

      await expect(useOrganizationCommand('invalid')).rejects.toThrow(CommandError);
      await expect(useOrganizationCommand('invalid')).rejects.toThrow('Organization "invalid" not found');
    });
  });

  describe('removeOrganizationCommand', () => {
    it('should remove organization that is not active', async () => {
      vi.mocked(authStorage.getCurrentOrganizationAlias).mockReturnValue('org1');
      vi.mocked(authStorage.removeOrganization).mockImplementation(() => {});

      await removeOrganizationCommand('org2');

      expect(authStorage.removeOrganization).toHaveBeenCalledWith('org2');
      expect(consoleLogSpy).toHaveBeenCalledWith(chalk.green(`Removed organization: ${chalk.bold('org2')}`));
    });

    it('should remove active organization and switch to another', async () => {
      vi.mocked(authStorage.getCurrentOrganizationAlias)
        .mockReturnValueOnce('org1')
        .mockReturnValueOnce('org2');
      vi.mocked(authStorage.removeOrganization).mockImplementation(() => {});

      await removeOrganizationCommand('org1');

      expect(authStorage.removeOrganization).toHaveBeenCalledWith('org1');
      expect(consoleLogSpy).toHaveBeenCalledWith(chalk.green(`Removed organization: ${chalk.bold('org1')}`));
      expect(consoleLogSpy).toHaveBeenCalledWith(chalk.yellow(`Active organization switched to: ${chalk.bold('org2')}`));
    });

    it('should display message when no more organizations after removal', async () => {
      vi.mocked(authStorage.getCurrentOrganizationAlias)
        .mockReturnValueOnce('org1')
        .mockReturnValueOnce(null);
      vi.mocked(authStorage.removeOrganization).mockImplementation(() => {});

      await removeOrganizationCommand('org1');

      expect(consoleLogSpy).toHaveBeenCalledWith(chalk.green(`Removed organization: ${chalk.bold('org1')}`));
      expect(consoleLogSpy).toHaveBeenCalledWith(chalk.yellow('No more organizations configured.'));
    });
  });
});
