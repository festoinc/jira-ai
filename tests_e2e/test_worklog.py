"""
E2E tests for the Worklog Management feature (JIR-167).

Tests exercise the jira-ai CLI commands:
  - issue worklog list <issue-key>
  - issue worklog add <issue-key> --time <duration> [--comment <text>] [--started <datetime>]
  - issue worklog update <issue-key> --id <worklog-id> [--time <dur>] [--comment <text>]
  - issue worklog delete <issue-key> --id <worklog-id>
  - Filtering with --started-after / --started-before
  - Error handling for invalid inputs

Test credentials are stored in ~/.jira-ai/config.json (never committed).
Run from project root after `npm run build`.

Usage:
    python3 -m pytest tests_e2e/test_worklog.py -v
"""

import json
import os
import re
import time

import pytest

from conftest import (
    REGULAR_PROJECT_KEY,
    run_cli,
)

TEST_ISSUE_KEY = "AT-258"


def parse_json_output(result):
    combined = result.stdout.strip()
    if not combined:
        combined = result.stderr.strip()
    return json.loads(combined)


def _cleanup_worklogs(issue_key):
    result = run_cli("issue", "worklog", "list", issue_key)
    if result.returncode != 0:
        return
    try:
        data = json.loads(result.stdout.strip())
    except (json.JSONDecodeError, ValueError):
        return
    worklogs = data.get("worklogs", [])
    for w in worklogs:
        run_cli("issue", "worklog", "delete", issue_key, "--id", str(w["id"]),
                "--adjust-estimate", "leave")


def _get_worklog_ids(issue_key):
    result = run_cli("issue", "worklog", "list", issue_key)
    if result.returncode != 0:
        return []
    try:
        data = json.loads(result.stdout.strip())
    except (json.JSONDecodeError, ValueError):
        return []
    return [str(w["id"]) for w in data.get("worklogs", [])]


@pytest.fixture(autouse=True)
def cleanup_worklogs():
    _cleanup_worklogs(TEST_ISSUE_KEY)
    yield
    _cleanup_worklogs(TEST_ISSUE_KEY)


# =============================================================================
# 1. issue worklog list
# =============================================================================
class TestWorklogList:
    def test_list_returns_valid_json(self):
        result = run_cli("issue", "worklog", "list", TEST_ISSUE_KEY)
        assert result.returncode == 0, f"Failed:\nstdout: {result.stdout}\nstderr: {result.stderr}"
        data = parse_json_output(result)
        assert isinstance(data, dict)
        assert data["issueKey"] == TEST_ISSUE_KEY
        assert "worklogs" in data
        assert "total" in data

    def test_list_has_worklogs_array(self):
        result = run_cli("issue", "worklog", "list", TEST_ISSUE_KEY)
        assert result.returncode == 0
        data = parse_json_output(result)
        assert isinstance(data["worklogs"], list)

    def test_list_empty_after_cleanup(self):
        result = run_cli("issue", "worklog", "list", TEST_ISSUE_KEY)
        assert result.returncode == 0
        data = parse_json_output(result)
        assert data["worklogs"] == []
        assert data["total"] == 0

    def test_list_invalid_issue_key(self):
        result = run_cli("issue", "worklog", "list", "INVALID-99999")
        assert result.returncode != 0

    def test_list_shows_worklogs_after_add(self):
        add_result = run_cli(
            "issue", "worklog", "add", TEST_ISSUE_KEY,
            "--time", "30m",
            "--comment", "E2E list test",
        )
        assert add_result.returncode == 0

        result = run_cli("issue", "worklog", "list", TEST_ISSUE_KEY)
        assert result.returncode == 0
        data = parse_json_output(result)
        assert data["total"] >= 1
        comments = [w.get("comment", "") for w in data["worklogs"]]
        assert any("E2E list test" in c for c in comments)

    def test_worklog_entry_has_required_fields(self):
        add_result = run_cli(
            "issue", "worklog", "add", TEST_ISSUE_KEY,
            "--time", "1h",
            "--comment", "E2E fields check",
        )
        assert add_result.returncode == 0

        result = run_cli("issue", "worklog", "list", TEST_ISSUE_KEY)
        assert result.returncode == 0
        data = parse_json_output(result)
        wl = data["worklogs"][0]
        assert "id" in wl
        assert "author" in wl
        assert "started" in wl
        assert "timeSpent" in wl
        assert "timeSpentSeconds" in wl
        assert "created" in wl
        assert "updated" in wl
        assert "issueKey" in wl
        assert wl["issueKey"] == TEST_ISSUE_KEY

    def test_worklog_author_has_required_fields(self):
        add_result = run_cli(
            "issue", "worklog", "add", TEST_ISSUE_KEY,
            "--time", "15m",
        )
        assert add_result.returncode == 0

        result = run_cli("issue", "worklog", "list", TEST_ISSUE_KEY)
        assert result.returncode == 0
        data = parse_json_output(result)
        wl = data["worklogs"][0]
        author = wl["author"]
        assert "accountId" in author
        assert "displayName" in author


# =============================================================================
# 2. issue worklog add
# =============================================================================
class TestWorklogAdd:
    def test_add_worklog_success(self):
        result = run_cli(
            "issue", "worklog", "add", TEST_ISSUE_KEY,
            "--time", "1h",
        )
        assert result.returncode == 0, f"Failed:\nstdout: {result.stdout}\nstderr: {result.stderr}"
        data = parse_json_output(result)
        assert "id" in data
        assert data["timeSpentSeconds"] == 3600
        assert data["issueKey"] == TEST_ISSUE_KEY

    def test_add_worklog_with_comment(self):
        result = run_cli(
            "issue", "worklog", "add", TEST_ISSUE_KEY,
            "--time", "30m",
            "--comment", "E2E test comment",
        )
        assert result.returncode == 0
        data = parse_json_output(result)
        assert data["timeSpentSeconds"] == 1800
        assert "E2E test comment" in data.get("comment", "")

    def test_add_worklog_with_started(self):
        result = run_cli(
            "issue", "worklog", "add", TEST_ISSUE_KEY,
            "--time", "2h",
            "--started", "2026-01-15T09:00:00.000+0000",
        )
        assert result.returncode == 0
        data = parse_json_output(result)
        assert data["timeSpentSeconds"] == 7200
        assert "2026-01-15" in data.get("started", "")

    def test_add_worklog_combined_duration(self):
        result = run_cli(
            "issue", "worklog", "add", TEST_ISSUE_KEY,
            "--time", "1d2h30m",
        )
        assert result.returncode == 0
        data = parse_json_output(result)
        assert data["timeSpentSeconds"] == 37800

    def test_add_worklog_invalid_duration(self):
        result = run_cli(
            "issue", "worklog", "add", TEST_ISSUE_KEY,
            "--time", "invalid",
        )
        assert result.returncode != 0

    def test_add_worklog_invalid_issue_key(self):
        result = run_cli(
            "issue", "worklog", "add", "INVALID-99999",
            "--time", "1h",
        )
        assert result.returncode != 0

    def test_add_worklog_appears_in_list(self):
        add_result = run_cli(
            "issue", "worklog", "add", TEST_ISSUE_KEY,
            "--time", "45m",
            "--comment", "E2E add-then-list check",
        )
        assert add_result.returncode == 0
        add_data = parse_json_output(add_result)
        worklog_id = str(add_data["id"])

        list_result = run_cli("issue", "worklog", "list", TEST_ISSUE_KEY)
        assert list_result.returncode == 0
        list_data = parse_json_output(list_result)
        ids = [str(w["id"]) for w in list_data["worklogs"]]
        assert worklog_id in ids

    def test_add_worklog_estimate_adjustment_auto(self):
        result = run_cli(
            "issue", "worklog", "add", TEST_ISSUE_KEY,
            "--time", "15m",
            "--adjust-estimate", "auto",
        )
        assert result.returncode == 0

    def test_add_worklog_estimate_adjustment_leave(self):
        result = run_cli(
            "issue", "worklog", "add", TEST_ISSUE_KEY,
            "--time", "15m",
            "--adjust-estimate", "leave",
        )
        assert result.returncode == 0


# =============================================================================
# 3. issue worklog update
# =============================================================================
class TestWorklogUpdate:
    def _add_worklog(self):
        result = run_cli(
            "issue", "worklog", "add", TEST_ISSUE_KEY,
            "--time", "1h",
            "--comment", "Original comment",
        )
        assert result.returncode == 0
        return parse_json_output(result)

    def test_update_worklog_time(self):
        wl = self._add_worklog()
        result = run_cli(
            "issue", "worklog", "update", TEST_ISSUE_KEY,
            "--id", str(wl["id"]),
            "--time", "2h",
        )
        assert result.returncode == 0, f"Failed:\nstdout: {result.stdout}\nstderr: {result.stderr}"
        data = parse_json_output(result)
        assert data["timeSpentSeconds"] == 7200
        assert data["id"] == str(wl["id"])

    def test_update_worklog_comment(self):
        wl = self._add_worklog()
        result = run_cli(
            "issue", "worklog", "update", TEST_ISSUE_KEY,
            "--id", str(wl["id"]),
            "--comment", "Updated E2E comment",
        )
        assert result.returncode == 0
        data = parse_json_output(result)
        assert "Updated E2E comment" in data.get("comment", "")

    def test_update_worklog_started(self):
        wl = self._add_worklog()
        result = run_cli(
            "issue", "worklog", "update", TEST_ISSUE_KEY,
            "--id", str(wl["id"]),
            "--started", "2026-02-20T10:00:00.000+0000",
        )
        assert result.returncode == 0
        data = parse_json_output(result)
        assert "2026-02-20" in data.get("started", "")

    def test_update_worklog_invalid_id(self):
        result = run_cli(
            "issue", "worklog", "update", TEST_ISSUE_KEY,
            "--id", "99999999",
            "--time", "1h",
        )
        assert result.returncode != 0

    def test_update_worklog_no_fields_provided(self):
        wl = self._add_worklog()
        result = run_cli(
            "issue", "worklog", "update", TEST_ISSUE_KEY,
            "--id", str(wl["id"]),
        )
        assert result.returncode != 0

    def test_update_worklog_invalid_duration(self):
        wl = self._add_worklog()
        result = run_cli(
            "issue", "worklog", "update", TEST_ISSUE_KEY,
            "--id", str(wl["id"]),
            "--time", "bad",
        )
        assert result.returncode != 0

    def test_update_worklog_invalid_issue_key(self):
        result = run_cli(
            "issue", "worklog", "update", "INVALID-99999",
            "--id", "12345",
            "--time", "1h",
        )
        assert result.returncode != 0

    def test_update_reflected_in_list(self):
        wl = self._add_worklog()
        run_cli(
            "issue", "worklog", "update", TEST_ISSUE_KEY,
            "--id", str(wl["id"]),
            "--time", "3h",
        )

        list_result = run_cli("issue", "worklog", "list", TEST_ISSUE_KEY)
        assert list_result.returncode == 0
        list_data = parse_json_output(list_result)
        found = [w for w in list_data["worklogs"] if str(w["id"]) == str(wl["id"])]
        assert len(found) == 1
        assert found[0]["timeSpentSeconds"] == 10800


# =============================================================================
# 4. issue worklog delete
# =============================================================================
class TestWorklogDelete:
    def _add_worklog(self):
        result = run_cli(
            "issue", "worklog", "add", TEST_ISSUE_KEY,
            "--time", "30m",
            "--comment", "To be deleted",
        )
        assert result.returncode == 0
        return parse_json_output(result)

    def test_delete_worklog_success(self):
        wl = self._add_worklog()
        result = run_cli(
            "issue", "worklog", "delete", TEST_ISSUE_KEY,
            "--id", str(wl["id"]),
        )
        assert result.returncode == 0, f"Failed:\nstdout: {result.stdout}\nstderr: {result.stderr}"
        data = parse_json_output(result)
        assert data["deleted"] is True
        assert data["issueKey"] == TEST_ISSUE_KEY
        assert data["id"] == str(wl["id"])

    def test_delete_removes_from_list(self):
        wl = self._add_worklog()
        wl_id = str(wl["id"])

        assert wl_id in _get_worklog_ids(TEST_ISSUE_KEY)

        run_cli("issue", "worklog", "delete", TEST_ISSUE_KEY, "--id", wl_id)

        assert wl_id not in _get_worklog_ids(TEST_ISSUE_KEY)

    def test_delete_invalid_id(self):
        result = run_cli(
            "issue", "worklog", "delete", TEST_ISSUE_KEY,
            "--id", "99999999",
        )
        assert result.returncode != 0

    def test_delete_invalid_issue_key(self):
        result = run_cli(
            "issue", "worklog", "delete", "INVALID-99999",
            "--id", "12345",
        )
        assert result.returncode != 0

    def test_delete_with_leave_estimate(self):
        wl = self._add_worklog()
        result = run_cli(
            "issue", "worklog", "delete", TEST_ISSUE_KEY,
            "--id", str(wl["id"]),
            "--adjust-estimate", "leave",
        )
        assert result.returncode == 0

    def test_delete_double_delete_fails(self):
        wl = self._add_worklog()
        wl_id = str(wl["id"])

        result1 = run_cli("issue", "worklog", "delete", TEST_ISSUE_KEY, "--id", wl_id)
        assert result1.returncode == 0

        result2 = run_cli("issue", "worklog", "delete", TEST_ISSUE_KEY, "--id", wl_id)
        assert result2.returncode != 0


# =============================================================================
# 5. Filtering with --started-after / --started-before
# =============================================================================
class TestWorklogFiltering:
    def test_started_after_filter(self):
        now_ms = int(time.time() * 1000)
        future_ms = now_ms + 86400000

        run_cli(
            "issue", "worklog", "add", TEST_ISSUE_KEY,
            "--time", "15m",
            "--comment", "Filter test current",
        )

        result = run_cli(
            "issue", "worklog", "list", TEST_ISSUE_KEY,
            "--started-after", str(future_ms),
        )
        assert result.returncode == 0
        data = parse_json_output(result)
        for w in data["worklogs"]:
            assert int(time.mktime(time.strptime(w["started"][:19], "%Y-%m-%dT%H:%M:%S")) * 1000) >= future_ms

    def test_started_before_filter(self):
        past_ms = 0

        result = run_cli(
            "issue", "worklog", "list", TEST_ISSUE_KEY,
            "--started-before", str(past_ms),
        )
        assert result.returncode == 0
        data = parse_json_output(result)
        assert data["total"] == 0


# =============================================================================
# 6. Estimate adjustment validation
# =============================================================================
class TestEstimateValidation:
    def test_add_new_estimate_without_new_estimate_flag_fails(self):
        result = run_cli(
            "issue", "worklog", "add", TEST_ISSUE_KEY,
            "--time", "15m",
            "--adjust-estimate", "new",
        )
        assert result.returncode != 0
        assert "--new-estimate is required" in result.stderr or "--new-estimate is required" in result.stdout

    def test_add_manual_estimate_without_value_fails(self):
        result = run_cli(
            "issue", "worklog", "add", TEST_ISSUE_KEY,
            "--time", "15m",
            "--adjust-estimate", "manual",
        )
        assert result.returncode != 0
        assert "--new-estimate or --reduce-by is required" in result.stderr or "--new-estimate or --reduce-by is required" in result.stdout

    def test_add_manual_estimate_with_reduce_by_succeeds(self):
        result = run_cli(
            "issue", "worklog", "add", TEST_ISSUE_KEY,
            "--time", "15m",
            "--adjust-estimate", "manual",
            "--reduce-by", "15m",
        )
        assert result.returncode == 0

    def test_delete_new_estimate_without_value_fails(self):
        wl = parse_json_output(run_cli(
            "issue", "worklog", "add", TEST_ISSUE_KEY,
            "--time", "15m",
        ))
        result = run_cli(
            "issue", "worklog", "delete", TEST_ISSUE_KEY,
            "--id", str(wl["id"]),
            "--adjust-estimate", "new",
        )
        assert result.returncode != 0

    def test_delete_manual_estimate_without_value_fails(self):
        wl = parse_json_output(run_cli(
            "issue", "worklog", "add", TEST_ISSUE_KEY,
            "--time", "15m",
        ))
        result = run_cli(
            "issue", "worklog", "delete", TEST_ISSUE_KEY,
            "--id", str(wl["id"]),
            "--adjust-estimate", "manual",
        )
        assert result.returncode != 0


# =============================================================================
# 7. Full CRUD lifecycle
# =============================================================================
class TestWorklogLifecycle:
    def test_add_update_delete_lifecycle(self):
        add_result = run_cli(
            "issue", "worklog", "add", TEST_ISSUE_KEY,
            "--time", "1h",
            "--comment", "Lifecycle test original",
        )
        assert add_result.returncode == 0
        wl = parse_json_output(add_result)
        wl_id = str(wl["id"])
        assert wl["timeSpentSeconds"] == 3600

        update_result = run_cli(
            "issue", "worklog", "update", TEST_ISSUE_KEY,
            "--id", wl_id,
            "--time", "2h",
            "--comment", "Lifecycle test updated",
        )
        assert update_result.returncode == 0
        updated = parse_json_output(update_result)
        assert updated["timeSpentSeconds"] == 7200
        assert "Lifecycle test updated" in updated.get("comment", "")

        list_result = run_cli("issue", "worklog", "list", TEST_ISSUE_KEY)
        assert list_result.returncode == 0
        list_data = parse_json_output(list_result)
        found = [w for w in list_data["worklogs"] if str(w["id"]) == wl_id]
        assert len(found) == 1
        assert found[0]["timeSpentSeconds"] == 7200

        delete_result = run_cli(
            "issue", "worklog", "delete", TEST_ISSUE_KEY,
            "--id", wl_id,
        )
        assert delete_result.returncode == 0
        del_data = parse_json_output(delete_result)
        assert del_data["deleted"] is True

        final_result = run_cli("issue", "worklog", "list", TEST_ISSUE_KEY)
        assert final_result.returncode == 0
        final_data = parse_json_output(final_result)
        ids = [str(w["id"]) for w in final_data["worklogs"]]
        assert wl_id not in ids

    def test_add_multiple_worklogs(self):
        ids = []
        for i in range(3):
            result = run_cli(
                "issue", "worklog", "add", TEST_ISSUE_KEY,
                "--time", f"{(i + 1) * 30}m",
                "--comment", f"Multi-worklog test {i}",
            )
            assert result.returncode == 0
            data = parse_json_output(result)
            ids.append(str(data["id"]))

        list_result = run_cli("issue", "worklog", "list", TEST_ISSUE_KEY)
        assert list_result.returncode == 0
        list_data = parse_json_output(list_result)
        assert list_data["total"] == 3
        list_ids = [str(w["id"]) for w in list_data["worklogs"]]
        for wid in ids:
            assert wid in list_ids
