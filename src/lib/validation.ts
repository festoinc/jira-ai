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

const DateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

const CustomFieldSchema = z
  .string()
  .refine(v => v.includes('='), { message: 'Custom field must be in format fieldId=value' });

// Command-specific schemas
export const CreateTaskSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  project: z.string().trim().min(1, 'Project is required').pipe(ProjectKeySchema),
  issueType: z.string().trim().min(1, 'Issue type is required'),
  parent: IssueKeySchema.optional(),
  priority: z.string().trim().min(1).optional(),
  description: z.string().optional(),
  descriptionFile: z.string().optional(),
  labels: z.string().optional(),
  component: z.string().optional(),
  fixVersion: z.string().optional(),
  dueDate: DateStringSchema.optional(),
  assignee: z.string().optional(),
  customField: z.array(CustomFieldSchema).optional(),
}).refine(
  data => !(data.description && data.descriptionFile),
  { message: 'Cannot use both --description and --description-file at the same time' }
);

export const UpdateIssueSchema = z.object({
  priority: z.string().trim().min(1).optional(),
  summary: z.string().trim().min(1).optional(),
  description: z.string().optional(),
  fromFile: z.string().optional(),
  labels: z.string().optional(),
  clearLabels: z.boolean().optional(),
  component: z.string().optional(),
  fixVersion: z.string().optional(),
  dueDate: DateStringSchema.optional(),
  assignee: z.string().optional(),
  customField: z.array(CustomFieldSchema).optional(),
}).refine(
  data =>
    data.priority !== undefined ||
    data.summary !== undefined ||
    data.description !== undefined ||
    data.fromFile !== undefined ||
    data.labels !== undefined ||
    data.clearLabels === true ||
    data.component !== undefined ||
    data.fixVersion !== undefined ||
    data.dueDate !== undefined ||
    data.assignee !== undefined ||
    (data.customField && data.customField.length > 0),
  { message: 'At least one field to update must be provided' }
);

export const ProjectFieldsSchema = z.object({
  type: z.string().optional(),
  custom: z.boolean().optional(),
  search: z.string().optional(),
});

export const AddCommentSchema = z.object({
  filePath: z.string().trim().min(1, 'File path is required').pipe(FilePathSchema),
  issueKey: z.string().trim().min(1, 'Issue key is required').pipe(IssueKeySchema),
});

export const ConfluenceAddCommentSchema = z.object({
  fromFile: z.string().trim().min(1, 'File path is required').pipe(FilePathSchema),
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

/**
 * Schema for hierarchical command names (e.g., "issue", "issue.get", "issue.label.add")
 * Also accepts 'all' for allowing all commands
 */
export const HierarchicalCommandSchema = z.string().regex(
  /^(all|[a-z]+(\.[a-z]+)*)$/,
  'Command must be "all" or lowercase dot-separated (e.g., "issue", "issue.get", "issue.label.add")'
);

// Default allowed commands using hierarchical structure
const DEFAULT_ALLOWED_COMMANDS = [
  'issue',
  'project',
  'user',
  'confl',
  'epic',
];

export const ProjectConfigSchema = z.object({
  key: z.string().trim().min(1),
  commands: z.array(z.string()).optional(),  // Can be legacy or hierarchical
  filters: ProjectFiltersSchema.optional(),
});

export const ProjectSettingSchema = z.union([
  z.string().trim().min(1),
  ProjectConfigSchema
]);

export const OrganizationSettingsSchema = z.object({
  'allowed-jira-projects': z.array(ProjectSettingSchema).nullish().transform(val => val || ['all']),
  'allowed-commands': z.array(z.string()).nullish().transform(val => val || DEFAULT_ALLOWED_COMMANDS),
  'allowed-confluence-spaces': z.array(z.string()).nullish().transform(val => val || ['all']),
});

export const SettingsSchema = z.object({
  defaults: OrganizationSettingsSchema.optional(),
  projects: z.array(ProjectSettingSchema).optional(),
  commands: z.array(z.string()).optional(),
});

// =============================================================================
// EPIC VALIDATION SCHEMAS
// =============================================================================

export const EpicListSchema = z.object({
  done: z.boolean().optional(),
  max: NumericStringSchema.optional(),
});

export const EpicCreateSchema = z.object({
  name: z.string().trim().min(1, 'Epic name is required'),
  summary: z.string().trim().min(1, 'Summary is required'),
  description: z.string().trim().optional(),
  labels: z.string().optional(),
});

export const EpicUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  summary: z.string().trim().min(1).optional(),
}).refine(data => data.name || data.summary, {
  message: 'At least one of --name or --summary is required',
});

export const EpicLinkSchema = z.object({
  epic: z.string().trim().min(1, 'Epic key is required').pipe(IssueKeySchema),
});

export const EpicMaxSchema = z.object({
  max: NumericStringSchema.optional(),
});

