import { CliError } from '../types/errors.js';

export interface CommandErrorOptions {
  exitCode?: number;
  hints?: string[];
}

export class CommandError extends CliError {
  public exitCode: number;
  public hints: string[];

  constructor(message: string, options: CommandErrorOptions = {}) {
    super(message);
    this.name = 'CommandError';
    this.exitCode = options.exitCode ?? 1;
    this.hints = options.hints ?? [];
  }
}
