# Usage

## 1. What it is
Work items kept as markdown files in git. The folder is the state.
Loop: design → backlog → refine → implement → merge → sync.
Shipped as the Claude Code plugin `work-items`: skills `wi` and `orchestrate`, 12 agents, and the `wi` helper on PATH.

## 2. Install
a. Add the marketplace and install (user scope = every project):
```
claude plugin marketplace add <git-url or local path>
claude plugin install work-items@work-items
```
In a session: `/plugin marketplace add <git-url or path>`, then `/plugin install work-items@work-items`.

b. New tracker: `/work-items:wi init`.
c. Existing tracker: `/work-items:wi upgrade` (`--dry-run` shows the plan).
d. Update the plugin:
```
claude plugin marketplace update work-items
claude plugin update work-items@work-items
```
Or enable auto-update for the marketplace in `/plugin`. Then run `/work-items:wi upgrade` in each tracker.

Also:
- Remove old copies: `~/.claude/skills/{wi,orchestrate}`, and project copies (`/work-items:wi upgrade` removes those).
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
| Sensitive areas | Never auto-refined, always security review |
| Size rubric | Only if the default does not fit |
| Categories | Optional label set |
| Conventions | Docs to read before planning |

1. Add the first epic: `/work-items:wi backlog epic <title>`, or edit `EPICS.md`.
2. Run `wi validate`. Expect `ok`.

## 4. Daily loop
| Command | When | Writes | Asks user |
|---|---|---|---|
| `/work-items:wi init` | New tracker | root, `EPICS.md`, `DECISIONS.md`, `INDEX.md`, state dirs, `WORKFLOW.md` | yes |
| `/work-items:wi upgrade [--dry-run]` | Plugin updated | missing skeleton files, migrations, `wi-version` | once, before applying |
| `/work-items:wi design <subject>` | Cross-cutting choice | `design/<slug>.md`, `DECISIONS.md` row | yes |
| `/work-items:wi backlog` or `backlog list` | See open intent | nothing | no |
| `/work-items:wi backlog epic <title>` | New epic | `EPICS.md` | only if no rationale |
| `/work-items:wi backlog feature\|bug <epic> <title>` | New item | `backlog/<slug>.md` | on duplicate or unclear size |
| `/work-items:wi backlog drop <item> <reason>` | Obsolete item | moves to `completed/`, `status: dropped` | no |
| `/work-items:wi next` | Pick work | nothing (top 10 of `wi next`) | no |
| `/work-items:wi refine <item>` | Make it ready | `refined/<slug>.md` | yes |
| `/work-items:wi implement <item>... [--autonomous]` | Build it | branch, PR, `in-review/<slug>.md` | no with `--autonomous`, else yes |
| `/work-items:wi unblock [item]` | Item is `blocked` | answers in the item, status back | yes |
| `/work-items:wi merge [prs\|items]` or `--all` | PRs labelled `ready-to-merge` | merge, optional tag, then sync | no, parks instead |
| `/work-items:wi sync` | After any merge | moves merged items to `completed/` | no |

Order, finish before you start: `sync` → `/work-items:wi merge --all` → `unblock` → `wi stale`, then review or drop what it lists → only then new items.
Stale item reviewed and kept: set `last_reviewed` to today. Obsolete: `/work-items:wi backlog drop`.

## 5. wi reference
Run as `wi <subcommand>` (the plugin's `bin/` is on PATH). Root: `$WI_ROOT`, else `work-items/`, else `.` (needs `EPICS.md` and `backlog/`).

| Command | Example | Exit |
|---|---|---|
| `list [state]` | `wi list backlog` | 0 |
| `next` | `wi next` | 0 |
| `nextid <E<n>> <F\|B>` | `wi nextid E1 F` prints `E1-F4` | 0; 1 without args |
| `index` | `wi index` | 0; rewrites `INDEX.md` and the design Work items blocks |
| `validate` | `wi validate` prints `ok` | 0 ok; 1 with problems listed, `stale: run wi index` when generated files are out of date |
| `stale [days]` | `wi stale 30` (default 60) | 0 |

An unknown subcommand prints usage and exits 2. No tracker found: exit 1.

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
2. Read `WORKFLOW.md`, then the `/work-items:wi` skill (`SKILL.md`), then the verb file (`refine.md`, `implement.md`, ...).
3. Verbs:

| Interactive, needs the user | Safe unattended |
|---|---|
| `init`, `upgrade`, `design`, `backlog` (except `list`), `refine`, `unblock`, `implement` without `--autonomous` | `implement --autonomous`, `merge`, `sync`, `next`, `validate`, `backlog list` |

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
| Replace orchestrate | Add `.claude/orchestrate/SKILL.md` (and its own `workflow.js`) |
| Agent behaviour | Agents are `work-items:<name>`; a project agent of the same bare name never replaces them. Steer through `WORKFLOW.md` or `.claude/orchestrate/SKILL.md` |
| Agent model or prompt | Fork the plugin |

## 9. Test the plugin
`bash tests/test-wi.sh` prints `all passed`.
