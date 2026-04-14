"""
E2E tests for Activity Feed & Change Tracking (JIR-137).

Tests cover:
  `issue activity <key>`:
    1. Basic call — returns structured JSON with activities array
    2. --since <ISO-timestamp> — filters activities after timestamp
    3. --limit <n> — respects limit
    4. --types <types> — filters by activity type
    5. --compact — outputs single-line JSON (no commentBody)
    6. Edge cases: invalid issue key
    7. Verify activity types: status_change, field_change, comment_added, comment_updated

  `issue comments <key>`:
    1. Basic call — returns structured JSON with comments array
    2. --limit <n> — respects limit
    3. --since <ISO-timestamp> — filters comments after timestamp
    4. --reverse — returns oldest first
    5. Edge cases: invalid issue key
    6. Verify comment fields: id, author, created, updated, body

Test credentials are stored in ~/.jira-ai/config.json (never committed).
Run from project root after `npm run build`:

    python3 -m pytest tests_e2e/test_activity_feed.py -v
"""

import json
import os
import re
import subprocess
import tempfile
import time

import pytest
import requests

from conftest import (
    REGULAR_PROJECT_KEY,
    EPIC_PROJECT_KEY,
    run_cli,
    save_test_credentials,
    TEST_JIRA_URL,
    TEST_JIRA_EMAIL,
    TEST_JIRA_TOKEN,
)

PROJECT_KEYS = [REGULAR_PROJECT_KEY, "GP", EPIC_PROJECT_KEY]

API_HEADERS = {
    "Content-Type": "application/json",
}


def _api_auth():
    if TEST_JIRA_EMAIL and TEST_JIRA_TOKEN:
        import base64
        creds = f"{TEST_JIRA_EMAIL}:{TEST_JIRA_TOKEN}"
        return {"Authorization": f"Basic {base64.b64encode(creds.encode()).decode()}"}
    return {}


def _api_headers():
    headers = dict(API_HEADERS)
    headers.update(_api_auth())
    return headers


def parse_json_output(result):
    combined = result.stdout.strip()
    if not combined:
        combined = result.stderr.strip()
    return json.loads(combined)


def create_test_issue(project_key=None, title=None):
    ts = str(int(time.time()))
    pk = project_key or REGULAR_PROJECT_KEY
    issue_title = title or f"Activity Feed E2E Test {ts}"
    result = run_cli(
        "issue", "create",
        "--title", issue_title,
        "--project", pk,
        "--issue-type", "Task",
    )
    assert result.returncode == 0, f"Failed to create test issue: {result.stderr}"
    match = re.search(rf"({pk}-\d+)", result.stdout)
    assert match, f"Expected issue key in output: {result.stdout}"
    return match.group(1)


def delete_issue(issue_key):
    run_cli("issue", "delete", issue_key, "--confirm")


def add_comment_via_api(issue_key, body):
    url = f"{TEST_JIRA_URL}/rest/api/3/issue/{issue_key}/comment"
    resp = requests.post(
        url,
        headers=_api_headers(),
        json={"body": {"type": "doc", "version": 1, "content": [{"type": "paragraph", "content": [{"type": "text", "text": body}]}]}},
    )
    assert resp.status_code in (200, 201), f"Failed to add comment: {resp.status_code} {resp.text}"
    return resp.json()


def delete_issue_via_api(issue_key):
    try:
        requests.delete(
            f"{TEST_JIRA_URL}/rest/api/3/issue/{issue_key}?deleteSubtasks=true",
            headers=_api_headers(),
        )
    except Exception:
        pass


@pytest.fixture
def issue_with_activity():
    issue_key = create_test_issue()
    try:
        run_cli("issue", "transition", issue_key, "In Progress")
        add_comment_via_api(issue_key, "First test comment for activity feed")
        time.sleep(1)
        add_comment_via_api(issue_key, "Second test comment for activity feed")
        time.sleep(1)
        yield issue_key
    finally:
        delete_issue_via_api(issue_key)


@pytest.fixture
def issue_with_comments():
    issue_key = create_test_issue()
    try:
        add_comment_via_api(issue_key, "Comment A for comments test")
        time.sleep(1)
        add_comment_via_api(issue_key, "Comment B for comments test")
        time.sleep(1)
        add_comment_via_api(issue_key, "Comment C for comments test")
        yield issue_key
    finally:
        delete_issue_via_api(issue_key)


# =============================================================================
# issue activity tests
# =============================================================================
class TestIssueActivityBasic:
    def test_returns_structured_json(self, issue_with_activity):
        result = run_cli("issue", "activity", issue_with_activity)
        assert result.returncode == 0, f"Failed: {result.stderr}"
        data = parse_json_output(result)
        assert "activities" in data
        assert isinstance(data["activities"], list)
        assert data["issueKey"] == issue_with_activity
        assert "totalChanges" in data
        assert "hasMore" in data

    def test_activities_have_required_fields(self, issue_with_activity):
        result = run_cli("issue", "activity", issue_with_activity)
        data = parse_json_output(result)
        for entry in data["activities"]:
            assert "id" in entry
            assert "type" in entry
            assert "timestamp" in entry
            assert "author" in entry
            assert isinstance(entry["author"], dict)

    def test_contains_status_change(self, issue_with_activity):
        result = run_cli("issue", "activity", issue_with_activity)
        data = parse_json_output(result)
        types = [a["type"] for a in data["activities"]]
        assert "status_change" in types

    def test_contains_comment_added(self, issue_with_activity):
        result = run_cli("issue", "activity", issue_with_activity)
        data = parse_json_output(result)
        types = [a["type"] for a in data["activities"]]
        assert "comment_added" in types

    def test_across_projects(self):
        for pk in PROJECT_KEYS:
            try:
                issue_key = create_test_issue(project_key=pk)
            except Exception:
                continue
            try:
                add_comment_via_api(issue_key, f"Cross-project test comment for {pk}")
                result = run_cli("issue", "activity", issue_key)
                assert result.returncode == 0, f"activity failed for {issue_key}: {result.stderr}"
                data = parse_json_output(result)
                assert data["issueKey"] == issue_key
                assert isinstance(data["activities"], list)
                assert len(data["activities"]) >= 1
            finally:
                delete_issue_via_api(issue_key)
            break


class TestIssueActivityLimit:
    def test_limit_respected(self, issue_with_activity):
        result = run_cli("issue", "activity", issue_with_activity, "--limit", "2")
        data = parse_json_output(result)
        assert len(data["activities"]) <= 2

    def test_limit_one(self, issue_with_activity):
        result = run_cli("issue", "activity", issue_with_activity, "--limit", "1")
        data = parse_json_output(result)
        assert len(data["activities"]) == 1

    def test_limit_has_more(self, issue_with_activity):
        result = run_cli("issue", "activity", issue_with_activity, "--limit", "1")
        data = parse_json_output(result)
        total = data.get("totalChanges", 0)
        if total > 1:
            assert data["hasMore"] is True


class TestIssueActivitySince:
    def test_since_filters_activities(self, issue_with_activity):
        result_all = run_cli("issue", "activity", issue_with_activity)
        data_all = parse_json_output(result_all)
        if not data_all["activities"]:
            pytest.skip("No activities to filter")
        timestamps = [a["timestamp"] for a in data_all["activities"]]
        mid_ts = timestamps[len(timestamps) // 2] if len(timestamps) > 1 else timestamps[0]
        result_since = run_cli("issue", "activity", issue_with_activity, "--since", mid_ts)
        data_since = parse_json_output(result_since)
        for a in data_since["activities"]:
            assert a["timestamp"] >= mid_ts

    def test_since_future_returns_empty_or_fewer(self, issue_with_activity):
        future_ts = "2099-01-01T00:00:00Z"
        result = run_cli("issue", "activity", issue_with_activity, "--since", future_ts)
        data = parse_json_output(result)
        assert len(data["activities"]) == 0


class TestIssueActivityTypes:
    def test_filter_by_status_change(self, issue_with_activity):
        result = run_cli("issue", "activity", issue_with_activity, "--types", "status_change")
        data = parse_json_output(result)
        for a in data["activities"]:
            assert a["type"] == "status_change"

    def test_filter_by_comment_added(self, issue_with_activity):
        result = run_cli("issue", "activity", issue_with_activity, "--types", "comment_added")
        data = parse_json_output(result)
        for a in data["activities"]:
            assert a["type"] == "comment_added"

    def test_filter_by_multiple_types(self, issue_with_activity):
        result = run_cli("issue", "activity", issue_with_activity, "--types", "status_change,comment_added")
        data = parse_json_output(result)
        for a in data["activities"]:
            assert a["type"] in ("status_change", "comment_added")

    def test_verify_activity_type_values(self, issue_with_activity):
        result = run_cli("issue", "activity", issue_with_activity)
        data = parse_json_output(result)
        valid_types = {
            "status_change", "field_change", "link_added", "link_removed",
            "attachment_added", "attachment_removed", "comment_added", "comment_updated",
        }
        for a in data["activities"]:
            assert a["type"] in valid_types, f"Unexpected activity type: {a['type']}"


class TestIssueActivityCompact:
    def test_compact_output(self, issue_with_activity):
        result = run_cli("--compact", "issue", "activity", issue_with_activity)
        assert result.returncode == 0, f"Failed: {result.stderr}"
        output = result.stdout.strip()
        assert "\n" not in output
        data = json.loads(output)
        assert "activities" in data

    def test_compact_omits_comment_body(self, issue_with_activity):
        result = run_cli("--compact", "issue", "activity", issue_with_activity)
        data = parse_json_output(result)
        for a in data["activities"]:
            assert "commentBody" not in a


class TestIssueActivityEdgeCases:
    def test_invalid_issue_key(self):
        result = run_cli("issue", "activity", "INVALID-99999")
        assert result.returncode != 0

    def test_invalid_since_format(self):
        result = run_cli("issue", "activity", "AT-1", "--since", "not-a-date")
        assert result.returncode != 0

    def test_invalid_limit_zero(self):
        result = run_cli("issue", "activity", "AT-1", "--limit", "0")
        assert result.returncode != 0

    def test_new_issue_has_field_change(self):
        issue_key = create_test_issue()
        try:
            result = run_cli("issue", "activity", issue_key)
            assert result.returncode == 0, f"Failed: {result.stderr}"
            data = parse_json_output(result)
            types = [a["type"] for a in data["activities"]]
            assert len(types) > 0, "New issue should have at least some activity"
        finally:
            delete_issue_via_api(issue_key)


# =============================================================================
# issue comments tests
# =============================================================================
class TestIssueCommentsBasic:
    def test_returns_structured_json(self, issue_with_comments):
        result = run_cli("issue", "comments", issue_with_comments)
        assert result.returncode == 0, f"Failed: {result.stderr}"
        data = parse_json_output(result)
        assert "comments" in data
        assert isinstance(data["comments"], list)
        assert data["issueKey"] == issue_with_comments
        assert "total" in data
        assert "hasMore" in data

    def test_comments_have_required_fields(self, issue_with_comments):
        result = run_cli("issue", "comments", issue_with_comments)
        data = parse_json_output(result)
        for c in data["comments"]:
            assert "id" in c
            assert "author" in c
            assert isinstance(c["author"], dict)
            assert "created" in c
            assert "updated" in c
            assert "body" in c

    def test_comments_count(self, issue_with_comments):
        result = run_cli("issue", "comments", issue_with_comments)
        data = parse_json_output(result)
        assert len(data["comments"]) == 3

    def test_default_order_newest_first(self, issue_with_comments):
        result = run_cli("issue", "comments", issue_with_comments)
        data = parse_json_output(result)
        if len(data["comments"]) >= 2:
            first_created = data["comments"][0]["created"]
            second_created = data["comments"][1]["created"]
            assert first_created >= second_created

    def test_across_projects(self):
        for pk in PROJECT_KEYS:
            try:
                issue_key = create_test_issue(project_key=pk)
            except Exception:
                continue
            try:
                add_comment_via_api(issue_key, f"Cross-project comment for {pk}")
                result = run_cli("issue", "comments", issue_key)
                assert result.returncode == 0, f"comments failed for {issue_key}: {result.stderr}"
                data = parse_json_output(result)
                assert data["issueKey"] == issue_key
                assert isinstance(data["comments"], list)
                assert len(data["comments"]) >= 1
            finally:
                delete_issue_via_api(issue_key)
            break


class TestIssueCommentsLimit:
    def test_limit_respected(self, issue_with_comments):
        result = run_cli("issue", "comments", issue_with_comments, "--limit", "2")
        data = parse_json_output(result)
        assert len(data["comments"]) == 2
        assert data["hasMore"] is True

    def test_limit_one(self, issue_with_comments):
        result = run_cli("issue", "comments", issue_with_comments, "--limit", "1")
        data = parse_json_output(result)
        assert len(data["comments"]) == 1

    def test_limit_greater_than_total(self, issue_with_comments):
        result = run_cli("issue", "comments", issue_with_comments, "--limit", "100")
        data = parse_json_output(result)
        assert data["hasMore"] is False


class TestIssueCommentsSince:
    def test_since_filters_comments(self, issue_with_comments):
        result_all = run_cli("issue", "comments", issue_with_comments)
        data_all = parse_json_output(result_all)
        if len(data_all["comments"]) < 2:
            pytest.skip("Not enough comments to filter")
        timestamps = [c["created"] for c in data_all["comments"]]
        mid_ts = timestamps[len(timestamps) // 2]
        result_since = run_cli("issue", "comments", issue_with_comments, "--since", mid_ts)
        data_since = parse_json_output(result_since)
        for c in data_since["comments"]:
            assert c["created"] >= mid_ts

    def test_since_future_returns_empty(self, issue_with_comments):
        future_ts = "2099-01-01T00:00:00Z"
        result = run_cli("issue", "comments", issue_with_comments, "--since", future_ts)
        data = parse_json_output(result)
        assert len(data["comments"]) == 0


class TestIssueCommentsReverse:
    def test_reverse_oldest_first(self, issue_with_comments):
        result = run_cli("issue", "comments", issue_with_comments, "--reverse")
        data = parse_json_output(result)
        if len(data["comments"]) >= 2:
            first_created = data["comments"][0]["created"]
            second_created = data["comments"][1]["created"]
            assert first_created <= second_created

    def test_reverse_preserves_count(self, issue_with_comments):
        result_normal = run_cli("issue", "comments", issue_with_comments)
        result_reverse = run_cli("issue", "comments", issue_with_comments, "--reverse")
        data_normal = parse_json_output(result_normal)
        data_reverse = parse_json_output(result_reverse)
        assert len(data_normal["comments"]) == len(data_reverse["comments"])


class TestIssueCommentsEdgeCases:
    def test_invalid_issue_key(self):
        result = run_cli("issue", "comments", "INVALID-99999")
        assert result.returncode != 0

    def test_invalid_since_format(self):
        result = run_cli("issue", "comments", "AT-1", "--since", "not-a-date")
        assert result.returncode != 0

    def test_invalid_limit_zero(self):
        result = run_cli("issue", "comments", "AT-1", "--limit", "0")
        assert result.returncode != 0

    def test_new_issue_no_comments(self):
        issue_key = create_test_issue()
        try:
            result = run_cli("issue", "comments", issue_key)
            assert result.returncode == 0, f"Failed: {result.stderr}"
            data = parse_json_output(result)
            assert data["comments"] == []
            assert data["total"] == 0
        finally:
            delete_issue_via_api(issue_key)
