import { OrganizationSettings, ProjectFilters } from './settings.js';

export interface PresetDefinition {
  description: string;
  defaults: OrganizationSettings;
  globalParticipationFilter?: ProjectFilters['participated'];
}

export const PRESETS: Record<string, PresetDefinition> = {
  'read-only': {
    description: 'AI can only observe. No create, update, delete, or transition operations.',
    defaults: {
      'allowed-jira-projects': ['all'],
      'allowed-commands': [
        'issue.get',
        'issue.search',
        'issue.stats',
        'issue.comments',
        'issue.activity',
        'issue.tree',
        'issue.worklog.list',
        'issue.link.list',
        'issue.link.types',
        'issue.attach.list',
        'project.list',
        'project.statuses',
        'project.types',
        'project.fields',
        'user.me',
        'user.search',
        'user.worklog',
        'confl.get',
        'confl.spaces',
        'confl.pages',
        'confl.search',
        'epic.list',
        'epic.get',
        'epic.issues',
        'epic.progress',
        'board.list',
        'board.get',
        'board.config',
        'board.issues',
        'sprint.list',
        'sprint.get',
        'sprint.issues',
        'sprint.tree',
      ],
      'allowed-confluence-spaces': ['all'],
    },
  },

  'standard': {
    description: 'AI can perform common productive actions but cannot do destructive operations.',
    defaults: {
      'allowed-jira-projects': ['all'],
      'allowed-commands': [
        'issue.get',
        'issue.create',
        'issue.search',
        'issue.transition',
        'issue.update',
        'issue.comment',
        'issue.stats',
        'issue.assign',
        'issue.label.add',
        'issue.label.remove',
        'issue.link.list',
        'issue.link.create',
        'issue.link.types',
        'issue.attach.upload',
        'issue.attach.list',
        'issue.attach.download',
        'issue.comments',
        'issue.activity',
        'issue.tree',
        'issue.worklog.list',
        'issue.worklog.add',
        'issue.worklog.update',
        'project.list',
        'project.statuses',
        'project.types',
        'project.fields',
        'user.me',
        'user.search',
        'user.worklog',
        'confl.get',
        'confl.spaces',
        'confl.pages',
        'confl.create',
        'confl.comment',
        'confl.update',
        'confl.search',
        'epic.list',
        'epic.get',
        'epic.create',
        'epic.update',
        'epic.issues',
        'epic.link',
        'epic.unlink',
        'epic.progress',
        'board.list',
        'board.get',
        'board.config',
        'board.issues',
        'sprint.list',
        'sprint.get',
        'sprint.issues',
        'sprint.tree',
        'sprint.update',
      ],
      'allowed-confluence-spaces': ['all'],
    },
  },

  'my-tasks': {
    description: 'AI has full command access but restricted to issues where the current user participated.',
    defaults: {
      'allowed-jira-projects': ['all'],
      'allowed-commands': [
        'issue',
        'project',
        'user',
        'confl',
        'epic',
        'board',
        'sprint',
        'backlog',
      ],
      'allowed-confluence-spaces': ['all'],
    },
    globalParticipationFilter: {
      was_assignee: true,
      was_reporter: true,
      was_commenter: true,
      is_watcher: true,
    },
  },

  'yolo': {
    description: 'Unrestricted access. The AI can do everything. The name explicitly signals risk.',
    defaults: {
      'allowed-jira-projects': ['all'],
      'allowed-commands': ['all'],
      'allowed-confluence-spaces': ['all'],
    },
  },
};

export function getPreset(name: string): PresetDefinition {
  const preset = PRESETS[name];
  if (!preset) {
    const available = Object.keys(PRESETS).join(', ');
    throw new Error(`Unknown preset "${name}". Available presets: ${available}`);
  }
  return preset;
}

export function listPresets(): Record<string, {
  description: string;
  'allowed-commands': string[];
  'allowed-jira-projects': string[];
  'allowed-confluence-spaces': string[];
}> {
  const result: Record<string, any> = {};
  for (const [name, preset] of Object.entries(PRESETS)) {
    result[name] = {
      description: preset.description,
      'allowed-commands': preset.defaults['allowed-commands'],
      'allowed-jira-projects': preset.defaults['allowed-jira-projects'] as string[],
      'allowed-confluence-spaces': preset.defaults['allowed-confluence-spaces'],
    };
  }
  return result;
}

export function detectPreset(settings: OrganizationSettings): {
  current: string;
  description: string;
  closestMatch?: string;
  differences?: {
    addedCommands?: string[];
    removedCommands?: string[];
  };
} {
  for (const [name, preset] of Object.entries(PRESETS)) {
    if (settingsMatchPreset(settings, preset.defaults)) {
      return {
        current: name,
        description: `Your settings match the '${name}' preset.`,
      };
    }
  }

  // Find closest match
  let closestMatch: string | undefined;
  let minDiff = Infinity;

  for (const [name, preset] of Object.entries(PRESETS)) {
    const currentCmds = new Set(settings['allowed-commands']);
    const presetCmds = new Set(preset.defaults['allowed-commands']);
    const added = [...currentCmds].filter(c => !presetCmds.has(c));
    const removed = [...presetCmds].filter(c => !currentCmds.has(c));
    const diff = added.length + removed.length;
    if (diff < minDiff) {
      minDiff = diff;
      closestMatch = name;
    }
  }

  const closestPreset = closestMatch ? PRESETS[closestMatch] : undefined;
  const currentCmds = new Set(settings['allowed-commands']);
  const presetCmds = closestPreset ? new Set(closestPreset.defaults['allowed-commands']) : new Set<string>();
  const addedCommands = [...currentCmds].filter(c => !presetCmds.has(c));
  const removedCommands = [...presetCmds].filter(c => !currentCmds.has(c));

  return {
    current: 'custom',
    description: 'Your settings do not match any predefined preset.',
    closestMatch,
    differences: {
      addedCommands,
      removedCommands,
    },
  };
}

function settingsMatchPreset(settings: OrganizationSettings, presetDefaults: OrganizationSettings): boolean {
  const settingsCmds = [...settings['allowed-commands']].sort();
  const presetCmds = [...presetDefaults['allowed-commands']].sort();
  if (JSON.stringify(settingsCmds) !== JSON.stringify(presetCmds)) return false;

  const settingsProjects = [...settings['allowed-jira-projects']].map(p => typeof p === 'string' ? p : JSON.stringify(p)).sort();
  const presetProjects = [...presetDefaults['allowed-jira-projects']].map(p => typeof p === 'string' ? p : JSON.stringify(p)).sort();
  if (JSON.stringify(settingsProjects) !== JSON.stringify(presetProjects)) return false;

  const settingsSpaces = [...settings['allowed-confluence-spaces']].sort();
  const presetSpaces = [...presetDefaults['allowed-confluence-spaces']].sort();
  if (JSON.stringify(settingsSpaces) !== JSON.stringify(presetSpaces)) return false;

  return true;
}
