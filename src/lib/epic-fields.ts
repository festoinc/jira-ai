import { getJiraClient } from './jira-client.js';
import { getProjectFields, clearFieldCache as clearResolverCache } from './field-resolver.js';

export interface EpicFields {
  epicNameField: string;   // e.g. "customfield_10014" — stores the epic name
  epicLinkField: string;   // e.g. "customfield_10011" — links issues to epics
  storyPointField?: string; // e.g. "customfield_10016" — story points
}

// Module-level cache: null means "no epic fields found"; undefined means "not yet fetched"
const epicFieldsCache = new Map<string, EpicFields | null>();

/**
 * Fetch all Jira fields via the shared field-resolver (cached with TTL).
 */
async function getAllFields(): Promise<Array<{ id: string; name: string; custom: boolean }>> {
  // Delegate to field-resolver which handles caching with TTL
  return getProjectFields('__global__');
}

/**
 * Discover epic custom field IDs.
 * Strategy: Use /rest/api/3/field as primary (createmeta is deprecated in Cloud v3).
 * Search by name for "Epic Name", "Epic Link", and story point variants.
 * Results are cached per-project-key after first call.
 * Returns null if epic fields are not found (likely a next-gen project).
 */
export async function getEpicFields(projectKey: string): Promise<EpicFields | null> {
  if (epicFieldsCache.has(projectKey)) {
    return epicFieldsCache.get(projectKey)!;
  }

  const fields = await getAllFields();

  let epicNameField: string | undefined;
  let epicLinkField: string | undefined;
  let storyPointField: string | undefined;

  for (const field of fields) {
    const nameLower = field.name.toLowerCase();
    if (nameLower === 'epic name') {
      epicNameField = field.id;
    } else if (nameLower === 'epic link') {
      epicLinkField = field.id;
    } else if (nameLower === 'story points' || nameLower === 'story point estimate') {
      storyPointField = field.id;
    }
  }

  if (!epicNameField || !epicLinkField) {
    epicFieldsCache.set(projectKey, null);
    return null;
  }

  const result: EpicFields = { epicNameField, epicLinkField, storyPointField };
  epicFieldsCache.set(projectKey, result);
  return result;
}

/**
 * Check if a project is a next-gen (team-managed) project.
 * Next-gen projects don't use epic custom fields — they use parent/child issue hierarchy.
 */
export async function isNextGenProject(projectKey: string): Promise<boolean> {
  const client = getJiraClient();
  const project = await client.projects.getProject({ projectIdOrKey: projectKey }) as any;
  return project?.style === 'next_gen';
}

/**
 * Clear the epic fields cache (primarily for testing).
 */
export function clearEpicFieldsCache(): void {
  epicFieldsCache.clear();
  clearResolverCache();
}
