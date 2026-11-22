# /work-items:wi upgrade [--dry-run]

Bring an existing tracker up to this plugin version. Never edit an item body except through a listed migration.

1. **Root**: find the tracker root as `wi` does. Read `wi-version:` from WORKFLOW.md; absent → `0.1.0` (copied, pre-plugin layout).
2. **Target**: `version` in `${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json`. Equal → print "up to date", stop.
3. **Plan**: every migration below whose `from` is ≥ the tracker version, in order, plus:
   - Skeleton files from `${CLAUDE_SKILL_DIR}/skeleton/` that are missing. Never overwrite.
   - WORKFLOW.md sections present in the skeleton but missing in the tracker: append the section with its placeholder. Keep existing values.
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
| 0.1.0 | 0.2.0 | CLAUDE.md points at the old skill path | Replace lines mentioning `.claude/skills/wi/SKILL.md` so they point to `/work-items:wi`. |
