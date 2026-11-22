# /wi merge [pr-url|item ...] | --all

Merge ready PRs, from any run. Never asks the user mid-run; parks instead.

1. **Queue**: the named PRs/items, or with `--all` every open PR labelled `ready-to-merge` in the WORKFLOW.md repos (in-repo mode: this repo) whose item sits in `in-review/`. A PR without a tracked item: skip, report. Order: dependency PRs first (`Depends on:` line, item `depends_on`), stacks bottom-up.
2. **Gate** per PR: orchestrate Stage 4 gate, with no run object, so line 1 → label `ready-to-merge`, no `needs-attention`, and a `Verified-sha:` line in the PR body; line 2 → that sha equals `headRefOid`. Lines 3-5 unchanged.
3. **Steps**: orchestrate Stage 4 steps 1, 3-8, except:
   - Step 2 (CI red) → park, no repair (repair needs the run). Tell the user to rerun `/wi implement <item> --autonomous`.
   - Step 3 (base moved) → after the mechanical merge, dispatch `verify` on the branch worktree. Green → push, replace the `Verified-sha:` line with the new head, back to the gate. Red → park.
4. **Release**, only when that repo's `release` column in WORKFLOW.md `## Repos` is `tag`, after the post-merge check is green: next semver from the latest `v*` tag; minor if any item merged this run for that repo is `type: F`, else patch. `git tag v<x.y.z> <merge-sha> && git push origin v<x.y.z>`. One tag per repo per run, after its last merge. Post-merge check red → no tag, report.
5. **Park** as Stage 4 P. **Report** one line per PR: `merged <sha>` / `parked <reason>` / `skipped <reason>`, plus tags cut.

**Authorization**: this verb is the user's standing authorization to merge the queued PRs and push release tags. Nothing else: never push a default branch, never force-push.
