import * as fs from 'fs';
import * as path from 'path';
import { markdownToAdf } from 'marklassian';
import { createIssue, resolveUserByName } from '../lib/jira-client.js';
import { CommandError } from '../lib/errors.js';
import { validateOptions, CreateTaskSchema } from '../lib/validation.js';
import { isCommandAllowed, isProjectAllowed } from '../lib/settings.js';
import { outputResult } from '../lib/json-mode.js';

export async function createTaskCommand(
  options: {
    title: string;
    project: string;
    issueType: string;
    parent?: string;
    priority?: string;
    description?: string;
    descriptionFile?: string;
    labels?: string;
    component?: string;
    fixVersion?: string;
    dueDate?: string;
    assignee?: string;
    customField?: string[];
  }
): Promise<void> {
  validateOptions(CreateTaskSchema, options);

  const { title, project, issueType, parent, priority, description, descriptionFile, labels, component, fixVersion, dueDate, assignee, customField } = options;

  if (!isProjectAllowed(project)) {
    throw new CommandError(`Project '${project}' is not allowed by your settings.`);
  }

  if (!isCommandAllowed('create-task', project)) {
    throw new CommandError(`Command 'create-task' is not allowed for project ${project}.`);
  }

  // Build issue fields
  const issueFields: Record<string, any> = {};

  if (priority) {
    issueFields.priority = { name: priority };
  }

  if (description && descriptionFile) {
    throw new CommandError('Cannot use both --description and --description-file at the same time');
  }

  if (description) {
    issueFields.description = markdownToAdf(description);
  } else if (descriptionFile) {
    const absPath = path.resolve(descriptionFile);
    try {
      const content = fs.readFileSync(absPath, 'utf-8');
      issueFields.description = markdownToAdf(content);
    } catch (err: any) {
      throw new CommandError(`Error reading description file: ${err.message}`);
    }
  }

  if (labels) {
    issueFields.labels = labels.split(',').map(l => l.trim()).filter(Boolean);
  }

  if (component) {
    issueFields.components = component.split(',').map(n => ({ name: n.trim() })).filter(c => c.name);
  }

  if (fixVersion) {
    issueFields.fixVersions = fixVersion.split(',').map(n => ({ name: n.trim() })).filter(v => v.name);
  }

  if (dueDate) {
    issueFields.duedate = dueDate;
  }

  if (assignee) {
    if (assignee.startsWith('accountid:')) {
      issueFields.assignee = { accountId: assignee.slice('accountid:'.length) };
    } else {
      const accountId = await resolveUserByName(assignee);
      if (!accountId) {
        throw new CommandError(`Could not resolve user: ${assignee}`, {
          hints: ['Use "accountid:<id>" format or check the display name.'],
        });
      }
      issueFields.assignee = { accountId };
    }
  }

  if (customField) {
    for (const cf of customField) {
      const eqIdx = cf.indexOf('=');
      if (eqIdx === -1) {
        throw new CommandError(`Invalid custom field format: "${cf}". Use fieldId=value.`);
      }
      const fieldId = cf.slice(0, eqIdx);
      const rawValue = cf.slice(eqIdx + 1);
      const numValue = Number(rawValue);
      issueFields[fieldId] = isNaN(numValue) ? rawValue : numValue;
    }
  }

  try {
    const result = await createIssue({
      project,
      summary: title,
      issueType,
      parent,
      ...issueFields,
    });

    outputResult({ key: result.key, title, project, issueType, parent });
  } catch (error: any) {
    const errorMsg = error.message?.toLowerCase() || '';
    const hints: string[] = [];

    if (errorMsg.includes('project')) {
      hints.push('Check that the project key is correct', 'Use "jira-ai projects" to see available projects');
    } else if (errorMsg.includes('issue type') || errorMsg.includes('issuetype')) {
      hints.push('Check that the issue type is correct', `Use "jira-ai list-issue-types ${project}" to see available issue types`);
    } else if (errorMsg.includes('parent')) {
      hints.push('Check that the parent issue key is correct', 'Parent issues are required for subtasks');
    } else if (errorMsg.includes('403')) {
      hints.push('You may not have permission to create issues in this project');
    }

    throw new CommandError(`Failed to create issue: ${error.message}`, { hints });
  }
}
