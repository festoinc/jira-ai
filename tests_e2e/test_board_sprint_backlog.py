import re
import time

import pytest

from conftest import EPIC_PROJECT_KEY, REGULAR_PROJECT_KEY, run_cli

SEA_BOARD_ID = "69"
GP_BOARD_ID = "36"
SEA_PROJECT_KEY = EPIC_PROJECT_KEY


def find_first_board_id():
    result = run_cli("board", "list")
    if result.returncode != 0:
        pytest.skip(f"Cannot list boards: {result.stderr}")
    match = re.search(r"^\s*(\d+)\s+", result.stdout, re.MULTILINE)
    if match:
        return match.group(1)
    pytest.skip("No boards found")


def find_future_sprint_id(board_id=SEA_BOARD_ID):
    result = run_cli("sprint", "list", board_id, "--state", "future")
    if result.returncode != 0:
        pytest.skip(f"Cannot list future sprints: {result.stderr}")
    match = re.search(r"^\s*(\d+)\s+", result.stdout, re.MULTILINE)
    if match:
        return match.group(1)
    pytest.skip(f"No future sprints found on board {board_id}")


def find_any_sprint_id(board_id=SEA_BOARD_ID):
    result = run_cli("sprint", "list", board_id)
    if result.returncode != 0:
        pytest.skip(f"Cannot list sprints: {result.stderr}")
    match = re.search(r"^\s*(\d+)\s+", result.stdout, re.MULTILINE)
    if match:
        return match.group(1)
    pytest.skip(f"No sprints found on board {board_id}")


def create_test_sprint(board_id=SEA_BOARD_ID):
    ts = str(int(time.time()))
    name = f"E2E Test Sprint {ts}"
    result = run_cli(
        "sprint", "create", board_id,
        "--name", name,
        "--goal", f"Test goal {ts}",
        "--start", "2026-04-01",
        "--end", "2026-04-14",
    )
    assert result.returncode == 0, f"Failed to create sprint: {result.stderr}"
    output = result.stdout + result.stderr
    match = re.search(r"ID:\s*(\d+)", output)
    if not match:
        match = re.search(r"\(ID:\s*(\d+)\)", output)
    assert match, f"Expected sprint ID in output: {output}"
    sprint_id = match.group(1)
    return sprint_id, name


def delete_sprint(sprint_id):
    result = run_cli("sprint", "delete", sprint_id)
    return result.returncode == 0


def create_test_issue(project_key=REGULAR_PROJECT_KEY):
    ts = str(int(time.time()))
    title = f"E2E Board Test Issue {ts}"
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
    run_cli("issue", "delete", issue_key, "--confirm")


# ── Board List ──────────────────────────────────────────────────────────


class TestBoardList:
    def test_board_list_returns_results(self):
        result = run_cli("board", "list")
        assert result.returncode == 0, f"Board list failed: {result.stderr}"
        assert "Boards" in result.stdout or "board" in result.stdout.lower()

    def test_board_list_shows_board_id(self):
        result = run_cli("board", "list")
        assert result.returncode == 0
        assert SEA_BOARD_ID in result.stdout

    def test_board_list_filter_by_project(self):
        result = run_cli("board", "list", "--project", SEA_PROJECT_KEY)
        assert result.returncode == 0, f"Board list --project failed: {result.stderr}"

    def test_board_list_filter_by_type(self):
        result = run_cli("board", "list", "--type", "simple")
        assert result.returncode == 0, f"Board list --type failed: {result.stderr}"

    def test_board_list_invalid_project(self):
        result = run_cli("board", "list", "--project", "INVALIDPROJ999")
        assert result.returncode == 0


# ── Board Get ───────────────────────────────────────────────────────────


class TestBoardGet:
    def test_board_get_existing(self):
        result = run_cli("board", "get", SEA_BOARD_ID)
        assert result.returncode == 0, f"Board get failed: {result.stderr}"
        assert "SEA board" in result.stdout
        assert SEA_BOARD_ID in result.stdout

    def test_board_get_shows_type(self):
        result = run_cli("board", "get", SEA_BOARD_ID)
        assert result.returncode == 0
        assert "Type" in result.stdout or "type" in result.stdout.lower()

    def test_board_get_shows_project(self):
        result = run_cli("board", "get", SEA_BOARD_ID)
        assert result.returncode == 0
        assert "Project" in result.stdout or SEA_PROJECT_KEY in result.stdout

    def test_board_get_nonexistent(self):
        result = run_cli("board", "get", "999999")
        assert result.returncode != 0, "Getting nonexistent board should fail"


# ── Board Config ────────────────────────────────────────────────────────


class TestBoardConfig:
    def test_board_config_existing(self):
        result = run_cli("board", "config", SEA_BOARD_ID)
        assert result.returncode == 0, f"Board config failed: {result.stderr}"
        assert "Board Config" in result.stdout or SEA_BOARD_ID in result.stdout

    def test_board_config_shows_columns(self):
        result = run_cli("board", "config", SEA_BOARD_ID)
        assert result.returncode == 0
        assert "Columns" in result.stdout or "columns" in result.stdout.lower()

    def test_board_config_shows_type(self):
        result = run_cli("board", "config", SEA_BOARD_ID)
        assert result.returncode == 0
        assert "Type" in result.stdout or "type" in result.stdout.lower()

    def test_board_config_nonexistent(self):
        result = run_cli("board", "config", "999999")
        assert result.returncode != 0, "Config for nonexistent board should fail"


# ── Board Issues ────────────────────────────────────────────────────────


class TestBoardIssues:
    def test_board_issues_existing(self):
        result = run_cli("board", "issues", SEA_BOARD_ID)
        assert result.returncode == 0, f"Board issues failed: {result.stderr}"

    def test_board_issues_with_max(self):
        result = run_cli("board", "issues", SEA_BOARD_ID, "--max", "5")
        assert result.returncode == 0, f"Board issues --max failed: {result.stderr}"

    def test_board_issues_with_jql(self):
        result = run_cli(
            "board", "issues", SEA_BOARD_ID,
            "--jql", "resolution = Unresolved",
        )
        assert result.returncode == 0, f"Board issues --jql failed: {result.stderr}"

    def test_board_issues_nonexistent_board(self):
        result = run_cli("board", "issues", "999999")
        assert result.returncode != 0, "Issues for nonexistent board should fail"


# ── Board Rank ──────────────────────────────────────────────────────────


class TestBoardRank:
    def test_board_rank_missing_issues(self):
        result = run_cli("board", "rank", "--before", "SEA-1")
        assert result.returncode != 0, "Rank without --issues should fail"

    def test_board_rank_missing_position(self):
        result = run_cli("board", "rank", "--issues", "SEA-1")
        assert result.returncode != 0, "Rank without --before or --after should fail"

    def test_board_rank_with_after(self):
        issue1 = create_test_issue(SEA_PROJECT_KEY)
        issue2 = create_test_issue(SEA_PROJECT_KEY)
        try:
            result = run_cli(
                "board", "rank",
                "--issues", issue2,
                "--after", issue1,
            )
            assert result.returncode == 0, f"Board rank --after failed: {result.stderr}"
            assert "Ranked" in result.stdout or "ranked" in (result.stdout + result.stderr).lower()
        finally:
            delete_issue(issue1)
            delete_issue(issue2)

    def test_board_rank_with_before(self):
        issue1 = create_test_issue(SEA_PROJECT_KEY)
        issue2 = create_test_issue(SEA_PROJECT_KEY)
        try:
            result = run_cli(
                "board", "rank",
                "--issues", issue2,
                "--before", issue1,
            )
            assert result.returncode == 0, f"Board rank --before failed: {result.stderr}"
        finally:
            delete_issue(issue1)
            delete_issue(issue2)


# ── Sprint List ─────────────────────────────────────────────────────────


class TestSprintList:
    def test_sprint_list_returns_results(self):
        result = run_cli("sprint", "list", SEA_BOARD_ID)
        assert result.returncode == 0, f"Sprint list failed: {result.stderr}"

    def test_sprint_list_shows_sprint_id(self):
        result = run_cli("sprint", "list", SEA_BOARD_ID)
        assert result.returncode == 0
        assert re.search(r"\d+", result.stdout), "Expected at least one sprint ID"

    def test_sprint_list_filter_by_state(self):
        result = run_cli("sprint", "list", SEA_BOARD_ID, "--state", "closed")
        assert result.returncode == 0, f"Sprint list --state failed: {result.stderr}"

    def test_sprint_list_filter_future(self):
        result = run_cli("sprint", "list", SEA_BOARD_ID, "--state", "future")
        assert result.returncode == 0, f"Sprint list --state future failed: {result.stderr}"

    def test_sprint_list_invalid_board(self):
        result = run_cli("sprint", "list", "999999")
        assert result.returncode != 0, "Listing sprints on invalid board should fail"


# ── Sprint Get ──────────────────────────────────────────────────────────


class TestSprintGet:
    def test_sprint_get_existing(self):
        sprint_id = find_any_sprint_id()
        result = run_cli("sprint", "get", sprint_id)
        assert result.returncode == 0, f"Sprint get failed: {result.stderr}"
        assert sprint_id in result.stdout

    def test_sprint_get_shows_state(self):
        sprint_id = find_any_sprint_id()
        result = run_cli("sprint", "get", sprint_id)
        assert result.returncode == 0
        assert "State" in result.stdout or "state" in result.stdout.lower()

    def test_sprint_get_nonexistent(self):
        result = run_cli("sprint", "get", "999999")
        assert result.returncode != 0, "Getting nonexistent sprint should fail"


# ── Sprint Create ───────────────────────────────────────────────────────


class TestSprintCreate:
    def test_sprint_create_and_delete(self):
        sprint_id, name = create_test_sprint()
        try:
            result = run_cli("sprint", "get", sprint_id)
            assert result.returncode == 0, f"Failed to get created sprint: {result.stderr}"
            assert sprint_id in result.stdout
            assert name in result.stdout
        finally:
            delete_sprint(sprint_id)

    def test_sprint_create_with_goal(self):
        ts = str(int(time.time()))
        name = f"E2E Goal Sprint {ts}"
        goal = f"Test goal {ts}"
        result = run_cli(
            "sprint", "create", SEA_BOARD_ID,
            "--name", name,
            "--goal", goal,
            "--start", "2026-04-15",
            "--end", "2026-04-28",
        )
        assert result.returncode == 0, f"Sprint create with goal failed: {result.stderr}"
        output = result.stdout + result.stderr
        match = re.search(r"ID:\s*(\d+)", output)
        if not match:
            match = re.search(r"\(ID:\s*(\d+)\)", output)
        assert match, f"Expected sprint ID in output: {output}"
        delete_sprint(match.group(1))

    def test_sprint_create_missing_name(self):
        result = run_cli("sprint", "create", SEA_BOARD_ID)
        assert result.returncode != 0, "Creating sprint without --name should fail"

    def test_sprint_create_missing_board_id(self):
        result = run_cli("sprint", "create", "--name", "No Board")
        assert result.returncode != 0, "Creating sprint without board ID should fail"


# ── Sprint Start ────────────────────────────────────────────────────────


class TestSprintStart:
    def test_sprint_start_future_sprint(self):
        sprint_id, _ = create_test_sprint()
        try:
            result = run_cli("sprint", "start", sprint_id)
            assert result.returncode == 0, f"Sprint start failed: {result.stderr}"
            assert "started" in (result.stdout + result.stderr).lower()

            result = run_cli("sprint", "get", sprint_id)
            assert result.returncode == 0
            assert "active" in result.stdout.lower()
        finally:
            try:
                run_cli("sprint", "update", sprint_id, "--name", f"Cleanup Sprint {sprint_id}")
            except Exception:
                pass

    def test_sprint_start_nonexistent(self):
        result = run_cli("sprint", "start", "999999")
        assert result.returncode != 0, "Starting nonexistent sprint should fail"


# ── Sprint Complete ─────────────────────────────────────────────────────


class TestSprintComplete:
    def test_sprint_complete_active_sprint(self):
        sprint_id, _ = create_test_sprint()
        try:
            run_cli("sprint", "start", sprint_id)

            result = run_cli("sprint", "complete", sprint_id)
            assert result.returncode == 0, f"Sprint complete failed: {result.stderr}"
            assert "completed" in (result.stdout + result.stderr).lower()

            result = run_cli("sprint", "get", sprint_id)
            assert result.returncode == 0
            assert "closed" in result.stdout.lower()
        except Exception:
            try:
                delete_sprint(sprint_id)
            except Exception:
                pass

    def test_sprint_complete_future_sprint_fails(self):
        sprint_id, _ = create_test_sprint()
        try:
            result = run_cli("sprint", "complete", sprint_id)
            assert result.returncode != 0, "Completing future sprint should fail"
        finally:
            delete_sprint(sprint_id)


# ── Sprint Update ───────────────────────────────────────────────────────


class TestSprintUpdate:
    def test_sprint_update_name(self):
        sprint_id, _ = create_test_sprint()
        try:
            ts = str(int(time.time()))
            new_name = f"Updated Sprint {ts}"
            result = run_cli("sprint", "update", sprint_id, "--name", new_name)
            assert result.returncode == 0, f"Sprint update failed: {result.stderr}"
            assert "updated" in (result.stdout + result.stderr).lower()
        finally:
            delete_sprint(sprint_id)

    def test_sprint_update_goal(self):
        sprint_id, _ = create_test_sprint()
        try:
            ts = str(int(time.time()))
            result = run_cli("sprint", "update", sprint_id, "--goal", f"New goal {ts}")
            assert result.returncode == 0, f"Sprint update goal failed: {result.stderr}"
        finally:
            delete_sprint(sprint_id)

    def test_sprint_update_dates(self):
        sprint_id, _ = create_test_sprint()
        try:
            result = run_cli(
                "sprint", "update", sprint_id,
                "--start", "2026-05-01",
                "--end", "2026-05-14",
            )
            assert result.returncode == 0, f"Sprint update dates failed: {result.stderr}"
        finally:
            delete_sprint(sprint_id)

    def test_sprint_update_no_flags(self):
        sprint_id = find_any_sprint_id()
        result = run_cli("sprint", "update", sprint_id)
        assert result.returncode != 0, "Update without any flags should fail"

    def test_sprint_update_nonexistent(self):
        result = run_cli("sprint", "update", "999999", "--name", "Ghost")
        assert result.returncode != 0, "Updating nonexistent sprint should fail"


# ── Sprint Delete ───────────────────────────────────────────────────────


class TestSprintDelete:
    def test_sprint_delete_created_sprint(self):
        sprint_id, _ = create_test_sprint()
        result = run_cli("sprint", "delete", sprint_id)
        assert result.returncode == 0, f"Sprint delete failed: {result.stderr}"
        assert "deleted" in (result.stdout + result.stderr).lower()

    def test_sprint_delete_nonexistent(self):
        result = run_cli("sprint", "delete", "999999")
        assert result.returncode != 0, "Deleting nonexistent sprint should fail"


# ── Sprint Issues ───────────────────────────────────────────────────────


class TestSprintIssues:
    def test_sprint_issues_existing(self):
        sprint_id = find_any_sprint_id()
        result = run_cli("sprint", "issues", sprint_id)
        assert result.returncode == 0, f"Sprint issues failed: {result.stderr}"

    def test_sprint_issues_with_max(self):
        sprint_id = find_any_sprint_id()
        result = run_cli("sprint", "issues", sprint_id, "--max", "5")
        assert result.returncode == 0, f"Sprint issues --max failed: {result.stderr}"

    def test_sprint_issues_with_jql(self):
        sprint_id = find_any_sprint_id()
        result = run_cli(
            "sprint", "issues", sprint_id,
            "--jql", "resolution = Unresolved",
        )
        assert result.returncode == 0, f"Sprint issues --jql failed: {result.stderr}"

    def test_sprint_issues_nonexistent_sprint(self):
        result = run_cli("sprint", "issues", "999999")
        assert result.returncode != 0, "Issues for nonexistent sprint should fail"


# ── Sprint Move ─────────────────────────────────────────────────────────


class TestSprintMove:
    def test_sprint_move_issues_to_future_sprint(self):
        sprint_id, _ = create_test_sprint()
        issue_key = create_test_issue(SEA_PROJECT_KEY)
        try:
            result = run_cli(
                "sprint", "move", sprint_id,
                "--issues", issue_key,
            )
            assert result.returncode == 0, f"Sprint move failed: {result.stderr}"
            assert "moved" in (result.stdout + result.stderr).lower()
        finally:
            delete_issue(issue_key)
            delete_sprint(sprint_id)

    def test_sprint_move_with_rank_before(self):
        issue1 = create_test_issue(SEA_PROJECT_KEY)
        issue2 = create_test_issue(SEA_PROJECT_KEY)
        sprint_id, _ = create_test_sprint()
        try:
            result = run_cli(
                "sprint", "move", sprint_id,
                "--issues", issue1,
            )
            assert result.returncode == 0

            result = run_cli(
                "sprint", "move", sprint_id,
                "--issues", issue2,
                "--before", issue1,
            )
            assert result.returncode == 0, f"Sprint move --before failed: {result.stderr}"
        finally:
            delete_issue(issue1)
            delete_issue(issue2)
            delete_sprint(sprint_id)

    def test_sprint_move_with_rank_after(self):
        issue1 = create_test_issue(SEA_PROJECT_KEY)
        issue2 = create_test_issue(SEA_PROJECT_KEY)
        sprint_id, _ = create_test_sprint()
        try:
            result = run_cli(
                "sprint", "move", sprint_id,
                "--issues", issue1,
            )
            assert result.returncode == 0

            result = run_cli(
                "sprint", "move", sprint_id,
                "--issues", issue2,
                "--after", issue1,
            )
            assert result.returncode == 0, f"Sprint move --after failed: {result.stderr}"
        finally:
            delete_issue(issue1)
            delete_issue(issue2)
            delete_sprint(sprint_id)

    def test_sprint_move_missing_issues(self):
        result = run_cli("sprint", "move", "1")
        assert result.returncode != 0, "Move without --issues should fail"

    def test_sprint_move_nonexistent_sprint(self):
        issue_key = create_test_issue(SEA_PROJECT_KEY)
        try:
            result = run_cli("sprint", "move", "999999", "--issues", issue_key)
            assert result.returncode != 0, "Move to nonexistent sprint should fail"
        finally:
            delete_issue(issue_key)


# ── Backlog Move ────────────────────────────────────────────────────────


class TestBacklogMove:
    def test_backlog_move_issue(self):
        issue_key = create_test_issue(SEA_PROJECT_KEY)
        try:
            sprint_id, _ = create_test_sprint()
            run_cli("sprint", "move", sprint_id, "--issues", issue_key)

            result = run_cli("backlog", "move", "--issues", issue_key)
            assert result.returncode == 0, f"Backlog move failed: {result.stderr}"
            assert "moved" in (result.stdout + result.stderr).lower()
        finally:
            delete_issue(issue_key)
            delete_sprint(sprint_id)

    def test_backlog_move_multiple_issues(self):
        issue1 = create_test_issue(SEA_PROJECT_KEY)
        issue2 = create_test_issue(SEA_PROJECT_KEY)
        try:
            result = run_cli("backlog", "move", "--issues", issue1, issue2)
            assert result.returncode == 0, f"Backlog move multiple failed: {result.stderr}"
        finally:
            delete_issue(issue1)
            delete_issue(issue2)

    def test_backlog_move_missing_issues(self):
        result = run_cli("backlog", "move")
        assert result.returncode != 0, "Backlog move without --issues should fail"

    def test_backlog_move_nonexistent_issue(self):
        result = run_cli("backlog", "move", "--issues", "SEA-999999")
        assert result.returncode != 0, "Moving nonexistent issue should fail"
