
import { describe, it, expect } from 'vitest';
import { exec } from 'child_process';
import path from 'path';

describe('CLI Dotenv Output', () => {
  it('should not print dotenv banner', async () => {
    return new Promise<void>((resolve, reject) => {
      const cliPath = path.resolve(__dirname, '../src/cli.ts');
      // Using npx tsx to run the TS file directly
      exec(`npx tsx ${cliPath} --help`, { cwd: path.resolve(__dirname, '..') }, (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }
        
        // Combine stdout and stderr just in case
        const output = stdout + stderr;
        
        // We expect NOT to see the dotenv banner
        // banner usually looks like: [dotenv@17.2.3] injecting env (0) from .env
        expect(output).not.toMatch(/\[dotenv@.*\] injecting env/);
        
        resolve();
      });
    }, 10000); // increase timeout as npx tsx might be slow
  });
});
