import chalk from 'chalk';

export async function aboutCommand() {
  console.log(chalk.bold.cyan('\n📋 Jira AI\n'));
  console.log(`${chalk.bold('Version:')} 0.3.17`);
  console.log(`${chalk.bold('GitHub:')}  https://github.com/festoinc/jira-ai\n`);
}