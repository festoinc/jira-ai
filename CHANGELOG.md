# Changelog

## [Unreleased]

### Added

- **Activity Feed & Change Tracking** — New `issue activity` and `issue comments` commands for monitoring issue changes.
  - `issue activity <issue-key>` — Unified activity feed combining changelog entries and comments, sorted by most recent first. Supports `--since`, `--limit`, `--types`, `--author`, and `--compact` flags.
  - `issue comments <issue-key>` — Paginated comment listing with `--limit`, `--since`, and `--reverse` flags.
  - Activity types: `status_change`, `field_change`, `comment_added`, `comment_updated`, `attachment_added`, `attachment_removed`, `link_added`, `link_removed`.

- **Worklog Management** — Full CRUD for issue worklogs with estimate adjustment support.
  - `issue worklog list <issue-id>` — List worklogs with `--started-after`, `--started-before`, and `--author-account-id` filters.
  - `issue worklog add <issue-id>` — Log time with `--time <duration>` (Jira format: `1h`, `30m`, `1d2h30m`, `1w`), `--comment`, `--started`, and estimate adjustment (`--adjust-estimate auto|new|leave|manual`).
  - `issue worklog update <issue-id>` — Update an existing worklog's time, comment, or start time. Requires `--id <worklog-id>`.
  - `issue worklog delete <issue-id>` — Delete a worklog entry. Requires `--id <worklog-id>`.
  - Dry-run support for `add`, `update`, and `delete` subcommands.

- **Timezone Normalization** — ISO 8601 timestamps in the `--started` flag are automatically normalized to Jira's required format. Supports `Z` suffix, colon-separated offsets (`+03:00`), and ensures milliseconds are always present.
