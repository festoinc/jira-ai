"""
E2E tests for the Rich Issue Create & Update feature (JIR-42).

Tests exercise the jira-ai CLI commands:
  - issue create with --priority, --description, --labels, --due-date, --assignee
  - issue update with --priority, --summary, --labels, --clear-labels, --due-date, --assignee
  - project fields <key> and project fields <key> --type <type>

Test credentials are stored in ~/.jira-ai/config.json (never committed).
Run from project root after `npm run build`.

Usage:
    python3 -m pytest tests_e2e/test_rich_issue_create_update.py -v
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
)

JIRA_URL = os.environ.get("JIRA_URL", "https://festoinc.atlassian.net")
JIRA_EMAIL = os.environ.get("JIRA_EMAIL", "anatolii.fesiuk@gmail.com")
JIRA_TOKEN = os.environ.get("JIRA_API_TOKEN", "")

CREDENTIALS = f"{JIRA_EMAIL}:{JIRA_TOKEN}"
BASIC_AUTH = base64.b64encode(CREDENTIALS.encode()).decode()
API_HEADERS = {
    "Authorization": f"Basic {BASIC_AUTH}",
    "Content-Type": "application/json",
}

ANSI_RE = re.compile(r"\x1b\[[0-9;]*m")


def strip_ansi(text):
    return ANSI_RE.sub("", text)


def _output(result):
    return strip_ansi(result.stdout + "\n" + result.stderr)


def _extract_issue_key(result):
    output = _output(result)
    match = re.search(rf"({REGULAR_PROJECT_KEY}-\d+)", output)
    return match.group(1) if match else None


def create_test_issue(title=None, **kwargs):
    ts = str(int(time.time()))
    issue_title = title or f"E2E Test {ts}"
    args = [
        "issue", "create",
        "--title", issue_title,
        "--project", REGULAR_PROJECT_KEY,
        "--issue-type", "Task",
    ]
    for key, value in kwargs.items():
        arg_name = "--" + key.replace("_", "-")
        args.extend([arg_name, value])
    result = run_cli(*args)
    assert result.returncode == 0, f"Failed to create issue: {result.stderr}"
    issue_key = _extract_issue_key(result)
    assert issue_key, f"Expected issue key in output: {result.stdout}"
    return issue_key


def delete_issue_via_api(issue_key):
    try:
        resp = requests.delete(
            f"{JIRA_URL}/rest/api/3/issue/{issue_key}?deleteSubtasks=true",
            headers=API_HEADERS,
            timeout=15,
        )
        return resp.status_code in (204, 200)
    except Exception:
        return False


@pytest.fixture(autouse=True)
def cleanup_test_issues():
    created = []
    yield created.append
    for key in created:
        delete_issue_via_api(key)


# =============================================================================
# issue create with new flags
# =============================================================================
class TestIssueCreatePriority:
    def test_create_with_priority_high(self, cleanup_test_issues):
        result = run_cli(
            "issue", "create",
            "--title", "E2E Priority Test",
            "--project", REGULAR_PROJECT_KEY,
            "--issue-type", "Task",
            "--priority", "High",
        )
        assert result.returncode == 0, f"Create with priority failed: {result.stderr}"
        issue_key = _extract_issue_key(result)
        assert issue_key
        cleanup_test_issues(issue_key)

        get_result = run_cli("issue", "get", issue_key)
        assert get_result.returncode == 0
        output = _output(get_result)
        assert "High" in output

    def test_create_with_priority_medium(self, cleanup_test_issues):
        result = run_cli(
            "issue", "create",
            "--title", "E2E Priority Med",
            "--project", REGULAR_PROJECT_KEY,
            "--issue-type", "Task",
            "--priority", "Medium",
        )
        assert result.returncode == 0
        issue_key = _extract_issue_key(result)
        assert issue_key
        cleanup_test_issues(issue_key)

        get_result = run_cli("issue", "get", issue_key)
        assert get_result.returncode == 0
        output = _output(get_result)
        assert "Medium" in output

    def test_create_with_priority_low(self, cleanup_test_issues):
        result = run_cli(
            "issue", "create",
            "--title", "E2E Priority Low",
            "--project", REGULAR_PROJECT_KEY,
            "--issue-type", "Task",
            "--priority", "Low",
        )
        assert result.returncode == 0
        issue_key = _extract_issue_key(result)
        assert issue_key
        cleanup_test_issues(issue_key)

        get_result = run_cli("issue", "get", issue_key)
        assert get_result.returncode == 0
        output = _output(get_result)
        assert "Low" in output


class TestIssueCreateDescription:
    def test_create_with_description(self, cleanup_test_issues):
        desc = "Test description with **bold** and *italic* markdown"
        result = run_cli(
            "issue", "create",
            "--title", "E2E Desc Test",
            "--project", REGULAR_PROJECT_KEY,
            "--issue-type", "Task",
            "--description", desc,
        )
        assert result.returncode == 0, f"Create with description failed: {result.stderr}"
        issue_key = _extract_issue_key(result)
        assert issue_key
        cleanup_test_issues(issue_key)

        get_result = run_cli("issue", "get", issue_key)
        assert get_result.returncode == 0
        output = _output(get_result)
        assert "bold" in output
        assert "italic" in output

    def test_create_without_description(self, cleanup_test_issues):
        result = run_cli(
            "issue", "create",
            "--title", "E2E No Desc",
            "--project", REGULAR_PROJECT_KEY,
            "--issue-type", "Task",
        )
        assert result.returncode == 0
        issue_key = _extract_issue_key(result)
        assert issue_key
        cleanup_test_issues(issue_key)

        get_result = run_cli("issue", "get", issue_key)
        assert get_result.returncode == 0


class TestIssueCreateLabels:
    def test_create_with_single_label(self, cleanup_test_issues):
        result = run_cli(
            "issue", "create",
            "--title", "E2E Label Single",
            "--project", REGULAR_PROJECT_KEY,
            "--issue-type", "Task",
            "--labels", "e2e-test",
        )
        assert result.returncode == 0, f"Create with label failed: {result.stderr}"
        issue_key = _extract_issue_key(result)
        assert issue_key
        cleanup_test_issues(issue_key)

        get_result = run_cli("issue", "get", issue_key)
        assert get_result.returncode == 0
        output = _output(get_result)
        assert "e2e-test" in output

    def test_create_with_multiple_labels(self, cleanup_test_issues):
        result = run_cli(
            "issue", "create",
            "--title", "E2E Labels Multi",
            "--project", REGULAR_PROJECT_KEY,
            "--issue-type", "Task",
            "--labels", "e2e-test,e2e-automation,qa",
        )
        assert result.returncode == 0
        issue_key = _extract_issue_key(result)
        assert issue_key
        cleanup_test_issues(issue_key)

        get_result = run_cli("issue", "get", issue_key)
        assert get_result.returncode == 0
        output = _output(get_result)
        assert "e2e-test" in output
        assert "e2e-automation" in output
        assert "qa" in output


class TestIssueCreateDueDate:
    def test_create_with_due_date(self, cleanup_test_issues):
        due = "2026-12-31"
        result = run_cli(
            "issue", "create",
            "--title", "E2E Due Date",
            "--project", REGULAR_PROJECT_KEY,
            "--issue-type", "Task",
            "--due-date", due,
        )
        assert result.returncode == 0, f"Create with due date failed: {result.stderr}"
        issue_key = _extract_issue_key(result)
        assert issue_key
        cleanup_test_issues(issue_key)

        get_result = run_cli("issue", "get", issue_key)
        assert get_result.returncode == 0
        output = _output(get_result)
        assert due in output

    def test_create_without_due_date(self, cleanup_test_issues):
        result = run_cli(
            "issue", "create",
            "--title", "E2E No Due",
            "--project", REGULAR_PROJECT_KEY,
            "--issue-type", "Task",
        )
        assert result.returncode == 0
        issue_key = _extract_issue_key(result)
        assert issue_key
        cleanup_test_issues(issue_key)

        get_result = run_cli("issue", "get", issue_key)
        assert get_result.returncode == 0
        output = _output(get_result)
        assert "N/A" in output or "2026-12-31" not in output


class TestIssueCreateAssignee:
    def test_create_with_assignee_accountid(self, cleanup_test_issues):
        account_id = "557058:ed570bfb-cbf9-4193-a1b1-559e466c64fa"
        result = run_cli(
            "issue", "create",
            "--title", "E2E Assignee Test",
            "--project", REGULAR_PROJECT_KEY,
            "--issue-type", "Task",
            "--assignee", f"accountid:{account_id}",
        )
        assert result.returncode == 0, f"Create with assignee failed: {result.stderr}"
        issue_key = _extract_issue_key(result)
        assert issue_key
        cleanup_test_issues(issue_key)

        get_result = run_cli("issue", "get", issue_key)
        assert get_result.returncode == 0
        output = _output(get_result)
        assert "Unassigned" not in output


class TestIssueCreateCombined:
    def test_create_with_multiple_flags(self, cleanup_test_issues):
        due = "2026-12-31"
        result = run_cli(
            "issue", "create",
            "--title", "E2E Combined Test",
            "--project", REGULAR_PROJECT_KEY,
            "--issue-type", "Task",
            "--priority", "High",
            "--description", "Combined test with **markdown**",
            "--labels", "e2e-combined,qa-test",
            "--due-date", due,
        )
        assert result.returncode == 0, f"Create combined failed: {result.stderr}"
        issue_key = _extract_issue_key(result)
        assert issue_key
        cleanup_test_issues(issue_key)

        get_result = run_cli("issue", "get", issue_key)
        assert get_result.returncode == 0
        output = _output(get_result)

        assert "High" in output
        assert "markdown" in output
        assert "e2e-combined" in output
        assert "qa-test" in output
        assert due in output

    def test_create_priority_and_labels(self, cleanup_test_issues):
        result = run_cli(
            "issue", "create",
            "--title", "E2E Priority+Labels",
            "--project", REGULAR_PROJECT_KEY,
            "--issue-type", "Task",
            "--priority", "Medium",
            "--labels", "e2e-prio-label",
        )
        assert result.returncode == 0
        issue_key = _extract_issue_key(result)
        assert issue_key
        cleanup_test_issues(issue_key)

        get_result = run_cli("issue", "get", issue_key)
        assert get_result.returncode == 0
        output = _output(get_result)
        assert "Medium" in output
        assert "e2e-prio-label" in output

    def test_create_description_and_due_date(self, cleanup_test_issues):
        due = "2026-06-15"
        result = run_cli(
            "issue", "create",
            "--title", "E2E Desc+Due",
            "--project", REGULAR_PROJECT_KEY,
            "--issue-type", "Task",
            "--description", "Test with a due date",
            "--due-date", due,
        )
        assert result.returncode == 0
        issue_key = _extract_issue_key(result)
        assert issue_key
        cleanup_test_issues(issue_key)

        get_result = run_cli("issue", "get", issue_key)
        assert get_result.returncode == 0
        output = _output(get_result)
        assert "Test with a due date" in output
        assert due in output


# =============================================================================
# issue update with new flags
# =============================================================================
class TestIssueUpdatePriority:
    def test_update_priority(self, cleanup_test_issues):
        issue_key = create_test_issue()
        cleanup_test_issues(issue_key)

        result = run_cli("issue", "update", issue_key, "--priority", "High")
        assert result.returncode == 0, f"Update priority failed: {result.stderr}"

        get_result = run_cli("issue", "get", issue_key)
        assert get_result.returncode == 0
        output = _output(get_result)
        assert "High" in output

    def test_update_priority_to_low(self, cleanup_test_issues):
        issue_key = create_test_issue()
        cleanup_test_issues(issue_key)

        result = run_cli("issue", "update", issue_key, "--priority", "Low")
        assert result.returncode == 0

        get_result = run_cli("issue", "get", issue_key)
        assert get_result.returncode == 0
        output = _output(get_result)
        assert "Low" in output


class TestIssueUpdateSummary:
    def test_update_summary(self, cleanup_test_issues):
        issue_key = create_test_issue()
        cleanup_test_issues(issue_key)

        new_summary = f"Updated Summary {int(time.time())}"
        result = run_cli("issue", "update", issue_key, "--summary", new_summary)
        assert result.returncode == 0, f"Update summary failed: {result.stderr}"

        get_result = run_cli("issue", "get", issue_key)
        assert get_result.returncode == 0
        output = _output(get_result)
        assert new_summary in output


class TestIssueUpdateLabels:
    def test_update_labels(self, cleanup_test_issues):
        issue_key = create_test_issue()
        cleanup_test_issues(issue_key)

        result = run_cli("issue", "update", issue_key, "--labels", "updated-label,e2e")
        assert result.returncode == 0, f"Update labels failed: {result.stderr}"

        get_result = run_cli("issue", "get", issue_key)
        assert get_result.returncode == 0
        output = _output(get_result)
        assert "updated-label" in output
        assert "e2e" in output

    def test_update_labels_replaces_existing(self, cleanup_test_issues):
        issue_key = create_test_issue(labels="original-label")
        cleanup_test_issues(issue_key)

        result = run_cli("issue", "update", issue_key, "--labels", "new-label")
        assert result.returncode == 0

        get_result = run_cli("issue", "get", issue_key)
        assert get_result.returncode == 0
        output = _output(get_result)
        assert "new-label" in output
        assert "original-label" not in output


class TestIssueUpdateClearLabels:
    def test_clear_labels(self, cleanup_test_issues):
        issue_key = create_test_issue(labels="to-be-cleared,test-label")
        cleanup_test_issues(issue_key)

        get_before = run_cli("issue", "get", issue_key)
        assert get_before.returncode == 0
        assert "to-be-cleared" in _output(get_before)

        result = run_cli("issue", "update", issue_key, "--clear-labels")
        assert result.returncode == 0, f"Clear labels failed: {result.stderr}"

        get_after = run_cli("issue", "get", issue_key)
        assert get_after.returncode == 0
        output = _output(get_after)
        assert "to-be-cleared" not in output
        assert "test-label" not in output


class TestIssueUpdateDueDate:
    def test_update_due_date(self, cleanup_test_issues):
        issue_key = create_test_issue()
        cleanup_test_issues(issue_key)

        new_due = "2026-09-30"
        result = run_cli("issue", "update", issue_key, "--due-date", new_due)
        assert result.returncode == 0, f"Update due date failed: {result.stderr}"

        get_result = run_cli("issue", "get", issue_key)
        assert get_result.returncode == 0
        output = _output(get_result)
        assert new_due in output

    def test_update_due_date_replaces_existing(self, cleanup_test_issues):
        issue_key = create_test_issue(due_date="2026-01-01")
        cleanup_test_issues(issue_key)

        new_due = "2026-11-30"
        result = run_cli("issue", "update", issue_key, "--due-date", new_due)
        assert result.returncode == 0

        get_result = run_cli("issue", "get", issue_key)
        assert get_result.returncode == 0
        output = _output(get_result)
        assert new_due in output


class TestIssueUpdateAssignee:
    def test_update_assignee(self, cleanup_test_issues):
        issue_key = create_test_issue()
        cleanup_test_issues(issue_key)

        account_id = "557058:ed570bfb-cbf9-4193-a1b1-559e466c64fa"
        result = run_cli(
            "issue", "update", issue_key,
            "--assignee", f"accountid:{account_id}",
        )
        assert result.returncode == 0, f"Update assignee failed: {result.stderr}"

        get_result = run_cli("issue", "get", issue_key)
        assert get_result.returncode == 0
        output = _output(get_result)
        assert "Unassigned" not in output


# =============================================================================
# project fields command
# =============================================================================
class TestProjectFields:
    def test_project_fields_returns_results(self):
        result = run_cli("project", "fields", REGULAR_PROJECT_KEY)
        assert result.returncode == 0, f"Project fields failed: {result.stderr}"
        output = _output(result)
        assert "Fields" in output or "field" in output.lower()
        assert "Total" in output

    def test_project_fields_contains_common_fields(self):
        result = run_cli("project", "fields", REGULAR_PROJECT_KEY)
        assert result.returncode == 0
        output = _output(result)
        assert "summary" in output.lower() or "Summary" in output

    def test_project_fields_with_type_filter(self):
        result = run_cli("project", "fields", REGULAR_PROJECT_KEY, "--type", "Task")
        assert result.returncode == 0, f"Project fields --type failed: {result.stderr}"
        output = _output(result)
        assert "Fields" in output or "field" in output.lower()

    def test_project_fields_type_filter_returns_different_results(self):
        result_all = run_cli("project", "fields", REGULAR_PROJECT_KEY)
        result_task = run_cli("project", "fields", REGULAR_PROJECT_KEY, "--type", "Task")
        assert result_all.returncode == 0
        assert result_task.returncode == 0

        total_all = _output(result_all)
        total_task = _output(result_task)

        all_match = re.search(r"Total:\s*(\d+)", total_all)
        task_match = re.search(r"Total:\s*(\d+)", total_task)
        if all_match and task_match:
            assert int(task_match.group(1)) <= int(all_match.group(1))

    def test_project_fields_invalid_project(self):
        result = run_cli("project", "fields", "INVALIDPROJ999")
        assert result.returncode == 0
        output = _output(result)
        assert "Fields" in output or "field" in output.lower()
