# /work-items:wi refine <item>

Turn one backlog item into a ready spec. Interactive. No implementation.

1. **Resolve** in `backlog/`. Not found → offer `/work-items:wi backlog`. Never invent an item.
2. **Context**: read the item, its epic rationale, `DECISIONS.md`, the `design:` doc if set (the source of truth for *how*, don't re-argue it), WORKFLOW.md, and the code repo's conventions docs. A spec must not contradict a `DECISIONS.md` row.
3. **Deps**: find undelivered items or components this needs. Record IDs in `depends_on`, the why in `## Dependencies`.
4. **Repo impact** (cockpit mode): start where the change originates, walk WORKFLOW.md's downstream column, set `repos:` in delivery order (producer first). Drop a repo with no concrete change. Too big → propose a split per repo.
5. **Ask the requester first**: goal, why now, constraints, scope limits. One round. "Nothing to add" is fine.
6. **Research**: `work-items:researcher` agent on the current state. Is it already done? Which pattern should it follow? Already fully delivered → ask whether to close it with `backlog drop`.
7. **Draft**: `work-items:plan` agent with item + research + design. Output: the recommended approach and why it beats the alternatives, the conventions that apply, the minimal slice. This opens the grilling; it is not the answer.
8. **Grill** (`AskUserQuestion` rounds, push back on weak answers) until it is Ready:
   - story: As a <who>, I want <capability>, so that <value>;
   - AC: observable; fold in non-functional needs (availability, isolation, access control, observability). For each, ask "what test observes this?" (non-testable: "what equivalence check?"). Vague → measurable;
   - minimal slice; technology choice + why; naming; ordered tasks (a test task only when testable). Re-check size.
9. **Preview**: print the full spec as one code block, then ask: approve / change / re-grill. Write nothing before approval.
10. **Write** `refined/<slug>.md` (`git mv` from backlog, then rewrite):
    ```markdown
    ---
    <frontmatter, status: refined, refined_at: YYYY-MM-DD, last_reviewed: YYYY-MM-DD>
    ---
    # <ID> — <Title>
    ## Epic               (title + rationale, verbatim from EPICS.md)
    ## Dependencies
    ## Repo impact          (cockpit mode: | repo | change | depends on |)
    ## User story
    ## Acceptance criteria  (- [ ] items)
    ## Technical approach   (choice + why · conventions/deviations · testability)
    ## Naming
    ## Tasks                (- [ ] items)
    ```
11. **Design upkeep**: a decision that contradicts the `design:` doc or a `DECISIONS.md` row is a new decision: add a row with `Supersedes`, and amend the design (body states the current shape; a dated `## Decision record` entry at the foot says what changed and why), in the same commit.
12. `wi index && wi validate`, commit, then tell the user: `/work-items:wi implement <slug>`.

**Auto-refine** (used by `implement --autonomous` for an XS/S backlog item outside the sensitive areas): dispatch `work-items:fable-refiner`. It returns the spec, or blocked with open decisions (options + recommendation); the caller writes the file. Blocked → `status: blocked` + `## Open decisions` → `/work-items:wi unblock`.
