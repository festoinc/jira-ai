from conftest import run_cli


class TestSettingsDisplay:
    def test_settings_shows_current_config(self):
        result = run_cli("settings")
        assert result.returncode == 0, f"settings failed: {result.stderr}"
        assert "allowed" in result.stdout.lower() or "command" in result.stdout.lower() or "default" in result.stdout.lower(), \
            "Settings should display configuration info"


class TestSettingsReset:
    def test_settings_reset(self):
        result = run_cli("settings", "--reset")
        assert result.returncode == 0, f"settings --reset failed: {result.stderr}"


class TestSettingsValidate:
    def test_settings_validate_existing_file(self):
        result = run_cli("settings", "--validate", "settings.yaml")
        assert result.returncode == 0, f"settings --validate failed: {result.stderr}"

    def test_settings_validate_nonexistent_file(self):
        result = run_cli("settings", "--validate", "nonexistent_file.yaml")
        assert result.returncode != 0, "Validating nonexistent file should fail"
