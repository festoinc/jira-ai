import chalk from 'chalk';

let _jsonMode = false;
let _compactMode = false;

export function initJsonMode(): void {
  _jsonMode = process.argv.includes('--json') || process.argv.includes('--json-compact');
  _compactMode = process.argv.includes('--json-compact');
}

export function isJsonMode(): boolean {
  return _jsonMode;
}

export function isCompactMode(): boolean {
  return _compactMode;
}

export function outputResult<T>(data: T, formatter?: (data: T) => string): void {
  if (_jsonMode) {
    const output = _compactMode
      ? JSON.stringify(data)
      : JSON.stringify(data, null, 2);
    console.log(output);
  } else {
    if (formatter) {
      console.log(formatter(data));
    } else if (typeof data === 'object' && data !== null) {
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log(data);
    }
  }
}

export function outputError(
  message: string,
  hints: string[] = [],
  exitCode: number = 1
): void {
  if (_jsonMode) {
    console.log(JSON.stringify({ error: true, message, hints, exitCode }));
    process.exit(exitCode);
  } else {
    console.error(chalk.red(`\n❌ Error: ${message}`));
    hints.forEach(hint => {
      console.error(chalk.yellow(`   Hint: ${hint}`));
    });
    process.exit(exitCode);
  }
}
