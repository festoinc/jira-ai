import { describe, it, expect, vi } from 'vitest';
import { ProjectKeySchema, IssueKeySchema, FilePathSchema, validateOptions } from '../src/lib/validation.js';
import * as fs from 'fs';
import { CliError } from '../src/types/errors.js';

vi.mock('fs');

describe('Validation Schemas', () => {
  describe('ProjectKeySchema', () => {
    it('should validate valid project keys', () => {
      expect(ProjectKeySchema.safeParse('PROJ').success).toBe(true);
      expect(ProjectKeySchema.safeParse('ABC').success).toBe(true);
      expect(ProjectKeySchema.safeParse('MYPROJECT').success).toBe(true);
    });

    it('should reject invalid project keys', () => {
      expect(ProjectKeySchema.safeParse('').success).toBe(false);
      expect(ProjectKeySchema.safeParse('a').success).toBe(false);
      expect(ProjectKeySchema.safeParse('proj').success).toBe(false);
      expect(ProjectKeySchema.safeParse('123').success).toBe(false);
      expect(ProjectKeySchema.safeParse('PROJ-123').success).toBe(false);
    });
  });

  describe('IssueKeySchema', () => {
    it('should validate valid issue keys', () => {
      expect(IssueKeySchema.safeParse('PROJ-123').success).toBe(true);
      expect(IssueKeySchema.safeParse('ABC-1').success).toBe(true);
    });

    it('should reject invalid issue keys', () => {
      expect(IssueKeySchema.safeParse('').success).toBe(false);
      expect(IssueKeySchema.safeParse('PROJ').success).toBe(false);
      expect(IssueKeySchema.safeParse('proj-123').success).toBe(false);
      expect(IssueKeySchema.safeParse('PROJ-ABC').success).toBe(false);
    });
  });

  describe('FilePathSchema', () => {
    it('should validate existing file paths', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      expect(FilePathSchema.safeParse('path/to/file.md').success).toBe(true);
    });

    it('should reject non-existent file paths', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      expect(FilePathSchema.safeParse('non/existent/file.md').success).toBe(false);
    });
  });
});

describe('validateOptions', () => {
  it('should return data if validation succeeds', () => {
    const schema = ProjectKeySchema;
    const result = validateOptions(schema, 'PROJ');
    expect(result).toBe('PROJ');
  });

  it('should throw CliError if validation fails', () => {
    const schema = ProjectKeySchema;
    expect(() => validateOptions(schema, 'invalid')).toThrow(CliError);
  });
});
