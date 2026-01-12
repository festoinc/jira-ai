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
    const issues = result.error.issues || [];
    const simpleErrorMessages = issues
      .map((err) => {
        // If it's a simple string validation (no object path), just return the message
        if (err.path.length === 0) return err.message;
        // For object validation, include the field name
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

