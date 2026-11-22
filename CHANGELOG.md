# Changelog

## 0.3.0
- Breaking: one command per verb (`/work-items:<verb>`). `/work-items:wi` is removed. `upgrade` migrates the project's CLAUDE.md.
- New: `auto` (unattended loop), `inbox`, `draft` status, `auto: no` field, `refiner` agent (opus, all sizes).
- `fable-refiner` now only resolves open decisions.
- Shared rules moved to `reference/tracker.md`.

## 0.2.2
- Install docs point to the GitHub marketplace piwi91/work-items.

## 0.2.1
- Added MIT licence and author.
- Shorter README.
- CLAUDE.md folded into USAGE.md (`## Develop`).

## 0.2.0
- Packaged as a Claude Code plugin and marketplace (`work-items`).
- `wi` is on PATH via `bin/`.
- Agents are scoped: `work-items:<name>`.
- New verb `upgrade` with a migrations table.
- Generated `INDEX.md` and design item tables (`<!-- wi:items -->`).
- New verb `merge`.

## 0.1.0
- Framework copied into each project (`.claude/skills`, `.claude/agents`).
