---
name: orchestrate
description: Run tasks or tracked work items through a fixed pipeline. Preflight in the session (readiness gate, open questions answered up front), a scoping Workflow call (Classify, Understand, Plan, no worktree), a branch per repo cluster, then one background Workflow per cluster that runs each unit as implement, validate, security review (conditional), with retry then escalation, one full-suite Verify, and a commit sweep. Postflight pushes, opens PRs and updates the tracker. Never reports a false pass. With `--autonomous` it never asks the user and merges when the Stage 4 gate passes. Use when asked to orchestrate a task, or by `/wi implement`.
---

# Orchestrator

## Stage 0 — Project override
If the target repo has `.claude/orchestrate/SKILL.md`, read it and follow it instead of this file.

This repo ships this skill. A personal copy at `~/.claude/skills/orchestrate` (or `~/.claude/skills/wi`) shadows the project copy. Remove the personal copy.

| Stage | Where | Why there |
|---|---|---|
| Preflight | this session | only place that can ask the user, and knows how many worktrees are needed |
| Pipeline | `${CLAUDE_SKILL_DIR}/workflow.js`, scoping then execution, background `Workflow` calls | scoping needs no worktree; execution is per repo cluster and keeps diffs out of this context |
| Postflight | this session | pushing and opening a PR is outward-facing |
| Merge | this session, `--autonomous` only | a gate checked by command |

This skill does not replace a project's own delivery loop. It is a generic path that can be pointed at tracker items.

## Stage 1 — Preflight

### 1-pre. Ground every repo on its remote tip
`git -C <repo> fetch origin` for every repo in scope (code repos and tracker) and check how far each is behind `origin/<default>`. Do this first.
- Behind, area untouched: say so in one line and continue. Cut worktrees from `origin/main`, never a stale `HEAD`.
- Behind, area touched: re-read the item's evidence against the remote tip. It may already be fixed.
- Local commits not on the remote, or a dirty tree: surface both. Uncommitted work is the user's to resolve; never stash it.

Never diagnose a repo-wide failure from a stale checkout.

### 1a. Mode
Work-item mode when a directory in scope is a tracker (state dirs `backlog/ refined/ in-progress/ in-review/ completed/`). Items resolve from there, readiness is gated, the tracker is updated in postflight. Otherwise generic mode: the prose is the task, no gate, no tracker bookkeeping.

### 1a-bis. `--autonomous`
Never call `AskUserQuestion`. Each ask below takes its default, written into the PR body under **Assumptions**.

| Where | Default |
|---|---|
| 1b item `blocked`, or `depends_on` not merged | skip and report |
| 1b thin backlog item | skip |
| 1b open decisions that carry a recommendation | implement under it, list as assumption |
| 1c-bis `needs-answers` | take each recommendation; none on a question → skip the item |
| answers needed later (escalation) | park the PR (Stage 4 step P) |

**Standing authorization** for the PRs this run opened: `git push` of the run's branch, `gh pr create`, `gh pr merge --merge --delete-branch` once the gate passes, closing PRs that merge subsumed. Nothing else: never push a default branch, never force-push, never merge a PR this run did not open (except via `/wi merge`, see `wi/merge.md`).

### 1b. Readiness gate (per item)
Read the spec yourself; no agent call.

**Ready:** in `refined/`, or `in-progress/` (resuming); or in `backlog/` with clear AC, one obvious location, no new contract, nothing security-sensitive. "Refined" means ready, not small.

**Not ready:** `status: blocked`, unanswered `## Open decisions`, a `depends_on` not completed, or a backlog item failing the bar.

On not ready, ask per item: **Refine it now** / **Implement anyway** (state assumptions in writing, they go to `args.answers`) / **Skip** / **Abort**.

### 1c. Answer open questions before launching
Resolve anything unanswered in the spec via `AskUserQuestion`, each with your recommendation. Nothing downstream can ask. In work-item mode write each answer into the spec (`**Answer:** ...`) and commit it before launching, then pass the same answers as `args.answers`.

### 1c-bis. Scope before any worktree
Call `Workflow` with `script` = the contents of `${CLAUDE_SKILL_DIR}/workflow.js` and `args: { task, item, answers, planOnly: true }`. Pass `script`, not `scriptPath`: `scriptPath` must sit under a working directory, and the skill directory may not. A scratchpad copy also serves `resumeFromRunId`.

No `workdir` or `branch`: read-only, git untouched.
- `status: "needs-answers"`: ask the returned `open_questions` with your recommendation, record the answers as in 1c, re-invoke with `args.answers`.
- `status: "scoped"`: returns `classification` (`security_sensitive`, `small_task`) and `units[]` (name, description, `is_code`, `repo`, steps, files, `test_strategy`). Don't patch Plan's decomposition here; a bad split is a Plan quality issue.

### 1d. Cluster units into worktrees
Group by `repo`. Units with no `repo` (or the same one) share one worktree, branch and PR and run sequentially inside it; two units racing one git index corrupt each other's commits. Different repos run in parallel, each with its own worktree, branch and `Workflow` call.

Across items or clusters:
- Same repo, dependency edge or overlapping files: sequential and stacked. The dependent run's `baseRef` is the dependency's branch.
- Different repos, dependency edge: not a conflict risk, so parallel unless a later cluster needs the earlier cluster's shipped shape (API, schema, generated client). Then launch the dependency, wait for it to return, and write the dependent units from its real diff.
- Combine two items into one run only when it is mechanically true that they overlap.

### 1e. A branch per cluster
Worktree or in place: follow the project's or user's instruction, else ask once per run. `--autonomous` without an instruction means worktree. Never run two clusters in one working tree. Never orchestrate on `main`.

```bash
git -C <repo> fetch origin
# worktree (under the repo's .claude/worktrees/):
git -C <repo> worktree add <repo>/.claude/worktrees/<slug> -b claude/<slug>-<4-char-suffix> <baseRef>
# in place (clean tree required):
git -C <repo> switch -c claude/<slug>-<4-char-suffix> <baseRef>
```

`<baseRef>` is `origin/main`, or the dependency's branch for a stacked cluster. Pass the path as `args.workdir` and the branch as `args.branch`. In place, "remove the worktree" below means: switch back to the default branch and keep the pushed branch.

**Naming.** One name everywhere: run name (`runName`) = item id or slug, or the first 6 words of a generic task slugified, max 48 chars, never time or random (it breaks the resume cache). Worktree and branch use it, the branch with the 4-char suffix. Agent labels are `<runName>/<phase>:<unit>:<iter>`.

### 1e-bis. Shared test infrastructure is preflight's job
If suites need expensive, reusable infrastructure (a database, a fixture stack), provision it here once, tell runs to reuse it and never tear it down (`args.answers`, with exact target names in the project's agent overrides). If busy, wait with the resume timer; never take it over. A warm shared resource leaks state between suites, so say so: a later failure may be a dirty fixture. The session tears it down after the item's PR is open (or merged and post-merge checks done), unless another session is using it. An escalated item keeps its infrastructure and its worktree.

### 1f. Launch execution per cluster
Call `Workflow` again per cluster with the same `script` and:

| `args` field | Meaning |
|---|---|
| `units` | this cluster's units from the scoping result; skips Classify/Understand/Plan |
| `security_sensitive` | from `classification` |
| `scoping` | the scoping `context` text |
| `workdir`, `branch` | the cluster's working tree and branch |
| `baseRef` | what the branch was cut from; diff base and PR base (default `main`) |
| `item` | `{id, slug, path}` when tracked |
| `answers` | decisions already settled with the user |
| `ciFailure` | repair mode: failing CI log tail. Skips the unit loop, one repair round, then Full Verify |

A bare string task with no scoping call is accepted: plan and run in one call, for a quick ad-hoc edit. Runs are backgrounded and notify on completion. Don't poll.

## Stage 2 — Pipeline (`workflow.js`)

### Scoping mode (no `units`)
1. **Classify** (`classify`): `security_sensitive`, `small_task`.
2. **Understand** (`understand`): always runs; `small_task` only sets depth. Returns `context`, never questions.
3. **Plan** (`plan`): the one phase that may raise `open_questions`; non-empty ends the call with `needs-answers`. Decomposes into units that stand alone.

With `planOnly: true` it returns here without touching git.

### Execution mode
Units run sequentially, each in a loop capped at `MAX_UNIT_ITERATIONS = 3`:

4. **Implement**: `tdd-implementer` for code, `doc-implementer` for non-code. `red_observed` is required and enforced: a `green` claim with `red_observed: false` becomes `blocked`. Commits its own files when a branch exists.
4b. **Collect e2e**: agents never wait on a long run with `run_in_background` (it ends the turn before the verdict). They block in the foreground in calls of at most 9 minutes, attach to an existing run for the same tree, and run only touched scenarios. A run still going is reported in `e2e_runs` as `PENDING` with its `wait_command`; the script hands it to a `verify` call for the real verdict. A run may declare `expected: FAIL` for a deliberate negative proof. A PASS on a `blocked_only_on_e2e` unit makes it green; any other verdict becomes the blocker.
5. **Validate** (`requirements-check`): does the change satisfy this unit's requirement, independent of its own test? Skipped for a blocked unit.
6. **Security Review** (`security-review`, only if `security_sensitive`, only after Validate passes): reads the diff and confirms or dismisses.

Any finding (blocked, unmet requirement, confirmed security issue) retries the unit with the finding as context. At the cap it escalates to a human with the last finding. Nothing but a passing gate marks a unit resolved.

7. **Full Verify**: once, after every unit is committed or escalated. One `verify` call over the whole branch (`git diff <baseRef>...HEAD`, or `git diff HEAD` without a branch). It runs the project's full lint and test suite, not just the changed files. It is never skipped, and a verify that did not run is not a pass.
   - On failure, up to `MAX_REPAIR_ROUNDS = 2`: failing checks go to the unit owning the implicated file (unattributed: every committed unit), which gets one more implement pass, then Verify re-runs failures first and the full suite only once they pass.
8. **Commit** (branch only): `commit-sweep` commits leftovers and reports tree state and commits. Runs regardless of outcome.
9. **Report**: `resolved = no escalations, verification passed, every unit committed`. Pure data assembly, no agent call.

Every `agent()` call is null-checked and fails closed: a failed `classify` means security-sensitive; a failed review or check is unresolved, not clean; a failed Verify is `all_passed: false`; a failed sweep means a dirty tree.

`ledger`: per unit, attempts, resolved, findings. `escalations`: `[{task, reason, findings}]`, the decisions a human owes the run; postflight shows them verbatim.

## Stage 3 — Postflight (this session, per returned run)

1. `needs-answers`: only from scoping. Ask, record, re-invoke.
2. Check `tree_clean` first. Not clean: inspect and resolve, don't push a partial state. Check `git worktree list` against each unit's `files_changed`; a path outside the cluster worktree is stranded work.
3. Push, then open the PR (base = `baseRef`). Body: per-unit changes, verification evidence, security outcome, escalations and ledger.
   - `resolved: true`: label `ready-to-merge`.
   - `escalated`: put each escalation (task, reason, findings) at the top as the decision a human owes. Label for attention, never `ready-to-merge`.
   - `unresolved`: same warning treatment with a generic reason.
   - Merging is Stage 4, only for `resolved: true` with `--autonomous`.
   - Put `Verified-sha: <verified_sha>` on its own line (omit when null).
4. Multi-repo cross-sync: once every cluster of an item has a PR, diff each branch against its `baseRef` and check every identifier one cluster assumed of another (field name, enum value, endpoint shape) against what the sibling shipped, literally. A mismatch blocks `ready-to-merge` on every affected PR. A dependent PR says "Depends on: <url>" and stays off `ready-to-merge` until that PR merges.
5. Tracker bookkeeping (the tracker's own rules win; for `/wi` see implement.md step 5): stamp `pr:`; resolved → summary and move to `in-review/`; escalated or unresolved → stay `in-progress/` with `blocked` or `needs-attention`.
6. Cleanup: on a resolved cluster remove the worktree once pushed and the PR is open, and tear down test infrastructure (1e-bis) unless Stage 4 needs it. On an escalated cluster keep both and say where.
7. Report one line per item: resolved, escalated (with the decision it waits on), or unresolved, plus PR link and label. Never summarize an escalated or unresolved run as done.

## Stage 4 — Merge (this session, `--autonomous`, per `resolved: true` PR)

This gate is the only gate when the host enforces nothing. Sequential, dependencies first. Every line checked by command:

1. Run `resolved`, `tree_clean`, no escalations, `verified_sha` non-null.
2. PR head (`gh pr view <n> --json headRefOid`) equals `verified_sha`. Anything pushed after Full Verify voids the proof.
3. CI: `gh pr checks <n> --watch --fail-fast` as one `run_in_background` call from this session (a session may background; a workflow agent may not). Zero checks is pending, not green. Every check `pass` or `skipping`.
4. Not behind base: `mergeStateStatus` is not `BEHIND` or `DIRTY`.
5. Dependency PRs already merged.

Steps:
1. Wait for CI. If it cannot finish in the call, use the resume timer.
2. CI red: re-invoke the cluster with `args.ciFailure` (failing check names plus the last ~80 log lines), same `workdir`, `branch`, `units`. Push, update `Verified-sha`, back to 1. Same failure twice, or an escalation: park. At most 2 repairs per PR.
3. Base moved: merge `origin/<base>` into the branch. Resolve only mechanical conflicts; anything else: park. Re-run the touched checks, push, update `Verified-sha`, back to 1. Max 2 syncs.
4. Merge: `gh pr merge <n> --merge --delete-branch`. Use `--merge`, not `--squash`: subsumed-PR detection needs branch ancestry. Retarget a stacked child to the default branch before its base branch is deleted, or GitHub closes it for good.
5. Subsumed PRs: for every other open PR, `git merge-base --is-ancestor <its-head> <merged-head>`. An ancestor is subsumed: confirm the default branch is a strict superset, comment with the merge commit, `gh pr close --delete-branch`, promote its item.
6. Tracker: run `/wi sync` (moves merged items to `completed/` with the summary updated).
7. Post-merge check: re-run the project's checks on the updated default branch. Red: comment on the merged PR with the signature and report it. Never revert automatically.
8. Cleanup as in Stage 3 step 6.

**P. Park** (any step that cannot continue): comment on the PR with the failure signature, what was tried and the single next action; remove `ready-to-merge`, add `needs-attention`; keep branch and worktree; continue the queue. Parking is the only response to a failed gate. Never loosen a gate, rerun until green, or merge around it.

Report one line per PR: merged `<sha>`, parked `<reason>`, or skipped `<reason>`, with the CI result.

## Waiting — resume timer
When the session must wait on something it cannot block on (busy shared infrastructure, pending CI, a dependency PR, a run longer than a foreground wait): call `ScheduleWakeup` with `delaySeconds: 1800` and a self-contained `prompt` (run name, stage, PR numbers, worktree paths, `runId`s, what is awaited, "continue the orchestrate run"). On wake, re-check by command, not memory. Still blocked: schedule again. Repeat until the run ends.

Never schedule a timer when blocked on a human (`needs-answers` outside `--autonomous`, a pending question, an escalation, a parked PR): report `needs input:` and stop. Cancel the timer (`stop: true`) when the run finishes or becomes human-blocked.

Models come from each agent's frontmatter in `.claude/agents/`, not from the script.

## Extension points
- **Full override**: `.claude/orchestrate/SKILL.md` plus its own `workflow.js`. Stage 0 hands over.
- **Swap an agent**: define an agent with the same name (`classify`, `understand`, `plan`, `tdd-implementer`, `doc-implementer`, `requirements-check`, `security-review`, `verify`, `commit-sweep`) in the project's `.claude/agents/`. Same role, project detail. `workflow.js` dispatches by `agentType`.
- **Insert or reorder phases**: copy `workflow.js` into the project and edit; there is no parent-script call.
- **A project's copy must keep**: Classify, Full Verify, the Plan open-questions drop-out, the `escalations` and `resolved: false` report, and "only a passing gate marks anything resolved". It may add checks. It may not make these depend on requester self-declaration.
- **Retry caps**: `MAX_UNIT_ITERATIONS` and `MAX_REPAIR_ROUNDS` are constants at the top of the execution section. User-only: a capped run goes back to the user; never raise them yourself.
- **Resume**: `Workflow` returns a `runId`. After an edit or partial failure, `resumeFromRunId` replays cached phases and re-runs from the changed step. `args.answers` invalidates from Understand on.
