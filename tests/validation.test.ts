import { describe, it, expect, vi } from 'vitest';
import { ProjectKeySchema, IssueKeySchema, FilePathSchema, validateOptions, CreateTaskSchema } from '../src/lib/validation.js';
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

// =============================================================================
// JIR-42: New schemas — intentionally RED (not yet added to validation.ts)
// =============================================================================

// UpdateIssueSchema and ProjectFieldsSchema are imported from validation.js below
// (these schemas don't exist yet — tests are intentionally RED)
import {
  UpdateIssueSchema,
  ProjectFieldsSchema,
} from '../src/lib/validation.js';

describe('CreateTaskSchema — new optional fields (JIR-42)', () => {
  it('should accept priority', () => {
    const result = CreateTaskSchema.safeParse({
      title: 'My Task',
      project: 'PROJ',
      issueType: 'Task',
      priority: 'High',
    });
    expect(result.success).toBe(true);
  });

  it('should accept description string', () => {
    const result = CreateTaskSchema.safeParse({
      title: 'My Task',
      project: 'PROJ',
      issueType: 'Task',
      description: '# Heading',
    });
    expect(result.success).toBe(true);
  });

  it('should accept labels as comma-separated string', () => {
    const result = CreateTaskSchema.safeParse({
      title: 'My Task',
      project: 'PROJ',
      issueType: 'Task',
      labels: 'bug,frontend',
    });
    expect(result.success).toBe(true);
  });

  it('should accept component', () => {
    const result = CreateTaskSchema.safeParse({
      title: 'My Task',
      project: 'PROJ',
      issueType: 'Task',
      component: 'Backend',
    });
    expect(result.success).toBe(true);
  });

  it('should accept fixVersion', () => {
    const result = CreateTaskSchema.safeParse({
      title: 'My Task',
      project: 'PROJ',
      issueType: 'Task',
      fixVersion: 'v1.0',
    });
    expect(result.success).toBe(true);
  });

  it('should accept dueDate in YYYY-MM-DD format', () => {
    const result = CreateTaskSchema.safeParse({
      title: 'My Task',
      project: 'PROJ',
      issueType: 'Task',
      dueDate: '2025-12-31',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid dueDate format', () => {
    const result = CreateTaskSchema.safeParse({
      title: 'My Task',
      project: 'PROJ',
      issueType: 'Task',
      dueDate: 'tomorrow',
    });
    expect(result.success).toBe(false);
  });

  it('should accept assignee string', () => {
    const result = CreateTaskSchema.safeParse({
      title: 'My Task',
      project: 'PROJ',
      issueType: 'Task',
      assignee: 'accountid:abc123',
    });
    expect(result.success).toBe(true);
  });

  it('should accept customField array', () => {
    const result = CreateTaskSchema.safeParse({
      title: 'My Task',
      project: 'PROJ',
      issueType: 'Task',
      customField: ['customfield_10100=5'],
    });
    expect(result.success).toBe(true);
  });

  it('should reject customField entry missing = separator', () => {
    const result = CreateTaskSchema.safeParse({
      title: 'My Task',
      project: 'PROJ',
      issueType: 'Task',
      customField: ['customfield_10100'],
    });
    expect(result.success).toBe(false);
  });

  it('should reject both description and descriptionFile set', () => {
    const result = CreateTaskSchema.safeParse({
      title: 'My Task',
      project: 'PROJ',
      issueType: 'Task',
      description: '# Heading',
      descriptionFile: '/path/to/file.md',
    });
    expect(result.success).toBe(false);
  });
});

describe('UpdateIssueSchema (JIR-42)', () => {
  it('should validate with priority only', () => {
    const result = UpdateIssueSchema.safeParse({ priority: 'High' });
    expect(result.success).toBe(true);
  });

  it('should validate with summary only', () => {
    const result = UpdateIssueSchema.safeParse({ summary: 'New title' });
    expect(result.success).toBe(true);
  });

  it('should validate with labels', () => {
    const result = UpdateIssueSchema.safeParse({ labels: 'bug,frontend' });
    expect(result.success).toBe(true);
  });

  it('should validate with clearLabels', () => {
    const result = UpdateIssueSchema.safeParse({ clearLabels: true });
    expect(result.success).toBe(true);
  });

  it('should validate with component', () => {
    const result = UpdateIssueSchema.safeParse({ component: 'Backend' });
    expect(result.success).toBe(true);
  });

  it('should validate with fixVersion', () => {
    const result = UpdateIssueSchema.safeParse({ fixVersion: 'v1.0' });
    expect(result.success).toBe(true);
  });

  it('should validate with dueDate in YYYY-MM-DD format', () => {
    const result = UpdateIssueSchema.safeParse({ dueDate: '2025-12-31' });
    expect(result.success).toBe(true);
  });

  it('should reject invalid dueDate format', () => {
    const result = UpdateIssueSchema.safeParse({ dueDate: 'not-a-date' });
    expect(result.success).toBe(false);
  });

  it('should validate with assignee', () => {
    const result = UpdateIssueSchema.safeParse({ assignee: 'accountid:abc123' });
    expect(result.success).toBe(true);
  });

  it('should validate with customField array', () => {
    const result = UpdateIssueSchema.safeParse({ customField: ['customfield_10100=5'] });
    expect(result.success).toBe(true);
  });

  it('should reject when no fields are provided', () => {
    const result = UpdateIssueSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('should reject empty summary', () => {
    const result = UpdateIssueSchema.safeParse({ summary: '' });
    expect(result.success).toBe(false);
  });

  it('should reject empty priority', () => {
    const result = UpdateIssueSchema.safeParse({ priority: '' });
    expect(result.success).toBe(false);
  });

  it('should reject customField entry missing = separator', () => {
    const result = UpdateIssueSchema.safeParse({ customField: ['customfield_10100'] });
    expect(result.success).toBe(false);
  });

  it('should accept fromFile combined with other fields', () => {
    const result = UpdateIssueSchema.safeParse({ priority: 'Low', fromFile: '/path/to/desc.md' });
    expect(result.success).toBe(true);
  });
});

describe('ProjectFieldsSchema (JIR-42)', () => {
  it('should validate with only project key', () => {
    const result = ProjectFieldsSchema.safeParse({ project: 'PROJ' });
    expect(result.success).toBe(true);
  });

  it('should validate with project key and issue type filter', () => {
    const result = ProjectFieldsSchema.safeParse({ project: 'PROJ', type: 'Bug' });
    expect(result.success).toBe(true);
  });

  it('should validate with custom flag', () => {
    const result = ProjectFieldsSchema.safeParse({ project: 'PROJ', custom: true });
    expect(result.success).toBe(true);
  });

  it('should validate with search term', () => {
    const result = ProjectFieldsSchema.safeParse({ project: 'PROJ', search: 'Story' });
    expect(result.success).toBe(true);
  });

  it('should accept empty options (project key validated separately as positional arg)', () => {
    const result = ProjectFieldsSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});
