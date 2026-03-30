"""
E2E tests for the issue transitions commands (JIR-63).

Tests cover:
  1. `issue transitions <key>` — lists transitions with required fields
  2. `issue transition <key> <status>` — backward-compatible plain transition
  3. `issue transition <key> <status> --json` — JSON output
  4. `issue transitions <key> --json` — structured JSON output
  5. Error handling — invalid transition name
  6. Flag validation — mutual exclusivity of --comment and --comment-file

Run from project root after `npm run build`:

    python3 -m pytest tests_e2e/test_transitions.py -v
"""

import json
import os
import re
import subprocess
import time

import pytest

CLI_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "dist", "cli.js"
)

REGULAR_PROJECT_KEY = "AT"

STABLE_ISSUE_KEY = "AT-196"


def run_cli(*args, timeout=60):
    cmd = ["node", CLI_PATH] + list(args)
    env = os.environ.copy()
    env["NODE_OPTIONS"] = "--no-warnings"
    result = subprocess.run(
        cmd, capture_output=True, text=True, timeout=timeout, env=env
    )
    return result


def parse_json_output(result):
    combined = result.stdout.strip()
    if not combined:
        combined = result.stderr.strip()
    return json.loads(combined)


def create_test_issue(title=None):
    ts = str(int(time.time()))
    issue_title = title or f"Transition E2E Test {ts}"
    result = run_cli(
        "issue", "create",
        "--title", issue_title,
        "--project", REGULAR_PROJECT_KEY,
        "--issue-type", "Task",
    )
    assert result.returncode == 0, f"Failed to create test issue: {result.stderr}"
    match = re.search(rf"({REGULAR_PROJECT_KEY}-\d+)", result.stdout)
    assert match, f"Expected issue key in output: {result.stdout}"
    return match.group(1)


def delete_issue(issue_key):
    run_cli("issue", "delete", issue_key, "--confirm")


def get_issue_status(issue_key):
    result = run_cli("--json", "issue", "get", issue_key)
    if result.returncode != 0:
        return None
    data = parse_json_output(result)
    status = data.get("status")
    if isinstance(status, dict):
        return status.get("name")
    return status


# =============================================================================
# 1. issue transitions <key> — list transitions with required fields
# =============================================================================
class TestListTransitions:
    def test_lists_transitions(self):
        result = run_cli("issue", "transitions", STABLE_ISSUE_KEY)
        assert result.returncode == 0, f"Failed: {result.stderr}"
        assert "To Do" in result.stdout
        assert "In Progress" in result.stdout
        assert "Done" in result.stdout
        assert "required:" in result.stdout

    def test_shows_required_fields_column(self):
        result = run_cli("issue", "transitions", STABLE_ISSUE_KEY)
        assert result.returncode == 0, f"Failed: {result.stderr}"
        lines = result.stdout.strip().split("\n")
        assert any("required:" in line for line in lines)

    def test_invalid_issue_key(self):
        result = run_cli("issue", "transitions", "INVALID-99999")
        assert result.returncode != 0


# =============================================================================
# 2. issue transition <key> <status> — backward-compatible plain transition
# =============================================================================
class TestPlainTransition:
    def test_transition_to_status(self):
        issue_key = create_test_issue()
        try:
            result = run_cli("issue", "transition", issue_key, "In Progress")
            assert result.returncode == 0, f"Failed: {result.stderr}"
            assert "successfully transitioned" in result.stdout.lower() or "In Progress" in result.stdout

            status = get_issue_status(issue_key)
            assert status is not None
            assert status.lower() == "in progress"
        finally:
            delete_issue(issue_key)

    def test_transition_case_insensitive(self):
        issue_key = create_test_issue()
        try:
            result = run_cli("issue", "transition", issue_key, "in progress")
            assert result.returncode == 0, f"Failed: {result.stderr}"

            status = get_issue_status(issue_key)
            assert status is not None
            assert status.lower() == "in progress"
        finally:
            delete_issue(issue_key)

    def test_transition_round_trip(self):
        issue_key = create_test_issue()
        try:
            result1 = run_cli("issue", "transition", issue_key, "In Progress")
            assert result1.returncode == 0, f"Failed: {result1.stderr}"

            result2 = run_cli("issue", "transition", issue_key, "To Do")
            assert result2.returncode == 0, f"Failed: {result2.stderr}"

            status = get_issue_status(issue_key)
            assert status is not None
            assert status.lower() == "to do"
        finally:
            delete_issue(issue_key)


# =============================================================================
# 3. issue transition <key> <status> --json — JSON output
# =============================================================================
class TestTransitionJson:
    def test_json_output(self):
        issue_key = create_test_issue()
        try:
            result = run_cli("--json", "issue", "transition", issue_key, "In Progress")
            assert result.returncode == 0, f"Failed: {result.stderr}"
            data = parse_json_output(result)
            assert isinstance(data, dict)
            assert data["success"] is True
            assert data["issueKey"] == issue_key
            assert "status" in data
            assert data["status"].lower() == "in progress"
        finally:
            delete_issue(issue_key)


# =============================================================================
# 4. issue transitions <key> --json — structured JSON output
# =============================================================================
class TestTransitionsJson:
    def test_json_output(self):
        result = run_cli("--json", "issue", "transitions", STABLE_ISSUE_KEY)
        assert result.returncode == 0, f"Failed: {result.stderr}"
        data = parse_json_output(result)
        assert isinstance(data, list)
        assert len(data) > 0

        entry = data[0]
        assert "id" in entry
        assert "name" in entry
        assert "to" in entry
        assert "requiredFields" in entry

    def test_json_contains_expected_statuses(self):
        result = run_cli("--json", "issue", "transitions", STABLE_ISSUE_KEY)
        assert result.returncode == 0
        data = parse_json_output(result)
        status_names = [t["to"] for t in data]
        assert "To Do" in status_names
        assert "In Progress" in status_names
        assert "Done" in status_names

    def test_required_only_flag_json(self):
        result = run_cli("--json", "issue", "transitions", STABLE_ISSUE_KEY, "--required-only")
        assert result.returncode == 0
        data = parse_json_output(result)
        assert isinstance(data, list)
        for entry in data:
            assert entry["requiredFields"] != "(none)"


# =============================================================================
# 5. Error handling — invalid transition name
# =============================================================================
class TestTransitionErrors:
    def test_invalid_transition_name(self):
        result = run_cli("issue", "transition", STABLE_ISSUE_KEY, "NonExistentStatus")
        assert result.returncode != 0
        assert "No transition found" in result.stderr or "No transition found" in result.stdout

    def test_invalid_transition_json(self):
        result = run_cli("--json", "issue", "transition", STABLE_ISSUE_KEY, "NonExistentStatus")
        assert result.returncode != 0

    def test_invalid_issue_key_transition(self):
        result = run_cli("issue", "transition", "INVALID-99999", "To Do")
        assert result.returncode != 0


# =============================================================================
# 6. Flag validation — mutual exclusivity of --comment and --comment-file
# =============================================================================
class TestFlagValidation:
    def test_comment_and_comment_file_mutual_exclusivity(self):
        issue_key = create_test_issue()
        try:
            tmpfile = f"/tmp/test_comment_{int(time.time())}.md"
            with open(tmpfile, "w") as f:
                f.write("Test comment body")

            result = run_cli(
                "issue", "transition", issue_key, "In Progress",
                "--comment", "inline comment",
                "--comment-file", tmpfile,
            )
            assert result.returncode != 0
            assert "Cannot use both" in result.stderr or "Cannot use both" in result.stdout

            os.unlink(tmpfile)
        finally:
            delete_issue(issue_key)

    def test_comment_and_comment_file_json_mode(self):
        issue_key = create_test_issue()
        try:
            tmpfile = f"/tmp/test_comment_{int(time.time())}.md"
            with open(tmpfile, "w") as f:
                f.write("Test comment body")

            result = run_cli(
                "--json", "issue", "transition", issue_key, "In Progress",
                "--comment", "inline comment",
                "--comment-file", tmpfile,
            )
            assert result.returncode != 0

            os.unlink(tmpfile)
        finally:
            delete_issue(issue_key)
