"""
E2E tests for the saved queries feature (JIR-107).

Tests exercise the jira-ai CLI end-to-end:
  1. Saved query execution -- `issue search --query <name>` runs correct JQL
  2. List queries -- `issue search --list-queries` outputs available saved query names
  3. Help text -- `issue search --help` includes saved queries options
  4. Non-existent query -- `--query nonexistent` returns appropriate error
  5. Combined with filters -- saved query works with global project filters

Test credentials are stored in ~/.jira-ai/config.json (never committed).
Settings with saved queries are written/restored via fixtures.
Run from project root after `npm run build`.

Usage:
    TEST_JIRA_URL=https://xxx.atlassian.net \
    TEST_JIRA_EMAIL=user@example.com \
    TEST_JIRA_TOKEN=xxx \
    python3 -m pytest tests_e2e/test_saved_queries.py -v
"""

import json
import os
import subprocess

import pytest

CLI_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "dist", "cli.js"
)

CONFIG_DIR = os.path.join(os.path.expanduser("~"), ".jira-ai")
CONFIG_FILE = os.path.join(CONFIG_DIR, "config.json")
SETTINGS_FILE = os.path.join(CONFIG_DIR, "settings.yaml")

TEST_JIRA_URL = os.environ.get("TEST_JIRA_URL", "https://festoinc.atlassian.net")
TEST_JIRA_EMAIL = os.environ.get("TEST_JIRA_EMAIL", "")
TEST_JIRA_TOKEN = os.environ.get("TEST_JIRA_TOKEN", "")

REGULAR_PROJECT_KEY = "AT"

HAS_CREDENTIALS = bool(TEST_JIRA_EMAIL and TEST_JIRA_TOKEN)

SETTINGS_WITH_QUERIES = """\
defaults:
  allowed-jira-projects:
    - all
  allowed-commands:
    - all
  allowed-confluence-spaces:
    - all
savedQueries:
  my-open-tasks: "assignee = currentUser() AND status != Done"
  production-bugs: "project = PS AND type = Bug AND status != Done"
"""

SETTINGS_WITH_FILTERED_PROJECTS = """\
defaults:
  allowed-jira-projects:
    - {key}
  allowed-commands:
    - all
  allowed-confluence-spaces:
    - all
savedQueries:
  filtered-tasks: "status != Done ORDER BY created DESC"
"""

SETTINGS_NO_QUERIES = """\
defaults:
  allowed-jira-projects:
    - all
  allowed-commands:
    - all
  allowed-confluence-spaces:
    - all
"""


def run_cli(*args, timeout=60):
    cmd = ["node", CLI_PATH] + list(args)
    env = os.environ.copy()
    env["NODE_OPTIONS"] = "--no-warnings"
    result = subprocess.run(
        cmd, capture_output=True, text=True, timeout=timeout, env=env
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
        "email": TEST_JIRA_EMAIL or "test@example.com",
        "apiToken": TEST_JIRA_TOKEN or "dummy-token-for-validation",
    }
    os.makedirs(CONFIG_DIR, exist_ok=True)
    with open(CONFIG_FILE, "w") as f:
        json.dump(config, f, indent=2)
    os.chmod(CONFIG_FILE, 0o600)


def write_settings(yaml_content):
    os.makedirs(CONFIG_DIR, exist_ok=True)
    with open(SETTINGS_FILE, "w") as f:
        f.write(yaml_content)


def read_settings():
    if os.path.exists(SETTINGS_FILE):
        with open(SETTINGS_FILE, "r") as f:
            return f.read()
    return None


def read_config():
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, "r") as f:
            return f.read()
    return None


@pytest.fixture(autouse=True)
def setup_credentials_and_settings():
    original_settings = read_settings()
    original_config = read_config()
    save_test_credentials()
    write_settings(SETTINGS_WITH_QUERIES)
    yield
    if original_settings is not None:
        write_settings(original_settings)
    elif os.path.exists(SETTINGS_FILE):
        os.unlink(SETTINGS_FILE)
    if original_config is not None:
        with open(CONFIG_FILE, "w") as f:
            f.write(original_config)
    elif os.path.exists(CONFIG_FILE):
        os.unlink(CONFIG_FILE)


# =============================================================================
# 1. Saved query execution
# =============================================================================
class TestSavedQueryExecution:
    @pytest.mark.skipif(not HAS_CREDENTIALS, reason="No Jira test credentials")
    def test_query_returns_results(self):
        result = run_cli("issue", "search", "--query", "my-open-tasks")
        assert result.returncode == 0, f"Failed: {result.stderr}"
        data = parse_json_output(result)
        assert isinstance(data, list)

    @pytest.mark.skipif(not HAS_CREDENTIALS, reason="No Jira test credentials")
    def test_query_resolves_correct_jql(self):
        result = run_cli("issue", "search", "--query", "production-bugs")
        assert result.returncode == 0, f"Failed: {result.stderr}"
        data = parse_json_output(result)
        assert isinstance(data, list)

    def test_query_mutual_exclusion_with_jql(self):
        result = run_cli(
            "issue", "search", "project = AT", "--query", "my-open-tasks"
        )
        assert result.returncode != 0
        combined = result.stdout + result.stderr
        assert "Cannot specify both" in combined

    @pytest.mark.skipif(not HAS_CREDENTIALS, reason="No Jira test credentials")
    def test_query_without_json_flag(self):
        result = run_cli("issue", "search", "--query", "my-open-tasks")
        assert result.returncode == 0, f"Failed: {result.stderr}"


# =============================================================================
# 2. List queries
# =============================================================================
class TestListQueries:
    def test_list_queries_json(self):
        result = run_cli("issue", "search", "--list-queries")
        assert result.returncode == 0, f"Failed: {result.stderr}"
        data = parse_json_output(result)
        assert "queries" in data
        assert isinstance(data["queries"], list)
        assert len(data["queries"]) == 2

    def test_list_queries_contains_names(self):
        result = run_cli("issue", "search", "--list-queries")
        data = parse_json_output(result)
        names = [q["name"] for q in data["queries"]]
        assert "my-open-tasks" in names
        assert "production-bugs" in names

    def test_list_queries_contains_jql(self):
        result = run_cli("issue", "search", "--list-queries")
        data = parse_json_output(result)
        for q in data["queries"]:
            assert "name" in q
            assert "jql" in q
            assert isinstance(q["jql"], str)
            assert len(q["jql"]) > 0

    def test_list_queries_empty_when_none(self):
        write_settings(SETTINGS_NO_QUERIES)
        result = run_cli("issue", "search", "--list-queries")
        assert result.returncode == 0, f"Failed: {result.stderr}"
        data = parse_json_output(result)
        assert "queries" in data
        assert isinstance(data["queries"], list)
        assert len(data["queries"]) == 0


# =============================================================================
# 3. Help text
# =============================================================================
class TestHelpText:
    def test_help_includes_query_option(self):
        result = run_cli("issue", "search", "--help")
        assert result.returncode == 0
        assert "--query" in result.stdout

    def test_help_includes_list_queries_option(self):
        result = run_cli("issue", "search", "--help")
        assert result.returncode == 0
        assert "--list-queries" in result.stdout

    def test_help_mentions_saved_queries(self):
        result = run_cli("issue", "search", "--help")
        assert result.returncode == 0
        combined = result.stdout.lower()
        assert "saved query" in combined

    def test_help_shows_query_description(self):
        result = run_cli("issue", "search", "--help")
        assert result.returncode == 0
        assert "Use a saved query by name" in result.stdout


# =============================================================================
# 4. Non-existent query
# =============================================================================
class TestNonExistentQuery:
    def test_nonexistent_query_error(self):
        result = run_cli("issue", "search", "--query", "nonexistent")
        assert result.returncode != 0
        data = parse_json_output(result)
        assert data.get("error") is True

    def test_nonexistent_query_error_message(self):
        result = run_cli("issue", "search", "--query", "nonexistent")
        data = parse_json_output(result)
        assert "not found" in data["message"].lower()

    def test_nonexistent_query_lists_available(self):
        result = run_cli("issue", "search", "--query", "nonexistent")
        data = parse_json_output(result)
        msg = data["message"].lower()
        assert "my-open-tasks" in msg or "available" in msg

    def test_nonexistent_query_plain_output(self):
        result = run_cli("issue", "search", "--query", "totally-invalid")
        assert result.returncode != 0
        combined = result.stdout + result.stderr
        assert "not found" in combined.lower()


# =============================================================================
# 5. Combined with filters
# =============================================================================
class TestCombinedWithFilters:
    @pytest.mark.skipif(not HAS_CREDENTIALS, reason="No Jira test credentials")
    def test_saved_query_with_project_filter(self):
        write_settings(SETTINGS_WITH_FILTERED_PROJECTS.format(key=REGULAR_PROJECT_KEY))
        result = run_cli("issue", "search", "--query", "filtered-tasks")
        assert result.returncode == 0, f"Failed: {result.stderr}"
        data = parse_json_output(result)
        assert isinstance(data, list)

    @pytest.mark.skipif(not HAS_CREDENTIALS, reason="No Jira test credentials")
    def test_saved_query_results_respect_project_filter(self):
        write_settings(SETTINGS_WITH_FILTERED_PROJECTS.format(key=REGULAR_PROJECT_KEY))
        result = run_cli("issue", "search", "--query", "filtered-tasks")
        assert result.returncode == 0, f"Failed: {result.stderr}"
        data = parse_json_output(result)
        for issue in data:
            assert issue["key"].startswith(f"{REGULAR_PROJECT_KEY}-"), (
                f"Expected all results in {REGULAR_PROJECT_KEY}, got {issue['key']}"
            )

    @pytest.mark.skipif(not HAS_CREDENTIALS, reason="No Jira test credentials")
    def test_saved_query_with_limit(self):
        result = run_cli("issue", "search", "--query", "my-open-tasks", "--limit", "5")
        assert result.returncode == 0, f"Failed: {result.stderr}"
        data = parse_json_output(result)
        assert isinstance(data, list)
        assert len(data) <= 5
