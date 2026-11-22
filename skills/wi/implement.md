# /work-items:wi implement <items>... [--autonomous]

Delivery runs through the `work-items:orchestrate` skill. This file covers only the tracker side.

1. **Queue**: the named items, or with `--autonomous` and no items, `wi next`. Order by deps.
2. **Readiness** per item (SKILL.md § Gates):
   - `refined/` or `in-progress/` → ready;
   - XS/S backlog item, not in a sensitive area → auto-refine first (refine.md § Auto-refine) when `--autonomous`, else ask;
   - anything else → `/work-items:wi refine` first. `--autonomous` skips the item and reports it, never asks.
3. **Start**: `git mv refined/<slug>.md in-progress/<slug>.md`, `status: in-progress`, `wi index && wi validate`, commit.
4. **Deliver**: invoke the `work-items:orchestrate` skill (pass `--autonomous` through) with the item path. Pass WORKFLOW.md's sensitive areas in the task text; test commands come from the code repo's CLAUDE.md `## Testing`. orchestrate owns worktree, plan, test-first, verify, push, and PR.
5. **Archive** after orchestrate returns:
   - resolved → stamp `pr:`, tick tasks, write `## Summary of changes` (SKILL.md § Gates), `git mv` to `in-review/`, `status: in-review`;
   - escalated/unresolved → stay in `in-progress/`, `status: blocked` (a decision is needed: `## Blocked` with the question) or `needs-attention` (it failed), `pr:` stamped if a PR exists.
   - Design upkeep as in refine.md step 11. `wi index && wi validate`, commit.
6. Merging: a human, orchestrate Stage 4 with `--autonomous`, or `/work-items:wi merge`. The last two run `/work-items:wi sync` themselves (Stage 4 step 6); after a human merge, run it.
