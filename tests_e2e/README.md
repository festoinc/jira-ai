# E2E Tests

End-to-end tests that run against a live Jira instance via the `jira-ai` CLI.

## Prerequisites

- Node.js >= 18
- Python 3 with `pytest` installed (`pip install pytest`)
- A built CLI: `npm run build` from the repo root

## Setup

Export your Jira test credentials as environment variables:

```bash
export TEST_JIRA_URL="https://your-instance.atlassian.net"
export TEST_JIRA_EMAIL="your-email@example.com"
export TEST_JIRA_TOKEN="your-api-token"
```

**Never commit credentials.** The test fixtures in `conftest.py` read from env vars and write a temporary config to `~/.jira-ai/config.json` (mode 600) during the test run.

## Running Tests

Run all e2e tests:

```bash
cd tests_e2e
pytest -v
```

Run a specific test file:

```bash
pytest -v test_issue_tree.py
pytest -v test_sprint_tree.py
```

Run a single test:

```bash
pytest -v test_issue_tree.py::TestIssueTreeBasic::test_tree_returns_valid_json
```

## Test Files

| File | Description |
|------|-------------|
| `test_issue_tree.py` | Issue hierarchy tree (`issue tree <KEY>`) |
| `test_sprint_tree.py` | Sprint hierarchy tree (`sprint tree <ID>`) |
| `test_transitions.py` | Issue transition commands |
| `test_epic_operations.py` | Epic CRUD operations |
| `test_issue_linking.py` | Issue link create/delete |
| `test_json_flag.py` | JSON output mode |
| `test_board_sprint_backlog.py` | Board, sprint, and backlog operations |
| `test_attachments.py` | Attachment upload/download/delete |
| `test_saved_queries.py` | Saved JQL queries |
| `test_rich_issue_create_update.py` | Issue create/update with rich fields |

## .gitignore

Credentials files are excluded:

```
tests_e2e/*.env
```

The root `.gitignore` also excludes `.env`, `.env.*`, and `__pycache__/`.
