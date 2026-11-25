---
name: sprint
description: Plan, start, close or check an optional sprint (a time-boxed goal over refined items).
argument-hint: "[plan [S<n>] | start [S<n>] | close | status [S<n>]]"
disable-model-invocation: true
allowed-tools: Read, Edit, Write, Glob, Grep, Bash, AskUserQuestion
---

# /work-items:sprint

Read `${CLAUDE_PLUGIN_ROOT}/reference/tracker.md` first.

Sprints are optional. Membership is the item's `sprint: S<n>` frontmatter. Edit only `sprints/` and that field.

- **`plan`** (new sprint):
  1. ID = `wi nextid S`. Create `sprints/` if missing.
  2. Ask: goal (required, one sentence: the value delivered at the end), start (default today), end (default start + 2 weeks), optional demo steps (numbered, each with an expected observable result).
  3. Write `sprints/S<n>-<slug>.md` from the template below. Omit `## Demo` when none given.
  4. Pick items: set `sprint: S<n>` in their frontmatter. An item is in at most one sprint; if it is in another open sprint, ask.
  5. `wi index && wi validate`, then commit per the tracker-commit policy.
- **`plan S<n>`**: edit that sprint the same way, only if it is `planned`. Remove `sprint:` from an item to unpick it.
- **`start [S<n>]`**: gate, report every failure and stop:
  - Goal is set.
  - No other sprint is `active`.
  - Every item with this `sprint:` is in `refined/` with `status: refined` (not `draft`, not `blocked`).

  Else set `status: active`, `wi index && wi validate`, commit.
- **`close`**: on the active sprint.
  1. Set `status: review`.
  2. For each item of the sprint not in `completed/`, ask (AskUserQuestion): move to another sprint (`sprint: S<m>`, an existing `planned` sprint or plan a new one) or no sprint (remove the field). Refuse to close while any is unanswered.
  3. Write `## Review`: goal met yes/no, each `## Demo` step shown / not shown (if a Demo exists; never a gate), carried items and where they went, notes.
  4. Set `status: closed`. Completed and dropped items keep `sprint:` as history.
  5. `wi index && wi validate`, commit.
- **`status [S<n>]`**: read-only. The active sprint (or the one given): goal, days left until `end` (past `end`: `overdue <d> days`), items by status, blocked items. No active sprint → say so.

Template:

```markdown
---
id: S1
title: <title>
status: planned
start: YYYY-MM-DD
end: YYYY-MM-DD
---
# S1 — <title>

## Goal
<one sentence>

## Demo
1. <step> → <expected result>

## Items
<!-- wi:items -->
<!-- /wi:items -->
```
