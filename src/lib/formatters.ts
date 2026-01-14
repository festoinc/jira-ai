import chalk from 'chalk';
import Table from 'cli-table3';
import { decode } from 'html-entities';
import { UserInfo, Project, TaskDetails, Status, JqlIssue, IssueType, IssueStatistics, HistoryEntry, WorklogWithIssue } from './jira-client.js';
import { formatTimestamp, truncate, formatDuration } from './utils.js';
import { Settings, ProjectSetting } from './settings.js';

/**
 * Create a styled table
 */
function createTable(headers: string[], colWidths?: number[]): Table.Table {
  return new Table({
    head: headers.map((h) => chalk.cyan.bold(h)),
    style: {
      head: [],
      border: ['gray'],
    },
    colWidths,
    wordWrap: true,
  });
}

/**
 * Format user info
 */
export function formatUserInfo(user: UserInfo): string {
  const table = createTable(['Property', 'Value'], [20, 50]);

  table.push(
    ['Host', user.host],
    ['Display Name', user.displayName],
    ['Email', user.emailAddress],
    ['Account ID', user.accountId],
    ['Status', user.active ? chalk.green('Active') : chalk.red('Inactive')],
    ['Time Zone', user.timeZone]
  );

  return '\n' + chalk.bold('User Information:') + '\n' + table.toString() + '\n';
}

/**
 * Format projects list
 */
export function formatProjects(projects: Project[]): string {
  if (projects.length === 0) {
    return chalk.yellow('No projects found.');
  }

  const table = createTable(['Key', 'Name', 'Type', 'Lead'], [12, 35, 15, 25]);

  projects.forEach((project) => {
    table.push([
      chalk.cyan(project.key),
      truncate(project.name, 35),
      project.projectTypeKey,
      project.lead?.displayName || chalk.gray('N/A'),
    ]);
  });

  let output = '\n' + chalk.bold(`Projects (${projects.length} total)`) + '\n\n';
  output += table.toString() + '\n';

  return output;
}

/**
 * Format task details with comments
 */
export function formatTaskDetails(task: TaskDetails): string {
  let output = '\n' + chalk.bold.cyan(`${task.key}: ${decode(task.summary)}`) + '\n\n';

  // Basic info table
  const infoTable = createTable(['Property', 'Value'], [15, 65]);

  infoTable.push(
    ['Status', chalk.green(task.status.name)],
    ['Assignee', task.assignee?.displayName || chalk.gray('Unassigned')],
    ['Reporter', task.reporter?.displayName || chalk.gray('N/A')],
    ['Created', formatTimestamp(task.created)],
    ['Updated', formatTimestamp(task.updated)]
  );

  // Add Due Date
  if (task.dueDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(task.dueDate);
    dueDate.setHours(0, 0, 0, 0);

    const isOverdue = dueDate < today;
    const isDone = task.status.category?.toLowerCase() === 'done';
    const dueDateValue = isOverdue && !isDone
      ? chalk.red(task.dueDate)
      : chalk.green(task.dueDate);

    infoTable.push(['Due Date', dueDateValue]);
  } else {
    infoTable.push(['Due Date', chalk.gray('N/A')]);
  }

  // Add labels to basic info table if present
  if (task.labels && task.labels.length > 0) {
    const labelsString = task.labels
      .map((label) => chalk.bgBlue.white.bold(` ${label} `))
      .join(' ');
    infoTable.push(['Labels', labelsString]);
  }

  output += infoTable.toString() + '\n\n';

  // Parent Task
  if (task.parent) {
    output += chalk.bold('Parent Task:') + '\n';
    const parentTable = createTable(['Key', 'Summary', 'Status'], [12, 50, 18]);
    parentTable.push([
      chalk.cyan(task.parent.key),
      truncate(decode(task.parent.summary), 50),
      task.parent.status.name,
    ]);
    output += parentTable.toString() + '\n\n';
  }

  // Subtasks
  if (task.subtasks && task.subtasks.length > 0) {
    output += chalk.bold(`Subtasks (${task.subtasks.length}):`) + '\n';
    const subtasksTable = createTable(['Key', 'Summary', 'Status'], [12, 50, 18]);
    task.subtasks.forEach((subtask) => {
      subtasksTable.push([
        chalk.cyan(subtask.key),
        truncate(decode(subtask.summary), 50),
        subtask.status.name,
      ]);
    });
    output += subtasksTable.toString() + '\n\n';
  }

  // Description
  if (task.description) {
    output += chalk.bold('Description:') + '\n';
    output += chalk.dim('─'.repeat(80)) + '\n';
    output += decode(task.description) + '\n';
    output += chalk.dim('─'.repeat(80)) + '\n\n';
  }

  // Comments
  if (task.comments.length > 0) {
    output += chalk.bold(`Comments (${task.comments.length}):`) + '\n\n';

    task.comments.forEach((comment, index) => {
      output += chalk.cyan(`${index + 1}. ${comment.author.displayName}`) +
                chalk.gray(` - ${formatTimestamp(comment.created)}`) + '\n';
      output += chalk.dim('─'.repeat(80)) + '\n';
      output += decode(comment.body) + '\n';
      output += chalk.dim('─'.repeat(80)) + '\n\n';
    });
  } else {
    output += chalk.gray('No comments yet.\n\n');
  }

  // History
  if (task.history && task.history.length > 0) {
    output += formatTaskHistory(task.history);
  }

  return output;
}

/**
 * Format task history
 */
export function formatTaskHistory(history: HistoryEntry[]): string {
  if (history.length === 0) {
    return chalk.gray('No history entries found.\n\n');
  }

  const table = createTable(['Date', 'Author', 'Field', 'From', 'To'], [22, 18, 15, 25, 25]);

  history.forEach((entry) => {
    entry.items.forEach((item, index) => {
      table.push([
        index === 0 ? formatTimestamp(entry.created) : '',
        index === 0 ? truncate(entry.author, 18) : '',
        chalk.yellow(item.field),
        truncate(item.from || chalk.gray('None'), 25),
        truncate(item.to || chalk.gray('None'), 25),
      ]);
    });
  });

  let output = '\n' + chalk.bold(`Task History (${history.length} entries)`) + '\n';
  output += table.toString() + '\n';
  return output;
}

/**
 * Format project statuses list
 */
export function formatProjectStatuses(projectKey: string, statuses: Status[]): string {
  if (statuses.length === 0) {
    return chalk.yellow('No statuses found for this project.');
  }

  const table = createTable(['Status Name', 'Category', 'Description'], [25, 20, 45]);

  // Sort statuses by category for better readability
  const sortedStatuses = [...statuses].sort((a, b) => {
    const categoryOrder = ['TODO', 'IN_PROGRESS', 'DONE'];
    const aIndex = categoryOrder.indexOf(a.statusCategory.key.toUpperCase());
    const bIndex = categoryOrder.indexOf(b.statusCategory.key.toUpperCase());
    return aIndex - bIndex;
  });

  sortedStatuses.forEach((status) => {
    // Color code based on status category
    let categoryColor = chalk.white;
    if (status.statusCategory.key.toLowerCase() === 'done') {
      categoryColor = chalk.green;
    } else if (status.statusCategory.key.toLowerCase() === 'indeterminate') {
      categoryColor = chalk.yellow;
    } else if (status.statusCategory.key.toLowerCase() === 'new') {
      categoryColor = chalk.blue;
    }

    table.push([
      chalk.cyan(status.name),
      categoryColor(status.statusCategory.name),
      truncate(status.description || chalk.gray('No description'), 45),
    ]);
  });

  let output = '\n' + chalk.bold(`Project ${projectKey} - Available Statuses (${statuses.length} total)`) + '\n\n';
  output += table.toString() + '\n';

  return output;
}

/**
 * Format JQL query results
 */
export function formatJqlResults(issues: JqlIssue[]): string {
  if (issues.length === 0) {
    return chalk.yellow('\nNo issues found matching your JQL query.\n');
  }

  const table = createTable(['Key', 'Summary', 'Status', 'Assignee', 'Priority'], [12, 40, 18, 20, 12]);

  issues.forEach((issue) => {
    // Color-code status
    let statusColor = chalk.white;
    const statusLower = issue.status.name.toLowerCase();
    if (statusLower.includes('done') || statusLower.includes('closed') || statusLower.includes('resolved')) {
      statusColor = chalk.green;
    } else if (statusLower.includes('progress') || statusLower.includes('review')) {
      statusColor = chalk.yellow;
    }

    // Color-code priority
    let priorityColor = chalk.white;
    const priorityName = issue.priority?.name || chalk.gray('None');
    if (issue.priority) {
      const priorityLower = issue.priority.name.toLowerCase();
      if (priorityLower.includes('highest') || priorityLower.includes('high')) {
        priorityColor = chalk.red;
      } else if (priorityLower.includes('medium')) {
        priorityColor = chalk.yellow;
      } else if (priorityLower.includes('low')) {
        priorityColor = chalk.blue;
      }
    }

    table.push([
      chalk.cyan(issue.key),
      truncate(decode(issue.summary), 40),
      statusColor(issue.status.name),
      issue.assignee ? truncate(issue.assignee.displayName, 20) : chalk.gray('Unassigned'),
      typeof priorityName === 'string' ? priorityColor(priorityName) : priorityName,
    ]);
  });

  let output = '\n' + chalk.bold(`Results (${issues.length} total)`) + '\n\n';
  output += table.toString() + '\n';

  return output;
}

/**
 * Format project issue types list
 */
export function formatProjectIssueTypes(projectKey: string, issueTypes: IssueType[]): string {
  if (issueTypes.length === 0) {
    return chalk.yellow('No issue types found for this project.');
  }

  // Separate standard issue types and subtasks
  const standardTypes = issueTypes.filter(type => !type.subtask);
  const subtaskTypes = issueTypes.filter(type => type.subtask);

  let output = '\n' + chalk.bold(`Project ${projectKey} - Issue Types (${issueTypes.length} total)`) + '\n\n';

  // Display standard issue types
  if (standardTypes.length > 0) {
    output += chalk.bold('Standard Issue Types:') + '\n';
    const table = createTable(['Name', 'ID', 'Hierarchy', 'Type', 'Description'], [18, 8, 10, 12, 42]);

    standardTypes.forEach((issueType) => {
      table.push([
        chalk.cyan(issueType.name),
        chalk.gray(issueType.id),
        chalk.magenta(issueType.hierarchyLevel.toString()),
        issueType.subtask ? chalk.yellow('Subtask') : chalk.green('Standard'),
        truncate(issueType.description || chalk.gray('No description'), 42),
      ]);
    });

    output += table.toString() + '\n';
  }

  // Display subtask types separately if they exist
  if (subtaskTypes.length > 0) {
    output += '\n' + chalk.bold('Subtask Types:') + '\n';
    const subtaskTable = createTable(['Name', 'ID', 'Hierarchy', 'Type', 'Description'], [18, 8, 10, 12, 42]);

    subtaskTypes.forEach((issueType) => {
      subtaskTable.push([
        chalk.cyan(issueType.name),
        chalk.gray(issueType.id),
        chalk.magenta(issueType.hierarchyLevel.toString()),
        chalk.yellow('Subtask'),
        truncate(issueType.description || chalk.gray('No description'), 42),
      ]);
    });

    output += subtaskTable.toString() + '\n';
  }

  return output;
}

/**
 * Format issue statistics
 */
export function formatIssueStatistics(statsList: IssueStatistics[]): string {
  if (statsList.length === 0) {
    return chalk.yellow('No statistics to display.');
  }

  const table = createTable([
    'Key',
    'Summary',
    'Time Logged',
    'Estimate',
    'Status Breakdown'
  ], [12, 30, 15, 15, 40]);

  statsList.forEach((stats) => {
    // Breakdown of time spent in each unique status
    const breakdown = Object.entries(stats.statusDurations)
      .map(([status, seconds]) => `${status}: ${formatDuration(seconds, 24)}`)
      .join('\n');

    const timeSpentStr = formatDuration(stats.timeSpentSeconds, 8);
    const estimateStr = formatDuration(stats.originalEstimateSeconds, 8);

    // Highlight if time spent exceeds estimate
    const timeSpentFormatted = stats.timeSpentSeconds > stats.originalEstimateSeconds && stats.originalEstimateSeconds > 0
      ? chalk.red(timeSpentStr)
      : chalk.green(timeSpentStr);

    table.push([
      chalk.cyan(stats.key),
      truncate(decode(stats.summary), 30),
      timeSpentFormatted,
      estimateStr,
      breakdown
    ]);
  });

  let output = '\n' + chalk.bold('Issue Statistics') + '\n\n';
  output += table.toString() + '\n';

  return output;
}

/**
 * Format users list
 */
export function formatUsers(users: UserInfo[]): string {
  if (users.length === 0) {
    return chalk.yellow('No users found.');
  }

  const table = createTable(['Display Name', 'Email', 'Account ID'], [30, 40, 30]);

  users.forEach((user) => {
    table.push([
      chalk.cyan(user.displayName),
      user.emailAddress || chalk.gray('N/A'),
      chalk.gray(user.accountId),
    ]);
  });

  let output = '\n' + chalk.bold(`Colleagues (${users.length} total)`) + '\n\n';
  output += table.toString() + '\n';

  return output;
}

/**
 * Format worklogs list
 */
export function formatWorklogs(worklogs: WorklogWithIssue[], groupByIssue: boolean = false): string {
  if (worklogs.length === 0) {
    return chalk.yellow('\nNo worklogs found for the given person and timeframe.\n');
  }

  // Sort worklogs by date (started)
  let sortedWorklogs = [...worklogs].sort((a, b) => 
    new Date(a.started).getTime() - new Date(b.started).getTime()
  );

  if (groupByIssue) {
    sortedWorklogs.sort((a, b) => a.issueKey.localeCompare(b.issueKey));
  }

  const table = createTable(['Date', 'Issue Key', 'Summary', 'Time Spent', 'Worklog Comment'], [12, 12, 30, 12, 45]);

  let totalSeconds = 0;

  sortedWorklogs.forEach((w) => {
    totalSeconds += w.timeSpentSeconds;
    table.push([
      w.started.split('T')[0],
      chalk.cyan(w.issueKey),
      truncate(decode(w.summary), 30),
      w.timeSpent,
      truncate(decode(w.comment || ''), 45),
    ]);
  });

  const totalHours = (totalSeconds / 3600).toFixed(2);
  let output = '\n' + chalk.bold('Worklogs') + '\n\n';
  output += table.toString() + '\n';
  output += chalk.bold(`Total time tracked: ${totalHours}h`) + '\n';

  return output;
}

/**
 * Format settings
 */
export function formatSettings(settings: Settings): string {
  let output = '\n' + chalk.bold.cyan('Active Configuration') + '\n\n';

  // Global Commands
  output += chalk.bold('Global Commands:') + '\n';
  output += `  ${settings.commands.join(', ')}\n\n`;

  // Projects
  output += chalk.bold(`Projects (${settings.projects.length}):`) + '\n';
  const table = createTable(['Project', 'Commands', 'Filters'], [15, 30, 50]);

  settings.projects.forEach((p) => {
    let key: string;
    let commands: string = 'global';
    let filters: string = 'none';

    if (typeof p === 'string') {
      key = p;
    } else {
      key = p.key;
      if (p.commands) {
        commands = p.commands.join(', ');
      }
      if (p.filters) {
        const parts = [];
        if (p.filters.jql) {
          parts.push(`JQL: ${p.filters.jql}`);
        }
        if (p.filters.participated) {
          const roles = [];
          if (p.filters.participated.was_assignee) roles.push('Assignee');
          if (p.filters.participated.was_reporter) roles.push('Reporter');
          if (p.filters.participated.was_commenter) roles.push('Commenter');
          if (p.filters.participated.is_watcher) roles.push('Watcher');
          if (roles.length > 0) {
            parts.push(`Roles: ${roles.join(', ')}`);
          }
        }
        filters = parts.join('\n') || 'none';
      }
    }

    table.push([
      chalk.cyan(key),
      commands,
      filters
    ]);
  });

  output += table.toString() + '\n';

  return output;
}
