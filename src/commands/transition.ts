import chalk from 'chalk';
import { getIssueTransitions, transitionIssue } from '../lib/jira-client.js';
import { CommandError } from '../lib/errors.js';
import { ui } from '../lib/ui.js';

export async function transitionCommand(
  taskId: string,
  toStatus: string
): Promise<void> {
  ui.startSpinner(`Fetching available transitions for ${taskId}...`);

  try {
    const transitions = await getIssueTransitions(taskId);
    ui.stopSpinner();

    const matchingTransitions = transitions.filter(
      (t) => t.to.name.toLowerCase() === toStatus.toLowerCase()
    );

    if (matchingTransitions.length === 0) {
      const availableStatuses = Array.from(new Set(transitions.map((t) => t.to.name))).join(', ');
      throw new CommandError(
        `No transition found to status "${toStatus}" for issue ${taskId}.`,
        {
          hints: [
            `Available destination statuses: ${availableStatuses || 'None'}`,
            'Check the status name and try again (it is case-insensitive).'
          ]
        }
      );
    }

    if (matchingTransitions.length > 1) {
      const availableTransitions = matchingTransitions.map(t => `"${t.name}" (ID: ${t.id})`).join(', ');
      throw new CommandError(
        `Multiple transitions found to status "${toStatus}" for issue ${taskId}.`,
        {
          hints: [
            `Ambiguous matches: ${availableTransitions}`,
            'This command currently only supports unambiguous status matching.'
          ]
        }
      );
    }

    const transition = matchingTransitions[0];
    ui.startSpinner(`Transitioning ${taskId} to ${transition.to.name}...`);
    
    await transitionIssue(taskId, transition.id);

    ui.succeedSpinner(
      chalk.green(`Issue ${taskId} successfully transitioned to ${transition.to.name}.`)
    );
  } catch (error: any) {
    if (error instanceof CommandError) {
      throw error;
    }

    const hints: string[] = [];
    if (error.message?.includes('403')) {
      hints.push('You may not have permission to transition this issue');
    } else if (error.message?.includes('required') || (error.response?.data?.errors && Object.keys(error.response.data.errors).length > 0)) {
      hints.push('This transition might require mandatory fields that are not yet supported by this command.');
      if (error.response?.data?.errors) {
        const fields = Object.keys(error.response.data.errors).join(', ');
        hints.push(`Missing fields: ${fields}`);
      }
    }

    throw new CommandError(`Failed to transition issue: ${error.message}`, { hints });
  }
}
