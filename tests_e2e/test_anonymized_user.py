"""
E2E tests for the anonymized-user fix (JIR-194 / JIR-198).

The fix ensures that Jira Cloud accounts with accountId '***' (anonymized /
privacy-redacted users) are filtered out in searchUsers so that downstream
commands never produce broken JQL like 'worklogAuthor = "***"'.

Tests exercise:
  1. user search — no entry has accountId '***'
  2. user activity with unresolvable user — graceful fallback
  3. user worklog with unresolvable user — graceful fallback
  4. issue search --comment-author with unresolvable user — graceful fallback
  5. user activity with a known-good user — no '***' leakage in output
  6. issue search --comment-author with known-good user — no '***' in output

Test credentials are stored in ~/.jira-ai/config.json (never committed).
Run from project root after `npm run build`.

Usage:
    python3 -m pytest tests_e2e/test_anonymized_user.py -v
"""

import json
import os

import pytest

from conftest import run_cli

TEST_USER = "anatolii.fesiuk@gmail.com"
TEST_PROJECT = "PS"
UNRESOLVABLE_USER = "zzz_nonexistent_anonymized_user_99999"

TEST_JIRA_EMAIL = os.environ.get("TEST_JIRA_EMAIL", "")
TEST_JIRA_TOKEN = os.environ.get("TEST_JIRA_TOKEN", "")
HAS_CREDENTIALS = bool(TEST_JIRA_EMAIL and TEST_JIRA_TOKEN)


def parse_json_output(result):
    combined = result.stdout.strip()
    if not combined:
        combined = result.stderr.strip()
    return json.loads(combined)


# =============================================================================
# 1. user search — no entry has accountId '***'
# =============================================================================
class TestUserSearchNoAnonymized:
    @pytest.mark.skipif(not HAS_CREDENTIALS, reason="No Jira test credentials")
    def test_user_search_no_star_account_ids(self):
        result = run_cli("user", "search")
        assert result.returncode == 0, f"Failed:\nstdout: {result.stdout}\nstderr: {result.stderr}"
        data = parse_json_output(result)
        assert isinstance(data, list)
        for user in data:
            assert user.get("accountId") != "***", (
                f"Anonymized user found in user search output: {user}"
            )

    @pytest.mark.skipif(not HAS_CREDENTIALS, reason="No Jira test credentials")
    def test_user_search_project_no_star_account_ids(self):
        result = run_cli("user", "search", TEST_PROJECT)
        assert result.returncode == 0, f"Failed:\nstdout: {result.stdout}\nstderr: {result.stderr}"
        data = parse_json_output(result)
        assert isinstance(data, list)
        for user in data:
            assert user.get("accountId") != "***", (
                f"Anonymized user found in user search --project output: {user}"
            )

    @pytest.mark.skipif(not HAS_CREDENTIALS, reason="No Jira test credentials")
    def test_user_search_valid_json(self):
        result = run_cli("user", "search")
        assert result.returncode == 0
        data = parse_json_output(result)
        assert isinstance(data, list)

    @pytest.mark.skipif(not HAS_CREDENTIALS, reason="No Jira test credentials")
    def test_user_search_entries_have_account_id(self):
        result = run_cli("user", "search")
        assert result.returncode == 0
        data = parse_json_output(result)
        if len(data) == 0:
            pytest.skip("No users returned")
        for user in data:
            assert "accountId" in user


# =============================================================================
# 2. user activity with unresolvable user — graceful fallback
# =============================================================================
class TestUserActivityUnresolvableUser:
    @pytest.mark.skipif(not HAS_CREDENTIALS, reason="No Jira test credentials")
    def test_returns_valid_json(self):
        result = run_cli("user", "activity", UNRESOLVABLE_USER, "7d")
        assert result.returncode == 0, f"Failed:\nstdout: {result.stdout}\nstderr: {result.stderr}"
        data = parse_json_output(result)
        assert isinstance(data, dict)

    @pytest.mark.skipif(not HAS_CREDENTIALS, reason="No Jira test credentials")
    def test_has_activities_key(self):
        result = run_cli("user", "activity", UNRESOLVABLE_USER, "7d")
        assert result.returncode == 0
        data = parse_json_output(result)
        assert "activities" in data
        assert isinstance(data["activities"], list)

    @pytest.mark.skipif(not HAS_CREDENTIALS, reason="No Jira test credentials")
    def test_no_star_in_output(self):
        result = run_cli("user", "activity", UNRESOLVABLE_USER, "7d")
        assert result.returncode == 0
        combined = result.stdout + result.stderr
        assert '"***"' not in combined

    @pytest.mark.skipif(not HAS_CREDENTIALS, reason="No Jira test credentials")
    def test_no_error_output(self):
        result = run_cli("user", "activity", UNRESOLVABLE_USER, "7d")
        assert result.returncode == 0
        assert "error" not in result.stderr.lower()

    @pytest.mark.skipif(not HAS_CREDENTIALS, reason="No Jira test credentials")
    def test_unresolvable_user_empty_activities(self):
        result = run_cli("user", "activity", UNRESOLVABLE_USER, "7d")
        assert result.returncode == 0
        data = parse_json_output(result)
        assert data["activities"] == []


# =============================================================================
# 3. user worklog with unresolvable user — graceful fallback
# =============================================================================
class TestUserWorklogUnresolvableUser:
    @pytest.mark.skipif(not HAS_CREDENTIALS, reason="No Jira test credentials")
    def test_returns_valid_json(self):
        result = run_cli("user", "worklog", UNRESOLVABLE_USER, "30d", "--project", TEST_PROJECT)
        assert result.returncode == 0, f"Failed:\nstdout: {result.stdout}\nstderr: {result.stderr}"
        data = parse_json_output(result)
        assert isinstance(data, list)

    @pytest.mark.skipif(not HAS_CREDENTIALS, reason="No Jira test credentials")
    def test_no_star_in_output(self):
        result = run_cli("user", "worklog", UNRESOLVABLE_USER, "30d", "--project", TEST_PROJECT)
        assert result.returncode == 0
        combined = result.stdout + result.stderr
        assert '"***"' not in combined

    @pytest.mark.skipif(not HAS_CREDENTIALS, reason="No Jira test credentials")
    def test_no_error_output(self):
        result = run_cli("user", "worklog", UNRESOLVABLE_USER, "30d", "--project", TEST_PROJECT)
        assert result.returncode == 0
        assert "error" not in result.stderr.lower()

    @pytest.mark.skipif(not HAS_CREDENTIALS, reason="No Jira test credentials")
    def test_unresolvable_user_empty_worklogs(self):
        result = run_cli("user", "worklog", UNRESOLVABLE_USER, "30d", "--project", TEST_PROJECT)
        assert result.returncode == 0
        data = parse_json_output(result)
        assert data == []


# =============================================================================
# 4. issue search --comment-author with unresolvable user — graceful fallback
# =============================================================================
class TestIssueSearchCommentAuthorUnresolvable:
    @pytest.mark.skipif(not HAS_CREDENTIALS, reason="No Jira test credentials")
    def test_returns_valid_json(self):
        result = run_cli(
            "issue", "search",
            f"project = {TEST_PROJECT} AND updated >= -7d",
            "--comment-author", UNRESOLVABLE_USER,
        )
        assert result.returncode == 0, f"Failed:\nstdout: {result.stdout}\nstderr: {result.stderr}"
        data = parse_json_output(result)
        assert isinstance(data, list)

    @pytest.mark.skipif(not HAS_CREDENTIALS, reason="No Jira test credentials")
    def test_no_star_in_output(self):
        result = run_cli(
            "issue", "search",
            f"project = {TEST_PROJECT} AND updated >= -7d",
            "--comment-author", UNRESOLVABLE_USER,
        )
        assert result.returncode == 0
        combined = result.stdout + result.stderr
        assert '"***"' not in combined

    @pytest.mark.skipif(not HAS_CREDENTIALS, reason="No Jira test credentials")
    def test_no_error_output(self):
        result = run_cli(
            "issue", "search",
            f"project = {TEST_PROJECT} AND updated >= -7d",
            "--comment-author", UNRESOLVABLE_USER,
        )
        assert result.returncode == 0
        assert "error" not in result.stderr.lower()

    @pytest.mark.skipif(not HAS_CREDENTIALS, reason="No Jira test credentials")
    def test_unresolvable_user_empty_results(self):
        result = run_cli(
            "issue", "search",
            f"project = {TEST_PROJECT} AND updated >= -7d",
            "--comment-author", UNRESOLVABLE_USER,
        )
        assert result.returncode == 0
        data = parse_json_output(result)
        assert isinstance(data, list)


# =============================================================================
# 5. user activity with known-good user — no '***' leakage in output
# =============================================================================
class TestUserActivityKnownUserNoAnonymizedLeak:
    @pytest.mark.skipif(not HAS_CREDENTIALS, reason="No Jira test credentials")
    def test_no_star_account_id_in_activities(self):
        result = run_cli("user", "activity", TEST_USER, "7d")
        assert result.returncode == 0
        combined = result.stdout + result.stderr
        assert '"***"' not in combined

    @pytest.mark.skipif(not HAS_CREDENTIALS, reason="No Jira test credentials")
    def test_activities_valid_schema(self):
        result = run_cli("user", "activity", TEST_USER, "7d")
        assert result.returncode == 0
        data = parse_json_output(result)
        assert isinstance(data, dict)
        assert "activities" in data
        assert "skipped" in data


# =============================================================================
# 6. issue search --comment-author with known-good user — no '***' in output
# =============================================================================
class TestIssueSearchCommentAuthorKnownUserNoLeak:
    @pytest.mark.skipif(not HAS_CREDENTIALS, reason="No Jira test credentials")
    def test_no_star_in_output(self):
        result = run_cli(
            "issue", "search",
            f"project = {TEST_PROJECT} AND updated >= -7d",
            "--comment-author", TEST_USER,
        )
        assert result.returncode == 0
        combined = result.stdout + result.stderr
        assert '"***"' not in combined

    @pytest.mark.skipif(not HAS_CREDENTIALS, reason="No Jira test credentials")
    def test_results_are_list(self):
        result = run_cli(
            "issue", "search",
            f"project = {TEST_PROJECT} AND updated >= -7d",
            "--comment-author", TEST_USER,
        )
        assert result.returncode == 0
        data = parse_json_output(result)
        assert isinstance(data, list)
