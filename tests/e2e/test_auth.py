import json
import os

from conftest import (
    CONFIG_DIR,
    CONFIG_FILE,
    TEST_JIRA_EMAIL,
    TEST_JIRA_TOKEN,
    TEST_JIRA_URL,
    clear_test_credentials,
    run_cli,
    save_test_credentials,
)


class TestAuthLogin:
    def test_auth_with_from_json_stores_flat_config(self):
        clear_test_credentials()
        creds = json.dumps({
            "host": TEST_JIRA_URL,
            "email": TEST_JIRA_EMAIL,
            "apiToken": TEST_JIRA_TOKEN,
        })
        result = run_cli("auth", "--from-json", creds)
        assert result.returncode == 0, f"auth --from-json failed: {result.stderr}"

        assert os.path.exists(CONFIG_FILE), "Config file should exist after login"
        with open(CONFIG_FILE) as f:
            config = json.load(f)

        assert config["host"] == TEST_JIRA_URL
        assert config["email"] == TEST_JIRA_EMAIL
        assert config["apiToken"] == TEST_JIRA_TOKEN
        assert "organizations" not in config, "Config should not have organizations key"
        assert "alias" not in config, "Config should not have alias key"
        assert "org" not in config, "Config should not have org key"

    def test_auth_with_from_file(self, tmp_path):
        clear_test_credentials()
        env_file = tmp_path / ".env"
        env_file.write_text(
            f"JIRA_HOST={TEST_JIRA_URL}\n"
            f"JIRA_USER_EMAIL={TEST_JIRA_EMAIL}\n"
            f"JIRA_API_TOKEN={TEST_JIRA_TOKEN}\n"
        )
        result = run_cli("auth", "--from-file", str(env_file))
        assert result.returncode == 0, f"auth --from-file failed: {result.stderr}"

        assert os.path.exists(CONFIG_FILE)
        with open(CONFIG_FILE) as f:
            config = json.load(f)
        assert config["host"] == TEST_JIRA_URL

    def test_config_has_no_org_alias_keys(self):
        save_test_credentials()

        with open(CONFIG_FILE) as f:
            config = json.load(f)

        flat_keys = list(config.keys())
        for k in flat_keys:
            assert "org" not in k.lower() or k == "host", f"Found org-related key: {k}"
            assert "alias" not in k.lower(), f"Found alias key: {k}"


class TestAuthLogout:
    def test_auth_logout_clears_config(self):
        save_test_credentials()
        assert os.path.exists(CONFIG_FILE), "Config should exist before logout"

        result = run_cli("auth", "--logout")
        assert result.returncode == 0, f"auth --logout failed: {result.stderr}"
        assert not os.path.exists(CONFIG_FILE), "Config file should be removed after logout"

    def test_auth_logout_subcommand(self):
        save_test_credentials()
        result = run_cli("auth", "logout")
        assert result.returncode == 0, f"auth logout failed: {result.stderr}"
        assert not os.path.exists(CONFIG_FILE), "Config file should be removed after auth logout"

    def test_auth_help_no_alias_flag(self):
        result = run_cli("auth", "--help")
        assert result.returncode == 0
        assert "--alias" not in result.stdout, "--alias flag should not exist in auth command"
