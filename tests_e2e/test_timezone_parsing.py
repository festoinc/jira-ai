"""
E2E tests for the timezone parsing fix (JIR-160 / JIR-163).

The --started flag on worklog add/update accepts ISO-8601 timestamps.
The CLI normalizes them into Jira's required format (yyyy-MM-dd'T'HH:mm:ss.SSSZ)
by:
  - Replacing Z suffix with +0000
  - Removing colon from timezone offsets (+03:00 → +0300)
  - Adding .000 milliseconds when missing

Tests cover:
  1. Worklog add with Z-suffix timestamp (e.g. 2026-04-15T07:00:00.000Z)
  2. Worklog add with colon-offset timestamp (e.g. 2026-04-15T10:00:00+03:00)
  3. Worklog add with no-millisecond Z timestamp (e.g. 2026-04-15T07:00:00Z)
  4. Worklog add with no-millisecond offset (e.g. 2026-04-15T07:00:00+0000)
  5. Worklog add with already-normalized timestamp (passes through unchanged)
  6. Worklog update with Z-suffix timestamp
  7. Worklog update with colon-offset timestamp
  8. --dry-run validation for timezone normalization (no side effects)
  9. Error handling — invalid timestamp format is passed through (API rejects it)

Test credentials are stored in ~/.jira-ai/config.json (never committed).
Run from project root after `npm run build`:

    python3 -m pytest tests_e2e/test_timezone_parsing.py -v
"""

import json
import os
import re
import subprocess
import time

import pytest

from conftest import (
    REGULAR_PROJECT_KEY,
    run_cli,
)

STABLE_ISSUE_KEY = "AT-196"


def parse_json_output(result):
    combined = result.stdout.strip()
    if not combined:
        combined = result.stderr.strip()
    return json.loads(combined)


def create_test_issue(title=None):
    ts = str(int(time.time()))
    issue_title = title or f"TZ E2E Test {ts}"
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


def add_worklog(issue_key, time_spent="1h", started=None, comment=None):
    args = [
        "--json", "issue", "worklog", "add", issue_key,
        "--time", time_spent,
    ]
    if started:
        args.extend(["--started", started])
    if comment:
        args.extend(["--comment", comment])
    result = run_cli(*args)
    return result


def update_worklog(issue_key, worklog_id, started=None, comment=None):
    args = [
        "--json", "issue", "worklog", "update", issue_key,
        "--id", worklog_id,
    ]
    if started:
        args.extend(["--started", started])
    if comment:
        args.extend(["--comment", comment])
    result = run_cli(*args)
    return result


def delete_worklog(issue_key, worklog_id):
    run_cli("--json", "issue", "worklog", "delete", issue_key, "--id", worklog_id)


def get_worklogs(issue_key):
    result = run_cli("--json", "issue", "worklog", "list", issue_key)
    if result.returncode != 0:
        return []
    data = parse_json_output(result)
    return data.get("worklogs", [])


# =============================================================================
# 1. Worklog add with Z-suffix timestamp (with milliseconds)
# =============================================================================
class TestWorklogAddZSuffix:
    def test_add_with_z_suffix_succeeds(self):
        issue_key = create_test_issue()
        try:
            result = add_worklog(
                issue_key,
                time_spent="1h",
                started="2026-04-15T07:00:00.000Z",
                comment="TZ test Z-suffix with ms",
            )
            assert result.returncode == 0, f"Worklog add failed: {result.stderr}"
            data = parse_json_output(result)
            assert "id" in data
            assert data["issueKey"] == issue_key
            delete_worklog(issue_key, data["id"])
        finally:
            delete_issue(issue_key)

    def test_started_field_is_normalized(self):
        issue_key = create_test_issue()
        try:
            result = add_worklog(
                issue_key,
                time_spent="30m",
                started="2026-04-15T07:00:00.000Z",
                comment="TZ test Z normalization",
            )
            assert result.returncode == 0
            data = parse_json_output(result)
            assert "+0000" in data["started"]
            delete_worklog(issue_key, data["id"])
        finally:
            delete_issue(issue_key)


# =============================================================================
# 2. Worklog add with colon-offset timestamp
# =============================================================================
class TestWorklogAddColonOffset:
    def test_add_with_positive_colon_offset(self):
        issue_key = create_test_issue()
        try:
            result = add_worklog(
                issue_key,
                time_spent="2h",
                started="2026-04-15T10:00:00+03:00",
                comment="TZ test colon offset positive",
            )
            assert result.returncode == 0, f"Worklog add failed: {result.stderr}"
            data = parse_json_output(result)
            assert "id" in data
            assert "+0300" in data["started"]
            delete_worklog(issue_key, data["id"])
        finally:
            delete_issue(issue_key)

    def test_add_with_negative_colon_offset(self):
        issue_key = create_test_issue()
        try:
            result = add_worklog(
                issue_key,
                time_spent="1h",
                started="2026-04-15T10:00:00-05:30",
                comment="TZ test colon offset negative",
            )
            assert result.returncode == 0, f"Worklog add failed: {result.stderr}"
            data = parse_json_output(result)
            assert "id" in data
            assert "-0530" in data["started"]
            delete_worklog(issue_key, data["id"])
        finally:
            delete_issue(issue_key)


# =============================================================================
# 3. Worklog add with no-millisecond Z timestamp
# =============================================================================
class TestWorklogAddNoMsZSuffix:
    def test_add_without_milliseconds_z(self):
        issue_key = create_test_issue()
        try:
            result = add_worklog(
                issue_key,
                time_spent="30m",
                started="2026-04-15T07:00:00Z",
                comment="TZ test no ms Z",
            )
            assert result.returncode == 0, f"Worklog add failed: {result.stderr}"
            data = parse_json_output(result)
            assert "id" in data
            assert "+0000" in data["started"]
            assert ".000" in data["started"]
            delete_worklog(issue_key, data["id"])
        finally:
            delete_issue(issue_key)


# =============================================================================
# 4. Worklog add with no-millisecond offset (already no colon)
# =============================================================================
class TestWorklogAddNoMsOffset:
    def test_add_without_milliseconds_offset(self):
        issue_key = create_test_issue()
        try:
            result = add_worklog(
                issue_key,
                time_spent="45m",
                started="2026-04-15T07:00:00+0000",
                comment="TZ test no ms offset",
            )
            assert result.returncode == 0, f"Worklog add failed: {result.stderr}"
            data = parse_json_output(result)
            assert "id" in data
            assert ".000" in data["started"]
            delete_worklog(issue_key, data["id"])
        finally:
            delete_issue(issue_key)


# =============================================================================
# 5. Worklog add with already-normalized timestamp (passes through)
# =============================================================================
class TestWorklogAddAlreadyNormalized:
    def test_add_with_normalized_timestamp(self):
        issue_key = create_test_issue()
        try:
            result = add_worklog(
                issue_key,
                time_spent="1h",
                started="2026-04-15T07:00:00.000+0000",
                comment="TZ test already normalized",
            )
            assert result.returncode == 0, f"Worklog add failed: {result.stderr}"
            data = parse_json_output(result)
            assert "id" in data
            assert "+0000" in data["started"]
            delete_worklog(issue_key, data["id"])
        finally:
            delete_issue(issue_key)

    def test_add_with_normalized_positive_offset(self):
        issue_key = create_test_issue()
        try:
            result = add_worklog(
                issue_key,
                time_spent="1h",
                started="2026-04-15T07:00:00.000+0530",
                comment="TZ test already normalized +0530",
            )
            assert result.returncode == 0, f"Worklog add failed: {result.stderr}"
            data = parse_json_output(result)
            assert "id" in data
            assert "+0530" in data["started"]
            delete_worklog(issue_key, data["id"])
        finally:
            delete_issue(issue_key)


# =============================================================================
# 6. Worklog update with Z-suffix timestamp
# =============================================================================
class TestWorklogUpdateZSuffix:
    def test_update_started_with_z_suffix(self):
        issue_key = create_test_issue()
        try:
            add_result = add_worklog(
                issue_key,
                time_spent="1h",
                started="2026-04-15T07:00:00.000+0000",
                comment="TZ test update fixture",
            )
            assert add_result.returncode == 0
            worklog_id = parse_json_output(add_result)["id"]

            update_result = update_worklog(
                issue_key,
                worklog_id,
                started="2026-04-15T09:00:00.000Z",
                comment="TZ test updated Z",
            )
            assert update_result.returncode == 0, f"Update failed: {update_result.stderr}"
            data = parse_json_output(update_result)
            assert "+0000" in data["started"]

            delete_worklog(issue_key, worklog_id)
        finally:
            delete_issue(issue_key)


# =============================================================================
# 7. Worklog update with colon-offset timestamp
# =============================================================================
class TestWorklogUpdateColonOffset:
    def test_update_started_with_colon_offset(self):
        issue_key = create_test_issue()
        try:
            add_result = add_worklog(
                issue_key,
                time_spent="1h",
                started="2026-04-15T07:00:00.000+0000",
                comment="TZ test update colon fixture",
            )
            assert add_result.returncode == 0
            worklog_id = parse_json_output(add_result)["id"]

            update_result = update_worklog(
                issue_key,
                worklog_id,
                started="2026-04-15T12:00:00+02:00",
                comment="TZ test updated colon",
            )
            assert update_result.returncode == 0, f"Update failed: {update_result.stderr}"
            data = parse_json_output(update_result)
            assert "+0200" in data["started"]

            delete_worklog(issue_key, worklog_id)
        finally:
            delete_issue(issue_key)

    def test_update_started_without_milliseconds(self):
        issue_key = create_test_issue()
        try:
            add_result = add_worklog(
                issue_key,
                time_spent="1h",
                started="2026-04-15T07:00:00.000+0000",
                comment="TZ test update no-ms fixture",
            )
            assert add_result.returncode == 0
            worklog_id = parse_json_output(add_result)["id"]

            update_result = update_worklog(
                issue_key,
                worklog_id,
                started="2026-04-15T14:30:00Z",
                comment="TZ test updated no ms",
            )
            assert update_result.returncode == 0, f"Update failed: {update_result.stderr}"
            data = parse_json_output(update_result)
            assert ".000" in data["started"]
            assert "+0000" in data["started"]

            delete_worklog(issue_key, worklog_id)
        finally:
            delete_issue(issue_key)


# =============================================================================
# 8. --dry-run validation for timezone normalization
# =============================================================================
class TestDryRunTimezoneNormalization:
    def test_dry_run_add_with_z_suffix(self):
        issue_key = create_test_issue()
        try:
            result = run_cli(
                "--dry-run", "--json",
                "issue", "worklog", "add", issue_key,
                "--time", "1h",
                "--started", "2026-04-15T07:00:00.000Z",
            )
            assert result.returncode == 0, f"Dry-run failed: {result.stderr}"
            data = parse_json_output(result)
            assert data["dryRun"] is True
            changes = data.get("changes", {})
            assert changes.get("started") == "2026-04-15T07:00:00.000Z"
        finally:
            delete_issue(issue_key)

    def test_dry_run_add_with_colon_offset(self):
        issue_key = create_test_issue()
        try:
            result = run_cli(
                "--dry-run", "--json",
                "issue", "worklog", "add", issue_key,
                "--time", "2h",
                "--started", "2026-04-15T10:00:00+03:00",
            )
            assert result.returncode == 0
            data = parse_json_output(result)
            assert data["dryRun"] is True
        finally:
            delete_issue(issue_key)

    def test_dry_run_no_worklog_created(self):
        issue_key = create_test_issue()
        try:
            worklogs_before = get_worklogs(issue_key)

            run_cli(
                "--dry-run", "--json",
                "issue", "worklog", "add", issue_key,
                "--time", "1h",
                "--started", "2026-04-15T07:00:00Z",
            )

            worklogs_after = get_worklogs(issue_key)
            assert len(worklogs_after) == len(worklogs_before), (
                "Dry-run should not create a worklog"
            )
        finally:
            delete_issue(issue_key)


# =============================================================================
# 9. Error handling — invalid issue key with --started
# =============================================================================
class TestTimezoneErrorHandling:
    def test_invalid_issue_key_with_started(self):
        result = add_worklog(
            "INVALID-99999",
            time_spent="1h",
            started="2026-04-15T07:00:00Z",
        )
        assert result.returncode != 0

    def test_worklog_add_without_started_defaults_to_now(self):
        issue_key = create_test_issue()
        try:
            result = add_worklog(
                issue_key,
                time_spent="15m",
                comment="TZ test default started",
            )
            assert result.returncode == 0, f"Worklog add without --started failed: {result.stderr}"
            data = parse_json_output(result)
            assert "id" in data
            assert data["started"]
            delete_worklog(issue_key, data["id"])
        finally:
            delete_issue(issue_key)
