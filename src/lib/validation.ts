import { z } from 'zod';
import * as fs from 'fs';
import { CommandError } from './errors.js';

import * as path from 'path';

export { z };

/**
 * Schema for Jira Project Keys (e.g., "PROJ", "ABC")
 */
export const ProjectKeySchema = z
  .string()
  .regex(/^[A-Z][A-Z0-9]+$/, 'Project key must be uppercase and start with a letter');

/**
 * Schema for Jira Issue Keys (e.g., "PROJ-123", "ABC-1")
 */
export const IssueKeySchema = z
  .string()
  .min(1, 'Task ID is required')
  .regex(/^[A-Z][A-Z0-9]+-\d+$/, 'Issue key must be in format PROJECT-NUMBER (e.g., PROJ-123)');


/**
 * Schema for File Paths. Resolves to absolute path.
 */
export const FilePathSchema = z
  .string()
  .transform((val) => path.resolve(val))
  .refine((val) => fs.existsSync(val), {
    message: 'File not found',
  });

/**
 * Schema for numeric strings (e.g., limits)
 */
export const NumericStringSchema = z
  .string()
  .regex(/^\d+$/, 'Must be a positive integer')
  .transform(Number)
  .refine((n) => n > 0, 'Must be greater than 0');

/**
 * Validates data against a schema and throws CommandError with formatted message on failure
 */
export function validateOptions<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const simpleErrorMessages = result.error.issues
      .map((err) => {
        if (err.path.length === 0) {
          return err.message;
        }
        return `${err.path.join('.')}: ${err.message}`;
      })
      .join('\n');

    throw new CommandError(simpleErrorMessages);
  }
  return result.data;
}

// Command-specific schemas
export const CreateTaskSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  project: z.string().trim().min(1, 'Project is required').pipe(ProjectKeySchema),
  issueType: z.string().trim().min(1, 'Issue type is required'),
  parent: IssueKeySchema.optional(),
});

export const AddCommentSchema = z.object({
  filePath: z.string().trim().min(1, 'File path is required').pipe(FilePathSchema),
  issueKey: z.string().trim().min(1, 'Issue key is required').pipe(IssueKeySchema),
});

export const UpdateDescriptionSchema = z.object({
  fromFile: z.string().trim().min(1, 'File path is required').pipe(FilePathSchema),
});



export const RunJqlSchema = z.object({
  limit: NumericStringSchema.optional(),
});

export const TimeframeSchema = z.string().regex(/^\d+d$/, 'Timeframe must be in format like "7d" or "30d"');

export const GetPersonWorklogSchema = z.object({
  groupByIssue: z.boolean().optional(),
});

export const GetIssueStatisticsSchema = z.object({
  fullBreakdown: z.boolean().optional(),
});

export const ProjectFiltersSchema = z.object({
  participated: z.object({
    was_assignee: z.boolean().optional(),
    was_reporter: z.boolean().optional(),
    was_commenter: z.boolean().optional(),
    is_watcher: z.boolean().optional(),
  }).optional(),
  jql: z.string().optional(),
});

export const ProjectConfigSchema = z.object({
  key: z.string().trim().min(1),
  commands: z.array(z.string()).optional(),
  filters: ProjectFiltersSchema.optional(),
});

export const ProjectSettingSchema = z.union([
  z.string().trim().min(1),
  ProjectConfigSchema
]);

export const OrganizationSettingsSchema = z.object({
  'allowed-jira-projects': z.array(ProjectSettingSchema).nullish().transform(val => val || ['all']),
  'allowed-commands': z.array(z.string()).nullish().transform(val => val || ['me', 'projects', 'task-with-details', 'run-jql', 'list-issue-types', 'project-statuses', 'create-task', 'list-colleagues', 'add-comment', 'add-label-to-issue', 'delete-label-from-issue', 'get-issue-statistics', 'get-person-worklog', 'organization', 'transition', 'update-description', 'confluence']),
  'allowed-confluence-spaces': z.array(z.string()).nullish().transform(val => val || ['all']),
});

export const SettingsSchema = z.object({
  defaults: OrganizationSettingsSchema.optional(),
  organizations: z.record(z.string(), OrganizationSettingsSchema).optional(),
  // Keep legacy fields for migration
  projects: z.array(ProjectSettingSchema).optional(),
  commands: z.array(z.string()).optional(),
});

