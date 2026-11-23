export const meta = {
  name: 'orchestrate',
  description:
    'Two modes in one script, switched on whether args.units is already supplied. Scoping mode (no units given): Classify, Understand, Plan — returns the decomposed unit list without touching a worktree, so the calling session can cluster units by repo and create worktrees only once the shape of the work is known. Execution mode (units given): runs each unit sequentially through Implement -> Validate -> (Security Review, conditional) -> on a finding, retry up to a cap then escalate-to-human, never resolved-anyway; once every unit is committed, one full-suite Verify runs against the whole branch, with its own small repair loop attributing failures back to the owning unit. Never reports a false pass on a dropped/blocked/escalated unit, an unverified branch, fabricated test evidence, or a crashed sub-call.',
  phases: [
    { title: 'Classify' },
    { title: 'Understand' },
    { title: 'Plan' },
    { title: 'Implement' },
    { title: 'Collect e2e' },
    { title: 'Validate' },
    { title: 'Security Review' },
    { title: 'Full Verify' },
    { title: 'Commit' },
    { title: 'Report' },
  ],
}

const CLASSIFY_SCHEMA = {
  type: 'object',
  properties: {
    security_sensitive: { type: 'boolean' },
    small_task: { type: 'boolean' },
  },
  required: ['security_sensitive', 'small_task'],
}

// A background workflow has no way to ask the user anything — AskUserQuestion isn't available
// to a subagent. So Plan, the Opus phase, returns the questions instead of guessing, and the run
// drops out right there: cheap (nothing implemented yet), and the calling session can ask, then
// re-invoke with `answers`. Understand only gathers; it never raises questions.
const OPEN_QUESTIONS_PROP = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      question: { type: 'string' },
      why_it_blocks: { type: 'string' },
      options: { type: 'array', items: { type: 'string' } },
      recommendation: { type: 'string' },
    },
    required: ['question', 'why_it_blocks'],
  },
}

const UNDERSTAND_SCHEMA = {
  type: 'object',
  properties: { context: { type: 'string' } },
  required: ['context'],
}

// repo is optional and defaults to the current one — most items are single-repo. When it's
// set and differs across units, the calling session (scoping mode's caller) clusters units
// by repo and gives each cluster its own worktree/branch before launching execution mode.
const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    open_questions: OPEN_QUESTIONS_PROP,
    units: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          is_code: { type: 'boolean' },
          repo: { type: 'string' },
          steps: { type: 'array', items: { type: 'string' } },
          files: { type: 'array', items: { type: 'string' } },
          test_strategy: { type: 'string' },
        },
        // test_strategy is required — the final Verify reads it directly with no fallback; a
        // missing one makes Verify guess what to run instead of checking what was actually asked for.
        required: ['name', 'is_code', 'steps', 'files', 'test_strategy'],
      },
    },
  },
  // Not required: an agent with nothing to ask reliably omits the field rather than sending [],
  // and a required-but-empty array burns the whole retry cap on a schema technicality.
  // Absent is read as "no questions" at the call site. With questions, units may be [].
  required: ['units'],
}

// status is required so a blocked unit has to say so, instead of evidence fields being
// required unconditionally and the model backfilling plausible-looking fake evidence.
// red_observed is required (not optional) AND enforced below (implementUnit downgrades a
// green claim with red_observed=false to blocked) — an honesty gate that can be silently
// true'd away or just never checked isn't one.
// Every long test run an agent started, so the script can collect a verdict the agent did not
// live to see. PENDING is the honest answer when the run outlasted the agent's turn budget.
const E2E_RUNS_PROP = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      run_id: { type: 'string' },
      wait_command: { type: 'string' }, // the exact foreground command that blocks on THIS run and prints its verdict
      scope: { type: 'string' }, // what it covers, e.g. "SCENARIO=login"
      verdict: { type: 'string', enum: ['PASS', 'FAIL', 'PENDING'] },
      // FAIL only for a deliberate negative proof (e.g. a rule removed to show the suite catches it).
      expected: { type: 'string', enum: ['PASS', 'FAIL'] },
      failing: { type: 'array', items: { type: 'string' } },
      evidence: { type: 'string' },
    },
    required: ['run_id', 'wait_command', 'verdict'],
  },
}

const IMPLEMENT_CODE_SCHEMA = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['green', 'blocked'] },
    files_changed: { type: 'array', items: { type: 'string' } },
    red_observed: { type: 'boolean' },
    green_evidence: { type: 'string' },
    blockers: { type: 'string' },
    committed: { type: 'boolean' },
    commit_subject: { type: 'string' },
    e2e_runs: E2E_RUNS_PROP,
    // true when the ONLY thing between this unit and green is a PENDING e2e verdict.
    blocked_only_on_e2e: { type: 'boolean' },
  },
  required: ['status', 'files_changed', 'red_observed'],
}

const E2E_WAIT_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['PASS', 'FAIL', 'UNKNOWN'] },
    failing: { type: 'array', items: { type: 'string' } },
    evidence: { type: 'string' },
  },
  required: ['verdict'],
}

const IMPLEMENT_NONCODE_SCHEMA = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['done', 'blocked'] },
    files_changed: { type: 'array', items: { type: 'string' } },
    blockers: { type: 'string' },
    committed: { type: 'boolean' },
    commit_subject: { type: 'string' },
  },
  required: ['status', 'files_changed'],
}

// Per-unit, not batched across a pass: units run strictly sequentially in execution mode now,
// so there is no "pass" to batch across. The trade — losing the old batched call's ability to
// catch a requirement satisfied jointly across sibling units — is why Plan is responsible for
// decomposing units that stand on their own, and why Report's cross-unit view still gets a
// final look in the calling session's postflight summary.
const REQUIREMENTS_CHECK_SCHEMA = {
  type: 'object',
  properties: {
    satisfied: { type: 'boolean' },
    gap: { type: 'string' },
  },
  required: ['satisfied'],
}

// One opus pass, not a screen+adjudicate split — the reviewer already reads the diff itself,
// so a separate cheap screen ahead of it added a call and a schema without adding recall.
const SECURITY_REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    confirmed: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          file: { type: 'string' },
          files: { type: 'array', items: { type: 'string' } },
          description: { type: 'string' },
          severity: { type: 'string' },
        },
        required: ['description'],
      },
    },
    dismissed: {
      type: 'array',
      items: {
        type: 'object',
        properties: { description: { type: 'string' } }, // audit trail only — no reasoning essay per dismissal
        required: ['description'],
      },
    },
  },
  required: ['confirmed', 'dismissed'],
}

const VERIFY_SCHEMA = {
  type: 'object',
  properties: {
    checks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          command: { type: 'string' },
          result: { type: 'string' },
          passed: { type: 'boolean' },
          unit: { type: 'string' }, // owning unit, if the check maps to exactly one
          files: { type: 'array', items: { type: 'string' } }, // specific files implicated, even for a whole-branch check like lint
        },
        required: ['command', 'passed'],
      },
    },
    all_passed: { type: 'boolean' },
    e2e_runs: E2E_RUNS_PROP,
    // HEAD the checks ran against: the merge gate refuses a PR whose head moved after this.
    head_sha: { type: 'string' },
  },
  required: ['checks', 'all_passed'],
}

// A bare string still works (ad-hoc task, current checkout, no git handling). The object form
// is what the skill's preflight passes: one work item, its own worktree, its own branch.
// The object form can arrive JSON-encoded rather than as a real value; parsing it back is the
// difference between the run owning its worktree/branch and silently doing no git handling at all.
function coerceInput(a) {
  if (typeof a !== 'string') return a || {}
  const trimmed = a.trim()
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (parsed && typeof parsed === 'object' && typeof parsed.task === 'string') return parsed
    } catch (e) {
      /* not JSON — a genuine ad-hoc task string */
    }
  }
  return { task: a }
}
const input = coerceInput(args)
const task = input.task
const workdir = input.workdir || null // absolute path to the git worktree this run owns
const branch = input.branch || null // branch checked out there; null = don't touch git at all
const baseRef = input.baseRef || 'main' // what the branch was cut from — the diff base for the gates
const item = input.item || null // {id, slug, path, ...} when this run is a tracked work item
// Answers to a previous run's open_questions, resolved by the calling session with the user.
// Kept in their own field rather than appended to `task`: `task` feeds every prompt and the
// run name, so folding answers into it would invalidate the whole resume cache.
const answers = input.answers || null
// Scoping mode: preflight already knows the shape of the work and wants it back before
// committing to a worktree (the normal tracked/multi-repo path). Execution mode (units given,
// or planOnly left false with no units): plan then run straight through — the simple ad-hoc path.
const planOnly = input.planOnly === true
// Failing CI log from a pushed PR: skips the unit loop and goes straight to a repair round.
const ciFailure = input.ciFailure || null
let units = input.units || null
let classification = input.security_sensitive != null ? { security_sensitive: input.security_sensitive, small_task: false } : null
let scoping = input.scoping || ''

// Set once, at the very start, and threaded through every agent() label from here on — so
// a run is identifiable in /workflows and in the final report without reading the full task
// text. Prefers the work item's id/slug when there is one (that's the name the user already
// uses for it); otherwise derived from the task text — never Date.now()/Math.random(), which
// break the tool's resume-from-cache behavior. Deterministic either way.
const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
const runName =
  (item && (item.id || item.slug) ? slugify(String(item.id || item.slug)).slice(0, 48) : '') ||
  slugify(task).split('-').slice(0, 6).join('-').slice(0, 48) ||
  'orchestrate-run'
log(`Starting run: ${runName}${branch ? ` (branch ${branch} in ${workdir})` : ''}${planOnly ? ' [scoping only]' : ''}`)

// Prepended to every agent prompt. Parallel sibling runs each own a separate worktree of the
// same repo; an agent that wanders into the main checkout would clobber another run's branch.
const workdirNote = workdir
  ? `Working tree: ${workdir} — a working tree (worktree or checkout) dedicated to this run, on branch ${branch || '(detached)'} cut from ${baseRef}. ` +
    `Read, edit, and run every command there (cd into it first; use absolute paths under it). Do NOT read or write any other checkout of this repo, and do NOT switch, rebase, or push the branch.\n`
  : ''
const answersNote = answers
  ? `Decisions already made by the user for this run (treat as settled, do not revisit):\n${typeof answers === 'string' ? answers : JSON.stringify(answers, null, 2)}\n`
  : ''
const itemNote = item ? `Work item: ${item.id || ''} ${item.slug || ''}${item.path ? ` (spec: ${item.path})` : ''}\n` : ''
// Every turn an agent takes re-sends its whole grown context, so an agent's cost grows with the
// SQUARE of its turn count. Measured over 78 real runs: agents past 200 turns were 55% of all
// token spend and the nine past 400 turns alone were 30% — almost all of it spinning (one
// implementer took 445 turns on a single poll loop; another called `true` 289 times).
// agent() exposes no maxTurns, so the cap can only be stated, not enforced by the runtime —
// the enforcement that IS mechanical is downstream: a blocked/failed report is handled by the
// retry loop, so an agent that stops early is cheap and safe, and never a false pass.
const budgetNote =
  `Token budget: every turn you take re-reads your entire context, so your cost grows with the square of your turn count. ` +
  `Soft budget ~120 tool calls, hard budget 200. On reaching the hard budget, STOP and report honestly what you have — ` +
  `blocked, or the check recorded as failed — rather than grinding on; the orchestrator replans from a blocked report far more cheaply than you can grind. ` +
  `Never poll a long-running job in separate turns, and NEVER use run_in_background here: inside this workflow a background call ends your turn and forces your final answer before the job finishes. ` +
  `Start a long test run detached, then wait in the FOREGROUND with one blocking Bash call (timeout 600000) that returns after at most ~9 minutes — e.g. a waiter with TIMEOUT=540 — and re-issue the same call only if it timed out. ` +
  `Before starting a run, check whether one for the current tree is already running or finished, and attach to it instead of launching another. ` +
  `Run only the scenarios your change touches; the full suite runs once, in Full Verify. ` +
  `If you must stop before a run's verdict, report it in e2e_runs with verdict PENDING and its exact wait_command — the orchestrator collects it; never relaunch it. ` +
  `A run you made fail on purpose (a negative proof, e.g. a rule removed to show the suite catches it) goes in e2e_runs with expected FAIL; any other run is expected to PASS. ` +
  `A bare sleep, a \`true\`, or a \`tail\` "just to check" is a full-context API turn that proves nothing.\n`
const preamble = workdirNote + itemNote + answersNote + budgetNote

function unitOwning(byName, file) {
  return Object.values(byName).find((u) => (u.files || []).includes(file))?.name
}

async function implementUnit(unit, retryContext, iterLabel) {
  const commitNote = branch
    ? `\n\nCommit discipline: when this unit is done (green, or done for a non-code unit), stage ONLY this unit's files and commit them in ${workdir} ` +
      `with a conventional-commit subject naming the unit${item && item.id ? ` and referencing ${item.id}` : ''}. One commit per unit per attempt; on a retry, a fixup commit is fine. ` +
      `You are already on ${branch} — never checkout, rebase, or push. Report committed=true and the commit_subject. If you end up blocked, still commit whatever is coherent and say so in blockers.`
    : ''
  // Understand already paid to map the relevant files and conventions; handing that to the
  // implementer instead of only to Plan is what stops it re-deriving the same thing with a
  // dozen Read calls, each billed at its full grown context. Median payload ~2.5k tokens,
  // which it earns back after roughly two avoided discovery turns.
  const scopingNote = scoping ? `\nScoping notes from the repo survey (use these before re-reading the tree yourself):\n${scoping}\n` : ''
  const prompt =
    preamble +
    `Task: ${task}\nUnit: ${unit.name} — ${unit.description || ''}\n` +
    `Steps: ${JSON.stringify(unit.steps)}\nFiles: ${JSON.stringify(unit.files)}\n` +
    `Test strategy: ${unit.test_strategy}` +
    scopingNote +
    commitNote +
    (retryContext ? `\n\nThis is a retry — address:\n${retryContext}` : '')
  // Not general-purpose: that is a BUILT-IN with no frontmatter, so it has no model pin and
  // inherits the parent session's model — every non-code unit silently ran on whatever the caller
  // was, usually the most expensive tier. doc-implementer pins sonnet and carries what
  // general-purpose cannot know: there is no red/green cycle here, the unit's test_strategy is the
  // bar, and a claim about code has to be run before it is written.
  const agentType = unit.is_code ? 'work-items:tdd-implementer' : 'work-items:doc-implementer'
  const schema = unit.is_code ? IMPLEMENT_CODE_SCHEMA : IMPLEMENT_NONCODE_SCHEMA
  const raw = await agent(prompt, { agentType, schema, phase: 'Implement', label: `${runName}/implement:${unit.name}:${iterLabel}` })
  // null = the call died or was skipped — record as blocked, never silently drop the unit.
  if (!raw) return { ...unit, status: 'blocked', files_changed: [], blockers: 'implement call returned no result', failed: true }
  const result = await applyE2EVerdicts(raw, `${unit.name}:${iterLabel}`)
  // A code unit claiming green without having actually observed red is a vacuous or
  // fabricated test cycle — the honesty gate in the schema only works if something reads it.
  if (unit.is_code && result.status === 'green' && result.red_observed !== true) {
    return {
      ...unit,
      ...result,
      status: 'blocked',
      blockers: (result.blockers ? result.blockers + '; ' : '') + 'claimed green without red_observed=true — treating as blocked',
      failed: false,
    }
  }
  return { ...unit, ...result, failed: false }
}

// A run the agent could not wait out is still running; its verdict is collected here instead of
// being lost, so the next step judges the real result rather than "blocked: still waiting".
async function settleE2E(runs, label) {
  const settled = []
  for (const r of runs || []) {
    if (r.verdict !== 'PENDING') {
      settled.push(r)
      continue
    }
    const prompt =
      workdirNote +
      `Collect the verdict of test run ${r.run_id} (${r.scope || 'scope not given'}). It is already running or finished — never start, restart, or kill a run, and never edit files.\n` +
      `1. Block on it in the FOREGROUND with: ${r.wait_command}\n` +
      `   One Bash call, timeout 600000, never run_in_background (a background call ends your turn before the run is done). ` +
      `If it returns because its own timeout hit while the run is still alive, issue the same call again, at most 12 times.\n` +
      `2. Decide the verdict from the run's own log: PASS only if the log shows the run passed; FAIL if any suite failed or the run errored; UNKNOWN otherwise.\n` +
      `3. Name each failing suite in \`failing\`, and put its first failing assertion or error (<=20 lines each, <=3000 chars total) plus the log path in \`evidence\`.`
    const w = await agent(prompt, { schema: E2E_WAIT_SCHEMA, phase: 'Collect e2e', label: `${runName}/e2e-wait:${label}:${r.run_id}`, agentType: 'work-items:verify' }).catch(() => null)
    settled.push(w ? { ...r, ...w } : { ...r, verdict: 'UNKNOWN', evidence: 'e2e verdict collection returned no result' })
  }
  return settled
}

const asExpected = (r) => r.verdict === (r.expected || 'PASS')

function e2eFindings(runs) {
  return runs
    .filter((r) => !asExpected(r))
    .map(
      (r) =>
        `e2e run ${r.run_id} (${r.scope || ''}): ${r.verdict}${r.expected ? ` (expected ${r.expected})` : ''}${(r.failing || []).length ? ` — failing: ${r.failing.join(', ')}` : ''}\n${r.evidence || ''}\n` +
        `This run has finished; do not relaunch it. Fix the cause, then re-run only the failing scenarios; run the full suite only once they pass.`
    )
    .join('\n')
}

// A "blocked" that was only waiting on a verdict becomes green once the verdict is PASS; any
// non-PASS verdict becomes the unit's blocker, with the failing suites and log evidence attached.
async function applyE2EVerdicts(result, label) {
  if (!(result.e2e_runs || []).length) return result
  const runs = await settleE2E(result.e2e_runs, label)
  const notPassed = e2eFindings(runs)
  const passNote = runs.map((r) => `e2e run ${r.run_id} (${r.scope || ''}): ${r.verdict}${r.expected ? ` (expected ${r.expected})` : ''}`).join('; ')
  if (notPassed) {
    const other = result.status === 'blocked' && !result.blocked_only_on_e2e && result.blockers ? `${result.blockers}\n` : ''
    return { ...result, e2e_runs: runs, status: 'blocked', blockers: other + notPassed }
  }
  if (result.status === 'blocked' && result.blocked_only_on_e2e) {
    return { ...result, e2e_runs: runs, status: 'green', blockers: '', green_evidence: `${result.green_evidence || ''}\n${passNote}`.trim() }
  }
  return { ...result, e2e_runs: runs }
}

// ---- Scoping: Classify, Understand, Plan — skipped entirely when units are already given ----
if (!units) {
  phase('Classify')
  const classificationRaw = await agent(
    preamble +
      `Classify this task for the orchestrator pipeline. Task: ${task}\n\n` +
      `Decide: is this security-sensitive (auth, secrets, network policy, access control, PII, crypto, internet-facing — default true if unsure)? ` +
      `Is this small and self-contained enough that the scoping survey can be brief (e.g. confined to one obvious file/location)? It no longer skips that survey — it only sets its depth.`,
    { agentType: 'work-items:classify', schema: CLASSIFY_SCHEMA, phase: 'Classify' }
  )
  if (!classificationRaw) log('Classify call failed — defaulting to security_sensitive=true, small_task=false (fail closed, not fail silent).')
  classification = classificationRaw ?? { security_sensitive: true, small_task: false }

  // Understand always runs. Skipping it on small_task silently voided two things at once: the
  // implementer lost the scoping notes the prompt below promises it, and the run lost its ONLY
  // path to raise an open question instead of guessing. small_task now sets the survey's depth.
  {
    phase('Understand')
    const scopingResult = await agent(
      preamble +
        `Scope relevant files/context for this task before planning: ${task}\n\n` +
        (classification.small_task
          ? `This task was triaged as small and self-contained — keep the survey short: the files it touches, the conventions binding them, nothing more.\n\n`
          : '') +
        `Report what is relevant and where. Do not raise questions or decide anything — Plan does that.`,
      { agentType: 'work-items:understand', schema: UNDERSTAND_SCHEMA, phase: 'Understand', label: `${runName}/understand` }
    )
    scoping = scopingResult ? scopingResult.context : ''
  }

  phase('Plan')
  const planResultRaw = await agent(
    preamble +
      `Plan this task. Task: ${task}\n` +
      (scoping ? `Scoping notes:\n${scoping}\n` : '') +
      `Decompose into independent units if the task naturally splits (otherwise a single unit covering the whole task). ` +
      `A unit should stand on its own — avoid a split where one unit's requirement is only satisfied jointly with a sibling's, since units are implemented ` +
      `and validated one at a time, sequentially, not as a batch. For each unit: name, description, is_code (testable code vs docs/design/prose with no test ` +
      `surface), repo (only if this task spans more than one repository — omit otherwise), ordered steps, files touched, and a test strategy.\n\n` +
      `This runs unattended — nothing downstream can ask the user anything. A question you raise in open_questions stops the run for a human answer, ` +
      `so raise only a real one. Units run one at a time, sequentially, and are grouped for execution by file overlap, so keep \`files\` accurate.`,
    { agentType: 'work-items:plan', schema: PLAN_SCHEMA, phase: 'Plan', label: `${runName}/plan` }
  )
  if (!planResultRaw) log('Plan call failed — no units returned.')
  // Drop out before any worktree exists or anything is built: the whole point is to stop cheap.
  if (planResultRaw && (planResultRaw.open_questions || []).length > 0) {
    log(`Stopping after Plan: Plan raised ${planResultRaw.open_questions.length} question(s) it can't answer itself.`)
    return {
      run_name: runName, task, item, status: 'needs-answers', resolved: false,
      open_questions: planResultRaw.open_questions, scoping,
      branch, base_ref: baseRef, workdir, units: [], escalations: [], commits: [], tree_clean: true, ledger: [],
      blockers: ['stopped after Plan — open questions need a human answer; re-invoke with args.answers set'],
    }
  }
  units = planResultRaw ? planResultRaw.units : []

  if (planOnly) {
    // Caller (preflight) wants the shape of the work before creating any worktree — cluster
    // by unit.repo, one worktree/branch per repo, then re-invoke per cluster with units set.
    return {
      run_name: runName, task, item, status: 'scoped', resolved: false,
      classification, scoping, units, open_questions: [],
    }
  }
  // No planOnly, no pre-supplied units: the simple ad-hoc path — plan then run straight
  // through in this same call (typically no workdir/branch at all: current checkout, no git).
}
// Execution mode entered directly with units but no classification (a caller that skipped the
// scoping call) — fail closed rather than crash on classification.security_sensitive below.
if (!classification) classification = { security_sensitive: true, small_task: false }

if (!units || units.length === 0) {
  log('No units to implement — nothing to do.')
  return {
    run_name: runName, task, item, status: 'unresolved', resolved: false,
    classification, scoping, units: [], escalations: [{ task: '(plan)', reason: 'plan returned no units', findings: '' }],
    branch, base_ref: baseRef, workdir, commits: [], tree_clean: true, ledger: [],
  }
}

// ---- Execution: each unit runs its own implement -> validate -> (security) loop, sequentially ----
const MAX_UNIT_ITERATIONS = 3
const MAX_REPAIR_ROUNDS = 2

const unitByName = {}
for (const u of units) unitByName[u.name] = u
const implByName = {}
const committedUnits = []
const escalations = [] // {task, reason, findings} — the summarized decision postflight hands to the human
const ledger = [] // one entry per unit — the run's history, returned to the caller

phase('Implement')
if (ciFailure) {
  for (const u of units) committedUnits.push(u.name)
  log('CI failure given — skipping the unit loop, entering a repair round.')
}
for (const unit of ciFailure ? [] : units) {
  let attempt = 0
  let retryContext = ''
  let lastFindings = null
  let unitResolved = false

  while (attempt < MAX_UNIT_ITERATIONS && !unitResolved) {
    attempt++
    const impl = await implementUnit(unit, retryContext, `iter${attempt}`)
    implByName[unit.name] = impl

    let findings = null
    if (impl.status === 'blocked') {
      findings = `Blocked: ${impl.blockers || 'no reason given'}`
    } else if (branch && impl.committed === false) {
      // Uncommitted work is invisible to the branch-wide Verify — `git diff baseRef...HEAD` comes
      // back empty for this unit and passes trivially, so the run reports resolved on an empty
      // branch. Strictly `=== false`: the schema does not require `committed`, and an omitted
      // field means "did not say", which the commit sweep still catches.
      findings = `Not committed: the implementer reported committed=false for ${JSON.stringify(impl.files_changed || [])}, so this unit contributes nothing to the branch diff every gate downstream reads. Commit this unit's files.`
    } else {
      phase('Validate')
      const req = await agent(
        preamble +
          `Task: ${task}\nUnit: ${unit.name} — ${unit.description || ''}\n` +
          `Check whether the implementation satisfies this unit's stated requirement — independent of whether its own test passes, that was already ` +
          `established by the red/green cycle. Look for the actual behavior the requirement describes, not just that some test is green.\n` +
          `Steps: ${JSON.stringify(unit.steps)}\nFiles changed: ${JSON.stringify(impl.files_changed)}\nClaimed evidence: ${impl.green_evidence || ''}`,
        { agentType: 'work-items:requirements-check', schema: REQUIREMENTS_CHECK_SCHEMA, phase: 'Validate', label: `${runName}/validate:${unit.name}:iter${attempt}` }
      )
      if (!req || !req.satisfied) {
        findings = `Requirements not met: ${req?.gap || (req ? 'no gap description given' : 'requirements check returned no result — treating as unmet')}`
      } else if (classification.security_sensitive) {
        phase('Security Review')
        const sec = await agent(
          preamble +
            `Review for security issues. Task: ${task}\nUnit: ${unit.name}\nFiles changed and awaiting review: ${JSON.stringify(impl.files_changed)}\n` +
            // A trailing `--` with an empty pathspec diffs the WHOLE branch rather than nothing,
            // so an implementer reporting no files silently widened the review to everything.
            // Say so explicitly instead of emitting a command that lies about its scope.
            (branch
              ? (impl.files_changed || []).length > 0
                ? `Read the change with \`git diff ${baseRef}...HEAD -- ${impl.files_changed.join(' ')}\` in ${workdir} (plus \`git status --porcelain\` for anything uncommitted).`
                : `The implementer reported NO changed files — review the whole branch and say so if it is empty: \`git diff ${baseRef}...HEAD\` in ${workdir} (plus \`git status --porcelain\`).`
              : ''),
          { agentType: 'work-items:security-review', schema: SECURITY_REVIEW_SCHEMA, phase: 'Security Review', label: `${runName}/security:${unit.name}:iter${attempt}` }
        )
        const confirmed = sec ? sec.confirmed : [{ description: 'security review call failed to return a result — treating as unresolved', severity: 'unknown' }]
        if (confirmed.length > 0) {
          findings = confirmed.map((f) => `Security finding — ${f.description} (${f.severity || 'unrated'})`).join('\n')
        }
      }
    }

    if (!findings) {
      unitResolved = true
      break
    }

    lastFindings = findings
    retryContext = findings
  }

  const escalated = escalations.some((e) => e.task === unit.name)
  if (unitResolved) committedUnits.push(unit.name)
  else if (!escalated) escalations.push({ task: unit.name, reason: `hit ${MAX_UNIT_ITERATIONS} attempt(s) without resolving`, findings: lastFindings })

  ledger.push({ task: unit.name, attempts: attempt, resolved: unitResolved, findings: unitResolved ? '' : lastFindings || '' })
  log(`Unit "${unit.name}": ${unitResolved ? `resolved after ${attempt} attempt(s)` : `not resolved — ${escalations.find((e) => e.task === unit.name)?.reason}`}`)
}

// ---- Full Verify: once per branch, against everything committed, not per unit ----
// all_passed defaults to FALSE and `skipped` disqualifies `resolved` below: a run that never
// verified has not passed. Defaulting it to true is what let a no-branch (ad-hoc) run report
// resolved with zero checks ever run. Verify no longer needs a branch — without one it reads the
// working tree instead of a branch diff.
let verification = { checks: [], all_passed: false, skipped: true, reason: 'full verify did not run' }
if (committedUnits.length > 0) {
  phase('Full Verify')
  // A repair round re-runs what failed first: a full e2e suite costs far more than its failing
  // scenarios, and paying for it while those are still red only re-reports the same failure.
  const failuresFirstNote = (previousFailures) =>
    previousFailures
      ? `This is a repair round. The previous verify failed with:\n${previousFailures}\n` +
        `FIRST re-run only those failing checks — for e2e, only the failing scenarios. If any still fails, stop there: report it as failed and do NOT run the full suite. ` +
        `Only when every previously failing check passes, run the full suite below.\n`
      : ''
  const runFullVerify = async (round, previousFailures) => {
    const scopedUnits = committedUnits.map((n) => unitByName[n])
    const scopedStrategy = scopedUnits.map((u) => ({ name: u.name, test_strategy: u.test_strategy, claimed_green_evidence: implByName[u.name]?.green_evidence }))
    const allFiles = [...new Set(scopedUnits.flatMap((u) => implByName[u.name]?.files_changed || []))]
    // allFiles is what's new/changed and needs a first look; it is NOT the boundary of what to
    // check — a fix scoped to one unit's files can still break another unit through a dependency
    // no unit declared. The full project suite is what actually catches that, not a file list.
    const result = await agent(
      preamble +
        `Verify this change. Task: ${task}\nUnits implemented${branch ? ` on ${branch}` : ''} so far: ${JSON.stringify(committedUnits)}\nFiles changed: ${JSON.stringify(allFiles)}\n` +
        `Inspect the change with \`${branch ? `git diff ${baseRef}...HEAD` : 'git diff HEAD'}\`${workdir ? ` in ${workdir}` : ''}. Do not commit anything yourself.\n` +
        `Test strategy / claimed evidence per unit: ${JSON.stringify(scopedStrategy)}\n` +
        failuresFirstNote(previousFailures) +
        `Run the project's normal full lint/test suite, not just checks scoped to the files listed above — those are what to focus on, not a boundary on what to run.\n` +
        `Report head_sha (\`git rev-parse HEAD\` at the start). ` +
        `Report every long e2e run in e2e_runs (run_id, wait_command, scope, verdict, failing suite names, a short log excerpt of each failure) — not as a separate check. ` +
        `An e2e run still going when you must stop is verdict PENDING: set all_passed from the checks you did finish, and the orchestrator collects the rest.`,
      { agentType: 'work-items:verify', schema: VERIFY_SCHEMA, phase: 'Full Verify', label: `${runName}/full-verify:round${round}` }
    )
    if (!result) return { checks: [{ command: 'verify agent call', result: 'no result returned', passed: false }], all_passed: false, skipped: false }
    // A verify that could not wait out its e2e run said PENDING; the verdict is collected here and
    // a non-PASS becomes a failed check carrying the failing suites, which is what repair reads.
    const runs = await settleE2E(result.e2e_runs, `verify:round${round}`)
    const e2eChecks = runs
      .filter((r) => !asExpected(r))
      .map((r) => ({ command: r.wait_command, result: e2eFindings([r]), passed: false }))
    const checks = [...(result.checks || []).filter((c) => !runs.some((r) => !asExpected(r) && c.command === r.wait_command)), ...e2eChecks]
    const hadPending = (result.e2e_runs || []).some((r) => r.verdict === 'PENDING')
    const allPassed = (hadPending || result.all_passed === true) && e2eChecks.length === 0 && checks.length + runs.length > 0 && checks.every((c) => c.passed)
    return { ...result, checks, e2e_runs: runs, all_passed: allPassed, skipped: false }
  }

  let repairRound = 0
  let lastFailFindings = null
  let seededFailure = ciFailure ? `CI failed on the pushed PR:\n${ciFailure}` : null
  while (true) {
    if (!seededFailure) {
      verification = await runFullVerify(repairRound, lastFailFindings)
      if (verification.all_passed) break
    }
    const findings = seededFailure || verification.checks.filter((c) => !c.passed).map((c) => `Verify failed — ${c.command}: ${c.result || 'failed'}`).join('\n')
    const failedChecks = seededFailure ? [] : verification.checks.filter((c) => !c.passed)
    seededFailure = null

    if (repairRound >= MAX_REPAIR_ROUNDS) {
      escalations.push({ task: 'full-verify', reason: `full verify still failing after ${MAX_REPAIR_ROUNDS} repair round(s)`, findings })
      break
    }
    lastFailFindings = findings
    repairRound++

    // Attribute failing checks to the committed unit that owns the file; unattributed findings
    // (e.g. a repo-wide lint rule) retry every committed unit rather than guessing narrow.
    const implicated = new Set()
    let unmatched = false
    for (const c of failedChecks) {
      const direct = c.unit && unitByName[c.unit] ? [c.unit] : []
      const viaFiles = (c.files || []).map((f) => unitOwning(unitByName, f)).filter(Boolean)
      const owners = [...new Set([...direct, ...viaFiles])]
      if (owners.length) owners.forEach((o) => implicated.add(o))
      else unmatched = true
    }
    const toFix = unmatched || implicated.size === 0 ? committedUnits : Array.from(implicated)
    log(`Full Verify round ${repairRound}: repairing unit(s) ${toFix.join(', ')}.`)
    for (const name of toFix) {
      const fix = await implementUnit(unitByName[name], findings, `repair${repairRound}`)
      implByName[name] = fix
      if (fix.status === 'blocked') escalations.push({ task: name, reason: 'blocked during post-verify repair', findings: fix.blockers || '' })
    }
  }
}

// Commit sweep — the calling session pushes this branch and opens a PR from it, so the tree
// must be clean and the history must contain exactly what the gates just looked at. Runs
// regardless of outcome: an escalated run's work still has to be pushable, not stranded.
let commitOutcome = { tree_clean: true, commits: [], notes: 'no branch given — this run did not touch git', skipped: true }
if (branch) {
  phase('Commit')
  const sweep = await agent(
    preamble +
      `Commit sweep for this run — do not implement, fix, or refactor anything.\n` +
      `1. \`git status --porcelain\` in ${workdir}. 2. If anything is uncommitted, stage and commit it with a conventional-commit subject describing what it is` +
      `${item && item.id ? ` and referencing ${item.id}` : ''} (an implementer left it behind; do not judge whether it should exist). ` +
      `3. Report head_sha (\`git rev-parse HEAD\` after any commit), the tree state and the commit subjects on ${branch} since ${baseRef} (\`git log --oneline ${baseRef}..HEAD\`).\n` +
      `Never push, never rebase, never amend a commit that is already there, never checkout another branch.`,
    { agentType: 'work-items:commit-sweep', schema: { type: 'object', properties: { tree_clean: { type: 'boolean' }, commits: { type: 'array', items: { type: 'string' } }, notes: { type: 'string' }, head_sha: { type: 'string' } }, required: ['tree_clean', 'commits'] }, phase: 'Commit', label: `${runName}/commit-sweep` }
  )
  commitOutcome = sweep
    ? { ...sweep, skipped: false }
    : { tree_clean: false, commits: [], notes: 'commit sweep call returned no result — treat the worktree as dirty and check it before pushing', skipped: false }
  if (!commitOutcome.tree_clean) log(`Commit sweep did not leave a clean tree in ${workdir} — the calling session must check before pushing.`)
}

phase('Report')
const resolved =
  escalations.length === 0 &&
  verification.skipped !== true &&
  verification.all_passed &&
  committedUnits.length === units.length
if (resolved) log(`Resolved — ${committedUnits.length}/${units.length} unit(s) committed, full verify passed.`)
else log(`Not resolved — ${escalations.length} escalation(s): ${escalations.map((e) => `${e.task} (${e.reason})`).join('; ') || 'none named, check verification'}.`)

const implemented = Object.values(implByName)
return {
  run_name: runName,
  task,
  item,
  status: resolved ? 'resolved' : escalations.length > 0 ? 'escalated' : 'unresolved',
  resolved,
  units_total: units.length,
  units_committed: committedUnits,
  escalations, // the summarized decision the human owes this run, if any — postflight surfaces these verbatim
  branch,
  base_ref: baseRef,
  workdir,
  commits: commitOutcome.commits,
  tree_clean: commitOutcome.tree_clean,
  // Merge gate input: equals the sha Full Verify ran on only when the sweep committed nothing after it.
  verified_sha: verification.head_sha && commitOutcome.head_sha === verification.head_sha ? verification.head_sha : null,
  head_sha: commitOutcome.head_sha || null,
  commit_notes: commitOutcome.notes,
  open_questions: [],
  security_sensitive: classification.security_sensitive,
  files_changed: [...new Set(implemented.flatMap((r) => r.files_changed || []))],
  units: implemented,
  verification,
  blockers: implemented.filter((r) => r.blockers).map((r) => `${r.name}: ${r.blockers}`),
  ledger,
}
