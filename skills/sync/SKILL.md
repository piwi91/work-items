---
name: sync
description: Make the tracker match PR state, moving merged items to completed.
disable-model-invocation: true
allowed-tools: Read, Edit, Write, Glob, Grep, Bash, Agent, AskUserQuestion, Skill
---

# /work-items:sync

Read `${CLAUDE_PLUGIN_ROOT}/reference/tracker.md` first.

Make the tracker match the PR state. Bookkeeping only: never merge, close, deploy, or test.

1. Default branch, clean tree, `git pull --rebase`.
2. Collect items with `pr:` in `refined/`, `in-progress/`, `in-review/`. Dropped items are ignored.
3. Per PR (`gh pr view <url> --json state,mergedAt`; no `gh` → GitHub MCP; unreadable → report "unverifiable", don't guess):
   - **merged** → `git mv` to `completed/`, `status: completed`, `completed_at: <merge date>`. Update `## Summary of changes` (tracker.md § Gates): add a `Completed <merge date>, <merge commit>` line plus anything that changed after review (PR commits after the move to in-review). No summary yet → write it from the PR body and diff. If the item has a `design:` doc and every item pointing to it is completed, set the design `status: implemented`. A multi-repo item moves only when every PR merged.
   - **closed unmerged** → `status: needs-attention` + `## Needs attention (date)`: reopen or `backlog drop`. Leave it where it is.
   - **open** → no change.
4. `wi index && wi validate`, then one commit: `sync: reconcile <n> item(s)`.
5. Report the table `item | PR | state | action`.
