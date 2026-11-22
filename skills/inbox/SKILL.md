---
name: inbox
description: List what needs a human, sorted by how much work each item holds up. Read-only.
allowed-tools: Read, Bash
---

# /work-items:inbox

Read `${CLAUDE_PLUGIN_ROOT}/reference/tracker.md` first.

Run `wi inbox`, print it. No edits.

Rows: `<kind> <id> <state-dir> holds=<n> <title>`.

| Kind | Item |
|---|---|
| `decision` | `blocked` |
| `failed` | `needs-attention` |
| `approve` | `draft` |
| `refine` | backlog with `auto: no` |

Sorted by how many open items each holds up. `/work-items:unblock` works through it top-down.
