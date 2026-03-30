import chalk from 'chalk';
import {
  getEpics,
  getEpic,
  createEpic,
  updateEpic,
  getEpicIssues,
  linkIssueToEpic,
  unlinkIssueFromEpic,
  getEpicProgress,
} from '../lib/jira-client.js';
import {
  formatEpicList,
  formatEpicDetails,
  formatEpicProgress,
  formatEpicIssues,
} from '../lib/formatters.js';
import { CommandError } from '../lib/errors.js';
import { ui } from '../lib/ui.js';
import { outputResult } from '../lib/json-mode.js';

// =============================================================================
// epic list <project-key> [--done] [--max <n>]
// =============================================================================
export async function epicListCommand(
  projectKey: string,
  options: { done?: boolean; max?: number } = {}
): Promise<void> {
  ui.startSpinner(`Fetching epics for project ${projectKey}...`);
  try {
    const epics = await getEpics(projectKey, {
      includeDone: !!options.done,
      max: options.max,
    });
    ui.stopSpinner();
    outputResult(epics, formatEpicList);
  } catch (error: any) {
    ui.failSpinner();
    const hints: string[] = [];
    const msg = error.message?.toLowerCase() || '';
    if (msg.includes('404') || msg.includes('not found') || msg.includes('project')) {
      hints.push('Check that the project key is correct');
      hints.push('Use "jira-ai project list" to see available projects');
    } else if (msg.includes('403')) {
      hints.push('You may not have permission to access this project');
    }
    throw new CommandError(`Failed to list epics: ${error.message}`, { hints });
  }
}

// =============================================================================
// epic get <epic-key>
// =============================================================================
export async function epicGetCommand(epicKey: string): Promise<void> {
  ui.startSpinner(`Fetching epic ${epicKey}...`);
  try {
    const epic = await getEpic(epicKey);
    ui.stopSpinner();
    console.log(formatEpicDetails(epic));
  } catch (error: any) {
    ui.failSpinner();
    const hints: string[] = [];
    const msg = error.message?.toLowerCase() || '';
    if (msg.includes('404') || msg.includes('not found')) {
      hints.push('Check that the epic key is correct');
      hints.push('Use "jira-ai epic list <project>" to see available epics');
    } else if (msg.includes('403')) {
      hints.push('You may not have permission to access this epic');
    }
    throw new CommandError(`Failed to get epic: ${error.message}`, { hints });
  }
}

// =============================================================================
// epic create <project-key> --name <name> --summary <text> [--description <text>] [--labels <l1,l2>]
// =============================================================================
export async function epicCreateCommand(
  projectKey: string,
  options: { name: string; summary: string; description?: string; labels?: string }
): Promise<void> {
  ui.startSpinner(`Creating epic in project ${projectKey}...`);
  try {
    const labels = options.labels
      ? options.labels.split(',').map(l => l.trim()).filter(Boolean)
      : undefined;

    const result = await createEpic(projectKey, options.name, options.summary, {
      description: options.description,
      labels,
    });

    ui.succeedSpinner(chalk.green(`Epic created successfully: ${result.key}`));
    console.log(chalk.gray(`\nName: ${options.name}`));
    console.log(chalk.gray(`Summary: ${options.summary}`));
    console.log(chalk.gray(`Project: ${projectKey}`));
    console.log(chalk.cyan(`\nEpic Key: ${result.key}`));
  } catch (error: any) {
    ui.failSpinner();
    const hints: string[] = [];
    const msg = error.message?.toLowerCase() || '';
    if (msg.includes('403')) {
      hints.push('You may not have permission to create epics in this project');
    } else if (msg.includes('project') || msg.includes('404')) {
      hints.push('Check that the project key is correct');
      hints.push('Use "jira-ai project list" to see available projects');
    } else if (msg.includes('epic')) {
      hints.push('This project may not support epics');
      hints.push('Use "jira-ai project types <project>" to check available issue types');
    }
    throw new CommandError(`Failed to create epic: ${error.message}`, { hints });
  }
}

// =============================================================================
// epic update <epic-key> [--name <name>] [--summary <text>]
// =============================================================================
export async function epicUpdateCommand(
  epicKey: string,
  options: { name?: string; summary?: string }
): Promise<void> {
  ui.startSpinner(`Updating epic ${epicKey}...`);
  try {
    await updateEpic(epicKey, { name: options.name, summary: options.summary });
    ui.succeedSpinner(chalk.green(`Epic ${epicKey} updated successfully.`));
    if (options.name) console.log(chalk.gray(`Name: ${options.name}`));
    if (options.summary) console.log(chalk.gray(`Summary: ${options.summary}`));
  } catch (error: any) {
    ui.failSpinner();
    const hints: string[] = [];
    const msg = error.message?.toLowerCase() || '';
    if (msg.includes('404') || msg.includes('not found')) {
      hints.push('Check that the epic key is correct');
    } else if (msg.includes('403')) {
      hints.push('You may not have permission to update this epic');
    }
    throw new CommandError(`Failed to update epic: ${error.message}`, { hints });
  }
}

// =============================================================================
// epic issues <epic-key> [--max <n>]
// =============================================================================
export async function epicIssuesCommand(
  epicKey: string,
  options: { max?: number }
): Promise<void> {
  ui.startSpinner(`Fetching issues for epic ${epicKey}...`);
  try {
    const issues = await getEpicIssues(epicKey, { max: options.max });
    ui.stopSpinner();
    console.log(formatEpicIssues(issues));
  } catch (error: any) {
    ui.failSpinner();
    const hints: string[] = [];
    const msg = error.message?.toLowerCase() || '';
    if (msg.includes('404') || msg.includes('not found')) {
      hints.push('Check that the epic key is correct');
      hints.push('Use "jira-ai epic list <project>" to see available epics');
    } else if (msg.includes('403')) {
      hints.push('You may not have permission to access this epic');
    }
    throw new CommandError(`Failed to get epic issues: ${error.message}`, { hints });
  }
}

// =============================================================================
// epic link <issue-key> --epic <epic-key>
// =============================================================================
export async function epicLinkCommand(issueKey: string, epicKey: string): Promise<void> {
  ui.startSpinner(`Linking ${issueKey} to epic ${epicKey}...`);
  try {
    await linkIssueToEpic(issueKey, epicKey);
    ui.succeedSpinner(chalk.green(`Issue ${issueKey} linked to epic ${epicKey}.`));
  } catch (error: any) {
    ui.failSpinner();
    const hints: string[] = [];
    const msg = error.message?.toLowerCase() || '';
    if (msg.includes('404') || msg.includes('not found')) {
      hints.push('Check that both the issue key and epic key are correct');
    } else if (msg.includes('400') || msg.includes('bad request')) {
      hints.push('Issue may already be linked to this epic');
    } else if (msg.includes('403')) {
      hints.push('You may not have permission to link this issue');
    }
    throw new CommandError(`Failed to link issue to epic: ${error.message}`, { hints });
  }
}

// =============================================================================
// epic unlink <issue-key>
// =============================================================================
export async function epicUnlinkCommand(issueKey: string): Promise<void> {
  ui.startSpinner(`Removing ${issueKey} from its epic...`);
  try {
    await unlinkIssueFromEpic(issueKey);
    ui.succeedSpinner(chalk.green(`Issue ${issueKey} removed from epic.`));
  } catch (error: any) {
    ui.failSpinner();
    const hints: string[] = [];
    const msg = error.message?.toLowerCase() || '';
    if (msg.includes('404') || msg.includes('not found')) {
      hints.push('Check that the issue key is correct');
    } else if (msg.includes('403')) {
      hints.push('You may not have permission to update this issue');
    }
    throw new CommandError(`Failed to unlink issue from epic: ${error.message}`, { hints });
  }
}

// =============================================================================
// epic progress <epic-key>
// =============================================================================
export async function epicProgressCommand(epicKey: string): Promise<void> {
  ui.startSpinner(`Calculating progress for epic ${epicKey}...`);
  try {
    const progress = await getEpicProgress(epicKey);
    ui.stopSpinner();
    console.log(formatEpicProgress(progress));
  } catch (error: any) {
    ui.failSpinner();
    const hints: string[] = [];
    const msg = error.message?.toLowerCase() || '';
    if (msg.includes('404') || msg.includes('not found')) {
      hints.push('Check that the epic key is correct');
      hints.push('Use "jira-ai epic list <project>" to see available epics');
    } else if (msg.includes('403')) {
      hints.push('You may not have permission to access this epic');
    }
    throw new CommandError(`Failed to get epic progress: ${error.message}`, { hints });
  }
}
