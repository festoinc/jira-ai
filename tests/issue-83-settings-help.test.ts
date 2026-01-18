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
    expect(output).toContain('SPACE1');
  });
  
  it('should NOT contain legacy top-level keys in examples', () => {
    const output = execSync('npx tsx src/cli.ts settings --help', { encoding: 'utf8' });
    
    // These should now be ABSENT from the top level of the structure section
    expect(output).not.toMatch(/^\s+projects:$/m);
    expect(output).not.toMatch(/^\s+commands:$/m);
  });
});