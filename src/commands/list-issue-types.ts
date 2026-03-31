import { getProjectIssueTypes } from '../lib/jira-client.js';
import { isCommandAllowed, isProjectAllowed } from '../lib/settings.js';
import { CommandError } from '../lib/errors.js';
import { outputResult } from '../lib/json-mode.js';

export async function listIssueTypesCommand(projectKey: string): Promise<void> {
  // Check if project is allowed
  if (!isProjectAllowed(projectKey)) {
    throw new CommandError(`Project '${projectKey}' is not allowed by your settings.`);
  }

  // Check if command is allowed for this project
  if (!isCommandAllowed('list-issue-types', projectKey)) {
    throw new CommandError(`Command 'list-issue-types' is not allowed for project ${projectKey}.`);
  }

  const issueTypes = await getProjectIssueTypes(projectKey);
  outputResult(issueTypes);
}
