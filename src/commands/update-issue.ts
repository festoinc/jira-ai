import * as fs from 'fs';
import * as path from 'path';
import { markdownToAdf } from 'marklassian';
import { updateIssue, validateIssuePermissions, resolveUserByName } from '../lib/jira-client.js';
import { CommandError } from '../lib/errors.js';
import { validateOptions, UpdateIssueSchema, IssueKeySchema } from '../lib/validation.js';
import { isCommandAllowed, isProjectAllowed } from '../lib/settings.js';
import { outputResult } from '../lib/json-mode.js';

export async function updateIssueCommand(
  issueKey: string,
  options: {
    priority?: string;
    summary?: string;
    description?: string;
    fromFile?: string;
    labels?: string;
    clearLabels?: boolean;
    component?: string;
    fixVersion?: string;
    dueDate?: string;
    assignee?: string;
    customField?: string[];
  }
): Promise<void> {
  validateOptions(IssueKeySchema, issueKey);
  validateOptions(UpdateIssueSchema, options);

  const projectKey = issueKey.split('-')[0];

  if (!isProjectAllowed(projectKey)) {
    throw new CommandError(`Project '${projectKey}' is not allowed by your settings.`);
  }

  if (!isCommandAllowed('update-issue', projectKey)) {
    throw new CommandError(`Command 'update-issue' is not allowed for project ${projectKey}.`);
  }

  await validateIssuePermissions(issueKey, 'update-issue');

  const fields: Record<string, any> = {};

  if (options.priority !== undefined) {
    if (!options.priority) throw new CommandError('Priority value cannot be empty');
    fields.priority = { name: options.priority };
  }

  if (options.summary !== undefined) {
    fields.summary = options.summary;
  }

  if (options.description !== undefined) {
    fields.description = markdownToAdf(options.description);
  } else if (options.fromFile !== undefined) {
    const absPath = path.resolve(options.fromFile);
    let content: string;
    try {
      content = fs.readFileSync(absPath, 'utf-8');
    } catch (err: any) {
      throw new CommandError(`Error reading file: ${err.message}`);
    }
    fields.description = markdownToAdf(content);
  }

  if (options.clearLabels) {
    fields.labels = [];
  } else if (options.labels !== undefined) {
    fields.labels = options.labels.split(',').map(l => l.trim()).filter(Boolean);
  }

  if (options.component !== undefined) {
    fields.components = options.component.split(',').map(n => ({ name: n.trim() })).filter(c => c.name);
  }

  if (options.fixVersion !== undefined) {
    fields.fixVersions = options.fixVersion.split(',').map(n => ({ name: n.trim() })).filter(v => v.name);
  }

  if (options.dueDate !== undefined) {
    fields.duedate = options.dueDate;
  }

  if (options.assignee !== undefined) {
    if (options.assignee.startsWith('accountid:')) {
      fields.assignee = { accountId: options.assignee.slice('accountid:'.length) };
    } else {
      const accountId = await resolveUserByName(options.assignee);
      if (!accountId) {
        throw new CommandError(`Could not resolve user: ${options.assignee}`, {
          hints: ['Use "accountid:<id>" format or check the display name.'],
        });
      }
      fields.assignee = { accountId };
    }
  }

  if (options.customField) {
    for (const cf of options.customField) {
      const eqIdx = cf.indexOf('=');
      if (eqIdx === -1) {
        throw new CommandError(`Invalid custom field format: "${cf}". Use fieldId=value.`);
      }
      const fieldId = cf.slice(0, eqIdx);
      const rawValue = cf.slice(eqIdx + 1);
      const numValue = Number(rawValue);
      fields[fieldId] = isNaN(numValue) ? rawValue : numValue;
    }
  }

  try {
    await updateIssue(issueKey, fields);
    outputResult({ success: true, issueKey });
  } catch (error: any) {
    if (error instanceof CommandError) throw error;

    const errorMsg = error.message?.toLowerCase() || '';
    const hints: string[] = [];

    if (errorMsg.includes('404')) {
      hints.push('Check that the issue key is correct');
    } else if (errorMsg.includes('403')) {
      hints.push('You may not have permission to edit this issue');
    }

    throw new CommandError(error.message, { hints });
  }
}
