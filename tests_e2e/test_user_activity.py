"""
E2E tests for the User Activity and related commands (JIR-185 Step 10).

Tests exercise:
  1. `user activity <person> <timeframe>` — basic output schema
  2. `user activity <person> <timeframe> --project <key>` — project filter
  3. `user activity <person> <timeframe> --group-by-issue` — grouped output
  4. `user worklog <person> <timeframe> --project <key>` — filtered worklog
  5. `issue search <jql> --comment-author <person>` — comment-author search

Test credentials are stored in ~/.jira-ai/config.json (never committed).
Run from project root after `npm run build`.

Usage:
    python3 -m pytest tests_e2e/test_user_activity.py -v
"""

import json
import os

import pytest

from conftest import run_cli

TEST_USER = "anatolii.fesiuk@gmail.com"
TEST_PROJECT = "PS"


def parse_json_output(result):
    combined = result.stdout.strip()
    if not combined:
        combined = result.stderr.strip()
    return json.loads(combined)


# =============================================================================
# 1. user activity — basic output schema
# =============================================================================
class TestUserActivityBasic:
    def test_returns_valid_json(self):
        result = run_cli("user", "activity", TEST_USER, "7d")
        assert result.returncode == 0, f"Failed:\nstdout: {result.stdout}\nstderr: {result.stderr}"
        data = parse_json_output(result)
        assert isinstance(data, dict)

    def test_output_has_activities_array(self):
        result = run_cli("user", "activity", TEST_USER, "7d")
        assert result.returncode == 0
        data = parse_json_output(result)
        assert "activities" in data
        assert isinstance(data["activities"], list)

    def test_output_has_skipped(self):
        result = run_cli("user", "activity", TEST_USER, "7d")
        assert result.returncode == 0
        data = parse_json_output(result)
        assert "skipped" in data
        assert isinstance(data["skipped"], int)

    def test_activity_entry_has_required_fields(self):
        result = run_cli("user", "activity", TEST_USER, "30d")
        assert result.returncode == 0
        data = parse_json_output(result)
        if len(data["activities"]) == 0:
            pytest.skip("No activities returned for the test user in this timeframe")
        entry = data["activities"][0]
        assert "issueKey" in entry
        assert "issueSummary" in entry
        assert "type" in entry
        assert "timestamp" in entry

    def test_activity_entry_has_id(self):
        result = run_cli("user", "activity", TEST_USER, "30d")
        assert result.returncode == 0
        data = parse_json_output(result)
        if len(data["activities"]) == 0:
            pytest.skip("No activities returned for the test user in this timeframe")
        entry = data["activities"][0]
        assert "id" in entry

    def test_invalid_timeframe(self):
        result = run_cli("user", "activity", TEST_USER, "invalid")
        assert result.returncode != 0


# =============================================================================
# 2. user activity --project — project filter
# =============================================================================
class TestUserActivityProjectFilter:
    def test_project_filter_returns_valid_json(self):
        result = run_cli("user", "activity", TEST_USER, "30d", "--project", TEST_PROJECT)
        assert result.returncode == 0, f"Failed:\nstdout: {result.stdout}\nstderr: {result.stderr}"
        data = parse_json_output(result)
        assert isinstance(data, dict)
        assert "activities" in data

    def test_project_filter_all_keys_match(self):
        result = run_cli("user", "activity", TEST_USER, "30d", "--project", TEST_PROJECT)
        assert result.returncode == 0
        data = parse_json_output(result)
        if len(data["activities"]) == 0:
            pytest.skip("No activities returned for the test user in this project/timeframe")
        for entry in data["activities"]:
            assert entry["issueKey"].startswith(f"{TEST_PROJECT}-"), (
                f"Expected issueKey to start with {TEST_PROJECT}-, got {entry['issueKey']}"
            )

    def test_project_filter_has_skipped(self):
        result = run_cli("user", "activity", TEST_USER, "30d", "--project", TEST_PROJECT)
        assert result.returncode == 0
        data = parse_json_output(result)
        assert "skipped" in data


# =============================================================================
# 3. user activity --group-by-issue — grouped output
# =============================================================================
class TestUserActivityGroupByIssue:
    def test_group_by_issue_returns_valid_json(self):
        result = run_cli("user", "activity", TEST_USER, "30d", "--group-by-issue")
        assert result.returncode == 0, f"Failed:\nstdout: {result.stdout}\nstderr: {result.stderr}"
        data = parse_json_output(result)
        assert isinstance(data, dict)

    def test_group_by_issue_has_issues_array(self):
        result = run_cli("user", "activity", TEST_USER, "30d", "--group-by-issue")
        assert result.returncode == 0
        data = parse_json_output(result)
        assert "issues" in data
        assert isinstance(data["issues"], list)

    def test_group_by_issue_has_skipped(self):
        result = run_cli("user", "activity", TEST_USER, "30d", "--group-by-issue")
        assert result.returncode == 0
        data = parse_json_output(result)
        assert "skipped" in data

    def test_grouped_entry_has_required_fields(self):
        result = run_cli("user", "activity", TEST_USER, "30d", "--group-by-issue")
        assert result.returncode == 0
        data = parse_json_output(result)
        if len(data["issues"]) == 0:
            pytest.skip("No issues returned for grouped activity")
        issue = data["issues"][0]
        assert "issueKey" in issue
        assert "activities" in issue
        assert isinstance(issue["activities"], list)

    def test_grouped_entry_activities_have_required_fields(self):
        result = run_cli("user", "activity", TEST_USER, "30d", "--group-by-issue")
        assert result.returncode == 0
        data = parse_json_output(result)
        if len(data["issues"]) == 0:
            pytest.skip("No issues returned for grouped activity")
        issue = data["issues"][0]
        if len(issue["activities"]) == 0:
            pytest.skip("No activities inside the grouped issue")
        act = issue["activities"][0]
        assert "id" in act
        assert "type" in act
        assert "timestamp" in act

    def test_group_by_issue_with_project(self):
        result = run_cli(
            "user", "activity", TEST_USER, "30d",
            "--group-by-issue", "--project", TEST_PROJECT,
        )
        assert result.returncode == 0
        data = parse_json_output(result)
        if "issues" not in data:
            pytest.skip("No activities found for grouped + project filter (empty result path)")
        if len(data["issues"]) == 0:
            pytest.skip("No issues returned for grouped activity with project filter")
        for issue in data["issues"]:
            assert issue["issueKey"].startswith(f"{TEST_PROJECT}-")


# =============================================================================
# 4. user worklog --project — filtered worklog
# =============================================================================
class TestUserWorklogProject:
    def test_worklog_returns_valid_json(self):
        result = run_cli("user", "worklog", TEST_USER, "30d", "--project", TEST_PROJECT)
        assert result.returncode == 0, f"Failed:\nstdout: {result.stdout}\nstderr: {result.stderr}"
        data = parse_json_output(result)
        assert isinstance(data, list)

    def test_worklog_no_error_output(self):
        result = run_cli("user", "worklog", TEST_USER, "30d", "--project", TEST_PROJECT)
        assert result.returncode == 0
        assert "error" not in result.stderr.lower()

    def test_worklog_entries_have_required_fields(self):
        result = run_cli("user", "worklog", TEST_USER, "30d", "--project", TEST_PROJECT)
        assert result.returncode == 0
        data = parse_json_output(result)
        if len(data) == 0:
            pytest.skip("No worklogs returned for the test user in this project/timeframe")
        wl = data[0]
        assert "id" in wl
        assert "timeSpentSeconds" in wl
        assert "started" in wl
        assert "author" in wl


# =============================================================================
# 5. issue search --comment-author — comment-author search
# =============================================================================
class TestIssueSearchCommentAuthor:
    def test_search_with_comment_author_returns_valid_json(self):
        result = run_cli(
            "issue", "search",
            "project = PS AND updated >= -7d",
            "--comment-author", TEST_USER,
        )
        assert result.returncode == 0, f"Failed:\nstdout: {result.stdout}\nstderr: {result.stderr}"
        data = parse_json_output(result)
        assert isinstance(data, list)

    def test_search_with_comment_author_no_error_output(self):
        result = run_cli(
            "issue", "search",
            "project = PS AND updated >= -7d",
            "--comment-author", TEST_USER,
        )
        assert result.returncode == 0
        assert "error" not in result.stderr.lower()

    def test_search_with_comment_author_has_issue_keys(self):
        result = run_cli(
            "issue", "search",
            "project = PS AND updated >= -7d",
            "--comment-author", TEST_USER,
        )
        assert result.returncode == 0
        data = parse_json_output(result)
        if len(data) == 0:
            pytest.skip("No issues returned for comment-author search")
        for issue in data:
            assert "key" in issue

    def test_search_with_comment_author_invalid_user(self):
        result = run_cli(
            "issue", "search",
            "project = PS AND updated >= -7d",
            "--comment-author", "nonexistent_user_12345",
        )
        assert result.returncode == 0
        data = parse_json_output(result)
        assert isinstance(data, list)
