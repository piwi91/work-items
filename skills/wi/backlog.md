# /work-items:wi backlog

Backlog = functional intent: **what** and **why**, never how. If the user starts naming files or tools, stop: "that's for refine."

- **No args / `list`**: `wi list backlog`. No edits.
- **`epic <title>`**: next free `E<n>`. Append `## E<n> — <title>` + `_<one-line rationale>_` to `EPICS.md`. No rationale given → ask for it first.
- **`feature|bug <epic> <title>`**:
  1. Epic exists in `EPICS.md`, else list the epics and offer to create one.
  2. **Duplicate gate**: grep the titles in all state dirs for overlapping scope. On a hit, ask: merge into the existing item, or proceed and record the overlap as a dep.
  3. ID = `wi nextid <epic> F|B`. Write `backlog/<slug>.md`: frontmatter (SKILL.md § Frontmatter, `status: backlog`) + `# <ID> — <Title>` + a 1-2 sentence description + optional `## Context` (goal, likely area, constraints, scope limits; still no how).
  4. Infer priority (broken today → P1/P2, security gap → P2, nice-to-have → P4/P5) and size (rubric). Unclear → ask. Set `depends_on` for open items it references.
  5. `wi index && wi validate`, then commit per the tracker-commit policy.
- **`drop <item> <reason>`**: close an item that is superseded, obsolete or no longer wanted, in any open state. A reason is required. `git mv` to `completed/`, set `status: dropped`, append `## Dropped (YYYY-MM-DD)` with the reason (and the superseding item or `D<n>` if any). Remove it from other items' `depends_on` or replace it with its successor. `wi index && wi validate`, commit. A dropped item with an open PR: leave the PR to the user.
- Reclassify a feature as a bug: set `type: B`. Keep the ID.
- Edit only `backlog/`, `EPICS.md`, and (for `drop`) the dropped item and items that depended on it.
