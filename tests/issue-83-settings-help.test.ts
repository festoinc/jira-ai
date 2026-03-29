import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';

describe('Settings Help Text (Integration)', () => {
  it('should contain the defaults and confluence examples', () => {
    const output = execSync('npx tsx src/cli.ts settings --help', { encoding: 'utf8' });

    expect(output).toContain('defaults:');
    expect(output).toContain('allowed-confluence-spaces:');
    expect(output).not.toContain('organizations:');
  });

  it('should contain hierarchical command examples', () => {
    const output = execSync('npx tsx src/cli.ts settings --help', { encoding: 'utf8' });

    expect(output).toContain('Command Groups');
    expect(output).toContain('issue.get');
    expect(output).toContain('issue.label');
    expect(output).toContain('project.list');
    expect(output).toContain('user.me');
  });
});
