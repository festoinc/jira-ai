# Changelog

## [Unreleased]

## [1.7.1] - 2026-04-16

### Documentation

- Extended presets documentation with `--reset`, `--apply`, `--validate`, and `view-current-settings` command details (JIR-182).
- Updated README and SKILL.md with comprehensive preset configuration documentation including usage examples (JIR-181, step 11).

## [1.7.0] - 2026-04-16

### Added

- **Configuration Presets** — Predefined permission presets for quick setup without manual `settings.yaml` editing.
  - `settings --preset <name>` — Apply a preset (`read-only`, `standard`, `my-tasks`, `yolo`).
  - `settings --list-presets` — List all available presets with full configuration details.
  - `settings --detect-preset` — Detect which preset matches current settings, with closest-match suggestions for custom configurations.
  - `read-only` — Read-only access to issues, projects, users, Confluence, epics, boards, and sprints.
  - `standard` — Common productive actions (CRUD, transitions, comments, labels, links, attachments, worklogs) without destructive operations.
  - `my-tasks` — Full command access with a `globalParticipationFilter` restricting issue visibility to those where the user participated (assignee, reporter, commenter, or watcher).
  - `yolo` — Unrestricted access across all commands, projects, and Confluence spaces.

## [1.6.0] - 2026-04-16

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
