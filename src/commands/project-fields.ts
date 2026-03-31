import { getProjectFields } from '../lib/field-resolver.js';
import { CommandError } from '../lib/errors.js';
import { validateOptions, ProjectKeySchema } from '../lib/validation.js';
import { isCommandAllowed, isProjectAllowed } from '../lib/settings.js';
import { outputResult } from '../lib/json-mode.js';

export async function projectFieldsCommand(
  projectKey: string,
  options: {
    type?: string;
    custom?: boolean;
    search?: string;
  }
): Promise<void> {
  if (!projectKey) {
    throw new CommandError('Project key is required');
  }
  validateOptions(ProjectKeySchema, projectKey);

  if (!isProjectAllowed(projectKey)) {
    throw new CommandError(`Project '${projectKey}' is not allowed by your settings.`);
  }

  if (!isCommandAllowed('project.fields', projectKey)) {
    throw new CommandError(`Command 'project.fields' is not allowed for project ${projectKey}.`);
  }

  try {
    let fields = await getProjectFields(projectKey, options.type);

    if (options.custom) {
      fields = fields.filter(f => f.custom);
    }

    if (options.search) {
      const lower = options.search.toLowerCase();
      fields = fields.filter(f => f.name.toLowerCase().includes(lower) || f.id.toLowerCase().includes(lower));
    }

    outputResult(fields);
  } catch (error: any) {
    if (error instanceof CommandError) throw error;

    const errorMsg = error.message?.toLowerCase() || '';
    const hints: string[] = [];

    if (errorMsg.includes('404') || errorMsg.includes('does not exist')) {
      hints.push('Check that the project key is correct');
    } else if (errorMsg.includes('403')) {
      hints.push('You may not have permission to view this project');
    }

    throw new CommandError(error.message, { hints });
  }
}
