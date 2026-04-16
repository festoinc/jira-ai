import json
import os
import subprocess
import time
import uuid

import pytest

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CLI_PATH = os.path.join(PROJECT_ROOT, "dist", "cli.js")

TEST_JIRA_URL = os.environ.get("TEST_JIRA_URL", "https://festoinc.atlassian.net")
TEST_JIRA_EMAIL = os.environ.get("TEST_JIRA_EMAIL", "")
TEST_JIRA_TOKEN = os.environ.get("TEST_JIRA_TOKEN", "")

EPIC_PROJECT_KEY = "SEA"
REGULAR_PROJECT_KEY = "AT"

CONFIG_DIR = os.path.join(os.path.expanduser("~"), ".jira-ai")
CONFIG_FILE = os.path.join(CONFIG_DIR, "config.json")


def run_cli(*args, timeout=60):
    cmd = ["node", CLI_PATH] + list(args)
    env = os.environ.copy()
    env["NODE_OPTIONS"] = "--no-warnings"
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=timeout,
        env=env,
    )
    return result


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
    save_test_credentials()
    yield
    save_test_credentials()


@pytest.fixture
def unique_id():
    return uuid.uuid4().hex[:8]


@pytest.fixture
def epic_timestamp():
    return str(int(time.time()))
