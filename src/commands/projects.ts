import { getProjects } from '../lib/jira-client.js';
import { getAllowedProjects, isProjectAllowed } from '../lib/settings.js';
import { outputResult } from '../lib/json-mode.js';

export async function projectsCommand(): Promise<void> {
  const allProjects = await getProjects();
  const allowedProjects = getAllowedProjects();

  // Filter projects based on settings
  const hasAll = allowedProjects.some(p => p === 'all');
  const filteredProjects = hasAll
    ? allProjects
    : allProjects.filter(project => isProjectAllowed(project.key));

  outputResult(filteredProjects);
}
