import chalk from 'chalk';
import ora from 'ora';
import { getProjects } from '../lib/jira-client.js';
import { formatProjects } from '../lib/formatters.js';
import { getAllowedProjects, isProjectAllowed } from '../lib/settings.js';

export async function projectsCommand(): Promise<void> {
  const spinner = ora('Fetching projects...').start();

  try {
    const allProjects = await getProjects();
    const allowedProjectKeys = getAllowedProjects();

    // Filter projects based on settings
    const filteredProjects = allowedProjectKeys.includes('all')
      ? allProjects
      : allProjects.filter(project => isProjectAllowed(project.key));

    spinner.succeed(chalk.green('Projects retrieved'));

    if (filteredProjects.length === 0) {
      console.log(chalk.yellow('\nNo projects match your settings configuration.'));
      console.log(chalk.gray('Allowed projects: ' + allowedProjectKeys.join(', ')));
    } else {
      console.log(formatProjects(filteredProjects));
    }
  } catch (error) {
    spinner.fail(chalk.red('Failed to fetch projects'));
    console.error(chalk.red('\nError: ' + (error instanceof Error ? error.message : 'Unknown error')));
    process.exit(1);
  }
}
