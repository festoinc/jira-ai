import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';

describe('Settings Help Text (Integration)', () => {
  it('should contain the new organizations and confluence examples', () => {
    const output = execSync('npx tsx src/cli.ts settings --help', { encoding: 'utf8' });

    // Check for new sections
    expect(output).toContain('defaults:');
    expect(output).toContain('allowed-confluence-spaces:');
    expect(output).toContain('organizations:');
    expect(output).toContain('work:');
    expect(output).toContain('DOCS');  // Updated from SPACE1
  });

  it('should contain hierarchical command examples', () => {
    const output = execSync('npx tsx src/cli.ts settings --help', { encoding: 'utf8' });

    // Check for new hierarchical command structure documentation
    expect(output).toContain('Command Groups');
    expect(output).toContain('issue.get');
    expect(output).toContain('issue.label');
    expect(output).toContain('project.list');
    expect(output).toContain('user.me');
  });
});