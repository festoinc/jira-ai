import { describe, it, expect, beforeAll } from 'vitest';
import { getProjects } from '../../src/lib/jira-client.js';
import { checkEnv } from './integration-test-utils.js';

describe('projects integration test', () => {
  beforeAll(() => {
    checkEnv();
  });

  it('should fetch projects from Jira', async () => {
    const projects = await getProjects();
    
    expect(Array.isArray(projects)).toBe(true);
    if (projects.length > 0) {
      expect(projects[0].id).toBeDefined();
      expect(projects[0].key).toBeDefined();
      expect(projects[0].name).toBeDefined();
    }
  });
});
