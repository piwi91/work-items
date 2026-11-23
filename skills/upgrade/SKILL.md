---
name: upgrade
description: Bring an existing tracker up to this plugin version.
argument-hint: "[--dry-run]"
disable-model-invocation: true
allowed-tools: Read, Edit, Write, Glob, Grep, Bash, Agent, AskUserQuestion, Skill
---

# /work-items:upgrade [--dry-run]

Read `${CLAUDE_PLUGIN_ROOT}/reference/tracker.md` first.

Bring an existing tracker up to this plugin version. Never edit an item body except through a listed migration.

1. **Root**: find the tracker root as `wi` does. Read `wi-version:` from WORKFLOW.md; absent → `0.1.0` (copied, pre-plugin layout).
2. **Target**: `version` in `${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json`. Equal → print "up to date", stop.
3. **Plan**: every migration below whose `from` is ≥ the tracker version (`0.2.x` matches any 0.2.* version), in order, plus:
   - Skeleton files from `${CLAUDE_PLUGIN_ROOT}/skills/init/skeleton/` that are missing. Never overwrite, except where a migration below says so.
   - WORKFLOW.md sections present in the skeleton but missing in the tracker: append the section with its placeholder. Keep existing values.
   - WORKFLOW.md `## Repos` section: missing → append the skeleton section. Header's first two columns must be `slug`, `path` → otherwise propose the fix and ask. In-repo mode needs no rows.
   - For every open item run `wi repo <ID>` (and per slug in its `repos:`). List each failure with its reason (no row, path not a directory, no `repos:` in cockpit mode). Ask the user for the missing path(s); never guess.
   - `wi-version:` set to the target.
   - A project override the user wrote (`.claude/orchestrate/SKILL.md`, agents not named below): keep it, report it.
4. `--dry-run`: print the plan, stop. Otherwise print the plan, ask once (`AskUserQuestion`: apply / cancel), then apply, run `wi index`, `wi validate`, and make one commit `wi: upgrade tracker <old> → <new>` with explicit pathspecs.
   - Deleting under `.claude/` may be refused (sandbox): `git rm --cached` those paths, commit, and tell the user the exact `rm -rf` to run.
5. **Report**: table `change | path | result`.

## Migrations
| from | to | change | how |
|---|---|---|---|
| 0.1.0 | 0.2.0 | Framework no longer copied into the tracker | `git rm` tracked `.claude/skills/wi` and `.claude/skills/orchestrate`. From `.claude/agents/` remove only files named `architect classify commit-sweep doc-implementer fable-refiner plan requirements-check researcher security-review tdd-implementer understand verify` (`.md`); list any other file and leave it. |
| 0.1.0 | 0.2.0 | Designs get generated item tables | In each `design/*.md` with a `## Work items` section: keep the heading, replace the hand-written table body with the line pair `<!-- wi:items -->` / `<!-- /wi:items -->`. No such section: append `## Work items` with the pair. |
| 0.1.0 | 0.2.0 | INDEX.md is generated | `wi index` creates it. |
| 0.1.0 | 0.2.0 | CLAUDE.md points at the old skill path | Replace lines mentioning `.claude/skills/wi/SKILL.md` so they point to `/work-items:init`. |
| 0.2.x | 0.3.0 | One command per verb; `/work-items:wi` removed | In the project's CLAUDE.md replace each `/work-items:wi <verb>` with `/work-items:<verb>`, and a bare `/work-items:wi` with `/work-items:next`. `wi-version` to `0.3.0`. |
| 0.3.2 | 0.3.3 | Makefile takes IDs in any case | Replace the tracker's `Makefile` with the skeleton one (explicit exception to "never overwrite"). If it differs from the shipped 0.3.2 Makefile, show the diff and ask before replacing. |
