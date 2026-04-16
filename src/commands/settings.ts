import fs from 'fs';
import yaml from 'js-yaml';
import {
  loadSettings,
  saveSettings,
  Settings,
  DEFAULT_SETTINGS,
  migrateSettings,
  __resetCache__,
} from '../lib/settings.js';
import { SettingsSchema } from '../lib/validation.js';
import { getProjects } from '../lib/jira-client.js';
import { CommandError } from '../lib/errors.js';
import { validateEnvVars } from '../lib/utils.js';
import { outputResult } from '../lib/json-mode.js';
import { getPreset, listPresets, detectPreset } from '../lib/presets.js';

export interface SettingsOptions {
  apply?: string;
  validate?: string;
  reset?: boolean;
  preset?: string;
  listPresets?: boolean;
  detectPreset?: boolean;
}

export async function settingsCommand(options: SettingsOptions): Promise<void> {
  const presetFlags = [options.preset, options.listPresets, options.detectPreset].filter(Boolean).length;
  const exclusiveFlags = presetFlags + (options.reset ? 1 : 0) + (options.apply ? 1 : 0) + (options.validate ? 1 : 0);
  if (exclusiveFlags > 1) {
    throw new CommandError('--preset, --list-presets, --detect-preset, --reset, --apply, and --validate are mutually exclusive');
  }

  if (options.listPresets) {
    outputResult({ presets: listPresets() });
    return;
  }

  if (options.detectPreset) {
    const settings = loadSettings();
    const defaults = settings.defaults || DEFAULT_SETTINGS.defaults!;
    outputResult(detectPreset(defaults));
    return;
  }

  if (options.preset) {
    const preset = getPreset(options.preset);
    __resetCache__();
    const current = loadSettings();
    const newSettings: Settings = {
      defaults: { ...preset.defaults, ...(preset.globalParticipationFilter ? { globalParticipationFilter: preset.globalParticipationFilter } : {}) },
      savedQueries: current.savedQueries,
    };
    saveSettings(newSettings);
    outputResult({ success: true, preset: options.preset, message: `Preset applied. Edit ~/.jira-ai/settings.yaml to customize.` });
    return;
  }

  if (options.reset) {
    try {
      saveSettings(DEFAULT_SETTINGS);
      outputResult({ success: true, message: 'Settings reset to default successfully!' });
    } catch (error) {
      throw new CommandError(`Error resetting settings: ${error instanceof Error ? error.message : String(error)}`);
    }
    return;
  }

  if (options.apply) {
    await applySettings(options.apply);
    return;
  }

  if (options.validate) {
    await validateSettingsFile(options.validate);
    return;
  }

  const settings = loadSettings();
  outputResult(settings);
}

async function validateSettingsFile(filePath: string): Promise<Settings> {
  if (!fs.existsSync(filePath)) {
    throw new CommandError(`File not found: ${filePath}`);
  }

  let rawSettings: any;
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    rawSettings = yaml.load(content);
  } catch (error) {
    throw new CommandError(`Error parsing YAML in ${filePath}`);
  }

  const result = SettingsSchema.safeParse(rawSettings);
  if (!result.success) {
    const messages = result.error.issues
      .map((err) => `${err.path.join('.')}: ${err.message}`)
      .join('\n');
    throw new CommandError(`Invalid settings structure:\n${messages}`);
  }

  const settings = migrateSettings(result.data);

  try {
    validateEnvVars();
    const projects = await getProjects();
    const projectKeys = new Set(projects.map(p => p.key));

    const validateOrg = (orgSettings: any, label: string) => {
      const projectsToValidate = orgSettings['allowed-jira-projects'] || [];
      for (const p of projectsToValidate) {
        const key = typeof p === 'string' ? p : p.key;

        if (key === 'all') continue;

        if (!projectKeys.has(key)) {
          const msg = `Project "${key}" (in ${label}) not found in Jira.`;
          throw new CommandError(msg);
        }
      }
    };

    if (settings.defaults) {
      validateOrg(settings.defaults, 'defaults');
    }

    outputResult({ success: true, message: 'Settings are valid!' });
    return settings;
  } catch (error) {
    if (error instanceof CommandError) throw error;
    throw new CommandError(`Failed to connect to Jira for validation: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function applySettings(filePath: string): Promise<void> {
  const settings = await validateSettingsFile(filePath);

  try {
    saveSettings(settings);
    outputResult({ success: true, message: 'Settings applied successfully!' });
  } catch (error) {
    throw error;
  }
}
