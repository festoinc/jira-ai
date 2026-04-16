"""
E2E regression tests for preset feature (JIR-164).

Verifies existing search and issue operations still work after the presets feature:
  1. Issue search works with yolo preset (all allowed)
  2. Issue get works with yolo preset
  3. Issue search works with my-tasks preset (participation filter)
  4. Project list works with various presets
  5. Settings reset restores default functionality
  6. Issue search works after switching between presets

Test credentials are stored in ~/.jira-ai/config.json (never committed).
Run from project root after `npm run build`.

Usage:
    python3 -m pytest tests_e2e/test_preset_regression.py -v
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
# 1. Search works with yolo preset
# =============================================================================
class TestSearchWithYolo:
    @pytest.mark.skipif(not HAS_CREDENTIALS, reason="No Jira test credentials")
    def test_search_with_yolo_returns_results(self):
        run_cli("settings", "--preset", "yolo")
        result = run_cli("issue", "search", f"project = {REGULAR_PROJECT_KEY}", "--limit", "5")
        assert result.returncode == 0, f"Failed: {result.stderr}"
        data = parse_json_output(result)
        assert isinstance(data, list)

    @pytest.mark.skipif(not HAS_CREDENTIALS, reason="No Jira test credentials")
    def test_search_with_yolo_returns_valid_issues(self):
        run_cli("settings", "--preset", "yolo")
        result = run_cli("issue", "search", f"project = {REGULAR_PROJECT_KEY}", "--limit", "3")
        data = parse_json_output(result)
        for issue in data:
            assert "key" in issue
            assert issue["key"].startswith(f"{REGULAR_PROJECT_KEY}-")


# =============================================================================
# 2. Issue get works with yolo preset
# =============================================================================
class TestIssueGetWithYolo:
    @pytest.mark.skipif(not HAS_CREDENTIALS, reason="No Jira test credentials")
    def test_get_issue_with_yolo(self):
        run_cli("settings", "--preset", "yolo")
        result = run_cli("issue", "get", f"{REGULAR_PROJECT_KEY}-1")
        assert result.returncode == 0, f"Failed: {result.stderr}"
        data = parse_json_output(result)
        assert "key" in data
        assert data["key"] == f"{REGULAR_PROJECT_KEY}-1"


# =============================================================================
# 3. Search works with my-tasks preset
# =============================================================================
class TestSearchWithMyTasks:
    @pytest.mark.skipif(not HAS_CREDENTIALS, reason="No Jira test credentials")
    def test_search_with_my_tasks(self):
        run_cli("settings", "--preset", "my-tasks")
        result = run_cli("issue", "search", "assignee = currentUser()", "--limit", "5")
        assert result.returncode == 0, f"Failed: {result.stderr}"
        data = parse_json_output(result)
        assert isinstance(data, list)


# =============================================================================
# 4. Project list works with various presets
# =============================================================================
class TestProjectListWithPresets:
    @pytest.mark.skipif(not HAS_CREDENTIALS, reason="No Jira test credentials")
    def test_project_list_with_yolo(self):
        run_cli("settings", "--preset", "yolo")
        result = run_cli("project", "list")
        assert result.returncode == 0, f"Failed: {result.stderr}"

    @pytest.mark.skipif(not HAS_CREDENTIALS, reason="No Jira test credentials")
    def test_project_list_with_read_only(self):
        run_cli("settings", "--preset", "read-only")
        result = run_cli("project", "list")
        assert result.returncode == 0, f"Failed: {result.stderr}"

    @pytest.mark.skipif(not HAS_CREDENTIALS, reason="No Jira test credentials")
    def test_project_list_with_standard(self):
        run_cli("settings", "--preset", "standard")
        result = run_cli("project", "list")
        assert result.returncode == 0, f"Failed: {result.stderr}"

    @pytest.mark.skipif(not HAS_CREDENTIALS, reason="No Jira test credentials")
    def test_project_list_with_my_tasks(self):
        run_cli("settings", "--preset", "my-tasks")
        result = run_cli("project", "list")
        assert result.returncode == 0, f"Failed: {result.stderr}"


# =============================================================================
# 5. Settings reset restores default functionality
# =============================================================================
class TestSettingsReset:
    def test_reset_returns_to_default(self):
        run_cli("settings", "--preset", "yolo")
        run_cli("settings", "--reset")
        result = run_cli("settings")
        data = parse_json_output(result)
        assert "defaults" in data
        cmds = data["defaults"]["allowed-commands"]
        assert "issue" in cmds or any("issue" in c for c in cmds)

    @pytest.mark.skipif(not HAS_CREDENTIALS, reason="No Jira test credentials")
    def test_search_works_after_reset(self):
        run_cli("settings", "--preset", "yolo")
        run_cli("settings", "--reset")
        result = run_cli("issue", "search", f"project = {REGULAR_PROJECT_KEY}", "--limit", "3")
        assert result.returncode == 0, f"Failed: {result.stderr}"


# =============================================================================
# 6. Switching between presets preserves search functionality
# =============================================================================
class TestPresetSwitching:
    @pytest.mark.skipif(not HAS_CREDENTIALS, reason="No Jira test credentials")
    def test_search_after_switching_presets(self):
        run_cli("settings", "--preset", "read-only")
        result = run_cli("issue", "search", f"project = {REGULAR_PROJECT_KEY}", "--limit", "3")
        assert result.returncode == 0, f"Failed: {result.stderr}"

        run_cli("settings", "--preset", "yolo")
        result = run_cli("issue", "search", f"project = {REGULAR_PROJECT_KEY}", "--limit", "3")
        assert result.returncode == 0, f"Failed: {result.stderr}"

    @pytest.mark.skipif(not HAS_CREDENTIALS, reason="No Jira test credentials")
    def test_search_after_switching_to_my_tasks(self):
        run_cli("settings", "--preset", "yolo")
        run_cli("settings", "--preset", "my-tasks")
        result = run_cli("issue", "search", "assignee = currentUser()", "--limit", "3")
        assert result.returncode == 0, f"Failed: {result.stderr}"

    @pytest.mark.skipif(not HAS_CREDENTIALS, reason="No Jira test credentials")
    def test_detect_matches_last_applied_preset(self):
        run_cli("settings", "--preset", "read-only")
        result = run_cli("settings", "--detect-preset")
        data = parse_json_output(result)
        assert data["current"] == "read-only"

        run_cli("settings", "--preset", "yolo")
        result = run_cli("settings", "--detect-preset")
        data = parse_json_output(result)
        assert data["current"] == "yolo"

        run_cli("settings", "--preset", "my-tasks")
        result = run_cli("settings", "--detect-preset")
        data = parse_json_output(result)
        assert data["current"] == "my-tasks"

        run_cli("settings", "--preset", "standard")
        result = run_cli("settings", "--detect-preset")
        data = parse_json_output(result)
        assert data["current"] == "standard"


# =============================================================================
# 7. Dry-run works with presets
# =============================================================================
class TestDryRunWithPresets:
    @pytest.mark.skipif(not HAS_CREDENTIALS, reason="No Jira test credentials")
    def test_dry_run_create_with_yolo(self):
        run_cli("settings", "--preset", "yolo")
        result = run_cli(
            "--dry-run", "issue", "create",
            "--title", "Regression test dry-run",
            "--project", REGULAR_PROJECT_KEY,
            "--issue-type", "Task",
        )
        assert result.returncode == 0, f"Failed: {result.stderr}"
        data = parse_json_output(result)
        assert data["dryRun"] is True

    def test_dry_run_create_blocked_by_read_only(self):
        run_cli("settings", "--preset", "read-only")
        result = run_cli(
            "--dry-run", "issue", "create",
            "--title", "Should be blocked",
            "--project", REGULAR_PROJECT_KEY,
            "--issue-type", "Task",
        )
        assert result.returncode != 0
