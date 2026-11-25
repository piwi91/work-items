# Usage

## 1. What it is
Work items kept as markdown files in git. The folder is the state.
Loop: design → backlog → refine → implement → merge → sync.
Shipped as the Claude Code plugin `work-items`: one skill per verb (`/work-items:<verb>`), `orchestrate`, 13 agents, and the `wi` helper on PATH.

## 2. Install
a. Add the marketplace and install (user scope = every project):
```
claude plugin marketplace add piwi91/work-items
claude plugin install work-items@work-items
```
For local development of the plugin, use a local path instead (`claude plugin marketplace add /path/to/work-items`); it loads files in place, with no version bump needed.
In a session: `/plugin marketplace add piwi91/work-items`, then `/plugin install work-items@work-items`.

b. New tracker: `/work-items:init`.
c. Existing tracker: `/work-items:upgrade` (`--dry-run` shows the plan).
d. Update the plugin:
```
claude plugin marketplace update work-items
claude plugin update work-items@work-items
```
Or enable auto-update for the marketplace in `/plugin`. Then run `/work-items:upgrade` in each tracker.

Also:
- Remove old copies: `~/.claude/skills/{wi,orchestrate}`, and project copies (`/work-items:upgrade` removes those).
- Tracker outside the project: set `WI_ROOT` in the project's `.claude/settings.json` under `env`, or export it.
- The code repo's CLAUDE.md needs `## Testing` (tiers, commands, paths) and `## Docs` (doc locations, changelog, agent guidance).
- Needs: git, bash 3.2+, awk. `gh` (authenticated) for implement, merge and sync.

## 3. Setup checklist
Fill `WORKFLOW.md` (created by `init`):

| Field | Set |
|---|---|
| Mode | `in-repo` or `cockpit` (the tracker is its own repo, code lives in the repos below) |
| `tracker-commits` | `main` or `branch` |
| `worktree` | `yes` or `no`; omit to be asked |
| Repos | `slug`, `path`, `reaches downstream`, `release` (`tag` cuts a semver tag on merge) |
| Sensitive areas | Never auto-refined (`auto: no`), always security review |
| Size rubric | Only if the default does not fit |
| Categories | Optional label set |
| Conventions | Docs to read before planning |

1. Add the first epic: `/work-items:backlog epic <title>`, or edit `EPICS.md`.
2. Run `wi validate`. Expect `ok`.

## 4. Daily loop
| Command | When | Writes | Asks user |
|---|---|---|---|
| `/work-items:init` | New tracker | root, `EPICS.md`, `DECISIONS.md`, `INDEX.md`, state dirs, `WORKFLOW.md` | yes |
| `/work-items:upgrade [--dry-run]` | Plugin updated | missing skeleton files, migrations, `wi-version` | once, before applying |
| `/work-items:design <subject>` | Cross-cutting choice | `design/<slug>.md`, `DECISIONS.md` row | yes |
| `/work-items:backlog` or `backlog list` | See open intent | nothing | no |
| `/work-items:backlog epic <title>` | New epic | `EPICS.md` | only if no rationale |
| `/work-items:backlog feature\|bug <epic> <title>` | New item | `backlog/<slug>.md` | on duplicate or unclear size |
| `/work-items:backlog drop <item> <reason>` | Obsolete item | moves to `completed/`, `status: dropped` | no |
| `/work-items:next [--auto]` | Pick work | nothing (top 10 of `wi next`) | no |
| `/work-items:inbox` | What needs you | nothing (`wi inbox`) | no |
| `/work-items:sprint plan\|start\|close\|status` | Optional time-boxed goal | `sprints/<slug>.md`, `sprint:` in items | on plan and close |
| `/work-items:refine <item>` | Make it ready | `refined/<slug>.md` | yes |
| `/work-items:implement <item>... [--autonomous]` | Build it | branch, PR, `in-review/<slug>.md` | no with `--autonomous`, else yes |
| `/work-items:unblock [item]` | Item is `blocked` or `draft` | answers or approval in the item, status back | yes |
| `/work-items:auto [--max N] [--hours H]` | Unattended loop: sync, merge, refine, build | PRs, items in every state | never |
| `/work-items:merge [prs\|items]` or `--all` | PRs labelled `ready-to-merge` | merge, optional tag, then sync | no, parks instead |
| `/work-items:sync` | After any merge | moves merged items to `completed/` | no |

`auto` refine chain: classify (sensitive → `auto: no`, stays in backlog) → researcher → refiner (opus) → fable-refiner on open decisions only. Result: XS/S `refined` (built at once), M+ `draft` (approve in `unblock`), open decision `blocked`.

Order, finish before you start: `sync` → `/work-items:merge --all` → `unblock` → `wi stale`, then review or drop what it lists → only then new items.
Stale item reviewed and kept: set `last_reviewed` to today. Obsolete: `/work-items:backlog drop`.

## 5. wi reference
Run as `wi <subcommand>` (the plugin's `bin/` is on PATH). Root: `$WI_ROOT`, else `work-items/`, else `.` (needs `EPICS.md` and `backlog/`).

| Command | Example | Exit |
|---|---|---|
| `list [state]` | `wi list backlog` | 0 |
| `next [--auto]` | `wi next` | 0; rows `<ID> <state> <P> <type> <size> <repo> <title>`, plus a tab and `make -C <root> implement-<ID>` for refined items (`repo` is `-` when none); draft items are skipped. `--auto` also skips `auto: no` and prefixes `build` (refined), `refine` (XS/S backlog) or `draft` (M+ backlog) |
| `inbox` | `wi inbox` | 0; rows `<kind> <id> <state-dir> holds=<n> <title>`, kinds `decision` (blocked), `failed` (needs-attention), `approve` (draft), `refine` (backlog, `auto: no`); most-blocking first |
| `nextid <E<n>> <F\|B>` | `wi nextid E1 F` prints `E1-F4` | 0; 1 without args |
| `index` | `wi index` | 0; rewrites `INDEX.md` (with a `## Needs you` section) and the design Work items blocks |
| `validate` | `wi validate` prints `ok` | 0 ok; 1 with problems listed, `stale: run wi index` when generated files are out of date. Also fails when an item's `repos:` slug has no row in the WORKFLOW.md Repos table |
| `stale [days]` | `wi stale 30` (default 60) | 0 |
| `repo <ID> [slug]` | `wi repo E1-F4` prints the code repo path | 0; 1 if the item, slug or path is unknown, or a cockpit item has no `repos:`. Cockpit: path from the `WORKFLOW.md` Repos table (first `repos:` entry unless `slug` is given). In-repo: the enclosing git repo |

An unknown subcommand prints usage and exits 2. No tracker found: exit 1.

### Background sessions (Makefile)
`init` copies a `Makefile` into the tracker root. Run `make` there.

| Target | Does |
|---|---|
| `make implement-<ID> [REPO=<slug>]` (also `make implement <ID>`, `make implement ID=<ID>`) | Start a background session in a worktree of the item's code repo. `REPO` picks one repo of a multi-repo item |
| `make agents` / `logs-<ID>` / `attach-<ID>` / `stop-<ID>` | List, read logs, attach, stop |
| `make clean-worktree-<ID> [REPO=<slug>]` | Remove the leftover worktree |

The ID is case-insensitive in every form (`e1-f1` = `E1-F1`); this holds for `logs`, `attach`, `stop` and `clean-worktree` too.

It finds `wi` on PATH or in the plugin cache; override with `WI=<path>`.

## 6. Rules
- The folder is the truth. `status:` must fit the folder.
- IDs come from `nextid`. Never reuse or renumber.
- `INDEX.md` and the design Work items blocks are generated, never hand-edit them. Run `wi index && wi validate` before every tracker commit.
- Decisions go only in `DECISIONS.md` plus the design. A changed decision is a new row with `Supersedes`.
- Drop an item instead of leaving it stale.
- Never `git add -A`. Use pathspecs.
- Code goes on a branch and a PR, never on main.

## 7. For agents
1. Find the tracker root: `$WI_ROOT`, else `work-items/`, else the cwd (if it has `EPICS.md` and `backlog/`).
2. Read `WORKFLOW.md`, then `reference/tracker.md`, then the verb's skill (`skills/<verb>/SKILL.md`).
3. Verbs:

| Interactive, needs the user | Safe unattended |
|---|---|
| `init`, `upgrade`, `design`, `backlog` (except `list`), `sprint` (except `status`), `refine`, `unblock`, `implement` without `--autonomous` | `auto`, `implement --autonomous`, `merge`, `sync`, `next`, `inbox`, `validate`, `backlog list` |

4. No skills available? Create an item by hand:
   1. `wi nextid E<n> F` (or `B`). Result is the ID, for example `E1-F4`.
   2. File: `backlog/<lower-id>-<kebab-title>.md`, for example `backlog/e1-f4-add-login.md`.
   3. Frontmatter: `id`, `title`, `epic` (`E1 — <title>`), `type` (`F` or `B`), `priority` (`P1`..`P5`), `size` (`XS`..`XXL`), `depends_on: []`, `status: backlog`, `last_reviewed` (today). Then `# <ID> — <Title>` and one or two sentences of what and why.
   4. Move between states with `git mv`. Set `status:` to fit the new folder.
   5. `wi index && wi validate`, then `git add <paths>` and `git commit <paths>`. Never `git add -A`.
5. Blocked or ambiguous: set `status: blocked`, add `## Open decisions` with the question, options and a recommendation. Never guess.

## 8. Customise
| What | How |
|---|---|
| Sizes, categories, sensitive areas, repos, commit and worktree policy | `WORKFLOW.md` overrides the defaults in the skill |
| Replace orchestrate | Add `.claude/orchestrate/SKILL.md` (and its own script, passed by `scriptPath` from the project) |
| Agent behaviour | Agents are `work-items:<name>`; a project agent of the same bare name never replaces them. Steer through `WORKFLOW.md` or `.claude/orchestrate/SKILL.md` |
| Agent model or prompt | Fork the plugin |

## 9. Test the plugin
`bash tests/test-wi.sh` prints `all passed`.

## Develop
Run `bash tests/test-wi.sh`. On every change, bump the version in `.claude-plugin/plugin.json` and `skills/init/skeleton/WORKFLOW.md`, and add to CHANGELOG.md.
