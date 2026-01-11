# Test Suite Documentation

## Overview

This test suite provides comprehensive coverage for the Jira CLI settings and permissions system.

## Test Files

### 1. `settings.test.ts` (16 tests)
Tests the core settings module functionality:
- **Loading settings**: Reading and parsing settings.yaml
- **Project filtering**: Testing project allow/deny lists
- **Command filtering**: Testing command permissions
- **Caching**: Ensuring settings are cached properly
- **Error handling**: Invalid YAML, missing files

**Coverage**: 100% of settings.ts module

### 2. `projects.test.ts` (6 tests)
Tests the projects command with filtering:
- Displaying all projects when "all" is allowed
- Filtering projects based on settings.yaml
- Handling empty results
- API error handling

**Coverage**: 100% of projects.ts command

### 3. `cli-permissions.test.ts` (9 tests)
Tests the CLI permission wrapper:
- Command allow/deny logic
- Permission enforcement at CLI level
- Error messages for blocked commands
- Integration scenarios

**Total: 31 tests passing**

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests with verbose output
npm run test:verbose
```

## Test Coverage

Current coverage for tested modules:
- `src/lib/settings.ts`: 100%
- `src/commands/projects.ts`: 100%

## Key Test Scenarios Covered

### Settings Module
✓ Load settings from YAML file
✓ Default to "all" when file doesn't exist
✓ Handle null/undefined values
✓ Exit on invalid YAML
✓ Project allow/deny filtering
✓ Command allow/deny filtering
✓ Case-sensitive project matching
✓ Settings caching

### Projects Command
✓ Show all projects when "all" allowed
✓ Filter to specific projects (BP, PM, PS)
✓ Show warning for no matches
✓ Handle API errors gracefully

### CLI Permissions
✓ Allow/deny command execution
✓ Display helpful error messages
✓ Support "all" wildcard
✓ Pass arguments to allowed commands

## Mock Strategy

The test suite uses Jest mocks for:
- **fs module**: Mocked to test file I/O without actual files
- **jira.js**: Mocked to avoid ES module issues
- **ora, chalk**: Mocked to test CLI output
- **console**: Spied to verify error/warning messages

## Future Test Coverage

Potential areas to expand testing:
- Other command modules (me, task-with-details, project-statuses)
- Formatters
- Jira client integration tests
- End-to-end CLI tests
