import chalk from 'chalk';
import { getProjects } from '../lib/jira-client.js';
import { formatProjects } from '../lib/formatters.js';
import { getAllowedProjects, isProjectAllowed } from '../lib/settings.js';
import { ui } from '../lib/ui.js';

export async function projectsCommand(): Promise<void> {
  ui.startSpinner('Fetching projects...');

  const allProjects = await getProjects();
  const allowedProjectKeys = getAllowedProjects();

  // Filter projects based on settings
  const filteredProjects = allowedProjectKeys.includes('all')
    ? allProjects
    : allProjects.filter(project => isProjectAllowed(project.key));

  ui.succeedSpinner(chalk.green('Projects retrieved'));

  if (filteredProjects.length === 0) {
    console.log(chalk.yellow('\nNo projects match your settings configuration.'));
    console.log(chalk.gray('Allowed projects: ' + allowedProjectKeys.join(', ')));
  } else {
    console.log(formatProjects(filteredProjects));
  }
}
