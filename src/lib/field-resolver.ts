import { getJiraClient } from './jira-client.js';

export interface JiraField {
  id: string;
  name: string;
  schema: { type: string; items?: string };
  custom: boolean;
  required?: boolean;
}

const TTL_MS = 30 * 60 * 1000; // 30 minutes

// Global field list cache with TTL
let allFieldsCache: JiraField[] | null = null;
let allFieldsCachedAt = 0;

// Per-project cache (inherits from global list)
const projectFieldsCache = new Map<string, { fields: JiraField[]; cachedAt: number }>();

/**
 * Fetch all Jira fields and cache them with a 30-minute TTL.
 */
async function getAllFields(): Promise<JiraField[]> {
  const now = Date.now();
  if (allFieldsCache !== null && now - allFieldsCachedAt < TTL_MS) {
    return allFieldsCache;
  }
  const client = getJiraClient();
  const raw = await client.issueFields.getFields() as any[];
  allFieldsCache = raw.map((f: any) => ({
    id: f.id || '',
    name: f.name || '',
    schema: f.schema || { type: 'string' },
    custom: f.custom || false,
    required: f.required,
  }));
  allFieldsCachedAt = now;
  return allFieldsCache;
}

/**
 * Resolve a Jira field by name (case-insensitive) or by field id.
 * Returns null if not found or if input is empty.
 */
export async function resolveField(nameOrId: string): Promise<JiraField | null> {
  if (!nameOrId) return null;
  const fields = await getAllFields();
  const lower = nameOrId.toLowerCase();
  return (
    fields.find(f => f.id === nameOrId) ||
    fields.find(f => f.name.toLowerCase() === lower) ||
    null
  );
}

/**
 * Return all available Jira fields, optionally filtered by issue type.
 * Results are cached per project key for 30 minutes.
 */
export async function getProjectFields(projectKey: string, issueType?: string): Promise<JiraField[]> {
  const now = Date.now();
  const cached = projectFieldsCache.get(projectKey);
  if (cached && now - cached.cachedAt < TTL_MS) {
    return cached.fields;
  }
  // For now the global field list is used (createmeta is deprecated in Cloud v3).
  // In a real implementation, we'd filter by project + issueType via a project-specific API.
  const fields = await getAllFields();
  projectFieldsCache.set(projectKey, { fields, cachedAt: now });
  return fields;
}

/**
 * Clear all field caches (primarily for testing).
 */
export function clearFieldCache(): void {
  allFieldsCache = null;
  allFieldsCachedAt = 0;
  projectFieldsCache.clear();
}

/**
 * Coerce a raw CLI string value to the correct Jira API format for the given field.
 */
export class FieldResolver {
  async coerceValue(fieldId: string, value: string): Promise<any> {
    const field = await resolveField(fieldId);
    if (!field) {
      throw new Error(`Unknown field: ${fieldId}`);
    }

    const type = field.schema.type;
    const items = field.schema.items;

    // Assignee: special case — support "accountid:<id>" prefix
    if (fieldId === 'assignee') {
      if (value.startsWith('accountid:')) {
        return { accountId: value.slice('accountid:'.length) };
      }
      return { accountId: value };
    }

    // Date field: pass through
    if (type === 'date') {
      return value;
    }

    // Priority: { name: '...' }
    if (type === 'priority') {
      return { name: value };
    }

    // Number fields
    if (type === 'number') {
      return Number(value);
    }

    // Array fields
    if (type === 'array') {
      const parts = value.split(',').map(s => s.trim()).filter(Boolean);
      if (items === 'string') {
        // labels
        return parts;
      }
      if (items === 'component' || items === 'version') {
        // components / fixVersions
        return parts.map(name => ({ name }));
      }
      return parts;
    }

    // Fallback: return as-is
    return value;
  }
}
