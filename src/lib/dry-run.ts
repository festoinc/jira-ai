import { outputResult } from './json-mode.js';

export interface DryRunResult {
  dryRun: true;
  command: string;
  target: string;
  changes: Record<string, unknown>;
  preview: Record<string, unknown>;
  message: string;
}

export function isDryRun(): boolean {
  return process.argv.includes('--dry-run');
}

export function formatDryRunResult(
  command: string,
  target: string,
  changes: Record<string, unknown>,
  preview: Record<string, unknown> = {}
): void {
  const result: DryRunResult = {
    dryRun: true,
    command,
    target,
    changes,
    preview,
    message: 'No changes were made. Remove --dry-run to execute.',
  };
  outputResult(result);
}
