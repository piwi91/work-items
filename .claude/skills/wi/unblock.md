# /wi unblock [items]

Resolve `status: blocked` items with the user. You propose; the user decides. Edit tracker markdown only.

1. **Collect** `status: blocked` from `refined/` (`## Open decisions`, no branch yet) and `in-progress/` (`## Blocked`, branch exists). Skip questions that already have an `**Answer:**`.
2. **Per item, in order**:
   - Is it still open? Check against the default branch, or `git diff main...<branch>` for an implementation parking. Settled since → propose "obsolete, resume as-is"; no longer wanted → propose `backlog drop`.
   - Recommendation: reuse the refiner's if it is still current. Otherwise use `architect` for AC/design conflicts and `researcher` for facts. Check `DECISIONS.md` first.
   - `AskUserQuestion`: recommendation first, plus alternatives including "park longer", "back to refine" and "drop".
   - Record `**Answer (YYYY-MM-DD):** <decision + one-line why>` under the question. An answer that is a decision beyond this item also gets a `DECISIONS.md` row. If the answer changes an AC, edit the AC too. When all questions are answered, set `status: refined` (in `refined/`) or `in-progress`. `wi.sh index && wi.sh validate`, commit.
3. **Hand back**: table `item | decision | next`, then ask whether to run `/wi implement <answered items> --autonomous` now.
