"""
E2E tests for the Issue Attachments feature (JIR-93).

Tests exercise the jira-ai CLI commands:
  - issue attach upload <issue-key> --file <path> [--file <path>]...
  - issue attach list <issue-key>
  - issue attach download <issue-key> --id <attachment-id> [--output <path>]
  - issue attach delete <issue-key> --id <attachment-id>
  - issue get <issue-key> (includes attachments array)

Test credentials are stored in ~/.jira-ai/config.json (never committed).
Run from project root after `npm run build`.

Usage:
    python3 -m pytest tests_e2e/test_attachments.py -v
"""

import json
import os
import re
import subprocess
import tempfile
import time

import pytest

from conftest import (
    REGULAR_PROJECT_KEY,
    run_cli,
)

TEST_ISSUE_KEY = "AT-208"


def parse_json_output(result):
    combined = result.stdout.strip()
    if not combined:
        combined = result.stderr.strip()
    return json.loads(combined)


def _output(result):
    return (result.stdout + "\n" + result.stderr).lower()


def _create_temp_file(content, suffix=".txt"):
    fd, path = tempfile.mkstemp(suffix=suffix)
    with os.fdopen(fd, "w") as f:
        f.write(content)
    return path


def _cleanup_all_attachments(issue_key):
    result = run_cli("issue", "attach", "list", issue_key)
    if result.returncode != 0:
        return
    try:
        attachments = json.loads(result.stdout.strip())
    except (json.JSONDecodeError, ValueError):
        return
    for att in attachments:
        run_cli("issue", "attach", "delete", issue_key, "--id", att["id"])


def _get_attachment_ids(issue_key):
    result = run_cli("issue", "attach", "list", issue_key)
    if result.returncode != 0:
        return []
    try:
        attachments = json.loads(result.stdout.strip())
    except (json.JSONDecodeError, ValueError):
        return []
    return [att["id"] for att in attachments]


@pytest.fixture(autouse=True)
def cleanup_attachments():
    _cleanup_all_attachments(TEST_ISSUE_KEY)
    yield
    _cleanup_all_attachments(TEST_ISSUE_KEY)


# =============================================================================
# 1. Upload single file
# =============================================================================
class TestUploadSingleFile:
    def test_upload_single_file_success(self):
        path = _create_temp_file("hello world attachment test")
        try:
            result = run_cli("issue", "attach", "upload", TEST_ISSUE_KEY, "--file", path)
            assert result.returncode == 0, f"Failed:\nstdout: {result.stdout}\nstderr: {result.stderr}"
            data = parse_json_output(result)
            assert data["success"] is True
            assert data["issueKey"] == TEST_ISSUE_KEY
            assert len(data["attachments"]) == 1
            att = data["attachments"][0]
            assert att["id"]
            assert att["filename"] == os.path.basename(path)
            assert att["size"] > 0
        finally:
            os.unlink(path)

    def test_upload_contains_metadata_fields(self):
        path = _create_temp_file("metadata check content")
        try:
            result = run_cli("issue", "attach", "upload", TEST_ISSUE_KEY, "--file", path)
            assert result.returncode == 0
            att = parse_json_output(result)["attachments"][0]
            assert "id" in att
            assert "filename" in att
            assert "mimeType" in att
            assert "size" in att
            assert "created" in att
            assert "author" in att
            assert "displayName" in att["author"]
        finally:
            os.unlink(path)

    def test_upload_nonexistent_file_fails(self):
        result = run_cli("issue", "attach", "upload", TEST_ISSUE_KEY, "--file", "/tmp/nonexistent_file_xyz_12345.txt")
        assert result.returncode != 0


# =============================================================================
# 2. Upload multiple files
# =============================================================================
class TestUploadMultipleFiles:
    def test_upload_multiple_files_success(self):
        path1 = _create_temp_file("file one content", suffix="_1.txt")
        path2 = _create_temp_file("file two content", suffix="_2.txt")
        try:
            result = run_cli("issue", "attach", "upload", TEST_ISSUE_KEY, "--file", path1, "--file", path2)
            assert result.returncode == 0, f"Failed:\nstdout: {result.stdout}\nstderr: {result.stderr}"
            data = parse_json_output(result)
            assert data["success"] is True
            assert len(data["attachments"]) == 2
            filenames = [att["filename"] for att in data["attachments"]]
            assert os.path.basename(path1) in filenames
            assert os.path.basename(path2) in filenames
        finally:
            os.unlink(path1)
            os.unlink(path2)

    def test_upload_multiple_files_all_have_ids(self):
        path1 = _create_temp_file("multi file one")
        path2 = _create_temp_file("multi file two")
        path3 = _create_temp_file("multi file three")
        try:
            result = run_cli("issue", "attach", "upload", TEST_ISSUE_KEY,
                             "--file", path1, "--file", path2, "--file", path3)
            assert result.returncode == 0
            data = parse_json_output(result)
            for att in data["attachments"]:
                assert att["id"], f"Attachment missing id: {att}"
                assert att["size"] > 0
        finally:
            os.unlink(path1)
            os.unlink(path2)
            os.unlink(path3)


# =============================================================================
# 3. List attachments
# =============================================================================
class TestListAttachments:
    def test_list_empty_returns_empty_array(self):
        result = run_cli("issue", "attach", "list", TEST_ISSUE_KEY)
        assert result.returncode == 0, f"Failed:\nstdout: {result.stdout}\nstderr: {result.stderr}"
        data = json.loads(result.stdout.strip())
        assert isinstance(data, list)
        assert len(data) == 0

    def test_list_after_upload_shows_attachments(self):
        path = _create_temp_file("list test content")
        try:
            run_cli("issue", "attach", "upload", TEST_ISSUE_KEY, "--file", path)
            result = run_cli("issue", "attach", "list", TEST_ISSUE_KEY)
            assert result.returncode == 0
            data = json.loads(result.stdout.strip())
            assert len(data) >= 1
            filenames = [att["filename"] for att in data]
            assert os.path.basename(path) in filenames
        finally:
            os.unlink(path)

    def test_list_attachment_has_required_fields(self):
        path = _create_temp_file("field check content")
        try:
            run_cli("issue", "attach", "upload", TEST_ISSUE_KEY, "--file", path)
            result = run_cli("issue", "attach", "list", TEST_ISSUE_KEY)
            assert result.returncode == 0
            data = json.loads(result.stdout.strip())
            att = data[0]
            assert "id" in att
            assert "filename" in att
            assert "size" in att
            assert "mimeType" in att
            assert "created" in att
            assert "author" in att
        finally:
            os.unlink(path)


# =============================================================================
# 4. Download attachment
# =============================================================================
class TestDownloadAttachment:
    def test_download_by_id_success(self):
        content = "download test content " + str(int(time.time()))
        upload_path = _create_temp_file(content)
        download_path = None
        try:
            upload_result = run_cli("issue", "attach", "upload", TEST_ISSUE_KEY, "--file", upload_path)
            assert upload_result.returncode == 0
            att_id = parse_json_output(upload_result)["attachments"][0]["id"]

            fd, download_path = tempfile.mkstemp(suffix=".txt")
            os.close(fd)

            result = run_cli("issue", "attach", "download", TEST_ISSUE_KEY,
                             "--id", att_id, "--output", download_path)
            assert result.returncode == 0, f"Failed:\nstdout: {result.stdout}\nstderr: {result.stderr}"
            data = parse_json_output(result)
            assert data["success"] is True
            assert data["attachmentId"] == att_id
            assert data["outputPath"] == download_path

            with open(download_path, "r") as f:
                downloaded_content = f.read()
            assert downloaded_content == content
        finally:
            os.unlink(upload_path)
            if download_path and os.path.exists(download_path):
                os.unlink(download_path)

    def test_download_default_output_path(self):
        content = "default path test " + str(int(time.time()))
        upload_path = _create_temp_file(content, suffix="_default.txt")
        try:
            upload_result = run_cli("issue", "attach", "upload", TEST_ISSUE_KEY, "--file", upload_path)
            assert upload_result.returncode == 0
            upload_data = parse_json_output(upload_result)
            att_id = upload_data["attachments"][0]["id"]
            filename = upload_data["attachments"][0]["filename"]

            result = run_cli("issue", "attach", "download", TEST_ISSUE_KEY, "--id", att_id)
            assert result.returncode == 0
            data = parse_json_output(result)
            assert data["success"] is True
            saved_path = data["outputPath"]
            assert os.path.basename(saved_path) == filename

            assert os.path.exists(saved_path)
            with open(saved_path, "r") as f:
                assert f.read() == content
            os.unlink(saved_path)
        finally:
            os.unlink(upload_path)

    def test_download_invalid_id_fails(self):
        result = run_cli("issue", "attach", "download", TEST_ISSUE_KEY, "--id", "99999999")
        assert result.returncode != 0


# =============================================================================
# 5. Delete attachment
# =============================================================================
class TestDeleteAttachment:
    def test_delete_by_id_success(self):
        path = _create_temp_file("delete test content")
        try:
            upload_result = run_cli("issue", "attach", "upload", TEST_ISSUE_KEY, "--file", path)
            assert upload_result.returncode == 0
            att_id = parse_json_output(upload_result)["attachments"][0]["id"]

            result = run_cli("issue", "attach", "delete", TEST_ISSUE_KEY, "--id", att_id)
            assert result.returncode == 0, f"Failed:\nstdout: {result.stdout}\nstderr: {result.stderr}"
            data = parse_json_output(result)
            assert data["success"] is True
            assert data["issueKey"] == TEST_ISSUE_KEY
            assert data["attachmentId"] == att_id
        finally:
            os.unlink(path)

    def test_delete_removes_from_list(self):
        path = _create_temp_file("verify delete removes content")
        try:
            upload_result = run_cli("issue", "attach", "upload", TEST_ISSUE_KEY, "--file", path)
            assert upload_result.returncode == 0
            att_id = parse_json_output(upload_result)["attachments"][0]["id"]

            assert att_id in _get_attachment_ids(TEST_ISSUE_KEY)

            run_cli("issue", "attach", "delete", TEST_ISSUE_KEY, "--id", att_id)

            assert att_id not in _get_attachment_ids(TEST_ISSUE_KEY)
        finally:
            os.unlink(path)

    def test_delete_invalid_id_fails(self):
        result = run_cli("issue", "attach", "delete", TEST_ISSUE_KEY, "--id", "99999999")
        assert result.returncode != 0


# =============================================================================
# 6. issue get includes attachments
# =============================================================================
class TestIssueGetAttachments:
    def test_issue_get_has_attachments_array(self):
        path = _create_temp_file("issue get attachment test")
        try:
            run_cli("issue", "attach", "upload", TEST_ISSUE_KEY, "--file", path)
            result = run_cli("issue", "get", TEST_ISSUE_KEY)
            assert result.returncode == 0, f"Failed:\nstdout: {result.stdout}\nstderr: {result.stderr}"
            data = json.loads(result.stdout.strip())
            assert "attachments" in data
            assert isinstance(data["attachments"], list)
            assert len(data["attachments"]) >= 1
        finally:
            os.unlink(path)

    def test_issue_get_attachment_fields(self):
        path = _create_temp_file("field verify for issue get")
        try:
            upload_result = run_cli("issue", "attach", "upload", TEST_ISSUE_KEY, "--file", path)
            assert upload_result.returncode == 0
            uploaded_filename = parse_json_output(upload_result)["attachments"][0]["filename"]

            result = run_cli("issue", "get", TEST_ISSUE_KEY)
            assert result.returncode == 0
            data = json.loads(result.stdout.strip())
            att = data["attachments"][0]
            assert "id" in att
            assert "filename" in att
            assert att["filename"] == uploaded_filename
            assert "size" in att
            assert "author" in att
            assert "created" in att
        finally:
            os.unlink(path)

    def test_issue_get_attachments_empty_after_delete(self):
        path = _create_temp_file("empty check after delete")
        try:
            upload_result = run_cli("issue", "attach", "upload", TEST_ISSUE_KEY, "--file", path)
            att_id = parse_json_output(upload_result)["attachments"][0]["id"]
            run_cli("issue", "attach", "delete", TEST_ISSUE_KEY, "--id", att_id)

            result = run_cli("issue", "get", TEST_ISSUE_KEY)
            assert result.returncode == 0
            data = json.loads(result.stdout.strip())
            assert data["attachments"] == []
        finally:
            os.unlink(path)
