let _compactMode = false;

export function initJsonMode(): void {
  _compactMode = process.argv.includes('--json-compact') || process.argv.includes('--compact');
}

export function isJsonMode(): boolean {
  return true;
}

export function isCompactMode(): boolean {
  return _compactMode;
}

export function outputResult<T>(data: T, _formatter?: (data: T) => string): void {
  const output = _compactMode
    ? JSON.stringify(data)
    : JSON.stringify(data, null, 2);
  console.log(output);
}

export function outputError(
  message: string,
  hints: string[] = [],
  exitCode: number = 1
): void {
  console.log(JSON.stringify({ error: true, message, hints, exitCode }));
  process.exit(exitCode);
}
