# Usage

## 1. What it is
Work items kept as markdown files in git. The folder is the state.
Loop: design → backlog → refine → implement → merge → sync.

## 2. Install
| Mode | Setup |
|---|---|
| cockpit | This repo is the tracker. Code lives in other repos listed in WORKFLOW.md `## Repos`. Use the template or clone it. |
| in-repo | Copy `.claude/skills/wi`, `.claude/skills/orchestrate` and `.claude/agents` into the project. Run `/wi init`, or copy the skeleton (`EPICS.md`, `DECISIONS.md`, state dirs, `design/`) under `work-items/`. |

Both modes:
1. Remove or rename `~/.claude/skills/wi` and `~/.claude/skills/orchestrate`. A personal skill shadows the project skill.
2. The code repo's CLAUDE.md needs `## Testing` (tiers, commands, paths) and `## Docs` (doc locations, changelog, agent guidance).

Needs: git, bash 3.2+, awk. `gh` (authenticated) for implement, merge and sync.

## 3. Setup checklist
Fill `WORKFLOW.md` (copy of `.claude/skills/wi/workflow-template.md`):

| Field | Set |
|---|---|
| Mode | `in-repo` or `cockpit` |
| `tracker-commits` | `main` or `branch` |
| `worktree` | `yes` or `no`; omit to be asked |
| Repos | `slug`, `path`, `reaches downstream`, `release` (`tag` cuts a semver tag on merge) |
| Sensitive areas | Never auto-refined, always security review |
| Size rubric | Only if the default does not fit |
| Categories | Optional label set |
| Conventions | Docs to read before planning |

1. Add the first epic: `/wi backlog epic <title>`, or edit `EPICS.md`.
2. Run `bash .claude/skills/wi/wi.sh validate`. Expect `ok`.

## 4. Daily loop
| Command | When | Writes | Asks user |
|---|---|---|---|
| `/wi init` | New tracker | root, `EPICS.md`, `DECISIONS.md`, state dirs, `WORKFLOW.md` | yes |
| `/wi design <subject>` | Cross-cutting choice | `design/<slug>.md`, `DECISIONS.md` row | yes |
| `/wi backlog` or `backlog list` | See open intent | nothing | no |
| `/wi backlog epic <title>` | New epic | `EPICS.md` | only if no rationale |
| `/wi backlog feature\|bug <epic> <title>` | New item | `backlog/<slug>.md` | on duplicate or unclear size |
| `/wi backlog drop <item> <reason>` | Obsolete item | moves to `completed/`, `status: dropped` | no |
| `/wi next` | Pick work | nothing (top 10 of `wi.sh next`) | no |
| `/wi refine <item>` | Make it ready | `refined/<slug>.md` | yes |
| `/wi implement <item>... [--autonomous]` | Build it | branch, PR, `in-review/<slug>.md` | no with `--autonomous`, else yes |
| `/wi unblock [item]` | Item is `blocked` | answers in the item, status back | yes |
| `/wi merge [prs\|items]` or `--all` | PRs labelled `ready-to-merge` | merge, optional tag, then sync | no, parks instead |
| `/wi sync` | After any merge | moves merged items to `completed/` | no |

Order, finish before you start: `sync` → `/wi merge --all` → `unblock` → `wi.sh stale`, then review or drop what it lists → only then new items.
Stale item reviewed and kept: set `last_reviewed` to today. Obsolete: `/wi backlog drop`.

## 5. wi.sh reference
Run as `bash .claude/skills/wi/wi.sh <cmd>`. Root: `$WI_ROOT`, else `work-items/`, else `.` (needs `EPICS.md` and `backlog/`).

| Command | Example | Exit |
|---|---|---|
| `list [state]` | `wi.sh list backlog` | 0 |
| `next` | `wi.sh next` | 0 |
| `nextid <E<n>> <F\|B>` | `wi.sh nextid E1 F` prints `E1-F4` | 0; 1 without args |
| `validate` | `wi.sh validate` prints `ok` | 0 ok; 1 with problems listed, or with no output when `EPICS.md` has no epic yet |
| `stale [days]` | `wi.sh stale 30` (default 60) | 0 |

An unknown subcommand prints usage and exits 2. No tracker found: exit 1.

## 6. Rules
- The folder is the truth. `status:` must fit the folder.
- IDs come from `nextid`. Never reuse or renumber.
- Run `wi.sh validate` before every tracker commit.
- Decisions go only in `DECISIONS.md` plus the design. A changed decision is a new row with `Supersedes`.
- Drop an item instead of leaving it stale.
- Never `git add -A`. Use pathspecs.
- Code goes on a branch and a PR, never on main.

## 7. For agents
1. Find the tracker root: `$WI_ROOT`, else `work-items/`, else the cwd (if it has `EPICS.md` and `backlog/`).
2. Read `WORKFLOW.md`, then `.claude/skills/wi/SKILL.md`, then the verb file (`refine.md`, `implement.md`, ...).
3. Verbs:

| Interactive, needs the user | Safe unattended |
|---|---|
| `init`, `design`, `backlog` (except `list`), `refine`, `unblock`, `implement` without `--autonomous` | `implement --autonomous`, `merge`, `sync`, `next`, `validate`, `backlog list` |

4. No skills available? Create an item by hand:
   1. `wi.sh nextid E<n> F` (or `B`). Result is the ID, for example `E1-F4`.
   2. File: `backlog/<lower-id>-<kebab-title>.md`, for example `backlog/e1-f4-add-login.md`.
   3. Frontmatter: `id`, `title`, `epic` (`E1 — <title>`), `type` (`F` or `B`), `priority` (`P1`..`P5`), `size` (`XS`..`XXL`), `depends_on: []`, `status: backlog`, `last_reviewed` (today). Then `# <ID> — <Title>` and one or two sentences of what and why.
   4. Move between states with `git mv`. Set `status:` to fit the new folder.
   5. `wi.sh validate`, then `git add <paths>` and `git commit <paths>`. Never `git add -A`.
5. Blocked or ambiguous: set `status: blocked`, add `## Open decisions` with the question, options and a recommendation. Never guess.

## 8. Customise
| What | How |
|---|---|
| Sizes, categories, sensitive areas, repos, commit and worktree policy | `WORKFLOW.md` overrides the defaults in SKILL.md |
| Replace orchestrate | Add `.claude/orchestrate/SKILL.md` (and its own `workflow.js`) |
| Change an agent | Define an agent with the same name in the project's `.claude/agents/` |
| Agent model | `model:` in the agent frontmatter |

## 9. Test the framework
`bash .claude/skills/wi/test-wi.sh` prints `all passed`.
