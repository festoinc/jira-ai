import { decode } from 'html-entities';
import { UserInfo, Project, TaskDetails, Status, JqlIssue, IssueType, IssueStatistics, HistoryEntry, WorklogWithIssue, Epic, EpicDetails, EpicProgress, IssueLink, IssueLinkType } from './jira-client.js';
import { ConfluencePage, ConfluenceComment, ConfluenceSpace, ConfluencePageHierarchy } from './confluence-client.js';
import { formatTimestamp, truncate, formatDuration } from './utils.js';
import { Settings, ProjectSetting } from './settings.js';

export function formatUserInfo(user: UserInfo): string {
  return `User: ${user.displayName} (${user.emailAddress})`;
}

export function formatProjects(projects: Project[]): string {
  return projects.map(p => `${p.key}: ${p.name}`).join('\n');
}

export function formatTaskDetails(task: TaskDetails): string {
  return `${task.key}: ${decode(task.summary)} [${task.status.name}]`;
}

export function formatTaskHistory(history: HistoryEntry[]): string {
  return history.map(e => `${e.created}: ${e.author}`).join('\n');
}

export function formatProjectStatuses(projectKey: string, statuses: Status[]): string {
  return statuses.map(s => `${s.name} (${s.statusCategory.name})`).join('\n');
}

export function formatJqlResults(issues: JqlIssue[]): string {
  return issues.map(i => `${i.key}: ${decode(i.summary)} [${i.status.name}]`).join('\n');
}

export function formatProjectIssueTypes(projectKey: string, issueTypes: IssueType[]): string {
  return issueTypes.map(t => `${t.name} (${t.id})`).join('\n');
}

export function formatIssueStatistics(statsList: IssueStatistics[], fullBreakdown: boolean = false): string {
  return statsList.map(s => `${s.key}: ${formatDuration(s.timeSpentSeconds, 8)}`).join('\n');
}

export function formatUsers(users: UserInfo[]): string {
  return users.map(u => `${u.displayName} (${u.emailAddress})`).join('\n');
}

export function formatWorklogs(worklogs: WorklogWithIssue[], groupByIssue: boolean = false): string {
  return worklogs.map(w => `${w.issueKey}: ${w.timeSpent}`).join('\n');
}

export function formatSettings(settings: Settings): string {
  return JSON.stringify(settings, null, 2);
}

export function formatConfluencePage(page: ConfluencePage, comments: ConfluenceComment[]): string {
  return `${decode(page.title)} [${page.space}]`;
}

export function formatConfluenceSpaces(spaces: ConfluenceSpace[]): string {
  return spaces.map(s => `${s.key}: ${s.name}`).join('\n');
}

export function formatConfluencePageHierarchy(hierarchy: ConfluencePageHierarchy[]): string {
  return hierarchy.map(h => h.title).join('\n');
}

export function formatConfluenceSearchResults(results: ConfluencePage[]): string {
  return results.map(r => `${decode(r.title)} [${r.space}]`).join('\n');
}

export function formatEpicList(epics: Epic[]): string {
  return epics.map(e => `${e.key}: ${e.name || e.summary} [${e.status}]`).join('\n');
}

export function formatEpicDetails(epic: EpicDetails): string {
  return `${epic.key}: ${epic.name || epic.summary} [${epic.status}]`;
}

export function formatEpicProgress(progress: EpicProgress): string {
  return `${progress.epicKey}: ${progress.percentageDone}% done (${progress.doneIssues}/${progress.totalIssues})`;
}

export function formatEpicIssues(issues: JqlIssue[]): string {
  return issues.map(i => `${i.key}: ${i.summary} [${i.status.name}]`).join('\n');
}

export function formatIssueLinks(issueKey: string, links: IssueLink[]): string {
  return links.map(l => {
    if (l.outwardIssue) return `-> ${l.type.outward}: ${l.outwardIssue.key}`;
    if (l.inwardIssue) return `<- ${l.type.inward}: ${l.inwardIssue.key}`;
    return '';
  }).filter(Boolean).join('\n');
}

export function formatLinkTypes(linkTypes: IssueLinkType[]): string {
  return linkTypes.map(lt => `${lt.name} (inward: ${lt.inward}, outward: ${lt.outward})`).join('\n');
}
