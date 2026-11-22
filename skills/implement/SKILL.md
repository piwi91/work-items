---
name: implement
description: Build refined items through the orchestrate pipeline; tracker side.
argument-hint: "<item>... [--autonomous]"
disable-model-invocation: true
allowed-tools: Read, Edit, Write, Glob, Grep, Bash, Agent, AskUserQuestion, Skill
---

# /work-items:implement <items>... [--autonomous]

Read `${CLAUDE_PLUGIN_ROOT}/reference/tracker.md` first.

Delivery runs through the `work-items:orchestrate` skill. This file covers only the tracker side.

1. **Queue**: the named items, or with `--autonomous` and no items, `wi next --auto` (rows start with the action: build/refine/draft). Order by deps.
2. **Readiness** per item (tracker.md § Gates):
   - `refined/` with `status: refined`, or `in-progress/` → ready;
   - backlog item → with `--autonomous`, run the refine chain (refine SKILL.md § Refine chain) and build only if it came out `refined`; otherwise ask, or `/work-items:refine`;
   - `draft`, `blocked` or anything else → `--autonomous` skips the item and reports it, never asks; else `/work-items:unblock` or `/work-items:refine`.
3. **Start**: `git mv refined/<slug>.md in-progress/<slug>.md`, `status: in-progress`, `wi index && wi validate`, commit.
4. **Deliver**: invoke the `work-items:orchestrate` skill (pass `--autonomous` through) with the item path. Pass WORKFLOW.md's sensitive areas in the task text; test commands come from the code repo's CLAUDE.md `## Testing`. orchestrate owns worktree, plan, test-first, verify, push, and PR.
5. **Archive** after orchestrate returns:
   - resolved → stamp `pr:`, tick tasks, write `## Summary of changes` (tracker.md § Gates), `git mv` to `in-review/`, `status: in-review`;
   - escalated/unresolved → stay in `in-progress/`, `status: blocked` (a decision is needed: `## Blocked` with the question) or `needs-attention` (it failed), `pr:` stamped if a PR exists.
   - Design upkeep as in refine step 11. `wi index && wi validate`, commit.
6. Merging: a human, orchestrate Stage 4 with `--autonomous`, or `/work-items:merge`. The last two run `/work-items:sync` themselves (Stage 4 step 6); after a human merge, run it.
