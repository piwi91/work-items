---
name: auto
description: Autonomous loop. Syncs, merges, refines and builds items until the queue is empty or a stop rule hits. Never asks the user.
argument-hint: "[--max N] [--hours H]"
disable-model-invocation: true
allowed-tools: Read, Edit, Write, Glob, Grep, Bash, Agent, Skill, ScheduleWakeup, PushNotification
---

# /work-items:auto [--max N] [--hours H]

Read `${CLAUDE_PLUGIN_ROOT}/reference/tracker.md` first.

Never asks the user. Each pass reads state from git, nothing from memory.

## Pass
1. `/work-items:sync`, then `/work-items:merge --all`.
2. `q = wi next --auto`. Rows: `<action> <ID> <state> <P> <type> <size> <title>`. Take the top row.

| Action | Item | Do |
|---|---|---|
| `build` | refined | step 3 |
| `refine` | XS/S backlog | refine chain (refine SKILL.md § Refine chain), then build if it came out `refined` |
| `draft` | M+ backlog | refine chain; the result waits as `draft` |

3. `build` → `/work-items:implement <item> --autonomous`. Orchestrate auto-merges when the Stage 4 gate passes; merged dependencies unlock dependents for the next pass.
4. Record the outcome. Next pass.

## Queue empty
- PRs still waiting on CI or merge → `ScheduleWakeup` 1800s with a self-contained prompt (`/work-items:auto` and the remaining `--max`/`--hours`); next pass on wake.
- Nothing pending → stop.

## Stop rules
- `--max` items (default 5) or `--hours` reached.
- 2 failures in a row (circuit breaker: likely broken main or CI, not the items).
- Post-merge check red on main → stop at once.

Never loosen a gate. A failed gate parks the item, as in orchestrate.

## End
One line per item: `merged` / `in-review` / `draft` / `blocked` / `parked`. Then the output of `wi inbox`. If a `PushNotification` tool is available, send one short line.
