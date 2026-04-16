"""
E2E tests for --validate mutual exclusion with preset flags (JIR-164).

Tests verify that --validate is mutually exclusive with:
  --preset, --list-presets, --detect-preset, --reset, and --apply

Run from project root after `npm run build`.

Usage:
    python3 -m pytest tests_e2e/test_validate_mutual_exclusion.py -v
"""

import json
import os

import pytest

from conftest import (
    CONFIG_DIR,
    run_cli,
    save_test_credentials,
)

SETTINGS_FILE = os.path.join(CONFIG_DIR, "settings.yaml")


def parse_json_output(result):
    combined = result.stdout.strip()
    if not combined:
        combined = result.stderr.strip()
    return json.loads(combined)


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
# --validate + --preset mutual exclusion
# =============================================================================
class TestValidateWithPreset:
    def test_validate_and_preset_fails(self):
        result = run_cli("settings", "--validate", "some-file.yaml", "--preset", "read-only")
        assert result.returncode != 0

    def test_validate_and_preset_error_message(self):
        result = run_cli("settings", "--validate", "some-file.yaml", "--preset", "read-only")
        combined = result.stdout + result.stderr
        assert "mutually exclusive" in combined.lower()


# =============================================================================
# --validate + --list-presets mutual exclusion
# =============================================================================
class TestValidateWithListPresets:
    def test_validate_and_list_presets_fails(self):
        result = run_cli("settings", "--validate", "some-file.yaml", "--list-presets")
        assert result.returncode != 0

    def test_validate_and_list_presets_error_message(self):
        result = run_cli("settings", "--validate", "some-file.yaml", "--list-presets")
        combined = result.stdout + result.stderr
        assert "mutually exclusive" in combined.lower()


# =============================================================================
# --validate + --detect-preset mutual exclusion
# =============================================================================
class TestValidateWithDetectPreset:
    def test_validate_and_detect_preset_fails(self):
        result = run_cli("settings", "--validate", "some-file.yaml", "--detect-preset")
        assert result.returncode != 0

    def test_validate_and_detect_preset_error_message(self):
        result = run_cli("settings", "--validate", "some-file.yaml", "--detect-preset")
        combined = result.stdout + result.stderr
        assert "mutually exclusive" in combined.lower()


# =============================================================================
# --validate + --reset mutual exclusion
# =============================================================================
class TestValidateWithReset:
    def test_validate_and_reset_fails(self):
        result = run_cli("settings", "--validate", "some-file.yaml", "--reset")
        assert result.returncode != 0

    def test_validate_and_reset_error_message(self):
        result = run_cli("settings", "--validate", "some-file.yaml", "--reset")
        combined = result.stdout + result.stderr
        assert "mutually exclusive" in combined.lower()


# =============================================================================
# --validate + --apply mutual exclusion
# =============================================================================
class TestValidateWithApply:
    def test_validate_and_apply_fails(self):
        result = run_cli("settings", "--validate", "some-file.yaml", "--apply", "other-file.yaml")
        assert result.returncode != 0

    def test_validate_and_apply_error_message(self):
        result = run_cli("settings", "--validate", "some-file.yaml", "--apply", "other-file.yaml")
        combined = result.stdout + result.stderr
        assert "mutually exclusive" in combined.lower()


# =============================================================================
# Other mutual exclusion pairs
# =============================================================================
class TestOtherMutualExclusions:
    def test_preset_and_reset_fails(self):
        result = run_cli("settings", "--preset", "read-only", "--reset")
        assert result.returncode != 0

    def test_preset_and_list_presets_fails(self):
        result = run_cli("settings", "--preset", "read-only", "--list-presets")
        assert result.returncode != 0

    def test_preset_and_detect_preset_fails(self):
        result = run_cli("settings", "--preset", "read-only", "--detect-preset")
        assert result.returncode != 0

    def test_preset_and_apply_fails(self):
        result = run_cli("settings", "--preset", "read-only", "--apply", "some-file.yaml")
        assert result.returncode != 0

    def test_reset_and_list_presets_fails(self):
        result = run_cli("settings", "--reset", "--list-presets")
        assert result.returncode != 0

    def test_reset_and_detect_preset_fails(self):
        result = run_cli("settings", "--reset", "--detect-preset")
        assert result.returncode != 0

    def test_apply_and_list_presets_fails(self):
        result = run_cli("settings", "--apply", "some-file.yaml", "--list-presets")
        assert result.returncode != 0

    def test_apply_and_detect_preset_fails(self):
        result = run_cli("settings", "--apply", "some-file.yaml", "--detect-preset")
        assert result.returncode != 0


# =============================================================================
# Solo flags work fine
# =============================================================================
class TestSoloFlagsWork:
    def test_validate_alone_works_with_valid_file(self):
        tmpfile = os.path.join(CONFIG_DIR, "test-validate-settings.yaml")
        with open(tmpfile, "w") as f:
            f.write("defaults:\n  allowed-jira-projects:\n    - all\n  allowed-commands:\n    - all\n  allowed-confluence-spaces:\n    - all\n")
        result = run_cli("settings", "--validate", tmpfile)
        if os.path.exists(tmpfile):
            os.unlink(tmpfile)
        combined = result.stdout + result.stderr
        if result.returncode == 0:
            data = parse_json_output(result)
            assert data.get("success") is True
        else:
            assert "credentials" in combined.lower() or "not found" in combined.lower()

    def test_list_presets_alone_works(self):
        result = run_cli("settings", "--list-presets")
        assert result.returncode == 0

    def test_detect_preset_alone_works(self):
        result = run_cli("settings", "--detect-preset")
        assert result.returncode == 0

    def test_reset_alone_works(self):
        result = run_cli("settings", "--reset")
        assert result.returncode == 0

    def test_preset_alone_works(self):
        result = run_cli("settings", "--preset", "yolo")
        assert result.returncode == 0
