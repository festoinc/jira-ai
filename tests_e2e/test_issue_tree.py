import json
import re
import time

import pytest

from conftest import EPIC_PROJECT_KEY, REGULAR_PROJECT_KEY, run_cli

EPIC_KEY = "SEA-37"
CHILD_KEY = "SEA-38"


def parse_json(result):
    combined = result.stdout.strip()
    if not combined:
        combined = result.stderr.strip()
    return json.loads(combined)


def create_test_issue(project_key=REGULAR_PROJECT_KEY):
    ts = str(int(time.time()))
    title = f"Tree E2E Issue {ts}"
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


def cleanup_link(source, target):
    run_cli("issue", "link", "delete", source, "--target", target)


class TestIssueTreeBasic:
    def test_tree_returns_valid_json(self):
        result = run_cli("issue", "tree", EPIC_KEY)
        assert result.returncode == 0, f"issue tree failed: {result.stderr}"
        data = parse_json(result)
        assert isinstance(data, dict)

    def test_tree_has_required_fields(self):
        result = run_cli("issue", "tree", EPIC_KEY)
        data = parse_json(result)
        assert "root" in data
        assert "nodes" in data
        assert "edges" in data
        assert "depth" in data
        assert "truncated" in data
        assert "totalNodes" in data

    def test_tree_root_matches_issue_key(self):
        result = run_cli("issue", "tree", EPIC_KEY)
        data = parse_json(result)
        assert data["root"] == EPIC_KEY

    def test_tree_root_node_present(self):
        result = run_cli("issue", "tree", EPIC_KEY)
        data = parse_json(result)
        keys = [n["key"] for n in data["nodes"]]
        assert EPIC_KEY in keys

    def test_tree_nodes_have_required_fields(self):
        result = run_cli("issue", "tree", EPIC_KEY)
        data = parse_json(result)
        for node in data["nodes"]:
            assert "key" in node
            assert "summary" in node
            assert "status" in node
            assert "type" in node
            assert "priority" in node

    def test_tree_edges_have_required_fields(self):
        result = run_cli("issue", "tree", EPIC_KEY)
        data = parse_json(result)
        for edge in data["edges"]:
            assert "from" in edge
            assert "to" in edge
            assert "relation" in edge

    def test_tree_shows_child_hierarchy(self):
        result = run_cli("issue", "tree", EPIC_KEY)
        data = parse_json(result)
        keys = [n["key"] for n in data["nodes"]]
        assert CHILD_KEY in keys
        parent_edges = [e for e in data["edges"] if e["to"] == CHILD_KEY]
        assert len(parent_edges) >= 1
        assert parent_edges[0]["from"] == EPIC_KEY

    def test_tree_total_nodes_matches(self):
        result = run_cli("issue", "tree", EPIC_KEY)
        data = parse_json(result)
        assert data["totalNodes"] == len(data["nodes"])

    def test_tree_depth_is_integer(self):
        result = run_cli("issue", "tree", EPIC_KEY)
        data = parse_json(result)
        assert isinstance(data["depth"], int)

    def test_tree_truncated_is_boolean(self):
        result = run_cli("issue", "tree", EPIC_KEY)
        data = parse_json(result)
        assert isinstance(data["truncated"], bool)


class TestIssueTreeDepth:
    def test_depth_1_limits_traversal(self):
        result = run_cli("issue", "tree", EPIC_KEY, "--depth", "1")
        data = parse_json(result)
        assert isinstance(data["depth"], int)

    def test_depth_3_is_default(self):
        result = run_cli("issue", "tree", EPIC_KEY, "--depth", "3")
        data = parse_json(result)
        result_default = run_cli("issue", "tree", EPIC_KEY)
        data_default = parse_json(result_default)
        assert data["depth"] == data_default["depth"]

    def test_depth_0_returns_root_only(self):
        result = run_cli("issue", "tree", EPIC_KEY, "--depth", "0")
        data = parse_json(result)
        assert isinstance(data["nodes"], list)
        assert any(n["key"] == EPIC_KEY for n in data["nodes"])


class TestIssueTreeMaxNodes:
    def test_max_nodes_limits_output(self):
        result = run_cli("issue", "tree", EPIC_KEY, "--max-nodes", "1")
        data = parse_json(result)
        assert data["totalNodes"] <= 1
        assert data["truncated"] is True

    def test_max_nodes_large_no_truncation(self):
        result = run_cli("issue", "tree", EPIC_KEY, "--max-nodes", "200")
        data = parse_json(result)
        assert data["truncated"] is False

    def test_max_nodes_default_200(self):
        result_explicit = run_cli("issue", "tree", EPIC_KEY, "--max-nodes", "200")
        result_default = run_cli("issue", "tree", EPIC_KEY)
        data_explicit = parse_json(result_explicit)
        data_default = parse_json(result_default)
        assert data_explicit["totalNodes"] == data_default["totalNodes"]


class TestIssueTreeLinks:
    def test_links_flag_includes_linked_issues(self):
        issue_a = create_test_issue()
        issue_b = create_test_issue()
        try:
            run_cli("issue", "link", "create", issue_a, "Relates", issue_b)

            result = run_cli("issue", "tree", issue_a, "--links")
            data = parse_json(result)
            keys = [n["key"] for n in data["nodes"]]
            assert issue_b in keys

            link_edges = [e for e in data["edges"] if e["to"] == issue_b]
            assert len(link_edges) >= 1
            assert link_edges[0]["relation"] == "Relates"
        finally:
            cleanup_link(issue_a, issue_b)

    def test_links_without_flag_excludes_linked(self):
        issue_a = create_test_issue()
        issue_b = create_test_issue()
        try:
            run_cli("issue", "link", "create", issue_a, "Relates", issue_b)

            result = run_cli("issue", "tree", issue_a)
            data = parse_json(result)
            keys = [n["key"] for n in data["nodes"]]
            assert issue_b not in keys
        finally:
            cleanup_link(issue_a, issue_b)


class TestIssueTreeTypes:
    def test_types_filter_blocks(self):
        issue_a = create_test_issue()
        issue_b = create_test_issue()
        try:
            run_cli("issue", "link", "create", issue_a, "Blocks", issue_b)
            run_cli("issue", "link", "create", issue_a, "Relates", issue_b)

            result = run_cli("issue", "tree", issue_a, "--links", "--types", "Blocks")
            data = parse_json(result)
            link_edges = [e for e in data["edges"] if e["to"] == issue_b]
            assert len(link_edges) >= 1
            assert all(e["relation"] == "Blocks" for e in link_edges)
        finally:
            cleanup_link(issue_a, issue_b)

    def test_types_filter_requires_links(self):
        result = run_cli("issue", "tree", EPIC_KEY, "--types", "Blocks")
        assert result.returncode == 0


class TestIssueTreeCompact:
    def test_compact_single_line_output(self):
        result = run_cli("--compact", "issue", "tree", EPIC_KEY)
        assert result.returncode == 0, f"compact tree failed: {result.stderr}"
        output = result.stdout.strip()
        lines = [l for l in output.split("\n") if l.strip()]
        assert len(lines) == 1, f"Expected single line, got {len(lines)}: {output}"

    def test_compact_valid_json(self):
        result = run_cli("--compact", "issue", "tree", EPIC_KEY)
        data = json.loads(result.stdout.strip())
        assert "root" in data
        assert "nodes" in data

    def test_compact_no_pretty_printing(self):
        result = run_cli("--compact", "issue", "tree", EPIC_KEY)
        output = result.stdout.strip()
        assert "  " not in output
        assert "\n" not in output


class TestIssueTreeHelp:
    def test_help_shows_usage(self):
        result = run_cli("issue", "tree", "--help")
        assert result.returncode == 0
        assert "issue-key" in result.stdout or "issue key" in result.stdout.lower()

    def test_help_shows_flags(self):
        result = run_cli("issue", "tree", "--help")
        assert result.returncode == 0
        assert "--links" in result.stdout
        assert "--depth" in result.stdout
        assert "--max-nodes" in result.stdout
        assert "--types" in result.stdout


class TestIssueTreeErrorHandling:
    def test_invalid_issue_key(self):
        result = run_cli("issue", "tree", "INVALID-999999")
        assert result.returncode != 0
        data = parse_json(result)
        assert data.get("error") is True
        assert "message" in data

    def test_nonexistent_issue(self):
        result = run_cli("issue", "tree", f"{EPIC_PROJECT_KEY}-999999")
        assert result.returncode != 0

    def test_missing_issue_key(self):
        result = run_cli("issue", "tree")
        assert result.returncode != 0
