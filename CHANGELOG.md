# Changelog

## 0.4.1
- `wi index` escapes `|` in titles, so a pipe in a title no longer breaks the generated tables.

## 0.4.0
- New `/work-items:sprint` (`plan`, `start`, `close`, `status`): optional sprints with a goal, dates and an optional demo, in `sprints/`.
- Items join a sprint with `sprint: S<n>`. `wi next` ranks active-sprint items first; `wi index` lists sprints; `wi validate` checks them; `wi nextid S`.
- `next` and `inbox` print the active sprint on top.
- Sprints are optional: a tracker without `sprints/` is unchanged.

## 0.3.5
- Tracker git from a code-repo worktree session runs as plain `git -C "$WI_ROOT"` commands, one per call, so the session can update the tracker itself.

## 0.3.4
- `wi next` rows show the item's repo. Refined rows end with a copy/paste `make -C <root> implement-<ID>` command.

## 0.3.3
- Makefile: the item ID is case-insensitive and works as `implement-e1-f1`, `implement ID=e1-f1` or `implement e1-f1`.
- `wi validate` fails when an item's `repos:` slug has no row in the WORKFLOW.md Repos table. `init` fills the table in cockpit mode; the tracker rules require a row whenever a new repo slug is used; unattended refine blocks the item instead.
- `upgrade` checks the WORKFLOW.md Repos table and runs `wi repo` for every open item.

## 0.3.2
- New `wi repo <ID> [slug]` prints an item's code repo. Init ships a `Makefile` (`make implement-<ID>`) that starts a background session there.

## 0.3.1
- Orchestrate pipeline ships as plugin workflow `work-items:orchestrate`. Fixes failed inline-script and `scriptPath` calls.

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
