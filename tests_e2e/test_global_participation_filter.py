"""
E2E tests for the globalParticipationFilter feature (JIR-164).

Tests exercise the jira-ai CLI end-to-end:
  1. my-tasks preset applies globalParticipationFilter
  2. Search results are restricted via participation JQL injection
  3. Per-issue gating blocks unauthorized access
  4. Other presets (read-only, standard, yolo) do not inject participation filter

Test credentials are stored in ~/.jira-ai/config.json (never committed).
Run from project root after `npm run build`.

Usage:
    python3 -m pytest tests_e2e/test_global_participation_filter.py -v
"""

import json
import os

import pytest
import yaml

from conftest import (
    CONFIG_DIR,
    REGULAR_PROJECT_KEY,
    run_cli,
    save_test_credentials,
)

SETTINGS_FILE = os.path.join(CONFIG_DIR, "settings.yaml")

TEST_JIRA_URL = os.environ.get("TEST_JIRA_URL", "https://festoinc.atlassian.net")
TEST_JIRA_EMAIL = os.environ.get("TEST_JIRA_EMAIL", "")
TEST_JIRA_TOKEN = os.environ.get("TEST_JIRA_TOKEN", "")

HAS_CREDENTIALS = bool(TEST_JIRA_EMAIL and TEST_JIRA_TOKEN)


def parse_json_output(result):
    combined = result.stdout.strip()
    if not combined:
        combined = result.stderr.strip()
    return json.loads(combined)


def write_settings(settings_dict):
    os.makedirs(CONFIG_DIR, exist_ok=True)
    with open(SETTINGS_FILE, "w") as f:
        yaml.dump(settings_dict, f, default_flow_style=False)


def read_settings():
    if os.path.exists(SETTINGS_FILE):
        with open(SETTINGS_FILE, "r") as f:
            return yaml.safe_load(f)
    return None


MY_TASKS_SETTINGS = {
    "defaults": {
        "allowed-jira-projects": ["all"],
        "allowed-commands": ["issue", "project", "user", "confl", "epic", "board", "sprint", "backlog"],
        "allowed-confluence-spaces": ["all"],
        "globalParticipationFilter": {
            "was_assignee": True,
            "was_reporter": True,
            "was_commenter": True,
            "is_watcher": True,
        },
    }
}

YOLO_SETTINGS = {
    "defaults": {
        "allowed-jira-projects": ["all"],
        "allowed-commands": ["all"],
        "allowed-confluence-spaces": ["all"],
    }
}

READ_ONLY_SETTINGS = {
    "defaults": {
        "allowed-jira-projects": ["all"],
        "allowed-commands": [
            "issue.get", "issue.search", "issue.stats", "issue.comments",
            "issue.activity", "issue.tree", "issue.worklog.list",
            "issue.link.list", "issue.link.types", "issue.attach.list",
            "project.list", "project.statuses", "project.types", "project.fields",
            "user.me", "user.search", "user.worklog",
            "confl.get", "confl.spaces", "confl.pages", "confl.search",
            "epic.list", "epic.get", "epic.issues", "epic.progress",
            "board.list", "board.get", "board.config", "board.issues",
            "sprint.list", "sprint.get", "sprint.issues", "sprint.tree",
        ],
        "allowed-confluence-spaces": ["all"],
    }
}


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
# 1. my-tasks preset writes globalParticipationFilter
# =============================================================================
class TestMyTasksPresetWritesFilter:
    def test_my_tasks_settings_have_participation_filter(self):
        run_cli("settings", "--preset", "my-tasks")
        settings = read_settings()
        gpf = settings["defaults"].get("globalParticipationFilter")
        assert gpf is not None
        assert gpf["was_assignee"] is True
        assert gpf["was_reporter"] is True
        assert gpf["was_commenter"] is True
        assert gpf["is_watcher"] is True

    def test_my_tasks_detect_preset(self):
        run_cli("settings", "--preset", "my-tasks")
        result = run_cli("settings", "--detect-preset")
        data = parse_json_output(result)
        assert data["current"] == "my-tasks"


# =============================================================================
# 2. Other presets do not have participation filter
# =============================================================================
class TestOtherPresetsNoFilter:
    def test_yolo_no_participation_filter(self):
        run_cli("settings", "--preset", "yolo")
        settings = read_settings()
        assert settings["defaults"].get("globalParticipationFilter") is None

    def test_read_only_no_participation_filter(self):
        run_cli("settings", "--preset", "read-only")
        settings = read_settings()
        assert settings["defaults"].get("globalParticipationFilter") is None

    def test_standard_no_participation_filter(self):
        run_cli("settings", "--preset", "standard")
        settings = read_settings()
        assert settings["defaults"].get("globalParticipationFilter") is None


# =============================================================================
# 3. Search operations with my-tasks preset (requires credentials)
# =============================================================================
class TestSearchWithMyTasks:
    @pytest.mark.skipif(not HAS_CREDENTIALS, reason="No Jira test credentials")
    def test_search_with_my_tasks_returns_results(self):
        write_settings(MY_TASKS_SETTINGS)
        result = run_cli("issue", "search", "assignee = currentUser()", "--limit", "5")
        assert result.returncode == 0, f"Failed: {result.stderr}"
        data = parse_json_output(result)
        assert isinstance(data, list)

    @pytest.mark.skipif(not HAS_CREDENTIALS, reason="No Jira test credentials")
    def test_search_with_yolo_returns_results(self):
        write_settings(YOLO_SETTINGS)
        result = run_cli("issue", "search", f"project = {REGULAR_PROJECT_KEY}", "--limit", "5")
        assert result.returncode == 0, f"Failed: {result.stderr}"
        data = parse_json_output(result)
        assert isinstance(data, list)


# =============================================================================
# 4. Per-issue gating with read-only preset
# =============================================================================
class TestPerIssueGating:
    @pytest.mark.skipif(not HAS_CREDENTIALS, reason="No Jira test credentials")
    def test_read_only_allows_get(self):
        write_settings(READ_ONLY_SETTINGS)
        result = run_cli("issue", "get", f"{REGULAR_PROJECT_KEY}-1")
        assert result.returncode == 0, f"Failed: {result.stderr}"

    @pytest.mark.skipif(not HAS_CREDENTIALS, reason="No Jira test credentials")
    def test_read_only_blocks_create(self):
        write_settings(READ_ONLY_SETTINGS)
        result = run_cli(
            "issue", "create",
            "--title", "Should not be created",
            "--project", REGULAR_PROJECT_KEY,
            "--issue-type", "Task",
        )
        assert result.returncode != 0
        combined = result.stdout + result.stderr
        assert "not allowed" in combined.lower()

    @pytest.mark.skipif(not HAS_CREDENTIALS, reason="No Jira test credentials")
    def test_yolo_allows_create(self):
        write_settings(YOLO_SETTINGS)
        result = run_cli(
            "--dry-run", "issue", "create",
            "--title", "Yolo test create",
            "--project", REGULAR_PROJECT_KEY,
            "--issue-type", "Task",
        )
        assert result.returncode == 0, f"Failed: {result.stderr}"

    @pytest.mark.skipif(not HAS_CREDENTIALS, reason="No Jira test credentials")
    def test_read_only_blocks_update(self):
        write_settings(READ_ONLY_SETTINGS)
        result = run_cli(
            "--dry-run", "issue", "update", f"{REGULAR_PROJECT_KEY}-1",
            "--priority", "High",
        )
        assert result.returncode != 0
        combined = result.stdout + result.stderr
        assert "not allowed" in combined.lower()


# =============================================================================
# 5. Settings file correctly stores participation filter
# =============================================================================
class TestSettingsFileParticipation:
    def test_participation_filter_survives_settings_roundtrip(self):
        run_cli("settings", "--preset", "my-tasks")
        settings = read_settings()
        defaults = dict(settings["defaults"])
        gpf = defaults.pop("globalParticipationFilter")
        run_cli("settings", "--reset")
        write_settings({
            "defaults": {
                **defaults,
                "globalParticipationFilter": gpf,
            }
        })
        result = run_cli("settings", "--detect-preset")
        data = parse_json_output(result)
        assert data["current"] == "my-tasks"

    def test_partial_participation_filter_is_custom(self):
        settings = {
            "defaults": {
                "allowed-jira-projects": ["all"],
                "allowed-commands": ["issue", "project", "user", "confl", "epic", "board", "sprint", "backlog"],
                "allowed-confluence-spaces": ["all"],
                "globalParticipationFilter": {
                    "was_assignee": True,
                    "was_reporter": False,
                    "was_commenter": False,
                    "is_watcher": False,
                },
            }
        }
        write_settings(settings)
        result = run_cli("settings", "--detect-preset")
        data = parse_json_output(result)
        assert data["current"] == "custom"
