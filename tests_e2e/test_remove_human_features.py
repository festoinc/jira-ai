"""
E2E tests for the remove-human-features branch (JIR-81, Step 10).

Verifies that the CLI operates as a pure JSON-output tool with no
human-facing features (chalk, ora, cli-table3, formatters, spinners).

Test credentials are stored in ~/.jira-ai/config.json (never committed).
Run from project root after `npm run build`.

Usage:
    python3 -m pytest tests_e2e/test_remove_human_features.py -v
"""

import json
import os
import re
import subprocess

import pytest

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CLI_PATH = os.path.join(PROJECT_ROOT, "dist", "cli.js")

TEST_JIRA_URL = os.environ.get("TEST_JIRA_URL", "https://festoinc.atlassian.net")
TEST_JIRA_EMAIL = os.environ.get("TEST_JIRA_EMAIL", "")
TEST_JIRA_TOKEN = os.environ.get("TEST_JIRA_TOKEN", "")

REGULAR_PROJECT_KEY = "AT"

ANSI_ESCAPE_RE = re.compile(r"\x1b\[[0-9;]*[a-zA-Z]")

CONFIG_DIR = os.path.join(os.path.expanduser("~"), ".jira-ai")
CONFIG_FILE = os.path.join(CONFIG_DIR, "config.json")


def run_cli(*args, timeout=60):
    cmd = ["node", CLI_PATH] + list(args)
    env = os.environ.copy()
    env["NODE_OPTIONS"] = "--no-warnings"
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=timeout,
        env=env,
    )
    return result


def parse_json_output(result):
    combined = result.stdout.strip()
    if not combined:
        combined = result.stderr.strip()
    return json.loads(combined)


def save_test_credentials():
    config = {
        "host": TEST_JIRA_URL,
        "email": TEST_JIRA_EMAIL,
        "apiToken": TEST_JIRA_TOKEN,
    }
    os.makedirs(CONFIG_DIR, exist_ok=True)
    with open(CONFIG_FILE, "w") as f:
        json.dump(config, f, indent=2)
    os.chmod(CONFIG_FILE, 0o600)


def clear_test_credentials():
    if os.path.exists(CONFIG_FILE):
        os.unlink(CONFIG_FILE)


@pytest.fixture(autouse=True)
def restore_credentials():
    save_test_credentials()
    yield
    save_test_credentials()


# =============================================================================
# 1. `about` outputs valid JSON with `version` field
# =============================================================================
class TestAboutJsonOutput:
    def test_about_outputs_valid_json(self):
        result = run_cli("about")
        assert result.returncode == 0, f"Failed: {result.stderr}"
        data = parse_json_output(result)
        assert isinstance(data, dict)

    def test_about_has_version_field(self):
        result = run_cli("about")
        data = parse_json_output(result)
        assert "version" in data
        assert isinstance(data["version"], str)
        assert len(data["version"]) > 0

    def test_about_no_extra_stdout(self):
        result = run_cli("about")
        output = result.stdout.strip()
        json.loads(output)
        assert result.stderr.strip() == ""


# =============================================================================
# 2. `settings` outputs valid JSON
# =============================================================================
class TestSettingsJsonOutput:
    def test_settings_outputs_valid_json(self):
        result = run_cli("settings")
        assert result.returncode == 0, f"Failed: {result.stderr}"
        data = parse_json_output(result)
        assert isinstance(data, dict)

    def test_settings_has_defaults(self):
        result = run_cli("settings")
        data = parse_json_output(result)
        assert "defaults" in data
        assert isinstance(data["defaults"], dict)

    def test_settings_has_allowed_commands(self):
        result = run_cli("settings")
        data = parse_json_output(result)
        assert "allowed-commands" in data["defaults"]


# =============================================================================
# 3. Error conditions output JSON with `hints` array
# =============================================================================
class TestErrorJsonOutput:
    def test_error_is_valid_json(self):
        result = run_cli("issue", "get", "INVALID-999")
        assert result.returncode != 0
        data = parse_json_output(result)
        assert isinstance(data, dict)

    def test_error_has_error_flag(self):
        result = run_cli("issue", "get", "INVALID-999")
        data = parse_json_output(result)
        assert data["error"] is True

    def test_error_has_message(self):
        result = run_cli("issue", "get", "INVALID-999")
        data = parse_json_output(result)
        assert "message" in data
        assert isinstance(data["message"], str)
        assert len(data["message"]) > 0

    def test_error_has_hints_array(self):
        result = run_cli("issue", "get", "INVALID-999")
        data = parse_json_output(result)
        assert "hints" in data
        assert isinstance(data["hints"], list)

    def test_error_has_exit_code(self):
        result = run_cli("issue", "get", "INVALID-999")
        data = parse_json_output(result)
        assert "exitCode" in data
        assert isinstance(data["exitCode"], int)
        assert data["exitCode"] != 0

    def test_invalid_command_error_json(self):
        result = run_cli("issue", "search", "")
        assert result.returncode != 0
        data = parse_json_output(result)
        assert data["error"] is True


# =============================================================================
# 4. `--compact` flag produces single-line JSON
# =============================================================================
class TestCompactFlag:
    def test_compact_about_single_line(self):
        result = run_cli("--compact", "about")
        assert result.returncode == 0, f"Failed: {result.stderr}"
        output = result.stdout.strip()
        lines = [l for l in output.split("\n") if l.strip()]
        assert len(lines) == 1, f"Expected single line, got {len(lines)}: {output}"

    def test_compact_about_valid_json(self):
        result = run_cli("--compact", "about")
        data = json.loads(result.stdout.strip())
        assert "version" in data

    def test_compact_no_indentation(self):
        result = run_cli("--compact", "about")
        output = result.stdout.strip()
        assert "  " not in output

    def test_compact_settings_single_line(self):
        result = run_cli("--compact", "settings")
        assert result.returncode == 0, f"Failed: {result.stderr}"
        output = result.stdout.strip()
        lines = [l for l in output.split("\n") if l.strip()]
        assert len(lines) == 1

    def test_compact_settings_valid_json(self):
        result = run_cli("--compact", "settings")
        data = json.loads(result.stdout.strip())
        assert "defaults" in data

    def test_compact_board_list_single_line(self):
        result = run_cli("--compact", "board", "list")
        assert result.returncode == 0, f"Failed: {result.stderr}"
        output = result.stdout.strip()
        lines = [l for l in output.split("\n") if l.strip()]
        assert len(lines) == 1, f"Expected single line, got {len(lines)}: {output}"

    def test_compact_error_single_line(self):
        result = run_cli("--compact", "issue", "get", "INVALID-999")
        output = result.stdout.strip()
        lines = [l for l in output.split("\n") if l.strip()]
        assert len(lines) == 1
        data = json.loads(output)
        assert data["error"] is True


# =============================================================================
# 5. No colored output (no ANSI escape codes) in any command output
# =============================================================================
class TestNoAnsiEscapes:
    def _assert_no_ansi(self, result, label=""):
        combined = result.stdout + result.stderr
        assert not ANSI_ESCAPE_RE.search(combined), (
            f"ANSI escape found in {label} output: "
            f"{repr(combined[:200])}"
        )

    def test_about_no_ansi(self):
        result = run_cli("about")
        self._assert_no_ansi(result, "about")

    def test_settings_no_ansi(self):
        result = run_cli("settings")
        self._assert_no_ansi(result, "settings")

    def test_help_no_ansi(self):
        result = run_cli("--help")
        self._assert_no_ansi(result, "--help")

    def test_auth_help_no_ansi(self):
        result = run_cli("auth", "--help")
        self._assert_no_ansi(result, "auth --help")

    def test_board_list_no_ansi(self):
        result = run_cli("board", "list")
        self._assert_no_ansi(result, "board list")

    def test_error_no_ansi(self):
        result = run_cli("issue", "get", "INVALID-999")
        self._assert_no_ansi(result, "error")

    def test_compact_error_no_ansi(self):
        result = run_cli("--compact", "issue", "get", "INVALID-999")
        self._assert_no_ansi(result, "compact error")


# =============================================================================
# 6. `--json` and `--json-compact` flags are NOT present in help text
# =============================================================================
class TestRemovedJsonFlags:
    def test_json_flag_not_in_help(self):
        result = run_cli("--help")
        assert "--json" not in result.stdout, (
            "--json flag should not appear in help text"
        )

    def test_json_compact_flag_not_in_help(self):
        result = run_cli("--help")
        assert "--json-compact" not in result.stdout, (
            "--json-compact flag should not appear in help text"
        )

    def test_compact_flag_is_in_help(self):
        result = run_cli("--help")
        assert "--compact" in result.stdout, (
            "--compact flag should appear in help text"
        )


# =============================================================================
# 7. `auth --help` does NOT mention "interactive input"
# =============================================================================
class TestAuthHelpNoInteractive:
    def test_auth_help_no_interactive_input(self):
        result = run_cli("auth", "--help")
        combined = result.stdout + result.stderr
        assert "interactive input" not in combined.lower(), (
            'auth --help should not mention "interactive input"'
        )

    def test_auth_help_shows_from_json_option(self):
        result = run_cli("auth", "--help")
        assert "--from-json" in result.stdout

    def test_auth_help_shows_from_file_option(self):
        result = run_cli("auth", "--help")
        assert "--from-file" in result.stdout


# =============================================================================
# 8. Basic Jira API commands work and return JSON
# =============================================================================
class TestApiCommandsReturnJson:
    def test_board_list_valid_json(self):
        result = run_cli("board", "list")
        assert result.returncode == 0, f"Failed: {result.stderr}"
        data = parse_json_output(result)
        assert isinstance(data, dict)
        assert "boards" in data
        assert isinstance(data["boards"], list)

    def test_project_list_valid_json(self):
        result = run_cli("project", "list")
        assert result.returncode == 0, f"Failed: {result.stderr}"
        data = parse_json_output(result)
        assert isinstance(data, list)
        assert len(data) > 0
        assert "key" in data[0]

    def test_user_me_valid_json(self):
        result = run_cli("user", "me")
        assert result.returncode == 0, f"Failed: {result.stderr}"
        data = parse_json_output(result)
        assert isinstance(data, dict)
        assert "accountId" in data
        assert "displayName" in data

    def test_issue_search_valid_json(self):
        result = run_cli(
            "issue", "search",
            f"project = {REGULAR_PROJECT_KEY} ORDER BY created DESC",
        )
        assert result.returncode == 0, f"Failed: {result.stderr}"
        data = parse_json_output(result)
        assert isinstance(data, list)

    def test_board_list_with_project_filter(self):
        result = run_cli("board", "list", "--project", REGULAR_PROJECT_KEY)
        assert result.returncode == 0, f"Failed: {result.stderr}"
        data = parse_json_output(result)
        assert isinstance(data, dict)


# =============================================================================
# 9. All npm dependencies for human tools absent from package.json
# =============================================================================
class TestNoHumanDependencies:
    def _read_package_json(self):
        pkg_path = os.path.join(PROJECT_ROOT, "package.json")
        with open(pkg_path) as f:
            return json.load(f)

    def test_no_chalk_dependency(self):
        pkg = self._read_package_json()
        deps = list(pkg.get("dependencies", {}).keys())
        dev_deps = list(pkg.get("devDependencies", {}).keys())
        all_deps = deps + dev_deps
        assert "chalk" not in all_deps, "chalk should not be in dependencies"

    def test_no_ora_dependency(self):
        pkg = self._read_package_json()
        deps = list(pkg.get("dependencies", {}).keys())
        dev_deps = list(pkg.get("devDependencies", {}).keys())
        all_deps = deps + dev_deps
        assert "ora" not in all_deps, "ora should not be in dependencies"

    def test_no_cli_table3_dependency(self):
        pkg = self._read_package_json()
        deps = list(pkg.get("dependencies", {}).keys())
        dev_deps = list(pkg.get("devDependencies", {}).keys())
        all_deps = deps + dev_deps
        assert "cli-table3" not in all_deps, (
            "cli-table3 should not be in dependencies"
        )

    def test_no_inquirer_dependency(self):
        pkg = self._read_package_json()
        deps = list(pkg.get("dependencies", {}).keys())
        dev_deps = list(pkg.get("devDependencies", {}).keys())
        all_deps = deps + dev_deps
        assert "inquirer" not in all_deps, (
            "inquirer should not be in dependencies"
        )
