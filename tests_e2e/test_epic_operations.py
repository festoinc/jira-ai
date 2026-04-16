import re
import time

import pytest

from conftest import EPIC_PROJECT_KEY, REGULAR_PROJECT_KEY, run_cli, unique_id


def find_first_epic_key():
    result = run_cli("epic", "list", EPIC_PROJECT_KEY)
    if result.returncode != 0:
        pytest.skip(f"Cannot list epics in {EPIC_PROJECT_KEY}: {result.stderr}")
    match = re.search(rf"({EPIC_PROJECT_KEY}-\d+)", result.stdout)
    if match:
        return match.group(1)
    pytest.skip(f"No epics found in project {EPIC_PROJECT_KEY}")


def create_test_epic():
    ts = str(int(time.time()))
    name = f"E2E Epic {ts}"
    summary = f"Epic created by e2e test at {ts}"
    result = run_cli("epic", "create", EPIC_PROJECT_KEY, "--name", name, "--summary", summary)
    assert result.returncode == 0, f"Failed to create test epic: {result.stderr}"
    output = result.stdout + result.stderr
    match = re.search(rf"({EPIC_PROJECT_KEY}-\d+)", output)
    assert match, f"Expected epic key in output: {output}"
    return match.group(1), name, summary


def create_test_issue(project_key=REGULAR_PROJECT_KEY):
    ts = str(int(time.time()))
    title = f"E2E Test Issue {ts}"
    result = run_cli(
        "issue", "create",
        "--title", title,
        "--project", project_key,
        "--issue-type", "Task",
    )
    assert result.returncode == 0, f"Failed to create test issue: {result.stderr}"
    match = re.search(rf"({project_key}-\d+)", result.stdout)
    assert match, f"Expected issue key in output: {result.stdout}"
    return match.group(1)


def delete_issue(issue_key):
    result = run_cli("issue", "delete", issue_key, "--confirm")
    if result.returncode != 0:
        pass


class TestEpicList:
    def test_epic_list_returns_results(self):
        result = run_cli("epic", "list", EPIC_PROJECT_KEY)
        assert result.returncode == 0, f"Epic list failed: {result.stderr}"

    def test_epic_list_with_done_flag(self):
        result = run_cli("epic", "list", EPIC_PROJECT_KEY, "--done")
        assert result.returncode == 0, f"Epic list --done failed: {result.stderr}"

    def test_epic_list_with_max(self):
        result = run_cli("epic", "list", EPIC_PROJECT_KEY, "--max", "2")
        assert result.returncode == 0, f"Epic list --max failed: {result.stderr}"

    def test_epic_list_shows_epic_key(self):
        result = run_cli("epic", "list", EPIC_PROJECT_KEY)
        assert result.returncode == 0, f"Epic list failed: {result.stderr}"
        assert EPIC_PROJECT_KEY in result.stdout, f"Expected project key {EPIC_PROJECT_KEY} in output"

    def test_epic_list_invalid_project(self):
        result = run_cli("epic", "list", "INVALIDPROJ")
        assert result.returncode == 0
        assert "No epics found" in result.stdout


class TestEpicGet:
    def test_epic_get_existing(self):
        epic_key = find_first_epic_key()
        result = run_cli("epic", "get", epic_key)
        assert result.returncode == 0, f"Epic get failed: {result.stderr}"
        assert epic_key in result.stdout, f"Epic key should appear in output"

    def test_epic_get_nonexistent(self):
        result = run_cli("epic", "get", "SEA-999999")
        assert result.returncode != 0, "Getting nonexistent epic should fail"

    def test_epic_get_shows_status_and_project(self):
        epic_key = find_first_epic_key()
        result = run_cli("epic", "get", epic_key)
        assert result.returncode == 0, f"Epic get failed: {result.stderr}"
        assert "Status" in result.stdout or "status" in result.stdout.lower()
        assert "Project" in result.stdout or "project" in result.stdout.lower()


class TestEpicCreate:
    def test_epic_create_and_get(self):
        epic_key, name, summary = create_test_epic()
        try:
            result = run_cli("epic", "get", epic_key)
            assert result.returncode == 0, f"Failed to get created epic: {result.stderr}"
            assert epic_key in result.stdout
            result = run_cli("issue", "delete", epic_key, "--confirm")
        finally:
            delete_issue(epic_key)

    def test_epic_create_with_description(self):
        ts = str(int(time.time()))
        name = f"E2E Epic Desc {ts}"
        summary = f"Summary for epic {ts}"
        result = run_cli(
            "epic", "create", EPIC_PROJECT_KEY,
            "--name", name,
            "--summary", summary,
            "--description", "Test description for epic",
        )
        assert result.returncode == 0, f"Epic create with description failed: {result.stderr}"
        match = re.search(rf"({EPIC_PROJECT_KEY}-\d+)", result.stdout)
        assert match, f"Expected epic key in output: {result.stdout}"
        epic_key = match.group(1)
        delete_issue(epic_key)

    def test_epic_create_missing_name(self):
        result = run_cli("epic", "create", EPIC_PROJECT_KEY, "--summary", "No name")
        assert result.returncode != 0, "Creating epic without --name should fail"

    def test_epic_create_missing_summary(self):
        result = run_cli("epic", "create", EPIC_PROJECT_KEY, "--name", "No Summary")
        assert result.returncode != 0, "Creating epic without --summary should fail"


class TestEpicUpdate:
    def test_epic_update_name(self):
        epic_key, _, _ = create_test_epic()
        try:
            ts = str(int(time.time()))
            new_name = f"Updated Epic {ts}"
            result = run_cli("epic", "update", epic_key, "--name", new_name)
            assert result.returncode == 0, f"Epic update failed: {result.stderr}"
            output = (result.stdout + result.stderr).lower()
            assert "updated successfully" in output or epic_key.lower() in output

            result = run_cli("epic", "get", epic_key)
            assert result.returncode == 0
        finally:
            delete_issue(epic_key)

    def test_epic_update_summary(self):
        epic_key, _, _ = create_test_epic()
        try:
            ts = str(int(time.time()))
            new_summary = f"Updated summary {ts}"
            result = run_cli("epic", "update", epic_key, "--summary", new_summary)
            assert result.returncode == 0, f"Epic update summary failed: {result.stderr}"
        finally:
            delete_issue(epic_key)

    def test_epic_update_no_flags(self):
        epic_key = find_first_epic_key()
        result = run_cli("epic", "update", epic_key)
        assert result.returncode != 0, "Update without --name or --summary should fail"


class TestEpicIssues:
    def test_epic_issues(self):
        epic_key = find_first_epic_key()
        result = run_cli("epic", "issues", epic_key)
        assert result.returncode == 0, f"Epic issues failed: {result.stderr}"

    def test_epic_issues_with_max(self):
        epic_key = find_first_epic_key()
        result = run_cli("epic", "issues", epic_key, "--max", "5")
        assert result.returncode == 0, f"Epic issues --max failed: {result.stderr}"

    def test_epic_issues_nonexistent_epic(self):
        result = run_cli("epic", "issues", "SEA-999999")
        assert result.returncode == 0
        assert "No issues found" in result.stdout


class TestEpicLinkUnlink:
    def test_epic_link_and_unlink(self):
        epic_key, _, _ = create_test_epic()
        try:
            issue_key = create_test_issue(EPIC_PROJECT_KEY)
            try:
                result = run_cli("epic", "link", issue_key, "--epic", epic_key)
                assert result.returncode == 0, f"Epic link failed: {result.stderr}"
                output = result.stdout + result.stderr
                assert "linked" in output.lower() or epic_key in output

                time.sleep(3)

                result = run_cli("epic", "issues", epic_key)
                assert result.returncode == 0
                assert issue_key in result.stdout, f"Issue {issue_key} should be in epic issues list: {result.stdout}"

                result = run_cli("epic", "unlink", issue_key)
                assert result.returncode == 0, f"Epic unlink failed: {result.stderr}"
                output = result.stdout + result.stderr
                assert "removed" in output.lower() or issue_key in output
            finally:
                delete_issue(issue_key)
        finally:
            delete_issue(epic_key)

    def test_epic_link_nonexistent_epic(self):
        issue_key = create_test_issue(EPIC_PROJECT_KEY)
        try:
            result = run_cli("epic", "link", issue_key, "--epic", "SEA-999999")
            assert result.returncode != 0, "Linking to nonexistent epic should fail"
        finally:
            delete_issue(issue_key)

    def test_epic_link_missing_epic_flag(self):
        issue_key = create_test_issue(EPIC_PROJECT_KEY)
        try:
            result = run_cli("epic", "link", issue_key)
            assert result.returncode != 0, "Link without --epic flag should fail"
        finally:
            delete_issue(issue_key)

    def test_epic_unlink_nonexistent_issue(self):
        result = run_cli("epic", "unlink", "SEA-999999")
        assert result.returncode != 0, "Unlinking nonexistent issue should fail"


class TestEpicProgress:
    def test_epic_progress(self):
        epic_key = find_first_epic_key()
        result = run_cli("epic", "progress", epic_key)
        assert result.returncode == 0, f"Epic progress failed: {result.stderr}"
        assert "Total" in result.stdout or "Done" in result.stdout or "%" in result.stdout

    def test_epic_progress_with_linked_issues(self):
        epic_key, _, _ = create_test_epic()
        try:
            issue_key = create_test_issue(EPIC_PROJECT_KEY)
            try:
                result = run_cli("epic", "link", issue_key, "--epic", epic_key)
                assert result.returncode == 0, f"Link failed: {result.stderr}"

                result = run_cli("epic", "progress", epic_key)
                assert result.returncode == 0, f"Epic progress failed: {result.stderr}"
            finally:
                delete_issue(issue_key)
        finally:
            delete_issue(epic_key)

    def test_epic_progress_nonexistent_epic(self):
        result = run_cli("epic", "progress", "SEA-999999")
        assert result.returncode != 0, "Progress for nonexistent epic should fail"
