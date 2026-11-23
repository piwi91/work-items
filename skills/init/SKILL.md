---
name: init
description: Create a work-item tracker from the skeleton.
disable-model-invocation: true
allowed-tools: Read, Edit, Write, Glob, Grep, Bash, Agent, AskUserQuestion, Skill
---

# /work-items:init

Read `${CLAUDE_PLUGIN_ROOT}/reference/tracker.md` first.

Copy `${CLAUDE_SKILL_DIR}/skeleton/` into the tracker root, never overwriting an existing file. Set `wi-version` in WORKFLOW.md to the `version` in `${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json`.

Ask: in-repo or cockpit, commit policy, worktree yes/no. Offer to add to the project's CLAUDE.md the line `Work items: tracked in work-items/ with /work-items:* commands (see work-items/WORKFLOW.md).` and, when missing, `## Testing` (tiers, commands, paths, gotchas) and `## Docs` (doc locations, changelog, agent guidance) filled from the repo.

Cockpit: for each code repo ask slug, path, repos it reaches downstream, release (`tag` or `-`), and write the rows into the WORKFLOW.md Repos table. In-repo: leave the table empty, that is fine.

Run `wi index`, `wi validate`, commit.
