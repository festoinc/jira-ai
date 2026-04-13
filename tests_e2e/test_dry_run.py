"""
E2E tests for the Dry-Run / Preview Mode feature (JIR-126).

Tests exercise the jira-ai CLI commands with --dry-run:
  1. `issue create --dry-run` — previews creation, no issue created
  2. `issue update --dry-run` — previews update, no fields changed
  3. `issue transition --dry-run` — previews transition, no status change
  4. Verify no side effects after all dry-run commands

Test credentials are stored in ~/.jira-ai/config.json (never committed).
Run from project root after `npm run build`.

Usage:
    python3 -m pytest tests_e2e/test_dry_run.py -v
"""

import base64
import json
import os
import re
import time

import pytest
import requests

from conftest import (
    REGULAR_PROJECT_KEY,
    run_cli,
    save_test_credentials,
)

TEST_JIRA_URL = os.environ.get("TEST_JIRA_URL", "https://festoinc.atlassian.net")
TEST_JIRA_EMAIL = os.environ.get("TEST_JIRA_EMAIL", "")
TEST_JIRA_TOKEN = os.environ.get("TEST_JIRA_TOKEN", "")

CREDENTIALS = f"{TEST_JIRA_EMAIL}:{TEST_JIRA_TOKEN}"
BASIC_AUTH = base64.b64encode(CREDENTIALS.encode()).decode()
API_HEADERS = {
    "Authorization": f"Basic {BASIC_AUTH}",
    "Content-Type": "application/json",
}

STABLE_ISSUE_KEY = "AT-196"


def parse_json_output(result):
    combined = result.stdout.strip()
    if not combined:
        combined = result.stderr.strip()
    return json.loads(combined)


def _extract_issue_key(result):
    output = result.stdout + "\n" + result.stderr
    match = re.search(rf"({REGULAR_PROJECT_KEY}-\d+)", output)
    return match.group(1) if match else None


def create_test_issue(title=None):
    ts = str(int(time.time()))
    issue_title = title or f"Dry Run E2E Fixture {ts}"
    result = run_cli(
        "issue", "create",
        "--title", issue_title,
        "--project", REGULAR_PROJECT_KEY,
        "--issue-type", "Task",
    )
    assert result.returncode == 0, f"Failed to create test issue: {result.stderr}"
    issue_key = _extract_issue_key(result)
    assert issue_key, f"Expected issue key in output: {result.stdout}"
    return issue_key


def delete_issue_via_api(issue_key):
    try:
        resp = requests.delete(
            f"{TEST_JIRA_URL}/rest/api/3/issue/{issue_key}?deleteSubtasks=true",
            headers=API_HEADERS,
            timeout=15,
        )
        return resp.status_code in (204, 200)
    except Exception:
        return False


def get_issue_via_api(issue_key):
    resp = requests.get(
        f"{TEST_JIRA_URL}/rest/api/3/issue/{issue_key}",
        headers=API_HEADERS,
        timeout=15,
    )
    if resp.status_code != 200:
        return None
    return resp.json()


def search_issues_via_api(jql):
    resp = requests.get(
        f"{TEST_JIRA_URL}/rest/api/3/search",
        headers=API_HEADERS,
        params={"jql": jql, "maxResults": 50},
        timeout=15,
    )
    if resp.status_code != 200:
        return []
    return resp.json().get("issues", [])


# =============================================================================
# 1. issue create --dry-run
# =============================================================================
class TestDryRunCreate:
    def test_output_is_valid_json(self):
        result = run_cli(
            "--dry-run", "issue", "create",
            "--project", REGULAR_PROJECT_KEY,
            "--issue-type", "Bug",
            "--title", "Dry Run E2E Test",
        )
        assert result.returncode == 0, f"Failed: {result.stderr}"
        data = parse_json_output(result)
        assert isinstance(data, dict)

    def test_dry_run_field_is_true(self):
        result = run_cli(
            "--dry-run", "issue", "create",
            "--project", REGULAR_PROJECT_KEY,
            "--issue-type", "Bug",
            "--title", "Dry Run E2E Test",
        )
        data = parse_json_output(result)
        assert data["dryRun"] is True

    def test_command_field_is_issue_create(self):
        result = run_cli(
            "--dry-run", "issue", "create",
            "--project", REGULAR_PROJECT_KEY,
            "--issue-type", "Bug",
            "--title", "Dry Run E2E Test",
        )
        data = parse_json_output(result)
        assert data["command"] == "issue.create"

    def test_changes_contains_fields_that_would_be_set(self):
        result = run_cli(
            "--dry-run", "issue", "create",
            "--project", REGULAR_PROJECT_KEY,
            "--issue-type", "Bug",
            "--title", "Dry Run E2E Test",
            "--priority", "High",
        )
        data = parse_json_output(result)
        assert "changes" in data
        changes = data["changes"]
        assert changes["project"] == REGULAR_PROJECT_KEY
        assert changes["summary"] == "Dry Run E2E Test"
        assert changes["issueType"] == "Bug"

    def test_message_says_no_changes_were_made(self):
        result = run_cli(
            "--dry-run", "issue", "create",
            "--project", REGULAR_PROJECT_KEY,
            "--issue-type", "Bug",
            "--title", "Dry Run E2E Test",
        )
        data = parse_json_output(result)
        assert "No changes were made" in data["message"]

    def test_no_issue_actually_created(self):
        unique_title = f"Dry Run NoCreate {int(time.time())} {os.getpid()}"
        result = run_cli(
            "--dry-run", "issue", "create",
            "--project", REGULAR_PROJECT_KEY,
            "--issue-type", "Bug",
            "--title", unique_title,
        )
        assert result.returncode == 0

        issues = search_issues_via_api(
            f'project = {REGULAR_PROJECT_KEY} AND summary ~ "{unique_title}"'
        )
        assert len(issues) == 0, (
            f"Dry-run should not have created an issue, found {len(issues)}"
        )

    def test_create_with_all_fields_dry_run(self):
        result = run_cli(
            "--dry-run", "issue", "create",
            "--project", REGULAR_PROJECT_KEY,
            "--issue-type", "Task",
            "--title", "Dry Run Full Create",
            "--priority", "High",
            "--description", "Test description",
            "--labels", "dry-run-test,qa",
            "--due-date", "2026-12-31",
        )
        assert result.returncode == 0
        data = parse_json_output(result)
        assert data["dryRun"] is True
        assert data["command"] == "issue.create"
        changes = data["changes"]
        assert changes["project"] == REGULAR_PROJECT_KEY
        assert changes["summary"] == "Dry Run Full Create"
        assert changes["issueType"] == "Task"


# =============================================================================
# 2. issue update --dry-run
# =============================================================================
class TestDryRunUpdate:
    def test_output_is_valid_json(self):
        result = run_cli(
            "--dry-run", "issue", "update", STABLE_ISSUE_KEY,
            "--priority", "High",
        )
        assert result.returncode == 0, f"Failed: {result.stderr}"
        data = parse_json_output(result)
        assert isinstance(data, dict)

    def test_dry_run_field_is_true(self):
        result = run_cli(
            "--dry-run", "issue", "update", STABLE_ISSUE_KEY,
            "--priority", "High",
        )
        data = parse_json_output(result)
        assert data["dryRun"] is True

    def test_command_field_is_issue_update(self):
        result = run_cli(
            "--dry-run", "issue", "update", STABLE_ISSUE_KEY,
            "--priority", "High",
        )
        data = parse_json_output(result)
        assert data["command"] == "issue.update"

    def test_changes_shows_priority_from_and_to(self):
        result = run_cli(
            "--dry-run", "issue", "update", STABLE_ISSUE_KEY,
            "--priority", "High",
        )
        data = parse_json_output(result)
        assert "changes" in data
        assert "priority" in data["changes"]
        priority = data["changes"]["priority"]
        assert "from" in priority
        assert "to" in priority
        assert priority["to"] == "High"

    def test_issue_not_actually_updated(self):
        issue_data = get_issue_via_api(STABLE_ISSUE_KEY)
        assert issue_data is not None
        original_priority = issue_data["fields"]["priority"]["name"]

        result = run_cli(
            "--dry-run", "issue", "update", STABLE_ISSUE_KEY,
            "--priority", "High",
        )
        assert result.returncode == 0

        verify_data = get_issue_via_api(STABLE_ISSUE_KEY)
        assert verify_data is not None
        current_priority = verify_data["fields"]["priority"]["name"]
        assert current_priority == original_priority, (
            f"Priority changed from {original_priority} to {current_priority}"
        )

    def test_update_summary_dry_run(self):
        result = run_cli(
            "--dry-run", "issue", "update", STABLE_ISSUE_KEY,
            "--summary", "Updated via dry-run",
        )
        assert result.returncode == 0
        data = parse_json_output(result)
        assert data["dryRun"] is True
        assert data["command"] == "issue.update"

    def test_update_labels_dry_run(self):
        result = run_cli(
            "--dry-run", "issue", "update", STABLE_ISSUE_KEY,
            "--labels", "dry-run-label,test",
        )
        assert result.returncode == 0
        data = parse_json_output(result)
        assert data["dryRun"] is True

    def test_message_says_no_changes_were_made(self):
        result = run_cli(
            "--dry-run", "issue", "update", STABLE_ISSUE_KEY,
            "--priority", "High",
        )
        data = parse_json_output(result)
        assert "No changes were made" in data["message"]


# =============================================================================
# 3. issue transition --dry-run
# =============================================================================
class TestDryRunTransition:
    def test_output_is_valid_json(self):
        result = run_cli(
            "--dry-run", "issue", "transition", STABLE_ISSUE_KEY, "Done",
            "--resolution", "Fixed",
        )
        assert result.returncode == 0, f"Failed: {result.stderr}"
        data = parse_json_output(result)
        assert isinstance(data, dict)

    def test_dry_run_field_is_true(self):
        result = run_cli(
            "--dry-run", "issue", "transition", STABLE_ISSUE_KEY, "Done",
            "--resolution", "Fixed",
        )
        data = parse_json_output(result)
        assert data["dryRun"] is True

    def test_command_field_is_issue_transition(self):
        result = run_cli(
            "--dry-run", "issue", "transition", STABLE_ISSUE_KEY, "Done",
            "--resolution", "Fixed",
        )
        data = parse_json_output(result)
        assert data["command"] == "issue.transition"

    def test_changes_shows_status_from_and_to(self):
        result = run_cli(
            "--dry-run", "issue", "transition", STABLE_ISSUE_KEY, "Done",
            "--resolution", "Fixed",
        )
        data = parse_json_output(result)
        assert "changes" in data
        assert "status" in data["changes"]
        status = data["changes"]["status"]
        assert "from" in status
        assert "to" in status
        assert status["to"] == "Done"

    def test_issue_not_actually_transitioned(self):
        issue_data = get_issue_via_api(STABLE_ISSUE_KEY)
        assert issue_data is not None
        original_status = issue_data["fields"]["status"]["name"]

        result = run_cli(
            "--dry-run", "issue", "transition", STABLE_ISSUE_KEY, "Done",
            "--resolution", "Fixed",
        )
        assert result.returncode == 0

        verify_data = get_issue_via_api(STABLE_ISSUE_KEY)
        assert verify_data is not None
        current_status = verify_data["fields"]["status"]["name"]
        assert current_status == original_status, (
            f"Status changed from {original_status} to {current_status}"
        )

    def test_transition_to_in_progress_dry_run(self):
        result = run_cli(
            "--dry-run", "issue", "transition", STABLE_ISSUE_KEY, "To Do",
        )
        assert result.returncode == 0
        data = parse_json_output(result)
        assert data["dryRun"] is True
        assert data["command"] == "issue.transition"

    def test_message_says_no_changes_were_made(self):
        result = run_cli(
            "--dry-run", "issue", "transition", STABLE_ISSUE_KEY, "Done",
            "--resolution", "Fixed",
        )
        data = parse_json_output(result)
        assert "No changes were made" in data["message"]


# =============================================================================
# 4. Verify no side effects — comprehensive check
# =============================================================================
class TestNoSideEffects:
    def test_create_then_verify_no_leftovers(self):
        ts = str(int(time.time()))
        unique_title = f"DryRunSideEffectCheck {ts} {os.getpid()}"

        issues_before = search_issues_via_api(
            f'project = {REGULAR_PROJECT_KEY} AND summary ~ "{unique_title}"'
        )
        assert len(issues_before) == 0

        result = run_cli(
            "--dry-run", "issue", "create",
            "--project", REGULAR_PROJECT_KEY,
            "--issue-type", "Bug",
            "--title", unique_title,
        )
        assert result.returncode == 0

        issues_after = search_issues_via_api(
            f'project = {REGULAR_PROJECT_KEY} AND summary ~ "{unique_title}"'
        )
        assert len(issues_after) == 0, (
            f"Dry-run created an issue unexpectedly: {len(issues_after)} found"
        )

    def test_update_then_verify_no_changes(self):
        issue_key = create_test_issue()
        try:
            issue_data = get_issue_via_api(issue_key)
            assert issue_data is not None
            original_priority = issue_data["fields"]["priority"]["name"]
            original_summary = issue_data["fields"]["summary"]

            run_cli(
                "--dry-run", "issue", "update", issue_key,
                "--priority", "High",
                "--summary", "Changed by dry-run",
            )

            verify_data = get_issue_via_api(issue_key)
            assert verify_data is not None
            assert verify_data["fields"]["priority"]["name"] == original_priority
            assert verify_data["fields"]["summary"] == original_summary
        finally:
            delete_issue_via_api(issue_key)

    def test_transition_then_verify_no_status_change(self):
        issue_key = create_test_issue()
        try:
            issue_data = get_issue_via_api(issue_key)
            assert issue_data is not None
            original_status = issue_data["fields"]["status"]["name"]

            run_cli(
                "--dry-run", "issue", "transition", issue_key, "Done",
                "--resolution", "Fixed",
            )

            verify_data = get_issue_via_api(issue_key)
            assert verify_data is not None
            assert verify_data["fields"]["status"]["name"] == original_status
        finally:
            delete_issue_via_api(issue_key)

    def test_sequential_dry_runs_no_cumulative_side_effects(self):
        issue_key = create_test_issue()
        try:
            issue_data = get_issue_via_api(issue_key)
            assert issue_data is not None
            original_priority = issue_data["fields"]["priority"]["name"]
            original_status = issue_data["fields"]["status"]["name"]

            run_cli(
                "--dry-run", "issue", "update", issue_key,
                "--priority", "High",
            )
            run_cli(
                "--dry-run", "issue", "transition", issue_key, "Done",
            )
            run_cli(
                "--dry-run", "issue", "create",
                "--project", REGULAR_PROJECT_KEY,
                "--issue-type", "Bug",
                "--title", f"Seq DryRun {int(time.time())}",
            )

            verify_data = get_issue_via_api(issue_key)
            assert verify_data is not None
            assert verify_data["fields"]["priority"]["name"] == original_priority
            assert verify_data["fields"]["status"]["name"] == original_status
        finally:
            delete_issue_via_api(issue_key)
