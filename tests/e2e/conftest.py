import json
import os
import subprocess
import tempfile
import time
import uuid

import pytest

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CLI_PATH = os.path.join(PROJECT_ROOT, "dist", "cli.js")

TEST_JIRA_URL = os.environ.get("JIRA_HOST", "https://festoinc.atlassian.net")
TEST_JIRA_EMAIL = os.environ.get("JIRA_USER_EMAIL")
TEST_JIRA_TOKEN = os.environ.get("JIRA_API_TOKEN")

CONFIG_DIR = os.path.join(os.path.expanduser("~"), ".jira-ai")
CONFIG_FILE = os.path.join(CONFIG_DIR, "config.json")


def run_cli(*args, input_text=None, timeout=60):
    cmd = ["node", CLI_PATH] + list(args)
    env = os.environ.copy()
    env["NODE_OPTIONS"] = "--no-warnings"
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=timeout,
        env=env,
        input=input_text,
    )
    return result


def run_cli_json(*args, timeout=60):
    result = run_cli(*args, timeout=timeout)
    if result.returncode != 0:
        return {"_error": True, "stderr": result.stderr, "stdout": result.stdout}
    return {"_error": False, "stdout": result.stdout, "stderr": result.stderr}


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
    if not TEST_JIRA_EMAIL or not TEST_JIRA_TOKEN:
        pytest.skip("JIRA_USER_EMAIL and JIRA_API_TOKEN env vars required for e2e tests")
    save_test_credentials()
    yield
    save_test_credentials()


@pytest.fixture
def unique_id():
    return uuid.uuid4().hex[:8]
