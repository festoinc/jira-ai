import * as fs from 'fs';
import { getIssueTransitions, transitionIssue, validateIssuePermissions, resolveUserByName, TransitionPayload } from '../lib/jira-client.js';
import { CommandError } from '../lib/errors.js';
import { outputResult } from '../lib/json-mode.js';
import { markdownToAdf } from 'marklassian';
import { FieldResolver } from '../lib/field-resolver.js';
import { processMentionsInADF } from '../lib/adf-mentions.js';
import { isDryRun, formatDryRunResult } from '../lib/dry-run.js';

export interface TransitionOptions {
  resolution?: string;
  comment?: string;
  commentFile?: string;
  assignee?: string;
  fixVersion?: string;
  customFields?: string[];
}

export interface ListTransitionsOptions {
  requiredOnly?: boolean;
}

export async function transitionCommand(
  taskId: string,
  toStatus: string,
  options?: TransitionOptions
): Promise<void> {
  // Validate mutual exclusivity of --comment and --comment-file
  if (options?.comment && options?.commentFile) {
    throw new CommandError('Cannot use both --comment and --comment-file flags simultaneously.');
  }

  // Check permissions and filters
  const currentIssue = await validateIssuePermissions(taskId, 'transition');

  try {
    const transitions = await getIssueTransitions(taskId);

    const matchingTransitions = transitions.filter(
      (t) => t.to.name.toLowerCase() === toStatus.toLowerCase()
    );

    if (matchingTransitions.length === 0) {
      const availableStatuses = Array.from(new Set(transitions.map((t) => t.to.name))).join(', ');
      throw new CommandError(
        `No transition found to status "${toStatus}" for issue ${taskId}.`,
        {
          hints: [
            `Available destination statuses: ${availableStatuses || 'None'}`,
            'Check the status name and try again (it is case-insensitive).'
          ]
        }
      );
    }

    if (matchingTransitions.length > 1) {
      const availableTransitions = matchingTransitions.map(t => `"${t.name}" (ID: ${t.id})`).join(', ');
      throw new CommandError(
        `Multiple transitions found to status "${toStatus}" for issue ${taskId}.`,
        {
          hints: [
            `Ambiguous matches: ${availableTransitions}`,
            'This command currently only supports unambiguous status matching.'
          ]
        }
      );
    }

    const transition = matchingTransitions[0];

    if (isDryRun()) {
      const changes: Record<string, unknown> = {
        status: {
          from: (currentIssue as any)?.status?.name,
          to: transition.to.name,
        },
      };
      if (options?.resolution !== undefined) {
        changes.resolution = { to: options.resolution };
      }
      if (options?.assignee !== undefined) {
        changes.assignee = { to: options.assignee };
      }
      if (options?.fixVersion !== undefined) {
        changes.fixVersions = { to: options.fixVersion };
      }
      if (options?.customFields && options.customFields.length > 0) {
        for (const entry of options.customFields) {
          const eqIdx = entry.indexOf('=');
          if (eqIdx === -1) continue;
          const fieldId = entry.slice(0, eqIdx).trim();
          const value = entry.slice(eqIdx + 1).trim();
          changes[fieldId] = { to: value };
        }
      }
      formatDryRunResult('issue.transition', taskId, changes);
      return;
    }

    // Build optional payload if any options were provided
    let payload: TransitionPayload | undefined;
    if (options && Object.keys(options).some(k => (options as any)[k] !== undefined)) {
      const fields: Record<string, any> = {};
      const update: Record<string, any> = {};

      if (options.resolution) {
        fields['resolution'] = { name: options.resolution };
      }

      if (options.comment) {
        let adf = markdownToAdf(options.comment);
        adf = await processMentionsInADF(adf, resolveUserByName);
        update['comment'] = [{ add: { body: adf } }];
      } else if (options.commentFile) {
        const content = fs.readFileSync(options.commentFile, 'utf-8');
        let adf = markdownToAdf(content);
        adf = await processMentionsInADF(adf, resolveUserByName);
        update['comment'] = [{ add: { body: adf } }];
      }

      if (options.assignee) {
        if (options.assignee.startsWith('accountid:')) {
          fields['assignee'] = { accountId: options.assignee.slice('accountid:'.length) };
        } else {
          const accountId = await resolveUserByName(options.assignee);
          if (!accountId) {
            throw new CommandError(`Could not resolve user: "${options.assignee}". Check the display name and try again.`);
          }
          fields['assignee'] = { accountId };
        }
      }

      if (options.fixVersion) {
        fields['fixVersions'] = options.fixVersion.split(',').map((v: string) => ({ name: v.trim() }));
      }

      if (options.customFields && options.customFields.length > 0) {
        const resolver = new FieldResolver();
        for (const entry of options.customFields) {
          const eqIdx = entry.indexOf('=');
          if (eqIdx === -1) continue;
          const fieldId = entry.slice(0, eqIdx).trim();
          const value = entry.slice(eqIdx + 1).trim();
          try {
            fields[fieldId] = await resolver.coerceValue(fieldId, value);
          } catch {
            // Fall back to raw string if field schema is not accessible
            fields[fieldId] = value;
          }
        }
      }

      payload = {
        ...(Object.keys(fields).length > 0 && { fields }),
        ...(Object.keys(update).length > 0 && { update }),
      };
      if (Object.keys(payload).length === 0) payload = undefined;
    }

    await transitionIssue(taskId, transition.id, payload);
    outputResult({ success: true, issueKey: taskId, status: transition.to.name });
  } catch (error: any) {
    if (error instanceof CommandError) {
      throw error;
    }

    const errorMsg = error.message?.toLowerCase() || '';
    const hints: string[] = [];

    if (errorMsg.includes('403')) {
      hints.push('You may not have permission to transition this issue');
    } else if (errorMsg.includes('required') || error.response?.data?.errors) {
      hints.push('This transition might require mandatory fields that are not yet supported by this command.');
      if (error.response?.data?.errors) {
        const fields = Object.keys(error.response.data.errors).join(', ');
        hints.push(`Missing fields: ${fields}`);
      }
    }

    throw new CommandError(`Failed to transition issue: ${error.message}`, { hints });
  }
}

export async function listTransitionsCommand(
  issueKey: string,
  options?: ListTransitionsOptions
): Promise<void> {
  await validateIssuePermissions(issueKey, 'transition');
  const transitions = await getIssueTransitions(issueKey);

  let rows = transitions.map((t) => {
    const requiredFieldNames = t.fields
      ? Object.entries(t.fields)
          .filter(([, f]) => f.required)
          .map(([key]) => key)
      : [];

    return {
      id: t.id,
      name: t.name,
      to: t.to.name,
      requiredFields: requiredFieldNames.length > 0 ? requiredFieldNames.join(', ') : '(none)',
    };
  });

  if (options?.requiredOnly) {
    rows = rows.filter((r) => r.requiredFields !== '(none)');
  }

  outputResult(rows);
}
