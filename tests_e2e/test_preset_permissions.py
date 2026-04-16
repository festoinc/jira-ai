"""
E2E tests for command permission enforcement by presets (JIR-164 step 10).

Verifies that each preset correctly allows or blocks CLI commands:
  1. read-only:  read commands succeed, write commands blocked
  2. standard:   productive commands succeed, destructive commands blocked
  3. my-tasks:   all commands allowed, participation filter applied
  4. yolo:       all commands succeed

Blocked-command tests do NOT need live Jira credentials because the
permission check happens before any API call.  Allowed-command tests
that hit the real API are gated behind HAS_CREDENTIALS.

Run from project root after `npm run build`.

Usage:
    TEST_JIRA_EMAIL=... TEST_JIRA_TOKEN=... python3 -m pytest tests_e2e/test_preset_permissions.py -v
"""

import json
import os
import tempfile

import pytest
import yaml

from conftest import (
    CONFIG_DIR,
    REGULAR_PROJECT_KEY,
    run_cli,
    save_test_credentials,
)

SETTINGS_FILE = os.path.join(CONFIG_DIR, "settings.yaml")

TEST_JIRA_EMAIL = os.environ.get("TEST_JIRA_EMAIL", "")
TEST_JIRA_TOKEN = os.environ.get("TEST_JIRA_TOKEN", "")
HAS_CREDENTIALS = bool(TEST_JIRA_EMAIL and TEST_JIRA_TOKEN)

EXISTING_ISSUE = f"{REGULAR_PROJECT_KEY}-258"
EXISTING_ISSUE_2 = f"{REGULAR_PROJECT_KEY}-257"
BOARD_ID = "69"


def parse_json_output(result):
    combined = result.stdout.strip()
    if not combined:
        combined = result.stderr.strip()
    return json.loads(combined)


def write_settings(settings_dict):
    os.makedirs(CONFIG_DIR, exist_ok=True)
    with open(SETTINGS_FILE, "w") as f:
        yaml.dump(settings_dict, f, default_flow_style=False)


@pytest.fixture(autouse=True)
def setup_and_restore():
    original_settings = None
    if os.path.exists(SETTINGS_FILE):
        with open(SETTINGS_FILE, "r") as f:
            original_settings = f.read()
    save_test_credentials()
    yield
    if original_settings is not None:
        with open(SETTINGS_FILE, "w") as f:
            f.write(original_settings)
    elif os.path.exists(SETTINGS_FILE):
        os.unlink(SETTINGS_FILE)


# =============================================================================
# 1. read-only preset — read commands succeed, write commands blocked
# =============================================================================
class TestReadOnlyAllowed:
    @pytest.mark.skipif(not HAS_CREDENTIALS, reason="No Jira test credentials")
    def test_issue_get_allowed(self):
        run_cli("settings", "--preset", "read-only")
        result = run_cli("issue", "get", EXISTING_ISSUE)
        assert result.returncode == 0, f"issue.get blocked: {result.stderr}"

    @pytest.mark.skipif(not HAS_CREDENTIALS, reason="No Jira test credentials")
    def test_issue_search_allowed(self):
        run_cli("settings", "--preset", "read-only")
        result = run_cli("issue", "search", f"project = {REGULAR_PROJECT_KEY}", "--limit", "3")
        assert result.returncode == 0, f"issue.search blocked: {result.stderr}"

    @pytest.mark.skipif(not HAS_CREDENTIALS, reason="No Jira test credentials")
    def test_project_list_allowed(self):
        run_cli("settings", "--preset", "read-only")
        result = run_cli("project", "list")
        assert result.returncode == 0, f"project.list blocked: {result.stderr}"

    @pytest.mark.skipif(not HAS_CREDENTIALS, reason="No Jira test credentials")
    def test_user_me_allowed(self):
        run_cli("settings", "--preset", "read-only")
        result = run_cli("user", "me")
        assert result.returncode == 0, f"user.me blocked: {result.stderr}"

    @pytest.mark.skipif(not HAS_CREDENTIALS, reason="No Jira test credentials")
    def test_issue_comments_allowed(self):
        run_cli("settings", "--preset", "read-only")
        result = run_cli("issue", "comments", EXISTING_ISSUE)
        assert result.returncode == 0, f"issue.comments blocked: {result.stderr}"

    @pytest.mark.skipif(not HAS_CREDENTIALS, reason="No Jira test credentials")
    def test_issue_tree_allowed(self):
        run_cli("settings", "--preset", "read-only")
        result = run_cli("issue", "tree", EXISTING_ISSUE)
        assert result.returncode == 0, f"issue.tree blocked: {result.stderr}"

    @pytest.mark.skipif(not HAS_CREDENTIALS, reason="No Jira test credentials")
    def test_epic_list_allowed(self):
        run_cli("settings", "--preset", "read-only")
        result = run_cli("epic", "list", REGULAR_PROJECT_KEY)
        assert result.returncode == 0, f"epic.list blocked: {result.stderr}"

    @pytest.mark.skipif(not HAS_CREDENTIALS, reason="No Jira test credentials")
    def test_board_list_allowed(self):
        run_cli("settings", "--preset", "read-only")
        result = run_cli("board", "list")
        assert result.returncode == 0, f"board.list blocked: {result.stderr}"

    @pytest.mark.skipif(not HAS_CREDENTIALS, reason="No Jira test credentials")
    def test_sprint_list_allowed(self):
        run_cli("settings", "--preset", "read-only")
        result = run_cli("sprint", "list", BOARD_ID)
        assert result.returncode == 0, f"sprint.list blocked: {result.stderr}"


class TestReadOnlyBlocked:
    def test_issue_create_blocked(self):
        run_cli("settings", "--preset", "read-only")
        result = run_cli(
            "issue", "create",
            "--title", "blocked by read-only",
            "--project", REGULAR_PROJECT_KEY,
            "--issue-type", "Task",
        )
        assert result.returncode != 0
        combined = result.stdout + result.stderr
        assert "not allowed" in combined.lower()

    def test_issue_update_blocked(self):
        run_cli("settings", "--preset", "read-only")
        result = run_cli("issue", "update", EXISTING_ISSUE, "--summary", "blocked")
        assert result.returncode != 0
        combined = result.stdout + result.stderr
        assert "not allowed" in combined.lower()

    def test_issue_transition_blocked(self):
        run_cli("settings", "--preset", "read-only")
        result = run_cli("issue", "transition", EXISTING_ISSUE, "Done")
        assert result.returncode != 0
        combined = result.stdout + result.stderr
        assert "not allowed" in combined.lower()

    def test_issue_comment_blocked(self):
        run_cli("settings", "--preset", "read-only")
        with tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False) as f:
            f.write("blocked comment")
            tmp = f.name
        try:
            result = run_cli("issue", "comment", EXISTING_ISSUE, "--from-file", tmp)
        finally:
            os.unlink(tmp)
        assert result.returncode != 0
        combined = result.stdout + result.stderr
        assert "not allowed" in combined.lower()

    def test_issue_assign_blocked(self):
        run_cli("settings", "--preset", "read-only")
        result = run_cli("issue", "assign", EXISTING_ISSUE, "some-account-id")
        assert result.returncode != 0
        combined = result.stdout + result.stderr
        assert "not allowed" in combined.lower()

    def test_issue_label_add_blocked(self):
        run_cli("settings", "--preset", "read-only")
        result = run_cli("issue", "label", "add", EXISTING_ISSUE, "test-label")
        assert result.returncode != 0
        combined = result.stdout + result.stderr
        assert "not allowed" in combined.lower()

    def test_issue_label_remove_blocked(self):
        run_cli("settings", "--preset", "read-only")
        result = run_cli("issue", "label", "remove", EXISTING_ISSUE, "test-label")
        assert result.returncode != 0
        combined = result.stdout + result.stderr
        assert "not allowed" in combined.lower()

    def test_issue_link_create_blocked(self):
        run_cli("settings", "--preset", "read-only")
        result = run_cli("issue", "link", "create", EXISTING_ISSUE, "Blocks", EXISTING_ISSUE_2)
        assert result.returncode != 0
        combined = result.stdout + result.stderr
        assert "not allowed" in combined.lower()

    def test_issue_link_delete_blocked(self):
        run_cli("settings", "--preset", "read-only")
        result = run_cli("issue", "link", "delete", EXISTING_ISSUE, "--target", EXISTING_ISSUE_2)
        assert result.returncode != 0
        combined = result.stdout + result.stderr
        assert "not allowed" in combined.lower()

    def test_issue_attach_upload_blocked(self):
        run_cli("settings", "--preset", "read-only")
        result = run_cli("issue", "attach", "upload", EXISTING_ISSUE, "--file", "/tmp/test.txt")
        assert result.returncode != 0
        combined = result.stdout + result.stderr
        assert "not allowed" in combined.lower()

    def test_issue_attach_delete_blocked(self):
        run_cli("settings", "--preset", "read-only")
        result = run_cli("issue", "attach", "delete", EXISTING_ISSUE, "--id", "12345")
        assert result.returncode != 0
        combined = result.stdout + result.stderr
        assert "not allowed" in combined.lower()

    def test_issue_worklog_add_blocked(self):
        run_cli("settings", "--preset", "read-only")
        result = run_cli("issue", "worklog", "add", EXISTING_ISSUE, "--time", "1h")
        assert result.returncode != 0
        combined = result.stdout + result.stderr
        assert "not allowed" in combined.lower()

    def test_issue_worklog_update_blocked(self):
        run_cli("settings", "--preset", "read-only")
        result = run_cli("issue", "worklog", "update", EXISTING_ISSUE, "--id", "12345", "--time", "2h")
        assert result.returncode != 0
        combined = result.stdout + result.stderr
        assert "not allowed" in combined.lower()

    def test_issue_worklog_delete_blocked(self):
        run_cli("settings", "--preset", "read-only")
        result = run_cli("issue", "worklog", "delete", EXISTING_ISSUE, "--id", "12345")
        assert result.returncode != 0
        combined = result.stdout + result.stderr
        assert "not allowed" in combined.lower()

    def test_epic_create_blocked(self):
        run_cli("settings", "--preset", "read-only")
        result = run_cli("epic", "create", REGULAR_PROJECT_KEY, "--name", "blocked-epic", "--summary", "test")
        assert result.returncode != 0
        combined = result.stdout + result.stderr
        assert "not allowed" in combined.lower()

    def test_epic_update_blocked(self):
        run_cli("settings", "--preset", "read-only")
        result = run_cli("epic", "update", EXISTING_ISSUE, "--name", "blocked")
        assert result.returncode != 0
        combined = result.stdout + result.stderr
        assert "not allowed" in combined.lower()


# =============================================================================
# 2. standard preset — productive commands succeed, destructive blocked
# =============================================================================
class TestStandardAllowed:
    @pytest.mark.skipif(not HAS_CREDENTIALS, reason="No Jira test credentials")
    def test_issue_search_allowed(self):
        run_cli("settings", "--preset", "standard")
        result = run_cli("issue", "search", f"project = {REGULAR_PROJECT_KEY}", "--limit", "3")
        assert result.returncode == 0

    @pytest.mark.skipif(not HAS_CREDENTIALS, reason="No Jira test credentials")
    def test_issue_get_allowed(self):
        run_cli("settings", "--preset", "standard")
        result = run_cli("issue", "get", EXISTING_ISSUE)
        assert result.returncode == 0

    def test_issue_create_dry_run_allowed(self):
        run_cli("settings", "--preset", "standard")
        result = run_cli(
            "--dry-run", "issue", "create",
            "--title", "standard allows create",
            "--project", REGULAR_PROJECT_KEY,
            "--issue-type", "Task",
        )
        assert result.returncode == 0, f"issue.create dry-run blocked: {result.stderr}"

    def test_issue_update_dry_run_allowed(self):
        run_cli("settings", "--preset", "standard")
        result = run_cli(
            "--dry-run", "issue", "update",
            EXISTING_ISSUE,
            "--summary", "updated",
        )
        assert result.returncode == 0, f"issue.update dry-run blocked: {result.stderr}"

    def test_issue_transition_dry_run_allowed(self):
        run_cli("settings", "--preset", "standard")
        result = run_cli(
            "--dry-run", "issue", "transition",
            EXISTING_ISSUE,
            "Done",
        )
        assert result.returncode == 0, f"issue.transition dry-run blocked: {result.stderr}"

    def test_issue_comment_dry_run_allowed(self):
        run_cli("settings", "--preset", "standard")
        with tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False) as f:
            f.write("test comment")
            tmp = f.name
        try:
            result = run_cli("--dry-run", "issue", "comment", EXISTING_ISSUE, "--from-file", tmp)
        finally:
            os.unlink(tmp)
        assert result.returncode == 0, f"issue.comment dry-run blocked: {result.stderr}"

    def test_issue_worklog_add_dry_run_allowed(self):
        run_cli("settings", "--preset", "standard")
        result = run_cli(
            "--dry-run", "issue", "worklog", "add",
            EXISTING_ISSUE,
            "--time", "1h",
        )
        assert result.returncode == 0, f"issue.worklog.add dry-run blocked: {result.stderr}"

    def test_issue_link_create_dry_run_allowed(self):
        run_cli("settings", "--preset", "standard")
        result = run_cli(
            "--dry-run", "issue", "link", "create",
            EXISTING_ISSUE, "Blocks", EXISTING_ISSUE_2,
        )
        assert result.returncode == 0, f"issue.link.create dry-run blocked: {result.stderr}"

    def test_epic_create_not_blocked_by_permissions(self):
        run_cli("settings", "--preset", "standard")
        result = run_cli(
            "--dry-run", "epic", "create",
            REGULAR_PROJECT_KEY,
            "--name", "standard-epic",
            "--summary", "test epic",
        )
        combined = (result.stdout + result.stderr).lower()
        assert "not allowed" not in combined


class TestStandardBlocked:
    def test_issue_link_delete_blocked(self):
        run_cli("settings", "--preset", "standard")
        result = run_cli("issue", "link", "delete", EXISTING_ISSUE, "--target", EXISTING_ISSUE_2)
        assert result.returncode != 0
        combined = result.stdout + result.stderr
        assert "not allowed" in combined.lower()

    def test_issue_attach_delete_blocked(self):
        run_cli("settings", "--preset", "standard")
        result = run_cli("issue", "attach", "delete", EXISTING_ISSUE, "--id", "12345")
        assert result.returncode != 0
        combined = result.stdout + result.stderr
        assert "not allowed" in combined.lower()

    def test_issue_worklog_delete_blocked(self):
        run_cli("settings", "--preset", "standard")
        result = run_cli("issue", "worklog", "delete", EXISTING_ISSUE, "--id", "12345")
        assert result.returncode != 0
        combined = result.stdout + result.stderr
        assert "not allowed" in combined.lower()

    def test_sprint_create_blocked(self):
        run_cli("settings", "--preset", "standard")
        result = run_cli("sprint", "create", BOARD_ID, "--name", "blocked-sprint")
        assert result.returncode != 0
        combined = result.stdout + result.stderr
        assert "not allowed" in combined.lower()

    def test_sprint_start_blocked(self):
        run_cli("settings", "--preset", "standard")
        result = run_cli("sprint", "start", "37")
        assert result.returncode != 0
        combined = result.stdout + result.stderr
        assert "not allowed" in combined.lower()

    def test_sprint_complete_blocked(self):
        run_cli("settings", "--preset", "standard")
        result = run_cli("sprint", "complete", "37")
        assert result.returncode != 0
        combined = result.stdout + result.stderr
        assert "not allowed" in combined.lower()

    def test_sprint_delete_blocked(self):
        run_cli("settings", "--preset", "standard")
        result = run_cli("sprint", "delete", "37")
        assert result.returncode != 0
        combined = result.stdout + result.stderr
        assert "not allowed" in combined.lower()

    def test_sprint_move_blocked(self):
        run_cli("settings", "--preset", "standard")
        result = run_cli("sprint", "move", "37", "--issues", EXISTING_ISSUE)
        assert result.returncode != 0
        combined = result.stdout + result.stderr
        assert "not allowed" in combined.lower()

    def test_board_rank_blocked(self):
        run_cli("settings", "--preset", "standard")
        result = run_cli("board", "rank", "--issues", EXISTING_ISSUE, "--after", EXISTING_ISSUE_2)
        assert result.returncode != 0
        combined = result.stdout + result.stderr
        assert "not allowed" in combined.lower()

    def test_backlog_move_blocked(self):
        run_cli("settings", "--preset", "standard")
        result = run_cli("backlog", "move", "--issues", EXISTING_ISSUE)
        assert result.returncode != 0
        combined = result.stdout + result.stderr
        assert "not allowed" in combined.lower()


# =============================================================================
# 3. my-tasks preset — all commands allowed, participation filter applied
# =============================================================================
class TestMyTasksPermissions:
    def test_settings_has_participation_filter(self):
        run_cli("settings", "--preset", "my-tasks")
        result = run_cli("settings")
        data = parse_json_output(result)
        gpf = data["defaults"].get("globalParticipationFilter")
        assert gpf is not None
        assert gpf.get("was_assignee") is True
        assert gpf.get("was_reporter") is True
        assert gpf.get("was_commenter") is True
        assert gpf.get("is_watcher") is True

    def test_issue_create_dry_run_allowed(self):
        run_cli("settings", "--preset", "my-tasks")
        result = run_cli(
            "--dry-run", "issue", "create",
            "--title", "my-tasks allows create",
            "--project", REGULAR_PROJECT_KEY,
            "--issue-type", "Task",
        )
        assert result.returncode == 0

    def test_issue_update_dry_run_allowed(self):
        run_cli("settings", "--preset", "my-tasks")
        result = run_cli(
            "--dry-run", "issue", "update",
            EXISTING_ISSUE,
            "--summary", "updated",
        )
        assert result.returncode == 0

    def test_sprint_create_dry_run_allowed(self):
        run_cli("settings", "--preset", "my-tasks")
        result = run_cli(
            "--dry-run", "sprint", "create",
            BOARD_ID,
            "--name", "my-tasks sprint",
        )
        assert result.returncode == 0

    def test_backlog_move_dry_run_allowed(self):
        run_cli("settings", "--preset", "my-tasks")
        result = run_cli(
            "--dry-run", "backlog", "move",
            "--issues", EXISTING_ISSUE,
        )
        assert result.returncode == 0

    def test_board_rank_dry_run_allowed(self):
        run_cli("settings", "--preset", "my-tasks")
        result = run_cli(
            "--dry-run", "board", "rank",
            "--issues", EXISTING_ISSUE,
            "--after", EXISTING_ISSUE_2,
        )
        assert result.returncode == 0

    def test_issue_worklog_delete_dry_run_allowed(self):
        run_cli("settings", "--preset", "my-tasks")
        result = run_cli(
            "--dry-run", "issue", "worklog", "delete",
            EXISTING_ISSUE,
            "--id", "12345",
        )
        assert result.returncode == 0

    def test_issue_link_delete_dry_run_allowed(self):
        run_cli("settings", "--preset", "my-tasks")
        result = run_cli(
            "--dry-run", "issue", "link", "delete",
            EXISTING_ISSUE,
            "--target", EXISTING_ISSUE_2,
        )
        assert result.returncode == 0

    def test_sprint_delete_not_blocked_by_permissions(self):
        run_cli("settings", "--preset", "my-tasks")
        result = run_cli("--dry-run", "sprint", "delete", "37")
        combined = (result.stdout + result.stderr).lower()
        assert "not allowed" not in combined

    @pytest.mark.skipif(not HAS_CREDENTIALS, reason="No Jira test credentials")
    def test_search_with_participation_filter(self):
        run_cli("settings", "--preset", "my-tasks")
        result = run_cli("issue", "search", "assignee = currentUser()", "--limit", "5")
        assert result.returncode == 0


# =============================================================================
# 4. yolo preset — all commands succeed
# =============================================================================
class TestYoloPermissions:
    def test_issue_create_dry_run_allowed(self):
        run_cli("settings", "--preset", "yolo")
        result = run_cli(
            "--dry-run", "issue", "create",
            "--title", "yolo allows everything",
            "--project", REGULAR_PROJECT_KEY,
            "--issue-type", "Task",
        )
        assert result.returncode == 0

    def test_issue_update_dry_run_allowed(self):
        run_cli("settings", "--preset", "yolo")
        result = run_cli(
            "--dry-run", "issue", "update",
            EXISTING_ISSUE,
            "--summary", "updated",
        )
        assert result.returncode == 0

    def test_issue_transition_dry_run_allowed(self):
        run_cli("settings", "--preset", "yolo")
        result = run_cli(
            "--dry-run", "issue", "transition",
            EXISTING_ISSUE,
            "Done",
        )
        assert result.returncode == 0

    def test_issue_link_delete_not_blocked_by_permissions(self):
        run_cli("settings", "--preset", "yolo")
        result = run_cli(
            "--dry-run", "issue", "link", "delete",
            EXISTING_ISSUE,
            "--target", EXISTING_ISSUE_2,
        )
        combined = (result.stdout + result.stderr).lower()
        assert "not allowed" not in combined

    def test_issue_attach_delete_not_blocked_by_permissions(self):
        run_cli("settings", "--preset", "yolo")
        result = run_cli(
            "--dry-run", "issue", "attach", "delete",
            EXISTING_ISSUE,
            "--id", "12345",
        )
        combined = (result.stdout + result.stderr).lower()
        assert "not allowed" not in combined

    def test_issue_worklog_delete_dry_run_allowed(self):
        run_cli("settings", "--preset", "yolo")
        result = run_cli(
            "--dry-run", "issue", "worklog", "delete",
            EXISTING_ISSUE,
            "--id", "12345",
        )
        assert result.returncode == 0

    def test_sprint_create_dry_run_allowed(self):
        run_cli("settings", "--preset", "yolo")
        result = run_cli(
            "--dry-run", "sprint", "create",
            BOARD_ID,
            "--name", "yolo sprint",
        )
        assert result.returncode == 0

    def test_sprint_delete_not_blocked_by_permissions(self):
        run_cli("settings", "--preset", "yolo")
        result = run_cli("--dry-run", "sprint", "delete", "37")
        combined = (result.stdout + result.stderr).lower()
        assert "not allowed" not in combined

    def test_board_rank_dry_run_allowed(self):
        run_cli("settings", "--preset", "yolo")
        result = run_cli(
            "--dry-run", "board", "rank",
            "--issues", EXISTING_ISSUE,
            "--after", EXISTING_ISSUE_2,
        )
        assert result.returncode == 0

    def test_backlog_move_dry_run_allowed(self):
        run_cli("settings", "--preset", "yolo")
        result = run_cli(
            "--dry-run", "backlog", "move",
            "--issues", EXISTING_ISSUE,
        )
        assert result.returncode == 0

    @pytest.mark.skipif(not HAS_CREDENTIALS, reason="No Jira test credentials")
    def test_issue_search_allowed(self):
        run_cli("settings", "--preset", "yolo")
        result = run_cli("issue", "search", f"project = {REGULAR_PROJECT_KEY}", "--limit", "3")
        assert result.returncode == 0

    @pytest.mark.skipif(not HAS_CREDENTIALS, reason="No Jira test credentials")
    def test_issue_get_allowed(self):
        run_cli("settings", "--preset", "yolo")
        result = run_cli("issue", "get", EXISTING_ISSUE)
        assert result.returncode == 0

    def test_no_participation_filter(self):
        run_cli("settings", "--preset", "yolo")
        result = run_cli("settings")
        data = parse_json_output(result)
        assert data["defaults"].get("globalParticipationFilter") is None
        assert data["defaults"]["allowed-commands"] == ["all"]
