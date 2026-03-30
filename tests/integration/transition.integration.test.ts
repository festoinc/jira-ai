/**
 * RED integration tests for enhanced `issue transition` with required fields (JIR-63)
 *
 * These tests exercise the real Jira API at https://festoinc.atlassian.net
 * and will FAIL until the feature is implemented.
 *
 * Environment: set JIRA_HOST, JIRA_USER_EMAIL, JIRA_API_TOKEN in .env
 * or they will be injected from the test credentials stored below for CI.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  getIssueTransitions,
  transitionIssue,
  searchIssuesByJql,
} from '../../src/lib/jira-client.js';

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

describe('Transition integration tests — required fields (JIR-63)', () => {
  let issueKey: string;

  beforeAll(() => {

  });

  // -----------------------------------------------------------------------
  // Discover a suitable test issue
  // -----------------------------------------------------------------------
  it('should find a test issue in the festoinc project', async () => {
    const issues = await searchIssuesByJql('project = FESTO ORDER BY created DESC', 5);
    expect(issues.length).toBeGreaterThan(0);
    issueKey = issues[0].key;
    console.log(`Using test issue: ${issueKey}`);
  });

  // -----------------------------------------------------------------------
  // getIssueTransitions must return field metadata
  // -----------------------------------------------------------------------
  it('should return available transitions with field metadata for the test issue', async () => {
    if (!issueKey) {
      const issues = await searchIssuesByJql('project = FESTO ORDER BY created DESC', 1);
      issueKey = issues[0]?.key;
    }
    expect(issueKey).toBeDefined();

    const transitions = await getIssueTransitions(issueKey);

    expect(Array.isArray(transitions)).toBe(true);
    expect(transitions.length).toBeGreaterThan(0);

    // Each transition should include field metadata
    for (const t of transitions) {
      expect(t).toHaveProperty('id');
      expect(t).toHaveProperty('name');
      expect(t).toHaveProperty('to');
      // fields is expected once the implementation adds expand=transitions.fields
      expect(t).toHaveProperty('fields');
    }
  });

  // -----------------------------------------------------------------------
  // Transition with --resolution
  // -----------------------------------------------------------------------
  it('should transition an issue with a resolution field without 400 error', async () => {
    if (!issueKey) {
      const issues = await searchIssuesByJql('project = FESTO ORDER BY created DESC', 1);
      issueKey = issues[0]?.key;
    }
    expect(issueKey).toBeDefined();

    const transitions = await getIssueTransitions(issueKey);
    // Find a transition that ends in a "Done"-like state
    const doneTransition = transitions.find(
      t => /done|resolved|closed/i.test(t.to.name)
    );

    if (!doneTransition) {
      console.warn('No Done/Resolved transition found, skipping resolution test');
      return;
    }

    // This call uses the NEW third argument (fields payload) that will be
    // implemented in Step 3 of JIR-63.  Until then it will fail because
    // transitionIssue does not accept extra args.
    await expect(
      transitionIssue(issueKey, doneTransition.id, {
        fields: { resolution: { name: 'Done' } },
      })
    ).resolves.toBeUndefined();
  });
});
