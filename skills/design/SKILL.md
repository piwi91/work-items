---
name: design
description: Write one design doc (cross-cutting architecture) to design/.
argument-hint: "<subject|item|slug> [| supersede <slug>]"
disable-model-invocation: true
allowed-tools: Read, Edit, Write, Glob, Grep, Bash, Agent, AskUserQuestion, Skill
---

# /work-items:design <subject | item | slug> [| supersede <slug>]

Read `${CLAUDE_PLUGIN_ROOT}/reference/tracker.md` first.

Write one design doc to `design/<slug>.md`. You design; you do not implement. Only that file, `DECISIONS.md` and `EPICS.md`/`backlog/` (step 8) are written.

A design holds cross-cutting architecture and implies several backlog items. Contract level, not file level.

**Ground before you draw.** Every claim about current state cites a real file. Every claim about an external component's behaviour is checked against its docs or source. Unverifiable and load-bearing: an open question marked `VALIDATE`, never an assumption.

1. **Resolve**: a backlog item (read it and its epic) or a free-form subject. Read `DECISIONS.md` and scan `design/` for the subject. A prior doc: decide with the user whether this supersedes, extends or revises it. A decision that conflicts with a `DECISIONS.md` row must supersede it explicitly.
2. **Intent** (`AskUserQuestion`): the problem, who it is for, the cost of not doing it. Reject a restated title.
3. **Ground**: dispatch `work-items:researcher` on the current state (parallel for independent areas), and fetch upstream docs for anything the design leans on. Read-only; never mutate a live system.
4. **Scope gate** (`AskUserQuestion`): in and out of scope as subject boundaries (what this design owns, what it defers to other designs), never process steps. Invariants verbatim.
5. **Draft** to the template below. Cover options with real reasons, contracts, security at every layer that applies, and migration or rollout when it is not greenfield. Add a diagram where structure or ordering matters.
6. **Self-challenge**: list unverified assumptions (`VALIDATE`), security gaps, failure modes, scope leaks. Dispatch `work-items:architect` to red-team the draft; add `work-items:security-review` when it touches trust, identity, secrets, tenancy or network. Fix what you can, surface the rest as open questions.
7. **Preview**: print the full doc as one code block, then ask approve / revise / re-frame. Write nothing before approval.
8. **Write** `design/<slug>.md` with `status: draft`. Accepted at once: set `status: accepted` and add one row to `DECISIONS.md` in the same commit. Offer `/work-items:backlog` for each implied item. Supersede: set the prior doc `status: superseded`, `superseded-by: <slug>`, and add the new `DECISIONS.md` row with `Supersedes`. `wi index && wi validate`, commit.
9. Tell the user: `/work-items:refine <item>` picks these up, reads this design and stamps `design: design/<slug>.md`. When every item is completed, set `status: implemented`.

```markdown
---
title: <Subject>
status: draft            # draft | accepted | implemented | superseded
date: <YYYY-MM-DD>
supersedes: <slug or —>
superseded-by: <slug or —>
---
# Design: <Subject>
## Intent
## Scope
**In:** ...  **Out (deferred to other designs):** ...
## Invariants
## Options considered
| Option | Why | Why not |
|---|---|---|
| 0. Do nothing / current state | | |
## Decision          (while draft: "Recommended: <option>, because ...")
## Contracts         (per API, schema or resource: fields that matter, producer → owner → consumer, invariants)
## Security          (per layer that applies: what it enforces or prevents)
## Open questions
- [ ] <question> VALIDATE: <how to confirm>
## Work items
<!-- wi:items -->
<!-- /wi:items -->
## Decision record
- <YYYY-MM-DD> <what was decided or changed, and why>
```
