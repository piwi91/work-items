---
name: next
description: Show the top 10 items to work on next. Read-only.
argument-hint: "[--auto]"
allowed-tools: Read, Bash
---

# /work-items:next

Read `${CLAUDE_PLUGIN_ROOT}/reference/tracker.md` first.

Run `wi next` (with `--auto` if given), render the top 10 as a markdown table: ID, state, P, type, size, repo, title, start. `start` is the row's `make ...` command in backticks, empty when the row has none. If a sprint in `sprints/` has `status: active`, print one line above the table: `Sprint S<n> — <title>: <goal> (<d> days left; past `end`: `overdue <d> days`)`. No `sprints/` or no active sprint → nothing extra. No edits.
