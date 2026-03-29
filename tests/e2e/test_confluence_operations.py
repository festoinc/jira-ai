import re

import pytest

from conftest import run_cli


class TestConflSpaces:
    def test_confl_spaces(self):
        result = run_cli("confl", "spaces")
        assert result.returncode == 0, f"confl spaces failed: {result.stderr}"
        assert len(result.stdout.strip()) > 0, "Should list spaces"


class TestConflPages:
    def test_confl_pages(self):
        spaces_result = run_cli("confl", "spaces")
        if spaces_result.returncode != 0:
            pytest.skip("Could not list spaces")

        space_key = None
        lines = spaces_result.stdout.split("\n")
        for line in lines:
            if "│" in line and "Key" not in line and "───" not in line:
                parts = [p.strip() for p in line.split("│") if p.strip()]
                if parts:
                    candidate = parts[0]
                    if re.match(r"^[A-Za-z0-9~]+$", candidate) and len(candidate) >= 2:
                        space_key = candidate
                        break

        if not space_key:
            pytest.skip("No space key found")

        result = run_cli("confl", "pages", space_key)
        assert result.returncode == 0, f"confl pages failed: {result.stderr}"


class TestConflGet:
    def test_confl_get_requires_url(self):
        result = run_cli("confl", "get")
        assert result.returncode != 0, "confl get without URL should fail"


class TestConflSearch:
    def test_confl_search(self):
        result = run_cli("confl", "search", "test", "--limit", "5")
        assert result.returncode == 0, f"confl search failed: {result.stderr}"
