import chalk from 'chalk';
import { getProjects } from '../lib/jira-client.js';
import { formatProjects } from '../lib/formatters.js';
import { getAllowedProjects, isProjectAllowed } from '../lib/settings.js';
import { ui } from '../lib/ui.js';

export async function projectsCommand(): Promise<void> {
  ui.startSpinner('Fetching projects...');

  const allProjects = await getProjects();
  const allowedProjects = getAllowedProjects();

  // Filter projects based on settings
  const hasAll = allowedProjects.some(p => p === 'all');
  const filteredProjects = hasAll
    ? allProjects
    : allProjects.filter(project => isProjectAllowed(project.key));

  ui.succeedSpinner(chalk.green('Projects retrieved'));

  if (filteredProjects.length === 0) {
    console.log(chalk.yellow('\nNo projects match your settings configuration.'));
    const displayKeys = allowedProjects.map(p => typeof p === 'string' ? p : p.key);
    console.log(chalk.gray('Allowed projects: ' + displayKeys.join(', ')));
  } else {
    console.log(formatProjects(filteredProjects));
  }
}
