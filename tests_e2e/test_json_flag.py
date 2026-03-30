"""
E2E tests for the --json flag feature (JIR-61).

Tests exercise the jira-ai CLI with --json and --json-compact flags:
  - JSON output validation for all supported commands
  - JSON error handling
  - Regression: non-JSON mode still produces table output

Test credentials are stored in ~/.jira-ai/config.json (never committed).
Run from project root after `npm run build`.

Usage:
    python3 -m pytest tests_e2e/test_json_flag.py -v
"""

import json
import os
import re
import subprocess
import time

import pytest

CLI_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "dist", "cli.js"
)

REGULAR_PROJECT_KEY = "AT"
EPIC_PROJECT_KEY = "SEA"


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


def create_test_issue(title=None):
    ts = str(int(time.time()))
    issue_title = title or f"JSON E2E Test {ts}"
    result = run_cli(
        "issue", "create",
        "--title", issue_title,
        "--project", REGULAR_PROJECT_KEY,
        "--issue-type", "Task",
    )
    assert result.returncode == 0, f"Failed to create test issue: {result.stderr}"
    match = re.search(rf"({REGULAR_PROJECT_KEY}-\d+)", result.stdout)
    assert match, f"Expected issue key in output: {result.stdout}"
    return match.group(1)


def delete_issue(issue_key):
    run_cli("issue", "delete", issue_key, "--confirm")


def find_first_epic_key():
    result = run_cli("--json", "epic", "list", EPIC_PROJECT_KEY)
    if result.returncode != 0:
        pytest.skip(f"Cannot list epics in {EPIC_PROJECT_KEY}")
    data = parse_json_output(result)
    if not data:
        pytest.skip(f"No epics found in {EPIC_PROJECT_KEY}")
    return data[0]["key"]


# =============================================================================
# 1. --json user me
# =============================================================================
class TestJsonUserMe:
    def test_valid_json(self):
        result = run_cli("--json", "user", "me")
        assert result.returncode == 0, f"Failed: {result.stderr}"
        data = parse_json_output(result)
        assert isinstance(data, dict)

    def test_has_expected_fields(self):
        result = run_cli("--json", "user", "me")
        data = parse_json_output(result)
        assert "accountId" in data
        assert "displayName" in data
        assert "emailAddress" in data
        assert "active" in data

    def test_field_types(self):
        result = run_cli("--json", "user", "me")
        data = parse_json_output(result)
        assert isinstance(data["accountId"], str)
        assert isinstance(data["displayName"], str)
        assert isinstance(data["active"], bool)


# =============================================================================
# 2. --json project list
# =============================================================================
class TestJsonProjectList:
    def test_valid_json(self):
        result = run_cli("--json", "project", "list")
        assert result.returncode == 0, f"Failed: {result.stderr}"
        data = parse_json_output(result)
        assert isinstance(data, list)

    def test_has_project_objects(self):
        result = run_cli("--json", "project", "list")
        data = parse_json_output(result)
        assert len(data) > 0
        project = data[0]
        assert "key" in project
        assert "name" in project

    def test_contains_test_project(self):
        result = run_cli("--json", "project", "list")
        data = parse_json_output(result)
        keys = [p["key"] for p in data]
        assert REGULAR_PROJECT_KEY in keys


# =============================================================================
# 3. --json issue get <key>
# =============================================================================
class TestJsonIssueGet:
    def test_valid_json_with_fields(self):
        issue_key = create_test_issue()
        try:
            result = run_cli("--json", "issue", "get", issue_key)
            assert result.returncode == 0, f"Failed: {result.stderr}"
            data = parse_json_output(result)
            assert isinstance(data, dict)
            assert data["key"] == issue_key
            assert "summary" in data
            assert "status" in data
            assert isinstance(data["status"], dict)
            assert "name" in data["status"]
        finally:
            delete_issue(issue_key)

    def test_includes_labels(self):
        result = run_cli("--json", "issue", "create",
                         "--title", "JSON Labels Test",
                         "--project", REGULAR_PROJECT_KEY,
                         "--issue-type", "Task",
                         "--labels", "json-test,qa")
        data = parse_json_output(result)
        issue_key = data["key"]
        try:
            get_result = run_cli("--json", "issue", "get", issue_key)
            data = parse_json_output(get_result)
            assert isinstance(data.get("labels"), list)
            assert "json-test" in data["labels"]
        finally:
            delete_issue(issue_key)


# =============================================================================
# 4. --json issue search <jql>
# =============================================================================
class TestJsonIssueSearch:
    def test_valid_json_array(self):
        result = run_cli("--json", "issue", "search",
                         f"project = {REGULAR_PROJECT_KEY} ORDER BY created DESC")
        assert result.returncode == 0, f"Failed: {result.stderr}"
        data = parse_json_output(result)
        assert isinstance(data, list)

    def test_has_issue_objects(self):
        result = run_cli("--json", "issue", "search",
                         f"project = {REGULAR_PROJECT_KEY} ORDER BY created DESC")
        data = parse_json_output(result)
        if len(data) > 0:
            issue = data[0]
            assert "key" in issue
            assert "summary" in issue
            assert "status" in issue


# =============================================================================
# 5. --json issue create
# =============================================================================
class TestJsonIssueCreate:
    def test_valid_json(self):
        ts = str(int(time.time()))
        result = run_cli("--json", "issue", "create",
                         "--title", f"JSON Create Test {ts}",
                         "--project", REGULAR_PROJECT_KEY,
                         "--issue-type", "Task")
        assert result.returncode == 0, f"Failed: {result.stderr}"
        data = parse_json_output(result)
        assert isinstance(data, dict)

    def test_has_expected_fields(self):
        ts = str(int(time.time()))
        title = f"JSON Create Fields {ts}"
        result = run_cli("--json", "issue", "create",
                         "--title", title,
                         "--project", REGULAR_PROJECT_KEY,
                         "--issue-type", "Task")
        data = parse_json_output(result)
        assert "key" in data
        assert data["title"] == title
        assert data["project"] == REGULAR_PROJECT_KEY
        assert data["issueType"] == "Task"
        assert REGULAR_PROJECT_KEY in data["key"]
        delete_issue(data["key"])

    def test_create_with_parent(self):
        parent_key = create_test_issue()
        try:
            ts = str(int(time.time()))
            result = run_cli("--json", "issue", "create",
                             "--title", f"JSON Sub-task {ts}",
                             "--project", REGULAR_PROJECT_KEY,
                             "--issue-type", "Task",
                             "--parent", parent_key)
            if result.returncode == 0:
                data = parse_json_output(result)
                assert "parent" in data
                delete_issue(data["key"])
        finally:
            delete_issue(parent_key)


# =============================================================================
# 6. --json issue transition <key> <status>
# =============================================================================
class TestJsonIssueTransition:
    def test_valid_json(self):
        issue_key = create_test_issue()
        try:
            result = run_cli("--json", "issue", "transition", issue_key, "In Progress")
            assert result.returncode == 0, f"Failed: {result.stderr}"
            data = parse_json_output(result)
            assert isinstance(data, dict)
            assert data["success"] is True
            assert data["issueKey"] == issue_key
            assert "status" in data
        finally:
            delete_issue(issue_key)


# =============================================================================
# 7. --json issue update <key>
# =============================================================================
class TestJsonIssueUpdate:
    def test_valid_json(self):
        issue_key = create_test_issue()
        try:
            result = run_cli("--json", "issue", "update", issue_key,
                             "--summary", "Updated by JSON test")
            assert result.returncode == 0, f"Failed: {result.stderr}"
            data = parse_json_output(result)
            assert isinstance(data, dict)
            assert data["success"] is True
            assert data["issueKey"] == issue_key
        finally:
            delete_issue(issue_key)


# =============================================================================
# 8. --json issue stats <key>
# =============================================================================
class TestJsonIssueStats:
    def test_valid_json_array(self):
        issue_key = create_test_issue()
        try:
            result = run_cli("--json", "issue", "stats", issue_key)
            assert result.returncode == 0, f"Failed: {result.stderr}"
            data = parse_json_output(result)
            assert isinstance(data, list)
            assert len(data) > 0
            stat = data[0]
            assert stat["key"] == issue_key
        finally:
            delete_issue(issue_key)


# =============================================================================
# 9. --json issue link list <key>
# =============================================================================
class TestJsonIssueLinkList:
    def test_valid_json_array(self):
        issue_key = create_test_issue()
        try:
            result = run_cli("--json", "issue", "link", "list", issue_key)
            assert result.returncode == 0, f"Failed: {result.stderr}"
            data = parse_json_output(result)
            assert isinstance(data, list)
        finally:
            delete_issue(issue_key)


# =============================================================================
# 10. --json issue link types
# =============================================================================
class TestJsonIssueLinkTypes:
    def test_valid_json_array(self):
        result = run_cli("--json", "issue", "link", "types")
        assert result.returncode == 0, f"Failed: {result.stderr}"
        data = parse_json_output(result)
        assert isinstance(data, list)
        assert len(data) > 0

    def test_has_link_type_fields(self):
        result = run_cli("--json", "issue", "link", "types")
        data = parse_json_output(result)
        link_type = data[0]
        assert "id" in link_type
        assert "name" in link_type
        assert "inward" in link_type
        assert "outward" in link_type

    def test_includes_common_types(self):
        result = run_cli("--json", "issue", "link", "types")
        data = parse_json_output(result)
        names = [lt["name"] for lt in data]
        assert any("Blocks" in n for n in names)
        assert any("Relates" in n for n in names)


# =============================================================================
# 11. --json issue label add/remove
# =============================================================================
class TestJsonIssueLabel:
    def test_label_add_valid_json(self):
        issue_key = create_test_issue()
        try:
            result = run_cli("--json", "issue", "label", "add", issue_key,
                             "json-label-test")
            assert result.returncode == 0, f"Failed: {result.stderr}"
            data = parse_json_output(result)
            assert data["success"] is True
            assert data["issueKey"] == issue_key
            assert isinstance(data["labels"], list)
            assert "json-label-test" in data["labels"]
        finally:
            delete_issue(issue_key)

    def test_label_remove_valid_json(self):
        issue_key = create_test_issue()
        try:
            run_cli("--json", "issue", "label", "add", issue_key, "to-remove")
            result = run_cli("--json", "issue", "label", "remove", issue_key,
                             "to-remove")
            assert result.returncode == 0, f"Failed: {result.stderr}"
            data = parse_json_output(result)
            assert data["success"] is True
            assert data["issueKey"] == issue_key
            assert isinstance(data["labels"], list)

            verify = run_cli("--json", "issue", "get", issue_key)
            verify_data = parse_json_output(verify)
            assert "to-remove" not in verify_data["labels"]
        finally:
            delete_issue(issue_key)


# =============================================================================
# 12. --json epic list <project>
# =============================================================================
class TestJsonEpicList:
    def test_valid_json_array(self):
        result = run_cli("--json", "epic", "list", EPIC_PROJECT_KEY)
        assert result.returncode == 0, f"Failed: {result.stderr}"
        data = parse_json_output(result)
        assert isinstance(data, list)

    def test_has_epic_objects(self):
        result = run_cli("--json", "epic", "list", EPIC_PROJECT_KEY)
        data = parse_json_output(result)
        if len(data) > 0:
            epic = data[0]
            assert "key" in epic
            assert "name" in epic
            assert "status" in epic


# =============================================================================
# 13. --json epic get <key>
# =============================================================================
class TestJsonEpicGet:
    def test_valid_json(self):
        epic_key = find_first_epic_key()
        result = run_cli("--json", "epic", "get", epic_key)
        assert result.returncode == 0, f"Failed: {result.stderr}"
        data = parse_json_output(result)
        assert isinstance(data, dict)
        assert data["key"] == epic_key

    def test_has_expected_fields(self):
        epic_key = find_first_epic_key()
        result = run_cli("--json", "epic", "get", epic_key)
        data = parse_json_output(result)
        assert "name" in data
        assert "summary" in data
        assert "status" in data
        assert "projectKey" in data


# =============================================================================
# 14. --json epic issues <key>
# =============================================================================
class TestJsonEpicIssues:
    def test_valid_json_array(self):
        epic_key = find_first_epic_key()
        result = run_cli("--json", "epic", "issues", epic_key)
        assert result.returncode == 0, f"Failed: {result.stderr}"
        data = parse_json_output(result)
        assert isinstance(data, list)


# =============================================================================
# 15. --json epic progress <key>
# =============================================================================
class TestJsonEpicProgress:
    def test_valid_json(self):
        epic_key = find_first_epic_key()
        result = run_cli("--json", "epic", "progress", epic_key)
        assert result.returncode == 0, f"Failed: {result.stderr}"
        data = parse_json_output(result)
        assert isinstance(data, dict)

    def test_has_progress_metrics(self):
        epic_key = find_first_epic_key()
        result = run_cli("--json", "epic", "progress", epic_key)
        data = parse_json_output(result)
        assert "epicKey" in data
        assert "totalIssues" in data
        assert "doneIssues" in data
        assert "percentageDone" in data


# =============================================================================
# 16. --json project statuses <key>
# =============================================================================
class TestJsonProjectStatuses:
    def test_valid_json_array(self):
        result = run_cli("--json", "project", "statuses", REGULAR_PROJECT_KEY)
        assert result.returncode == 0, f"Failed: {result.stderr}"
        data = parse_json_output(result)
        assert isinstance(data, list)
        assert len(data) > 0

    def test_has_status_fields(self):
        result = run_cli("--json", "project", "statuses", REGULAR_PROJECT_KEY)
        data = parse_json_output(result)
        status = data[0]
        assert "name" in status
        assert "statusCategory" in status


# =============================================================================
# 17. --json project types <key>
# =============================================================================
class TestJsonProjectTypes:
    def test_valid_json_array(self):
        result = run_cli("--json", "project", "types", REGULAR_PROJECT_KEY)
        assert result.returncode == 0, f"Failed: {result.stderr}"
        data = parse_json_output(result)
        assert isinstance(data, list)
        assert len(data) > 0

    def test_has_type_fields(self):
        result = run_cli("--json", "project", "types", REGULAR_PROJECT_KEY)
        data = parse_json_output(result)
        issue_type = data[0]
        assert "name" in issue_type
        assert "subtask" in issue_type


# =============================================================================
# 18. --json project fields <key>
# =============================================================================
class TestJsonProjectFields:
    def test_valid_json_array(self):
        result = run_cli("--json", "project", "fields", REGULAR_PROJECT_KEY)
        assert result.returncode == 0, f"Failed: {result.stderr}"
        data = parse_json_output(result)
        assert isinstance(data, list)
        assert len(data) > 0

    def test_has_field_properties(self):
        result = run_cli("--json", "project", "fields", REGULAR_PROJECT_KEY)
        data = parse_json_output(result)
        field = data[0]
        assert "id" in field
        assert "name" in field


# =============================================================================
# 19. --json confl spaces
# =============================================================================
class TestJsonConflSpaces:
    def test_valid_json_array(self):
        result = run_cli("--json", "confl", "spaces")
        if result.returncode != 0:
            pytest.skip("Confluence not configured or unavailable")
        data = parse_json_output(result)
        assert isinstance(data, list)

    def test_has_space_fields(self):
        result = run_cli("--json", "confl", "spaces")
        if result.returncode != 0:
            pytest.skip("Confluence not configured or unavailable")
        data = parse_json_output(result)
        if len(data) > 0:
            space = data[0]
            assert "key" in space
            assert "name" in space


# =============================================================================
# 20. --json confl pages <space>
# =============================================================================
class TestJsonConflPages:
    def test_valid_json_array(self):
        spaces_result = run_cli("--json", "confl", "spaces")
        if spaces_result.returncode != 0:
            pytest.skip("Confluence not configured or unavailable")
        spaces = parse_json_output(spaces_result)
        if not spaces:
            pytest.skip("No Confluence spaces found")
        space_key = spaces[0]["key"]

        result = run_cli("--json", "confl", "pages", space_key)
        if result.returncode != 0:
            pytest.skip("Confluence pages unavailable")
        data = parse_json_output(result)
        assert isinstance(data, list)


# =============================================================================
# 21. --json about
# =============================================================================
class TestJsonAbout:
    def test_valid_json(self):
        result = run_cli("--json", "about")
        assert result.returncode == 0, f"Failed: {result.stderr}"
        data = parse_json_output(result)
        assert isinstance(data, dict)

    def test_has_version(self):
        result = run_cli("--json", "about")
        data = parse_json_output(result)
        assert "version" in data
        assert isinstance(data["version"], str)


# =============================================================================
# 22. --json settings
# =============================================================================
class TestJsonSettings:
    def test_valid_json(self):
        result = run_cli("--json", "settings")
        assert result.returncode == 0, f"Failed: {result.stderr}"
        data = parse_json_output(result)
        assert isinstance(data, dict)

    def test_has_defaults(self):
        result = run_cli("--json", "settings")
        data = parse_json_output(result)
        assert "defaults" in data


# =============================================================================
# 23. --json-compact user me
# =============================================================================
class TestJsonCompactUserMe:
    def test_single_line_output(self):
        result = run_cli("--json-compact", "user", "me")
        assert result.returncode == 0, f"Failed: {result.stderr}"
        output = result.stdout.strip()
        lines = [l for l in output.split("\n") if l.strip()]
        assert len(lines) == 1, f"Expected single line, got {len(lines)}: {output}"

    def test_valid_json(self):
        result = run_cli("--json-compact", "user", "me")
        data = json.loads(result.stdout.strip())
        assert "accountId" in data

    def test_no_pretty_printing(self):
        result = run_cli("--json-compact", "user", "me")
        output = result.stdout.strip()
        assert "\n" not in output
        assert "  " not in output


# =============================================================================
# 24. --json issue get INVALID-999 (error handling)
# =============================================================================
class TestJsonErrorHandling:
    def test_error_json_structure(self):
        result = run_cli("--json", "issue", "get", "INVALID-999")
        assert result.returncode != 0, "Expected non-zero exit for invalid issue"
        data = parse_json_output(result)
        assert isinstance(data, dict)
        assert data["error"] is True
        assert "message" in data
        assert isinstance(data["message"], str)
        assert len(data["message"]) > 0

    def test_error_has_hints(self):
        result = run_cli("--json", "issue", "get", "INVALID-999")
        data = parse_json_output(result)
        assert "hints" in data
        assert isinstance(data["hints"], list)

    def test_error_has_exit_code(self):
        result = run_cli("--json", "issue", "get", "INVALID-999")
        data = parse_json_output(result)
        assert "exitCode" in data
        assert isinstance(data["exitCode"], int)
        assert data["exitCode"] != 0


# =============================================================================
# 25. Regression: user me (no --json) → table output
# =============================================================================
class TestRegressionUserMe:
    def test_not_json(self):
        result = run_cli("user", "me")
        assert result.returncode == 0, f"Failed: {result.stderr}"
        with pytest.raises(json.JSONDecodeError):
            json.loads(result.stdout.strip())

    def test_contains_table_elements(self):
        result = run_cli("user", "me")
        output = result.stdout
        assert any(
            kw in output for kw in ["displayName", "Display Name", "Account", "Email"]
        )


# =============================================================================
# 26. Regression: project list (no --json) → table output
# =============================================================================
class TestRegressionProjectList:
    def test_not_json(self):
        result = run_cli("project", "list")
        assert result.returncode == 0, f"Failed: {result.stderr}"
        with pytest.raises(json.JSONDecodeError):
            json.loads(result.stdout.strip())

    def test_contains_project_key(self):
        result = run_cli("project", "list")
        assert REGULAR_PROJECT_KEY in result.stdout


# =============================================================================
# 27. Regression: issue search (no --json) → table output
# =============================================================================
class TestRegressionIssueSearch:
    def test_not_json(self):
        result = run_cli("issue", "search",
                         f"project = {REGULAR_PROJECT_KEY} ORDER BY created DESC")
        assert result.returncode == 0, f"Failed: {result.stderr}"
        with pytest.raises(json.JSONDecodeError):
            json.loads(result.stdout.strip())

    def test_contains_issue_keys(self):
        result = run_cli("issue", "search",
                         f"project = {REGULAR_PROJECT_KEY} ORDER BY created DESC")
        assert REGULAR_PROJECT_KEY in result.stdout
