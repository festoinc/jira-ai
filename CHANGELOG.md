# Changelog

## [Unreleased]

### Added

- **Activity Feed & Change Tracking** — New `issue activity` and `issue comments` commands for monitoring issue changes.
  - `issue activity <issue-key>` — Unified activity feed combining changelog entries and comments, sorted by most recent first. Supports `--since`, `--limit`, `--types`, `--author`, and `--compact` flags.
  - `issue comments <issue-key>` — Paginated comment listing with `--limit`, `--since`, and `--reverse` flags.
  - Activity types: `status_change`, `field_change`, `comment_added`, `comment_updated`, `attachment_added`, `attachment_removed`, `link_added`, `link_removed`.
