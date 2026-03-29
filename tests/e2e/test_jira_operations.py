import os
import re
import tempfile
import time

import pytest

from conftest import run_cli

PROJECT_KEY = "AT"
LABEL_UNIQUE = "e2e-label"


def find_first_issue_key():
    result = run_cli("issue", "search", f"project = {PROJECT_KEY} ORDER BY created DESC", "--limit", "1")
    assert result.returncode == 0, f"Search failed: {result.stderr}"
    match = re.search(r"([A-Z]+-\d+)", result.stdout)
    if match:
        return match.group(1)
    pytest.skip(f"No issues found in project {PROJECT_KEY}")


class TestIssueSearch:
    def test_issue_search_returns_results(self):
        result = run_cli("issue", "search", f"project = {PROJECT_KEY} ORDER BY created DESC", "--limit", "5")
        assert result.returncode == 0, f"Search failed: {result.stderr}"

    def test_issue_search_with_limit(self):
        result = run_cli("issue", "search", f"project = {PROJECT_KEY}", "--limit", "1")
        assert result.returncode == 0, f"Search with limit failed: {result.stderr}"

    def test_issue_search_invalid_jql_gives_error(self):
        result = run_cli("issue", "search", "INVALID JQL SYNTAX !!!")
        assert result.returncode != 0, "Invalid JQL should return non-zero"


class TestIssueGet:
    def test_issue_get_existing(self):
        issue_key = find_first_issue_key()
        result = run_cli("issue", "get", issue_key)
        assert result.returncode == 0, f"Get issue failed: {result.stderr}"
        assert issue_key in result.stdout, f"Issue key should appear in output"

    def test_issue_get_nonexistent(self):
        result = run_cli("issue", "get", "AT-999999")
        assert result.returncode != 0, "Getting nonexistent issue should fail"

    def test_issue_get_with_detailed_history(self):
        issue_key = find_first_issue_key()
        result = run_cli("issue", "get", issue_key, "--include-detailed-history", "--history-limit", "5")
        assert result.returncode == 0, f"Get with history failed: {result.stderr}"


class TestIssueCreate:
    def test_issue_create_and_get(self):
        uid = str(int(time.time()))
        title = f"E2E Test Issue {uid}"
        result = run_cli(
            "issue", "create",
            "--title", title,
            "--project", PROJECT_KEY,
            "--issue-type", "Task",
        )
        assert result.returncode == 0, f"Create issue failed: {result.stderr}"

        match = re.search(rf"({PROJECT_KEY}-\d+)", result.stdout)
        assert match, f"Expected issue key in create output: {result.stdout}"
        issue_key = match.group(1)

        result = run_cli("issue", "get", issue_key)
        assert result.returncode == 0
        assert title in result.stdout or issue_key in result.stdout


class TestIssueTransition:
    def test_issue_transition_to_in_progress_and_back(self):
        issue_key = find_first_issue_key()
        result = run_cli("issue", "get", issue_key)
        assert result.returncode == 0

        result = run_cli("issue", "transition", issue_key, "In Progress")
        if result.returncode == 0:
            result = run_cli("issue", "get", issue_key)
            assert "In Progress" in result.stdout

            run_cli("issue", "transition", issue_key, "To Do")


class TestIssueUpdate:
    def test_issue_update_description(self):
        issue_key = find_first_issue_key()
        with tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False) as f:
            f.write(f"# E2E Test Update\n\nUpdated at {time.time()}")
            tmp_path = f.name
        try:
            result = run_cli("issue", "update", issue_key, "--from-file", tmp_path)
            assert result.returncode == 0, f"Update failed: {result.stderr}"
        finally:
            os.unlink(tmp_path)


class TestIssueComment:
    def test_add_comment(self):
        issue_key = find_first_issue_key()
        with tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False) as f:
            f.write(f"E2E test comment at {time.time()}")
            tmp_path = f.name
        try:
            result = run_cli("issue", "comment", issue_key, "--from-file", tmp_path)
            assert result.returncode == 0, f"Comment failed: {result.stderr}"
        finally:
            os.unlink(tmp_path)


class TestIssueLabels:
    def test_label_add_and_remove(self):
        issue_key = find_first_issue_key()
        label = f"{LABEL_UNIQUE}-{int(time.time())}"

        result = run_cli("issue", "label", "add", issue_key, label)
        assert result.returncode == 0, f"Label add failed: {result.stderr}"

        result = run_cli("issue", "get", issue_key)
        assert label in result.stdout, f"Label should appear in issue"

        result = run_cli("issue", "label", "remove", issue_key, label)
        assert result.returncode == 0, f"Label remove failed: {result.stderr}"


class TestIssueStats:
    def test_issue_stats(self):
        issue_key = find_first_issue_key()
        result = run_cli("issue", "stats", issue_key)
        assert result.returncode == 0, f"Stats failed: {result.stderr}"


class TestIssueAssign:
    def test_issue_assign_to_me(self):
        me_result = run_cli("user", "me")
        assert me_result.returncode == 0, f"user me failed: {me_result.stderr}"

        account_id_match = re.search(r"(\d+:)?(\w{8}-\w{4}-\w{4}-\w{4}-\w{12})", me_result.stdout)
        if account_id_match:
            full_match = account_id_match.group(0)
            if ":" not in full_match:
                account_id_match = None
        if not account_id_match:
            pytest.skip("Could not find account ID from user me")

        account_id = account_id_match.group(0)
        issue_key = find_first_issue_key()

        result = run_cli("issue", "assign", issue_key, account_id)
        assert result.returncode == 0, f"Assign failed: {result.stderr}"

    def test_issue_unassign(self):
        issue_key = find_first_issue_key()
        result = run_cli("issue", "assign", issue_key, "null")
        assert result.returncode == 0, f"Unassign failed: {result.stderr}"


class TestProjectList:
    def test_project_list(self):
        result = run_cli("project", "list")
        assert result.returncode == 0, f"Project list failed: {result.stderr}"
        assert "AT" in result.stdout, "Expected project AT in list"


class TestUserMe:
    def test_user_me(self):
        result = run_cli("user", "me")
        assert result.returncode == 0, f"user me failed: {result.stderr}"
        assert "@" in result.stdout or "email" in result.stdout.lower() or "display" in result.stdout.lower()
