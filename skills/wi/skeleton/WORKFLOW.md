# WORKFLOW — project overlay for /work-items:wi
wi-version: 0.2.2

Overrides the defaults in the `/work-items:wi` skill. Delete any section you don't need.

## Mode
in-repo            # or: cockpit (code lives in the repos below)
tracker-commits: main   # or: branch
worktree: yes           # or: no — code work in a worktree (parallel sessions) or in place; omit to be asked

## Repos (cockpit mode)
| slug | path | reaches downstream | release |
|---|---|---|---|

## Sensitive areas (always security review, never auto-refined)
- <auth, secrets, …>

## Size rubric
<only if the default rubric doesn't fit>

## Categories
<optional label set>

## Conventions to read before planning
- <docs/conventions.md, CLAUDE.md, …>
