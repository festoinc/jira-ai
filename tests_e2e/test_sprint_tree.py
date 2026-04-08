import json
import re
import time

import pytest

from conftest import EPIC_PROJECT_KEY, run_cli

SEA_BOARD_ID = "69"


def parse_json(result):
    combined = result.stdout.strip()
    if not combined:
        combined = result.stderr.strip()
    return json.loads(combined)


def create_test_sprint(board_id=SEA_BOARD_ID):
    ts = str(int(time.time()))
    name = f"Tree E2E Sprint {ts}"
    result = run_cli(
        "sprint", "create", board_id,
        "--name", name,
        "--goal", f"Test goal {ts}",
        "--start", "2026-04-01",
        "--end", "2026-04-14",
    )
    assert result.returncode == 0, f"Failed to create sprint: {result.stderr}"
    output = result.stdout.strip()
    if not output:
        output = result.stderr.strip()
    data = json.loads(output)
    if "sprint" in data and "id" in data["sprint"]:
        sprint_id = str(data["sprint"]["id"])
    elif "id" in data:
        sprint_id = str(data["id"])
    else:
        match = re.search(r"ID:\s*(\d+)", result.stdout + result.stderr)
        if not match:
            match = re.search(r"\(ID:\s*(\d+)\)", result.stdout + result.stderr)
        assert match, f"Expected sprint ID in output: {output}"
        sprint_id = match.group(1)
    return sprint_id, name


def delete_sprint(sprint_id):
    run_cli("sprint", "delete", sprint_id)


def create_test_issue(project_key=EPIC_PROJECT_KEY):
    ts = str(int(time.time()))
    title = f"Sprint Tree E2E {ts}"
    result = run_cli(
        "issue", "create",
        "--title", title,
        "--project", project_key,
        "--issue-type", "Task",
    )
    assert result.returncode == 0, f"Failed to create issue: {result.stderr}"
    match = re.search(rf"({project_key}-\d+)", result.stdout)
    assert match, f"Expected issue key in output: {result.stdout}"
    return match.group(1)


def find_any_sprint_id(board_id=SEA_BOARD_ID):
    result = run_cli("sprint", "list", board_id)
    if result.returncode != 0:
        pytest.skip(f"Cannot list sprints: {result.stderr}")
    output = result.stdout.strip()
    if not output:
        output = result.stderr.strip()
    try:
        data = json.loads(output)
        if "sprints" in data and len(data["sprints"]) > 0:
            return str(data["sprints"][0]["id"])
    except (json.JSONDecodeError, KeyError, IndexError):
        pass
    match = re.search(r"^\s*(\d+)\s+", result.stdout, re.MULTILINE)
    if match:
        return match.group(1)
    pytest.skip(f"No sprints found on board {board_id}")


class TestSprintTreeBasic:
    def test_tree_returns_valid_json(self):
        sprint_id = find_any_sprint_id()
        result = run_cli("sprint", "tree", sprint_id)
        assert result.returncode == 0, f"sprint tree failed: {result.stderr}"
        data = parse_json(result)
        assert isinstance(data, dict)

    def test_tree_has_required_fields(self):
        sprint_id = find_any_sprint_id()
        result = run_cli("sprint", "tree", sprint_id)
        data = parse_json(result)
        assert "root" in data
        assert "nodes" in data
        assert "edges" in data
        assert "depth" in data
        assert "truncated" in data
        assert "totalNodes" in data

    def test_tree_root_is_sprint_prefixed(self):
        sprint_id = find_any_sprint_id()
        result = run_cli("sprint", "tree", sprint_id)
        data = parse_json(result)
        assert data["root"] == f"sprint-{sprint_id}"

    def test_tree_has_sprint_root_node(self):
        sprint_id = find_any_sprint_id()
        result = run_cli("sprint", "tree", sprint_id)
        data = parse_json(result)
        root_key = f"sprint-{sprint_id}"
        root_nodes = [n for n in data["nodes"] if n["key"] == root_key]
        assert len(root_nodes) >= 1
        root_node = root_nodes[0]
        assert root_node["type"] == "sprint"

    def test_tree_nodes_have_required_fields(self):
        sprint_id = find_any_sprint_id()
        result = run_cli("sprint", "tree", sprint_id)
        data = parse_json(result)
        for node in data["nodes"]:
            assert "key" in node
            assert "summary" in node
            assert "status" in node
            assert "type" in node
            assert "priority" in node

    def test_tree_edges_have_required_fields(self):
        sprint_id = find_any_sprint_id()
        result = run_cli("sprint", "tree", sprint_id)
        data = parse_json(result)
        for edge in data["edges"]:
            assert "from" in edge
            assert "to" in edge
            assert "relation" in edge

    def test_tree_total_nodes_matches(self):
        sprint_id = find_any_sprint_id()
        result = run_cli("sprint", "tree", sprint_id)
        data = parse_json(result)
        assert data["totalNodes"] == len(data["nodes"])

    def test_tree_depth_is_integer(self):
        sprint_id = find_any_sprint_id()
        result = run_cli("sprint", "tree", sprint_id)
        data = parse_json(result)
        assert isinstance(data["depth"], int)

    def test_tree_truncated_is_boolean(self):
        sprint_id = find_any_sprint_id()
        result = run_cli("sprint", "tree", sprint_id)
        data = parse_json(result)
        assert isinstance(data["truncated"], bool)


class TestSprintTreeWithIssues:
    def test_sprint_with_moved_issue(self):
        sprint_id, _ = create_test_sprint()
        issue_key = create_test_issue()
        try:
            run_cli("sprint", "start", sprint_id)
            run_cli("sprint", "move", sprint_id, "--issues", issue_key)
            time.sleep(2)

            result = run_cli("sprint", "tree", sprint_id)
            data = parse_json(result)
            keys = [n["key"] for n in data["nodes"]]
            assert issue_key in keys

            issue_edges = [e for e in data["edges"] if e["to"] == issue_key]
            assert len(issue_edges) >= 1
            assert issue_edges[0]["from"] == f"sprint-{sprint_id}"
            assert issue_edges[0]["relation"] == "hierarchy"
        finally:
            delete_sprint(sprint_id)

    def test_sprint_with_multiple_issues(self):
        sprint_id, _ = create_test_sprint()
        issue1 = create_test_issue()
        issue2 = create_test_issue()
        try:
            run_cli("sprint", "start", sprint_id)
            run_cli("sprint", "move", sprint_id, "--issues", issue1, issue2)
            time.sleep(3)

            result = run_cli("sprint", "tree", sprint_id)
            data = parse_json(result)
            keys = [n["key"] for n in data["nodes"]]
            assert issue1 in keys
            assert issue2 in keys
            assert data["totalNodes"] >= 3
        finally:
            delete_sprint(sprint_id)


class TestSprintTreeDepth:
    def test_depth_1_limits_traversal(self):
        sprint_id = find_any_sprint_id()
        result = run_cli("sprint", "tree", sprint_id, "--depth", "1")
        data = parse_json(result)
        assert isinstance(data["depth"], int)

    def test_depth_3_is_default(self):
        sprint_id = find_any_sprint_id()
        result = run_cli("sprint", "tree", sprint_id, "--depth", "3")
        data = parse_json(result)
        result_default = run_cli("sprint", "tree", sprint_id)
        data_default = parse_json(result_default)
        assert data["depth"] == data_default["depth"]


class TestSprintTreeMaxNodes:
    def test_max_nodes_limits_output(self):
        sprint_id, _ = create_test_sprint()
        issue1 = create_test_issue()
        issue2 = create_test_issue()
        try:
            run_cli("sprint", "start", sprint_id)
            run_cli("sprint", "move", sprint_id, "--issues", issue1)
            run_cli("sprint", "move", sprint_id, "--issues", issue2)
            time.sleep(2)

            result = run_cli("sprint", "tree", sprint_id, "--max-nodes", "1")
            data = parse_json(result)
            issue_nodes = [n for n in data["nodes"] if n["type"] != "sprint"]
            assert len(issue_nodes) <= 1
        finally:
            delete_sprint(sprint_id)

    def test_max_nodes_large_no_truncation(self):
        sprint_id = find_any_sprint_id()
        result = run_cli("sprint", "tree", sprint_id, "--max-nodes", "200")
        assert result.returncode == 0
        data = parse_json(result)
        assert isinstance(data, dict)


class TestSprintTreeCompact:
    def test_compact_single_line_output(self):
        sprint_id = find_any_sprint_id()
        result = run_cli("--compact", "sprint", "tree", sprint_id)
        assert result.returncode == 0, f"compact sprint tree failed: {result.stderr}"
        output = result.stdout.strip()
        lines = [l for l in output.split("\n") if l.strip()]
        assert len(lines) == 1, f"Expected single line, got {len(lines)}: {output}"

    def test_compact_valid_json(self):
        sprint_id = find_any_sprint_id()
        result = run_cli("--compact", "sprint", "tree", sprint_id)
        data = json.loads(result.stdout.strip())
        assert "root" in data
        assert "nodes" in data

    def test_compact_no_pretty_printing(self):
        sprint_id = find_any_sprint_id()
        result = run_cli("--compact", "sprint", "tree", sprint_id)
        output = result.stdout.strip()
        assert "  " not in output
        assert "\n" not in output


class TestSprintTreeHelp:
    def test_help_shows_usage(self):
        result = run_cli("sprint", "tree", "--help")
        assert result.returncode == 0
        assert "sprint-id" in result.stdout or "sprint id" in result.stdout.lower()

    def test_help_shows_flags(self):
        result = run_cli("sprint", "tree", "--help")
        assert result.returncode == 0
        assert "--depth" in result.stdout
        assert "--max-nodes" in result.stdout


class TestSprintTreeErrorHandling:
    def test_invalid_sprint_id(self):
        result = run_cli("sprint", "tree", "999999")
        assert result.returncode != 0
        data = parse_json(result)
        assert data.get("error") is True
        assert "message" in data

    def test_missing_sprint_id(self):
        result = run_cli("sprint", "tree")
        assert result.returncode != 0

    def test_non_numeric_sprint_id(self):
        result = run_cli("sprint", "tree", "abc")
        assert result.returncode != 0


class TestSprintTreeEmptySprint:
    def test_empty_sprint_returns_root_only(self):
        sprint_id, _ = create_test_sprint()
        try:
            result = run_cli("sprint", "tree", sprint_id)
            data = parse_json(result)
            assert data["totalNodes"] == 1
            assert data["nodes"][0]["key"] == f"sprint-{sprint_id}"
            assert data["nodes"][0]["type"] == "sprint"
            assert len(data["edges"]) == 0
        finally:
            delete_sprint(sprint_id)
