"""
E2E tests for the predefined presets feature (JIR-164).

Tests exercise the jira-ai CLI end-to-end:
  1. `settings --list-presets` — lists all 4 presets with details
  2. `settings --preset <name>` — applies each preset correctly
  3. `settings --detect-preset` — detects applied preset
  4. Preset field correctness — commands, projects, spaces, participation filter
  5. Unknown preset — error for invalid name

Test credentials are stored in ~/.jira-ai/config.json (never committed).
Settings are written/restored via fixtures.
Run from project root after `npm run build`.

Usage:
    python3 -m pytest tests_e2e/test_presets.py -v
"""

import json
import os

import pytest
import yaml

from conftest import (
    CONFIG_DIR,
    run_cli,
    save_test_credentials,
)

SETTINGS_FILE = os.path.join(CONFIG_DIR, "settings.yaml")

ALL_PRESET_NAMES = ["read-only", "standard", "my-tasks", "yolo"]


def parse_json_output(result):
    combined = result.stdout.strip()
    if not combined:
        combined = result.stderr.strip()
    return json.loads(combined)


def read_settings():
    if os.path.exists(SETTINGS_FILE):
        with open(SETTINGS_FILE, "r") as f:
            return yaml.safe_load(f)
    return None


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
# 1. List presets
# =============================================================================
class TestListPresets:
    def test_list_presets_returns_valid_json(self):
        result = run_cli("settings", "--list-presets")
        assert result.returncode == 0, f"Failed: {result.stderr}"
        data = parse_json_output(result)
        assert "presets" in data

    def test_list_presets_contains_all_four(self):
        result = run_cli("settings", "--list-presets")
        data = parse_json_output(result)
        presets = data["presets"]
        for name in ALL_PRESET_NAMES:
            assert name in presets, f"Missing preset: {name}"

    def test_list_presets_each_has_description(self):
        result = run_cli("settings", "--list-presets")
        data = parse_json_output(result)
        for name in ALL_PRESET_NAMES:
            assert "description" in data["presets"][name]
            assert len(data["presets"][name]["description"]) > 0

    def test_list_presets_each_has_allowed_commands(self):
        result = run_cli("settings", "--list-presets")
        data = parse_json_output(result)
        for name in ALL_PRESET_NAMES:
            cmds = data["presets"][name]["allowed-commands"]
            assert isinstance(cmds, list)
            assert len(cmds) > 0

    def test_list_presets_each_has_allowed_jira_projects(self):
        result = run_cli("settings", "--list-presets")
        data = parse_json_output(result)
        for name in ALL_PRESET_NAMES:
            projects = data["presets"][name]["allowed-jira-projects"]
            assert isinstance(projects, list)

    def test_list_presets_each_has_allowed_confluence_spaces(self):
        result = run_cli("settings", "--list-presets")
        data = parse_json_output(result)
        for name in ALL_PRESET_NAMES:
            spaces = data["presets"][name]["allowed-confluence-spaces"]
            assert isinstance(spaces, list)

    def test_my_tasks_has_global_participation_filter(self):
        result = run_cli("settings", "--list-presets")
        data = parse_json_output(result)
        mt = data["presets"]["my-tasks"]
        assert "globalParticipationFilter" in mt
        gpf = mt["globalParticipationFilter"]
        assert gpf.get("was_assignee") is True
        assert gpf.get("was_reporter") is True
        assert gpf.get("was_commenter") is True
        assert gpf.get("is_watcher") is True

    def test_other_presets_no_participation_filter(self):
        result = run_cli("settings", "--list-presets")
        data = parse_json_output(result)
        for name in ["read-only", "standard", "yolo"]:
            assert "globalParticipationFilter" not in data["presets"][name], (
                f"{name} should not have globalParticipationFilter"
            )

    def test_yolo_has_all_commands(self):
        result = run_cli("settings", "--list-presets")
        data = parse_json_output(result)
        assert data["presets"]["yolo"]["allowed-commands"] == ["all"]

    def test_read_only_has_no_create_or_update(self):
        result = run_cli("settings", "--list-presets")
        data = parse_json_output(result)
        cmds = data["presets"]["read-only"]["allowed-commands"]
        for c in cmds:
            assert "create" not in c, f"read-only should not allow {c}"
            assert "update" not in c, f"read-only should not allow {c}"
            assert "transition" not in c, f"read-only should not allow {c}"
            assert "delete" not in c, f"read-only should not allow {c}"


# =============================================================================
# 2. Apply each preset
# =============================================================================
class TestApplyPresets:
    def test_apply_read_only(self):
        result = run_cli("settings", "--preset", "read-only")
        assert result.returncode == 0, f"Failed: {result.stderr}"
        data = parse_json_output(result)
        assert data["success"] is True
        assert data["preset"] == "read-only"

    def test_apply_standard(self):
        result = run_cli("settings", "--preset", "standard")
        assert result.returncode == 0, f"Failed: {result.stderr}"
        data = parse_json_output(result)
        assert data["success"] is True
        assert data["preset"] == "standard"

    def test_apply_my_tasks(self):
        result = run_cli("settings", "--preset", "my-tasks")
        assert result.returncode == 0, f"Failed: {result.stderr}"
        data = parse_json_output(result)
        assert data["success"] is True
        assert data["preset"] == "my-tasks"

    def test_apply_yolo(self):
        result = run_cli("settings", "--preset", "yolo")
        assert result.returncode == 0, f"Failed: {result.stderr}"
        data = parse_json_output(result)
        assert data["success"] is True
        assert data["preset"] == "yolo"

    def test_apply_writes_settings_file(self):
        run_cli("settings", "--preset", "yolo")
        settings = read_settings()
        assert settings is not None
        assert "defaults" in settings

    def test_apply_read_only_writes_correct_commands(self):
        run_cli("settings", "--preset", "read-only")
        settings = read_settings()
        cmds = settings["defaults"]["allowed-commands"]
        assert "issue.get" in cmds
        assert "issue.search" in cmds
        assert "issue.create" not in cmds
        assert "issue.update" not in cmds
        assert "issue.transition" not in cmds

    def test_apply_standard_writes_correct_commands(self):
        run_cli("settings", "--preset", "standard")
        settings = read_settings()
        cmds = settings["defaults"]["allowed-commands"]
        assert "issue.get" in cmds
        assert "issue.create" in cmds
        assert "issue.update" in cmds
        assert "issue.transition" in cmds

    def test_apply_my_tasks_writes_participation_filter(self):
        run_cli("settings", "--preset", "my-tasks")
        settings = read_settings()
        gpf = settings["defaults"].get("globalParticipationFilter")
        assert gpf is not None
        assert gpf.get("was_assignee") is True
        assert gpf.get("was_reporter") is True
        assert gpf.get("was_commenter") is True
        assert gpf.get("is_watcher") is True

    def test_apply_yolo_writes_all_commands(self):
        run_cli("settings", "--preset", "yolo")
        settings = read_settings()
        cmds = settings["defaults"]["allowed-commands"]
        assert cmds == ["all"]

    def test_apply_preserves_saved_queries(self):
        write_settings({
            "defaults": {
                "allowed-jira-projects": ["all"],
                "allowed-commands": ["all"],
                "allowed-confluence-spaces": ["all"],
            },
            "savedQueries": {
                "test-query": "project = AT ORDER BY created DESC",
            },
        })
        run_cli("settings", "--preset", "read-only")
        settings = read_settings()
        assert "savedQueries" in settings
        assert "test-query" in settings["savedQueries"]


# =============================================================================
# 3. Detect preset
# =============================================================================
class TestDetectPreset:
    def test_detect_read_only_after_apply(self):
        run_cli("settings", "--preset", "read-only")
        result = run_cli("settings", "--detect-preset")
        assert result.returncode == 0
        data = parse_json_output(result)
        assert data["current"] == "read-only"
        assert "read-only" in data["description"].lower() or "read-only" in data["description"]

    def test_detect_standard_after_apply(self):
        run_cli("settings", "--preset", "standard")
        result = run_cli("settings", "--detect-preset")
        data = parse_json_output(result)
        assert data["current"] == "standard"

    def test_detect_my_tasks_after_apply(self):
        run_cli("settings", "--preset", "my-tasks")
        result = run_cli("settings", "--detect-preset")
        data = parse_json_output(result)
        assert data["current"] == "my-tasks"

    def test_detect_yolo_after_apply(self):
        run_cli("settings", "--preset", "yolo")
        result = run_cli("settings", "--detect-preset")
        data = parse_json_output(result)
        assert data["current"] == "yolo"

    def test_detect_custom_for_modified_settings(self):
        run_cli("settings", "--preset", "read-only")
        settings = read_settings()
        settings["defaults"]["allowed-commands"].append("issue.create")
        write_settings(settings)
        result = run_cli("settings", "--detect-preset")
        data = parse_json_output(result)
        assert data["current"] == "custom"

    def test_detect_custom_shows_closest_match(self):
        run_cli("settings", "--preset", "read-only")
        settings = read_settings()
        settings["defaults"]["allowed-commands"].append("issue.create")
        write_settings(settings)
        result = run_cli("settings", "--detect-preset")
        data = parse_json_output(result)
        assert "closestMatch" in data

    def test_detect_custom_shows_differences(self):
        run_cli("settings", "--preset", "read-only")
        settings = read_settings()
        settings["defaults"]["allowed-commands"].append("issue.create")
        write_settings(settings)
        result = run_cli("settings", "--detect-preset")
        data = parse_json_output(result)
        assert "differences" in data
        assert "addedCommands" in data["differences"]


# =============================================================================
# 4. Unknown preset
# =============================================================================
class TestUnknownPreset:
    def test_unknown_preset_returns_error(self):
        result = run_cli("settings", "--preset", "nonexistent")
        assert result.returncode != 0

    def test_unknown_preset_error_message(self):
        result = run_cli("settings", "--preset", "nonexistent")
        combined = result.stdout + result.stderr
        assert "Unknown preset" in combined

    def test_unknown_preset_lists_available(self):
        result = run_cli("settings", "--preset", "nonexistent")
        combined = result.stdout + result.stderr
        for name in ALL_PRESET_NAMES:
            assert name in combined, f"Available preset {name} not listed"


# =============================================================================
# 5. Settings view after preset
# =============================================================================
class TestSettingsView:
    def test_settings_shows_applied_preset_values(self):
        run_cli("settings", "--preset", "yolo")
        result = run_cli("settings")
        assert result.returncode == 0
        data = parse_json_output(result)
        assert "defaults" in data
        assert data["defaults"]["allowed-commands"] == ["all"]

    def test_settings_shows_read_only_commands(self):
        run_cli("settings", "--preset", "read-only")
        result = run_cli("settings")
        data = parse_json_output(result)
        cmds = data["defaults"]["allowed-commands"]
        assert len(cmds) > 0
        for c in cmds:
            assert "create" not in c
            assert "update" not in c
