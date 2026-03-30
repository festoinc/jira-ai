"""
E2E tests for the Issue Linking feature (JIR-32).

These tests exercise the jira-ai CLI commands:
  - issue link types
  - issue link list <issue-key>
  - issue link create <source-key> <link-type> <target-key>
  - issue link delete <source-key> --target <target-key>

Test credentials are stored in ~/.jira-ai/config.json (never committed).
Run from project root after `npm run build`.

Usage:
    python3 -m pytest tests_e2e/test_issue_linking.py -v
"""

import subprocess
import json
import base64
import os
import re
import requests
import pytest

CLI_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "dist", "cli.js")

CONFIG_PATH = os.path.join(os.path.expanduser("~"), ".jira-ai", "config.json")


def _load_config() -> dict:
    if not os.path.exists(CONFIG_PATH):
        pytest.skip(f"Jira config not found at {CONFIG_PATH}")
    with open(CONFIG_PATH) as f:
        return json.load(f)


_config = _load_config()
JIRA_URL = _config["host"].rstrip("/")
JIRA_EMAIL = _config["email"]
JIRA_TOKEN = _config["apiToken"]

TEST_ISSUE_A = "AT-114"
TEST_ISSUE_B = "AT-115"

CREDENTIALS = f"{JIRA_EMAIL}:{JIRA_TOKEN}"
BASIC_AUTH = base64.b64encode(CREDENTIALS.encode()).decode()
API_HEADERS = {
    "Authorization": f"Basic {BASIC_AUTH}",
    "Content-Type": "application/json",
}


def _run_cli(*args: str) -> subprocess.CompletedProcess:
    result = subprocess.run(
        ["node", CLI_PATH] + list(args),
        capture_output=True,
        text=True,
        timeout=30,
    )
    return result


def _output(result: subprocess.CompletedProcess) -> str:
    return (result.stdout + "\n" + result.stderr).lower()


def _get_issue_links_via_api(issue_key: str) -> list:
    resp = requests.get(
        f"{JIRA_URL}/rest/api/3/issue/{issue_key}?fields=issuelinks",
        headers=API_HEADERS,
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json().get("fields", {}).get("issuelinks", [])


def _delete_link_via_api(link_id: str) -> None:
    resp = requests.delete(
        f"{JIRA_URL}/rest/api/3/issueLink/{link_id}",
        headers=API_HEADERS,
        timeout=15,
    )
    assert resp.status_code in (204, 200), f"Failed to delete link {link_id}: {resp.status_code}"


def _cleanup_links():
    for key in [TEST_ISSUE_A, TEST_ISSUE_B]:
        for link in _get_issue_links_via_api(key):
            lid = link["id"]
            _delete_link_via_api(lid)


@pytest.fixture(autouse=True)
def cleanup_test_links():
    _cleanup_links()
    yield
    _cleanup_links()


# =============================================================================
# Test 1: List link types
# =============================================================================
class TestListLinkTypes:
    def test_returns_at_least_7_types(self):
        result = _run_cli("issue", "link", "types")
        assert result.returncode == 0, f"CLI failed:\nstdout: {result.stdout}\nstderr: {result.stderr}"
        assert "Link Types" in result.stdout or "link type" in result.stdout.lower()

    def test_includes_common_link_types(self):
        result = _run_cli("issue", "link", "types")
        assert result.returncode == 0
        output = result.stdout
        assert "Blocks" in output or "blocks" in output
        assert "Relates" in output or "relates" in output
        assert "Duplicate" in output or "duplicate" in output

    def test_output_contains_table_structure(self):
        result = _run_cli("issue", "link", "types")
        assert result.returncode == 0
        output = result.stdout
        assert "ID" in output or "Name" in output


# =============================================================================
# Test 2: List links (empty)
# =============================================================================
class TestListLinksEmpty:
    def test_empty_links_shows_no_links_message(self):
        result = _run_cli("issue", "link", "list", TEST_ISSUE_A)
        assert result.returncode == 0, f"CLI failed:\nstdout: {result.stdout}\nstderr: {result.stderr}"
        assert "No links found" in result.stdout or "0 total" in result.stdout or "0" in result.stdout


# =============================================================================
# Test 3: Create relates link
# =============================================================================
class TestCreateRelatesLink:
    def test_create_relates_link_success(self):
        result = _run_cli("issue", "link", "create", TEST_ISSUE_A, "Relates", TEST_ISSUE_B)
        assert result.returncode == 0, f"CLI failed:\nstdout: {result.stdout}\nstderr: {result.stderr}"
        out = _output(result)
        assert "link created" in out
        assert TEST_ISSUE_A.lower() in out
        assert TEST_ISSUE_B.lower() in out

    def test_relates_link_visible_on_both_sides(self):
        _run_cli("issue", "link", "create", TEST_ISSUE_A, "Relates", TEST_ISSUE_B)

        result_a = _run_cli("issue", "link", "list", TEST_ISSUE_A)
        assert result_a.returncode == 0
        assert TEST_ISSUE_B in result_a.stdout
        assert "relates" in result_a.stdout.lower()

        result_b = _run_cli("issue", "link", "list", TEST_ISSUE_B)
        assert result_b.returncode == 0
        assert TEST_ISSUE_A in result_b.stdout
        assert "relates" in result_b.stdout.lower()


# =============================================================================
# Test 4: Create blocks link (directional)
# =============================================================================
class TestCreateBlocksLink:
    def test_create_blocks_link_success(self):
        result = _run_cli("issue", "link", "create", TEST_ISSUE_A, "Blocks", TEST_ISSUE_B)
        assert result.returncode == 0, f"CLI failed:\nstdout: {result.stdout}\nstderr: {result.stderr}"
        out = _output(result)
        assert "link created" in out

    def test_blocks_link_shows_directional_labels(self):
        _run_cli("issue", "link", "create", TEST_ISSUE_A, "Blocks", TEST_ISSUE_B)

        result_a = _run_cli("issue", "link", "list", TEST_ISSUE_A)
        assert result_a.returncode == 0
        assert TEST_ISSUE_B in result_a.stdout
        assert "blocks" in result_a.stdout.lower()
        assert "outward" in result_a.stdout.lower()

        result_b = _run_cli("issue", "link", "list", TEST_ISSUE_B)
        assert result_b.returncode == 0
        assert TEST_ISSUE_A in result_b.stdout
        assert "blocked" in result_b.stdout.lower() or "inward" in result_b.stdout.lower()


# =============================================================================
# Test 5: Delete link
# =============================================================================
class TestDeleteLink:
    def test_delete_unique_link_success(self):
        _run_cli("issue", "link", "create", TEST_ISSUE_A, "Relates", TEST_ISSUE_B)

        result = _run_cli("issue", "link", "delete", TEST_ISSUE_A, "--target", TEST_ISSUE_B)
        assert result.returncode == 0, f"CLI failed:\nstdout: {result.stdout}\nstderr: {result.stderr}"
        out = _output(result)
        assert "link deleted" in out or "removed" in out

    def test_delete_removes_link_from_list(self):
        _run_cli("issue", "link", "create", TEST_ISSUE_A, "Relates", TEST_ISSUE_B)
        _run_cli("issue", "link", "delete", TEST_ISSUE_A, "--target", TEST_ISSUE_B)

        result = _run_cli("issue", "link", "list", TEST_ISSUE_A)
        assert result.returncode == 0
        assert TEST_ISSUE_B not in result.stdout


# =============================================================================
# Test 6: Delete ambiguous (multiple links)
# =============================================================================
class TestDeleteAmbiguous:
    def test_delete_multiple_links_returns_error(self):
        _run_cli("issue", "link", "create", TEST_ISSUE_A, "Relates", TEST_ISSUE_B)
        _run_cli("issue", "link", "create", TEST_ISSUE_A, "Blocks", TEST_ISSUE_B)

        result = _run_cli("issue", "link", "delete", TEST_ISSUE_A, "--target", TEST_ISSUE_B)
        assert result.returncode != 0, f"Expected failure for ambiguous delete but got success:\n{result.stdout}"
        out = _output(result)
        assert "multiple" in out


# =============================================================================
# Test 7: Create with invalid type
# =============================================================================
class TestCreateInvalidType:
    def test_invalid_link_type_returns_error(self):
        result = _run_cli("issue", "link", "create", TEST_ISSUE_A, "ZombieApocalypse", TEST_ISSUE_B)
        assert result.returncode != 0, f"Expected failure for invalid link type but got success:\n{result.stdout}"
        assert result.stdout or result.stderr


# =============================================================================
# Test 8: List non-existent issue
# =============================================================================
class TestListNonExistentIssue:
    def test_nonexistent_issue_returns_error(self):
        result = _run_cli("issue", "link", "list", "FAKE-99999")
        assert result.returncode != 0, f"Expected failure for non-existent issue but got success:\n{result.stdout}"
        assert result.stdout or result.stderr
