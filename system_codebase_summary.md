# SIKAD — System and Codebase Summary

SIKAD ("Find your next move") is a time-management app for students. The student tells it about their classes, routine and tasks; it builds a realistic schedule around the things that cannot move, always answers "what should I do now?", and replans when the day changes. The student approves every change.

This is the one reference for how SIKAD works and where everything is in the code. It replaces the earlier `system_summary.md` and `codebase_summary.md`. It describes the prototype as it is in the code on 14 Oct 2026 (commit `75578f0` plus uncommitted changes); line counts, sizes and line numbers are from that working tree. Where the app does not yet do what a rule says, the gap is named here and detailed in [errors.md](errors.md) §10–§11. To demonstrate the app, follow [user_flow.md](user_flow.md). To test it by hand, follow [test-guide.md](test-guide.md).

## 1. Purpose and product overview

- A web app that installs to a phone's home screen (a PWA). It also works in a desktop browser.
- Plain HTML, CSS and JavaScript. No framework, no build step, no server, no account.
- Everything the student enters is saved in the browser on that device only.
- **Run it:** open `index.html`, or run `python3 -m http.server` and visit `http://localhost:8000`.

## 2. Technology stack and runtime constraints

| | |
|---|---|
| Type | Installable PWA, single page |
| Stack | Plain HTML, CSS and JavaScript. No framework, no libraries, no build step, no `package.json` |
| Run | Open `index.html`, or `python3 -m http.server` and visit `http://localhost:8000` |
| Tests | `node tests/run-tests.js` (108 logic tests, no dependencies) |
| Storage | One state object in `localStorage` under `tempo-state-v1`; theme choice under `sikad-theme`; widget preview sizes under `sikad-widget-sizes`; the Demo clock's shift in session storage (`sikad-clock-shift`, one tab) |
| Network | None. No backend, no API calls, no AI model. All "AI" behaviour is deterministic JavaScript rules |
| Modules | Classic `<script>` tags. Each file is an IIFE that attaches one global (`window.Tempo*`) |

Constraints that follow from this (and from `CLAUDE.md`): no framework, library, npm package or build step may be added; no new fonts or colours outside the tokens in `design.md`; `js/parser.js` and `js/engine.js` keep their behaviour and JSON contracts except where a change was explicitly authorized; every existing `data-action` name keeps working.

## 3. Folder structure and application entry points

### 3.1 Folder tree

```
hexlabs-project/
├── index.html                    App shell: mount points + script tags
├── sw.js                         Service worker (offline app shell)
├── manifest.webmanifest          PWA install manifest
├── css/
│   └── styles.css                All styles and design tokens (1,424 lines)
├── js/
│   ├── time.js                   Wall-clock time helpers            → TempoTime
│   ├── data.js                   Sample/demo data                   → TempoData
│   ├── parser.js                 Text → structured intents          → TempoParser
│   ├── engine.js                 Scheduling engine                  → TempoEngine
│   ├── store.js                  State, persistence, transitions    → TempoStore
│   ├── focus.js                  Focus Mode methods and timer       → TempoFocus
│   ├── assistant.js              Ask SIKAD question answering       → TempoAssistant
│   ├── motion.js                 FLIP animation layer               → TempoMotion
│   └── app.js                    UI layer: render + actions (3,712 lines)
├── fonts/                        Self-hosted variable fonts + licences
├── icons/                        SVG logo mark and wordmark
├── tests/
│   └── run-tests.js              Node logic tests
├── prompts/                      The prompts and briefs used to build the app
│   ├── prompt-1/ … prompt-9/
├── .claude/
│   └── skills/                   Six vendored agent skills (design guidance)
├── skills-lock.json              Source + hash of each vendored skill
├── CLAUDE.md                     Build rules for AI-assisted work
├── README.md                     Project overview and demo script
├── design.md                     Design system and UI specification
├── motion-spec.md                Motion specification
├── SIKAD-UIUX-AUDIT-REPORT_v3.md UI/UX audit with finding IDs
├── build-prompts_v3.md           Batch-by-batch build prompt pack
├── process-log.md                Log of every change, why, and how it was tested
├── system_codebase_summary.md    This file: how the system works and where everything is
├── user_flow.md                  Demonstration guide for presenters
├── errors.md                     Catalogue of error and problem states
└── test-guide.md                 Five manual tests, test log, correction log
```

There is no `.gitignore`, `node_modules`, `package.json` or build output. What is in the repo is what ships.

### 3.2 Runtime files (root)

#### `index.html` (3 KB)
The only HTML page. It holds no screen markup; `app.js` renders everything.

- `<head>`: viewport with `viewport-fit=cover`, theme colour `#294B3A`, inline SVG favicon, manifest link, font preload, and a small inline script that applies the saved light/dark choice before first paint so there is no flash.
- `<body>` mount points:
  - `#intro` — the opening logo animation (hidden under reduced motion)
  - `#app` — every screen renders here
  - `#spotlight` — the dim layer for Focus Mode (`data-action="spotlightOff"`)
  - `#sheet-root` — bottom sheets and dialogs
  - `#toast-root` — toasts, including Undo
- Script load order, which is also the dependency order:
  `time → data → parser → engine → store → focus → assistant → motion → app`

#### `sw.js` (1 KB)
Service worker, cache name `sikad-shell-v2`. Network first, so a new deploy always wins when online; the cache is only used when the network fails. Caches the shell (HTML, CSS, manifest, icon, all nine JS files). Same-origin `GET` requests only. Registered at the end of `js/app.js`, and only on `http:`/`https:` (not on `file://`).

#### `manifest.webmanifest` (0.5 KB)
PWA manifest: name, `standalone` display, portrait orientation, Paper background `#F7F5EC`, Forest theme `#294B3A`, and `icons/sikad.svg` as both the `any` and `maskable` icon.

### 3.3 `fonts/` and `icons/`

| File | Purpose |
|---|---|
| `fonts/Inter-Variable.woff2` | Inter, Latin subset (body text) |
| `fonts/Inter-Variable-LatinExt.woff2` | Inter, Latin Extended subset |
| `fonts/PlusJakartaSans-Variable.woff2` | Plus Jakarta Sans, Latin subset (headings) |
| `fonts/PlusJakartaSans-Variable-LatinExt.woff2` | Plus Jakarta Sans, Latin Extended subset |
| `fonts/OFL-Inter.txt`, `fonts/OFL-PlusJakartaSans.txt` | SIL Open Font License 1.1 texts |
| `icons/sikad.svg` | The route mark (an S-shaped path). App icon, apple-touch-icon |
| `icons/sikad-whole.svg` | Wordmark: S mark + "IKAD" |

### 3.4 Documentation files (root)

| File | Lines | What it is |
|---|---:|---|
| `README.md` | 137 | Overview, 4-minute demo script, spec-to-code map, what is simulated, known limitations |
| `CLAUDE.md` | 20 | Build rules: stack limits, protected files, product-vs-prototype rules, how to work and report |
| `design.md` | 421 | Source of truth for design: brand, principles, "Grounded Path" direction, typography, colour, components, status states, motion, screen specs, copy |
| `motion-spec.md` | 205 | Motion tokens, technology, each interaction, overlap rules, reduced motion, acceptance criteria |
| `SIKAD-UIUX-AUDIT-REPORT_v3.md` | 191 | The audit: verdict, journey table, findings (IDs such as `F02`, `R07`, `S03`), rubric mapping, backlog |
| `build-prompts_v3.md` | 259 | The prompt pack that turns audit findings into batches (Patch 1 through Batch 12, final regression) |
| `process-log.md` | 155 | Running log, one entry per batch: what changed, which finding it addresses, one test and its result |
| `user_flow.md` | 856 | Demonstration guide for presenters: a fixed starting state (Demo clock on next Monday 9:05 AM, Alex's week), a 12-stop main route with the expected result of every step, nine optional scenarios, recovery, and what was verified (untracked in git as of this writing) |
| `errors.md` | 354 | Every error and problem state by area, plus confirmed defects and things that still need testing |

| `test-guide.md` | 293 | Five manual tests for the user/developer, with a test log and a correction log. All start as NOT RUN |
| `system_codebase_summary.md` | — | This file. It replaces the earlier `system_summary.md` and `codebase_summary.md` |

How they relate: `design.md` and `motion-spec.md` say what the app should be → the audit report says where it falls short → `build-prompts_v3.md` turns findings into batches → `process-log.md` records what was done.

### 3.5 `prompts/` — build history

The prompts given to the AI assistant, kept in order. Reference material only; nothing here is loaded at runtime.

| Folder | Files | Purpose |
|---|---|---|
| `prompt-1/` | `prompt.md`, `user_story.md` | The master system prompt for the SIKAD engine (the contract `parser.js` and `engine.js` implement) and the detailed product user story |
| `prompt-2/` | `updated_context.md`, `design-audit.md` | The brief for a product/brand/design-system audit, and the resulting audit (Phases A and B) |
| `prompt-3/` | `integrate.md`, `sikad-design-system.css` | Instruction to integrate a design-system export, and the export itself (a compiled Tailwind/Vite build, 113 KB). Only its colour tokens were mapped into `css/styles.css` |
| `prompt-4/` | `add-skills.md` | Setup instructions for the agent skills in `.claude/skills/` |
| `prompt-5/` | `sikad_final_implementation.md` | The final implementation brief: Ask SIKAD, proposals, Focus Mode, weekly progress |
| `prompt-6/` | `update_design.md` | Apply the updated `design.md`, write the motion spec, polish the UI |
| `prompt-7/` | `followup-batch13-sample-data.md` | Batch 13: switch the sample data to the BSIT 3B-G1 DBA fixture |
| `prompt-8/` | `sikad-fixes-ui-implementation.md`, `sikad-profile-update.md`, `update-logo.md` | Real clock, confirmations, pill nav, motion; the Profile editors; the S-shaped logo |
| `prompt-9/` | `updates.md` | Home Today card, weekly task progress, Overview weekly summary |

### 3.6 `.claude/` and `skills-lock.json` — agent tooling

Not part of the app. These guide AI-assisted design work on the repo.

`skills-lock.json` records the GitHub source and content hash of each skill vendored into `.claude/skills/`:

| Skill | Source | Contents |
|---|---|---|
| `design-taste-frontend` | `leonxlnx/taste-skill` | One `SKILL.md` |
| `frontend-design` | `anthropics/skills` | `SKILL.md`, licence |
| `make-interfaces-feel-better` | `jakubkrehel/make-interfaces-feel-better` | `SKILL.md` plus notes on animations, icons, performance, surfaces, typography |
| `motion-design` | `lottiefiles/motion-design-skill` | `SKILL.md` plus `director/` (8 principle notes), `patterns/` (4), `reference/` (4) |
| `ui-ux-pro-max` | `nextlevelbuilder/ui-ux-pro-max-skill` | `SKILL.md`, `references/`, `data/` (CSV/JSON catalogues of styles, colours, fonts, icons, and 22 per-stack guides), `scripts/` (Python search tools with their own tests) |
| `web-design-guidelines` | `vercel-labs/agent-skills` | One `SKILL.md` |

`ui-ux-pro-max/data/` holds the largest files in the repo (two are over 700 KB). They are reference catalogues and are never served to the browser.

## 4. Student setup and everyday user journey

### 4.1 First-time setup

| Step | What the student does |
|---|---|
| Welcome | Types a name and taps **Get started**. |
| 1. Set your baseline | Adds classes by uploading a COR / schedule photo, trying the sample schedule, or typing one class per line. |
| 2. A few quick questions | Says when the day starts and ends, whether they work, and whether they are in a school organization. |
| 3. Bring in your due dates | Optionally connects platforms (Google Calendar, Canvas, Teams, Classroom) and reviews what came in. |
| 4. Brain dump | Types or dictates everything on their plate, in their own words. |
| Review before planning | Checks the classes, commitments and tasks SIKAD understood, fixes anything wrong, then generates the plan. |

Setup always uses a 15-minute buffer, a 30-minute morning routine and the chosen commute; the last two can be changed later in Profile.

### 4.2 When plans change

| The student… | SIKAD… |
|---|---|
| Taps **Done** | Strikes the task through, credits the time, and shows the next task. |
| Taps **Snooze** | Moves the task to the next open block after its current one and shows before → after times, with Undo. A task the student pinned to a time has its pin cleared, so it moves too. |
| Reports a new commitment | Protects it as fixed and moves tasks around it, after approval. |
| Lets a planned block's time pass | Marks nothing done. Asks how it went (**Completed**, **Partly done**, **Not finished**) and holds that block's time until the student answers (§9). |
| Has more work than time | Says "Not enough time" and offers **A plan that fits**: the fewest, lowest-priority tasks finish late, each shown with how late. The student accepts or keeps the current plan. Nothing is shortened and no deadline is edited. |

**Undo** restores the state from just before the last change. It is one level deep, lives on the toast (about 5 seconds or more), and is cleared by a page reload, a new day, a new check-in, or a change arriving from another tab.

## 5. Home, Overview, Tasks, Profile and Ask SIKAD

The app has four tabs and a centre **Ask SIKAD** button.

**Home** — the daily screen, read top to bottom:

1. **What to do next.** One task, when to do it, and a "Why this?" explanation. Three buttons: **Start task**, **Done**, **Snooze**.
2. **Today.** Task time still left today, tasks completed out of today's total, and **View schedule →**, which jumps to today's timeline.
3. **Weekly task progress.** Percent of planned task time completed, completed versus planned time, whether the remaining work **Fits**, and **View weekly overview →**.
4. **Timeline.** Today or tomorrow as a path of classes and other fixed commitments (with a lock), commutes, the morning routine, an optional lunch hour, tasks, completed and missed blocks, and open time of 45 minutes or more.

When something needs attention, a card appears near the top: **Plan updated** (what moved, before → after), **Not enough time**, a missing deadline ("When is … due?"), or a **check-in** ("Your scheduled time for … has ended. How did it go?") for a block that ended without a report (§9). **Undo** is a button on the toast that follows each change, not on the Plan updated card.

**Overview** — the week, Monday to Sunday:

- **Weekly summary:** *Your time budget* (usable hours for tasks after fixed commitments), *Tasks remaining*, and *Time needed*.
- Seven day cards, each with the task time planned that day and a bar showing how much of the day's open time that takes. Tapping a day shows its timeline.
- Arrows move between weeks. Past weeks show what was done, missed or moved.

**Tasks** — every task, grouped into *Needs attention*, *Up next* and completed. A task can be opened to change its time needed (hours and minutes), its deadline (date and time), an optional start time, or its steps, or added manually. The three are separate fields: changing the deadline does not move the work, and a start time does not change the deadline. A refused value (no time needed, a start in the past, outside the day, or ending after the deadline) is explained under the field and changes nothing.

**Profile** — class schedule, recurring commitments, *Your day* (day start, when to stop scheduling, commute, morning routine, an optional protected lunch hour), appearance (Light / Dark / System), connected platforms, **Test widgets** and **Test notifications** (in-app previews, §11), a plain statement of how SIKAD plans and what is simulated, and Reset.

**Ask SIKAD** — the centre button. The student types or taps to speak. It does two things:

- **Answers questions** from the live plan, such as "How much usable time do I have tomorrow?" or "Can I finish everything before Friday?"
- **Takes changes**, such as "I have a work shift tomorrow from 6 PM to 10 PM" or a new task. SIKAD shows what it understood, then a proposal of what would move. Nothing changes until the student taps **Accept changes**.

### 5.1 Ask SIKAD commands

Besides adding tasks and commitments, Ask SIKAD can act on a saved task named by its title. These are fixed patterns in `js/parser.js` (`taskCommand`), not unrestricted language.

| Say | Result |
|---|---|
| "Move X to 8 PM tomorrow [if it fits]", "Schedule X for the next available slot", "Move X to Friday" | Reschedule. The time is a start time, never a deadline. |
| "Change X to 2 hours" | Time needed |
| "Change the deadline for X to Friday at 5 PM" | Deadline only |
| "Rename X to Y" · "Mark X as hard" · "Set X to high priority" | Name, difficulty, priority |
| "Remove X" / "Delete X from my tasks" | Removal, confirmed on the proposal |
| "Mark X as done" | Completion |
| "I finished half of X; I still need 45 minutes", "X took longer than expected" | Progress; the remaining time is asked for if not given |
| "Show me the tasks due tomorrow", "When is X?" | Answer only |
| "What happens if I move X to 8 PM?" | Preview on a copy; nothing changes |

Title matching: a full title in the message wins; otherwise shared title words; two close matches ask which one; no match says so and never creates a task. Every change goes through the same review → proposal → Accept/Reject → Undo flow and the same engine as manual edits (`applyTaskAction` in `js/store.js`). Every row above was run through the parser on 14 Oct 2026 and gave the listed result.

Not supported: notes editing by voice or text command (the reply is that the task "is already in your plan"), moving a commitment (a clarifying question), and several tasks in one command: a message that names two tasks changes neither and asks for one at a time.

## 6. Focus Mode and task outcomes

1. Tap **Start task**. The card expands, the rest of the screen dims, and the session starts.
2. SIKAD picks a working method and says why: Task chunking, Pomodoro, Timeboxing, or no method. **Change** switches it.
3. A timer runs, with Pause and Resume.
4. On **Mark done** or **Stop early**, the student says how it went: **Yes, it's complete**, **Partly done** (and how much is left, in hours and minutes), or **Not yet**. A finished timer never marks the task done.
5. The plan, the Today card and the weekly progress update to match.

Working methods live in `js/focus.js`: `chunking` (one step at a time), `pomodoro` (25 minutes on, 5 off), `timebox` (one bounded block) and `none` (a running timer). Time blocking decides *when* work happens (the engine); a method shapes *how* the student works inside a block already scheduled. A method never changes the plan.

A focus timer and a schedule block are different things. A timer reaching zero, and a block's end time passing, each prove nothing about the work. Only the student's answer credits it: the outcome question here, or a check-in (§9).

## 7. Scheduling pipeline

```
Student input → Understand → Prioritize → Schedule → Next action → Replan
```

| Stage | What happens | File |
|---|---|---|
| Understand | Typed or spoken text becomes classes, commitments, tasks, deadlines and durations. Missing details become a question, never a guess. | `js/parser.js` |
| Prioritize | Tasks are ranked by deadline, priority and dependencies. Overdue work comes first. | `js/engine.js` |
| Schedule | Tasks are placed into the open time left around fixed commitments, before their deadlines. | `js/engine.js` |
| Next action | The next session is picked and its "Why this?" is written. | `js/engine.js` |
| Replan | On any change, the schedule is rebuilt. Sessions that are still valid stay where they are. | `js/store.js` |
| Answer | Questions are answered by reading the same plan every screen uses. | `js/assistant.js` |
| Focus | Working-method suggestions and session timing. | `js/focus.js` |
| Display | All screens, sheets and interactions. | `js/app.js`, `css/styles.css` |
| Motion | Cards slide to their new slots after a replan; reduced-motion is respected. | `js/motion.js` |

### 7.1 Rules the engine always follows

- Fixed commitments (classes, recurring work or organization commitments, one-time events) are never moved by SIKAD. They show a lock.
- Commutes (before the first and after the last face-to-face class of a day), the morning routine and the optional lunch hour are worked out from the baseline. They block time like fixed commitments but are drawn without a lock.
- Every task gets a 15-minute buffer from other tasks and from fixed commitments. There is none after the last task of the day.
- A task's remaining time is never shortened to make a plan fit.
- Time passing never completes or credits work. A block that ends without a report becomes a question for the student, and its minutes wait, unplaced, until it is answered (§9).
- A task is never scheduled after its deadline. If it cannot fit, SIKAD says so. Two exceptions, both visible to the student: a task that is already overdue is kept and planned as early as possible, and a task the student agreed may finish late (an accepted "plan that fits") is marked **Late**.
- Work is planned inside the student's day (start to "stop scheduling after") and at most three weeks ahead.
- One sitting is at most 2 hours. Longer work is split into sessions of at least 30 minutes (60 where possible). A time the student pinned is the exception: it is placed as one block.
- Deadlines are never invented. A task without one waits for the student to add it. "This week", "next week", a date that passed in the last 60 days, and "last Friday" all become a question with two choices; a date that does not exist is refused.
- Durations SIKAD estimated itself are marked with ≈ and "AI estimate".
- Task steps and dependencies stay in order.
- Every replan shows before → after and can be undone (one level, see §4.2).

## 8. Prioritization and adaptive rescheduling

One policy is used everywhere (first plan, replans, Snooze, edits, Ask SIKAD). It lives in `rank()` and `schedule()` in `js/engine.js`.

1. Overdue work first, then anything the student marked "Do this first".
2. **Deadline urgency**, compared by day. Priority pulls a task's urgency earlier (high by 36 hours, medium by 12).
3. **Difficulty**, only among tasks that are urgent on the same day: Hard before Medium before Easy, so harder work gets the earlier, longer blocks. A hard task also gets one uninterrupted sitting when one exists. Difficulty never moves a task ahead of one that is urgent on an earlier day. A task with no stated difficulty counts as Medium.
4. Exact deadline (after the priority pull), then priority, then creation order.

Steps of one task, and tasks that depend on another, always stay in order. A task with no deadline is not scheduled until the student gives one.

Placing, in this order:

1. A time the student asked for is honoured first if it is free of fixed commitments, inside the day, and before the deadline; it may displace other tasks. Snoozing a pinned task clears the pin, so it really moves.
2. A focus session that is running keeps its block.
3. **Overdue unfinished work takes the earliest real slot**, before anything from the previous plan is kept. It keeps its real deadline and is labelled overdue.
4. Every other task is handled once, in rank order. It keeps its sessions from the previous plan when they are still valid, unless that would leave it behind lower-ranked work it can go ahead of. Otherwise it takes the earliest open slot before its deadline.

A task that loses its slot in steps 3 or 4 is placed again in its own turn: later the same day if it fits, otherwise on the next day with room before its deadline. Because every task is re-evaluated in rank order, one change carries across as many days as it needs to within the three-week window; displaced work is not all pushed to tomorrow. Sessions that are still valid and in order do not move. On every replan the engine also builds a plan from scratch and uses it instead of the stable one only when it fits more work or finishes important work clearly earlier.

**Deadline rescue.** If that leaves out work that could still meet its deadline, the engine tries plain earliest-deadline order with already-overdue work last, and uses it only when it fits strictly more.

**Overruns.** When the student reports on work that was happening now (Done, Partly done, session ended), the next task starts no sooner than 15 minutes later. A session that was due to start before then is placed again with its full duration: later today if it fits, otherwise on the next day that has room before its deadline, where it is ranked with everything else. Three different outcomes are reported: *At risk today*, *Won't fit today*, and *Not enough time before the deadline*.

**Too much work.** When something still has no slot before its deadline, SIKAD does not stop at the warning. `suggestAdjustment()` in `js/store.js` works out a plan that fits, on a copy: it lets one competing task at a time finish after its deadline (lowest priority first, then the one that already did not fit, then the later deadline), stops as soon as everything has a place, and then puts back any choice that turned out not to be needed, most important first. Nothing is shortened, no deadline is edited and no fixed commitment moves. The student sees which tasks would be late and by how much, and accepts or rejects it. An accepted late task is placed as early as the on-time work allows, is marked **Late**, and returns to on time automatically if room appears.

The same policy and the same engine call serve every entry point: the first plan, Done, Snooze, a task edit, an Ask SIKAD change, the end of a focus session, and an answered check-in. None of them has a scheduling rule of its own.

### 8.1 One pipeline for every change

Every change that affects the schedule goes the same way, whatever started it (adding a task, editing its time needed, deadline, start, priority or difficulty, Snooze, a check-in answer, an Ask SIKAD command, **Adjust schedule**):

`the change → a copy of the state → the engine replans the whole three-week horizon → the result is checked → before → after list and reasons → the student accepts → the copy replaces the state in one step → every screen reads the new plan`

No screen moves a schedule entry by itself. Changes that need approval are shown first; direct edits (Task details, Add a task, Done, Snooze) apply at once with Undo. Either way the plan is rebuilt by `replan()` in `js/store.js`.

**Hard constraints** are checked first and are never traded against a preference: a real time; not in the past; inside the student's day; finished by the deadline (unless the task is already overdue or the student agreed to a late finish); clear of every fixed commitment and its 15-minute gap; steps and dependencies in order; the full remaining time. **Preferences** come after, in a fixed order with no weights: a start time the student asked for; then deadline; then difficulty; then keeping sessions that are still valid and in order. A plan that breaks a hard constraint is never chosen for preserving more sessions.

### 8.2 Adjust schedule: a recommended time, or one the student picks

**Adjust schedule** appears on every "At risk today" and "Won't fit today" row on Home, and as a button on two notifications. It opens its own sheet (it used to open Task details with nothing filled in).

The sheet shows the task, the time it still needs, when it is planned now, its deadline, and a **recommended** date and time with the reason. The date and time fields are pre-filled with the recommendation. Under them is the plan that would result: every task that moves, before → after, and any warning that would remain.

The recommendation comes from the placement engine, on copies of the state (`recommendAdjustment()` in `js/store.js`):

1. If the task is already planned on a later day, that slot is the engine's own best answer and is the recommendation.
2. Otherwise, today's first open time, if it is earlier than the current slot, makes the task comfortable, and costs no other task its deadline.
3. Otherwise, the first open time on a later day that is still before its deadline. If another task would then take the time freed today and become tight, the sheet says so.
4. Otherwise the earlier time today even though it stays tight; or, if nothing fits, "No better time found" with the way out (change the time needed or the deadline).

The student can keep the recommendation or type another date and time. Each change is checked (`checkStart()`) and, if allowed, worked out again in full (`previewMove()`): the chosen start is honoured, flexible tasks in the way are placed again by the ordinary engine, on later days if need be, and the before → after list is refreshed. A time that cannot be used says exactly why (past; outside the day; ends after the deadline; runs into a named class, shift or commute) and offers the **closest time that works** as a button; **Accept changes** stays disabled until the time is valid. **Use recommended time** returns to the recommendation. **Keep current plan** closes the sheet with nothing changed. **Accept changes** swaps in the worked-out plan in one step, with Undo.

The same `checkStart()` guards the **Start at** field in Task details and in Add a task, so the three places cannot disagree. Add a task now has **Start at (optional)** too.

### 8.3 Where a task stands is derived, never stored

`taskStatus()` in `js/store.js` works out each task's state from the current plan every time it is asked: `done`, `needs_deadline`, `not_enough_time` (no slot before the deadline), `awaiting_answer` (a check-in is open), `in_progress`, or `scheduled`. Only the three unresolved ones put a task under **Needs attention** on the Tasks tab. Nothing is flagged because of what happened earlier, so nothing has to be cleared: when an accepted adjustment gives the task a valid slot, it is simply `scheduled`. A task that has its slot but is past its deadline is listed with the others and keeps its **Overdue** mark.

The Home warnings are derived the same way (§10). A task whose day or time the student chose is not reported as "Won't fit today". "Won't fit today" is read from the saved record of what was planned for today (`daySnapshots`), not from the last change, so it no longer disappears when the Plan updated card clears itself after 12 seconds.

## 9. Missed blocks, check-ins and adjusted schedule proposals

**Time passing never completes anything.** An earlier version marked a block done when its planned end passed. That was removed: scheduled time is not completed work.

**When a block ends without a report.** On opening the app, at each new minute, and when the app comes back to the front, `setClock()` in `js/store.js` looks for task blocks whose planned end has passed (`noteMissed`). Each one becomes a **check-in**, once, tied to its task and its block. A running focus session is never ended this way; blocks of other tasks that pass during it are still noted.

**While the question is open.** Nothing is credited and the task's status does not change. That block's minutes are **on hold**: the engine leaves them out when it plans (`units()` in `js/engine.js`), so they are not moved behind the student's back. Weekly progress still counts them as planned work. The timeline shows the block as "Ended · waiting for your answer". Home shows a card: "Your scheduled time for … has ended. How did it go?" Up to three cards show at once, oldest first.

| Answer | What happens |
|---|---|
| **Completed** | That block is credited, dated on the day it was planned, and the plan is rebuilt. A split task or a task with steps is finished only when nothing is left. Applied at once; the toast offers Undo. |
| **Partly done** | The student enters the time still needed, in hours and minutes. The finished part is credited and only the remainder is planned. Shown as a proposal first. |
| **Not finished** | Nothing is credited. The work that was on hold is planned again. Shown as a proposal first. |

There is no "dismiss". A card that is not answered stays, and a rejected proposal leaves it in place, so silence is never read as "done".

**The proposal ("Recommended schedule").** For Partly done and Not finished, the app applies the answer to a copy of the state (`checkinPartial` / `checkinNotDone`), lets the engine replan the copy, and shows the result in the same proposal sheet Ask SIKAD uses. It lists:

- the unfinished task, the time it still needs, and when it had been planned;
- its recommended new time, shown as was → now, and whether that is today or a later day;
- when it moves to a later day, how much open time today still has before the stop-scheduling time, and that the day is not made longer;
- why it sits where it does (overdue work goes first; otherwise that the slot is still before its deadline);
- every other task that moves, before → after, and across how many days;
- **Not enough time**, naming the work that does not fit, when no on-time slot exists.

These sentences are built in `adjustNotes()` in `js/store.js` from the plan the engine just produced, so the words and the timeline cannot disagree. **Accept changes** replaces the state with the copy in one step (Undo on the toast). **Keep current plan** changes nothing. If the copy does not fit, **A plan that fits** opens straight away, as it does for any overload, with **Don't adjust** to see the plain result.

**How the unfinished work is placed.** By the ordinary engine, with the ordinary policy (§8): an overdue task takes the earliest real slot; anything else is placed by deadline, then difficulty. If it fits today it goes into a real open slot today and the tasks it displaces are placed again. If today has no room before the stop-scheduling time, it goes to the next day that has room before its deadline, and the tasks it displaces there move on in turn, across as many days as needed inside the three-week window. Fixed commitments never move, the 15-minute buffer holds, and no task is shortened.

**The clock going back** (the Demo clock, or a corrected device clock) withdraws a check-in for a block that is ahead again, because it has not been missed after all. It touches no task, credit or edit.

**Saved data from the earlier version.** `state.autoDone` may hold records of blocks that version marked done. Nothing adds to that list now and the clock never reads it. If unseen records exist, Home shows **Marked done by an earlier version** with **I didn't finish** for each (`undoAutoDone`), so the student can still correct them. Check-ins saved by older versions are kept and answered the same way as new ones.

## 10. Completion confidence and user-facing risk states

**What the student sees is a status, a reason and an action. Never a number.** An earlier version showed "At risk · 38%", which did not say what the number meant.

| Actual situation | Shown | Reason shown | Action |
|---|---|---|---|
| The task fits comfortably | The ordinary task card. No warning. | | |
| Planned today, but today is tight | **At risk today**, on the Today card and the task's first block in the timeline | "This task may not fit today." Then the real numbers: the usable time left today, the time the task needs, and how many tasks are planned before it. Further causes appear only when true: its planned start has passed, it is marked hard, its time is an estimate. | **Adjust schedule** (a recommended time, §8.2) |
| Cannot fit in what is left of today, but has a later slot before its deadline | **Won't fit today** | "This task won't fit today, but it has a later slot." Then the work left, the time left today, and the day and time it is planned for. | **Adjust schedule** |
| No slot before its deadline | The **Not enough time** card on Home ("No open block before the deadline"), and "Not enough time before deadline" as the status | The work that does not fit, the usable time before the deadline, and that nothing was shortened and no deadline changed. | **See a plan that fits**, **Review options**, **Adjust** |
| A task has no deadline | "When is … due?" card | SIKAD won't guess a deadline. | Enter the date, **Schedule it** |

**Which state a task is in comes from the plan, not from the score.** "Won't fit today" means the engine placed the task on a later day. "Not enough time" means the engine found no slot before the deadline (`state.unscheduled`), and it always replaces any other state for that task. A low score never says a task is impossible: an at-risk task still has its slot today. A high score cannot hide a missed deadline.

**The score, kept internal.** `completionConfidence()` in `js/engine.js` still computes a rule-based estimate for each task planned today, and it decides only *whether* an "At risk today" warning is shown and how strongly it is coloured. It is not a measured probability and not a model prediction. Every constant is in `CONFIDENCE`.

For each task planned today, in plan order:

- **room** = usable time left today (from now to the end of the day, after fixed commitments) minus the planned time and 15-minute gaps of the tasks before it.
- **ratio** = room ÷ the task's time planned today.
- **score** = 0 at a ratio of 0.5 or less, 100 at 2.0 or more, linear in between.
- Then: −10 if Hard, +5 if Easy, −5 if the duration is an AI estimate, −4 per task queued before it (at most −12), −10 if its planned start has passed and it is not started. Clamped to 0–100.

| Score | Effect |
|---|---|
| 70 or more | No warning |
| 45–69 | **At risk today** |
| Under 45 | **At risk today**, in the stronger warning colour |

Each result carries `label`, `what`, `why` and `next` for the screen, and `percent` for the engine and the tests. The Today card, the timeline chip and the "At risk today" notification read the first four. Limits: the thresholds are judgement calls, not calibrated against past outcomes; the estimate only looks at today.

## 11. Widget previews and notification phone simulator

Both are reached from Profile, above Reset. Both are previews inside the app.

**Test widgets** (`#profile/widgets`) shows three widget previews: Next move, Today, and This week. Each has a Small, Medium and Large size with its own layout, and **Restore default sizes** puts them back. The chosen sizes are kept in a separate browser key (`sikad-widget-sizes`), not in the plan. The page only reads the plan. SIKAD does not install a home-screen widget, and a web app without native code cannot.

**Test notifications** (`#profile/notifications`) shows a **phone drawn inside the page**: a status bar, the date and a large clock (SIKAD's own clock, so it follows the Demo clock), a lock-screen area, and a home bar. Beside it are the five kinds of notification: Time to start, Deadline coming up, At risk today, Plan updated, Not enough time. **Show on phone** puts that notification on the phone's lock screen, with its own icon, colour, wording and two buttons. The phone and the list keep a fixed size: showing, switching or clearing a notification does not move or resize anything, and long content scrolls inside the phone. ✕ or Escape dismisses it; it can be shown again any number of times. Showing and dismissing never changes the plan.

The wording is filled from the current plan. When the plan has nothing that fits a kind, example text is used and the notification is marked **Sample**.

| Kind | Buttons | What each button does |
|---|---|---|
| Time to start | Start focus · View task | Starts a focus session on that block, exactly as **Start task** does (refused, with a reason, if a session is already running). Opens Task details. |
| Deadline coming up | View task · Adjust schedule | Opens Task details. Opens the Adjust schedule sheet with a recommended time (§8.2). |
| At risk today | Review task · Adjust schedule | Opens Task details for the task at risk. Opens the Adjust schedule sheet for it (§8.2). |
| Plan updated | Review schedule · View changes | Goes to Home's timeline. Goes to the **Plan updated** card. |
| Not enough time | Review options · View affected tasks | Goes to the **Not enough time** card on Home. Goes to the Tasks tab. |

- A button on a **Sample** notification that needs a real task or change opens nothing and says so on the notification. **Review schedule** is the exception: it only opens the timeline, so it works on a sample too. Sample content never touches the real plan.
- **Plan updated** is usually a sample: the Plan updated card on Home clears itself about 12 seconds after a change, and this kind reads that record.
- Every button leads to a feature that already exists and goes through that feature's own checks and confirmations. Only Start focus changes anything by itself, and it does what the Start task button does.
- When a button leads to another screen, a **‹ Notification previews** bar appears at the top of that screen; the browser's Back button works too. Task details opens over the simulator and closes back to it.
- No browser permission is requested, nothing is sent to the device, and nothing is delivered while the app is closed. Real delivery would need a push service and a server.

The content of both pages is provisional. It is defined in one place each in `js/app.js`: `WIDGETS` for the widgets, and `NOTIFS` (wording, icon, buttons) with `NOTIF_ACTIONS` (what each button does) for the notifications.

## 12. Data model, state transitions and persistence

- One state object holds the baseline, tasks, plan, history and focus sessions. It is saved to the browser's `localStorage` after every change.
- Nothing is sent to a server. No audio is stored.
- The current state is stored under one key (`tempo-state-v1`). The engine log keeps the last 25 entries, and day snapshots the last 8 weeks. Open check-ins (`checkins`) stay until answered. `autoDone` holds records left by an earlier version; nothing adds to it now.
- Three small values are kept outside the plan: the theme (`sikad-theme`), the widget preview sizes (`sikad-widget-sizes`), and the Demo clock's shift, which lives in the tab only (`sikad-clock-shift` in session storage).
- A service worker caches the app so it opens offline once it has been loaded over HTTPS or localhost. The font files are not in its pre-cache list (`errors.md` §11).
- **Profile → Reset** clears everything and restarts setup.

### 12.1 State shape

From `initialState()` in `js/store.js`:

| Group | Fields |
|---|---|
| Setup | `version`, `onboarded`, `onboardStep`, `user`, `integrations`, `prefs` |
| Baseline | `baseline` — `dayStart`, `dayEnd`, `commuteMins`, `bufferMins`, `routineMins`, `protectLunch`, `classes[]`, `recurring[]` |
| Inputs | `tasks[]`, `events[]`, `cancellations[]` |
| Plan | `plan[]`, `unscheduled[]`, `needsDeadline[]`, `alerts[]`, `status` |
| Session | `active`, `checkins[]` (blocks that ended without a report; their minutes are on hold until answered), `lastUpdate` |
| History | `history[]`, `workLog[]`, `focusLog[]`, `daySnapshots{}`, `engineLog[]`, `autoDone[]` (legacy: records left by an earlier version; nothing adds to it now) |

### 12.2 How state changes

- Every change goes through a function in `js/store.js` and ends in `replan()`, which runs the engine, records what moved (before → after) in `lastUpdate`, and saves the day's snapshot.
- Changes that need approval (an Ask SIKAD change, an answered check-in, an adjusted plan) are worked out on a **copy** of the state. Accepting swaps the copy in as one step; rejecting discards it. A proposal can therefore never leave a half-applied plan.
- Before any action runs, `js/app.js` copies the whole state. If the action throws, the copy is put back and the student sees "Couldn't update your plan".
- **Undo** restores the snapshot taken just before the last change. One level; cleared by a reload, a new day, or a new check-in.

### 12.3 How the numbers are calculated

| Number | Meaning |
|---|---|
| Today — time remaining | Minutes of unfinished task sessions planned for today. Classes and commutes are not counted. |
| Today — tasks completed | Tasks finished today, out of those plus the tasks still planned for today. |
| Weekly task progress | Task time completed this week ÷ (completed + still planned this week). |
| Fits | Shown when the work due by the end of the week is no more than the open time until then, and nothing is unscheduled. Otherwise "… short" or "Not all of it fits". It covers the same Monday-to-Sunday week as the progress bar. |
| Your time budget | Open time from now to Sunday night after fixed commitments, including time already given to tasks. |
| Tasks remaining | Unfinished tasks in the selected week, out of unfinished plus completed. |
| Time needed | Estimated time left across the unfinished tasks in the selected week. |
| Day bars (Overview) | Upcoming days: planned task time ÷ the day's open time around fixed commitments, so a full bar is a full day. Past days: time done ÷ time planned. |

Moving work to another week lowers "planned" only; it never lowers what was completed.

## 13. Clock handling and demo tools

Times are stored as wall-clock milliseconds: a UTC timestamp whose UTC fields equal the student's local time (`js/time.js`). `T.real()` is the device clock; `T.now()` is `T.real()` plus the Demo clock's shift, which is zero unless a presenter sets it. The shift lives in the tab's session storage, so it never leaks into another tab or a later visit. Form helpers (`dateInput`, `timeInput`, `joinInput`, `splitDur`, `joinDur`) turn date, time, hours and minutes fields into wall-clock values without going through the device timezone.

`syncClock()` in `js/app.js` brings `state.now` up to `T.now()` on load, at each new minute, and when the app returns to the front, by calling `S.setClock()`. The screen waits to redraw while the student is typing or a sheet is open.

Add `?demo=1` to the URL, or tap the version text at the bottom of Profile five times, to show the **Judge tools** dock (`?demo=0` hides it; it lasts for the browser tab). It can load a ready-made sample week ("Alex's week"), run 13 prepared scenarios, show the engine's JSON output for each request, skip a running focus timer ahead, and move a **Demo clock** (−1 hr to +1 day, or a chosen date and time, with "Use real time"). Moving the Demo clock forward past a planned block raises that block's check-in, exactly as real time would; moving it back withdraws check-ins for blocks that are ahead again. It never completes, credits or un-completes anything (§9). These tools never appear in the normal product.

**A step-by-step demonstration script is in `user_flow.md`.** It fixes the Demo clock to next Monday 9:05 AM, loads Alex's week, and gives the expected result of every step. Two cautions from it: "Use real time" jumps back to the real date and breaks that fixed starting point, and the Demo clock belongs to one browser tab.

## 14. JavaScript module responsibilities

Nine files, about 6,800 lines. Data flows one way:

```
typed or spoken text
      │
      ▼
 parser.js ── intents ──▶ store.js ──▶ engine.js ──▶ plan
                              │                        │
                              ▼                        ▼
                        localStorage              app.js renders
                                                  (motion.js animates)
```

| File | Lines | Global | Depends on |
|---|---:|---|---|
| `time.js` | 123 | `TempoTime` | — |
| `data.js` | 121 | `TempoData` | Time |
| `parser.js` | 903 | `TempoParser` | Time |
| `engine.js` | 769 | `TempoEngine` | Time |
| `store.js` | 991 | `TempoStore` | Time, Engine, Parser, Data |
| `focus.js` | 97 | `TempoFocus` | Time |
| `assistant.js` | 240 | `TempoAssistant` | Time, Engine, Parser (Store at call time) |
| `motion.js` | 133 | `TempoMotion` | — (DOM only) |
| `app.js` | 3,712 | — | all of the above |

#### `js/time.js`
Wall-clock time helpers. Times are stored as "wall-clock milliseconds": a UTC timestamp whose UTC fields equal the student's local time. `T.now()` reads the device clock and timezone. Exposes the `MIN`, `HOUR`, `DAY` constants plus date construction and formatting helpers used everywhere else. `T.now()` is the real minute plus the presenter's Demo-clock shift (`T.shift`, zero unless set in the judge dock; `T.real()` is the device clock alone). Form helpers `dateInput`, `timeInput`, `joinInput`, `splitDur` and `joinDur` turn date, time, hours and minutes fields into wall-clock values without passing through the device timezone.

#### `js/data.js`
Sample data for the simulated parts of the product. Keys:

- `SAMPLE_COR_TEXT` — the text a Certificate of Registration photo would OCR into (BSIT 3B-G1 DBA class schedule)
- `SAMPLE_LIFESTYLE` — commute, routine and weekly commitments for the sample student
- `SCENARIOS` — demo inputs for Ask SIKAD (class clash, missing deadline, dependency, and so on)
- `QUESTIONS` — suggested Ask SIKAD questions
- `SAMPLE_TRANSCRIPT` — fallback text when speech recognition is unavailable
- `INTEGRATIONS` — the platform list (Google Calendar, Canvas, Teams, Classroom)
- `SAMPLE_ASSIGNMENTS` — what a simulated platform sync imports

#### `js/parser.js` — UNDERSTAND
A deterministic stand-in for the language model described in `prompts/prompt-1/prompt.md`. Turns brain-dump text into structured intents and emits the Phase 1 / Phase 2 JSON contracts.

Rules: never invents a deadline (missing → `null` plus a clarifying question); missing durations get a type-based estimate flagged `is_ai_estimate`; new commitments are one-time unless the text says they recur; contradictions and ambiguous dates become questions.

Exports: `parse`, `parseSchedule`, `toPhase2`, `parseDuration`, `parseDate`, `parseTimes`, `parseExtra`, `splitClauses`, `classify`, `suggestParts`, `unclearQuestion`, `resolveTask`, `matchTask`, `titleCase`, `tokens`.

> Protected by `CLAUDE.md`: behaviour and JSON contracts must not change. Authorized exceptions (14 Oct 2026): overnight time ranges, questions for vague, passed and impossible dates, "last <weekday>", and refusing a command that names two tasks. Exports are unchanged; `parseDate` results may now carry `ambiguous`, `question`, `past` or `invalid`, and `parseTimes` results `overnight`.

#### `js/engine.js` — PRIORITIZE → BREAK DOWN → SCHEDULE → NEXT ACTION → REPLAN
The scheduling engine. Deterministic and stateless: every call takes the full state and returns a new plan.

Rules enforced here:
- Fixed commitments are never moved; tasks are placed around them
- A 15-minute buffer sits between a flexible task and anything else
- Nothing is scheduled after its deadline; what does not fit is reported as unscheduled with status `INFEASIBLE`
- Overdue tasks are kept and scheduled first
- Dependencies and part order are respected
- On replan, overdue unfinished work takes the earliest real slot first; every other task is then handled once in rank order and keeps its previous sessions when they are still valid and still in order. A task that loses its slot is placed again, on a later day if need be

Constants: sessions run 30–120 minutes (`MIN_SESSION`, `MAX_SESSION`); free fragments under 15 minutes are dropped.

Exports: `occurrences`, `freeSlots`, `units`, `rank`, `schedule`, `capacity`, `diff`, `completionConfidence`, `CONFIDENCE`, `nextSession`, `currentFixed`, `explain`, `eventConflicts`, `recurringConflicts`, `analyzeBaseline`, `phase3`.

> Protected by `CLAUDE.md`: behaviour and JSON contracts must not change. Authorized exceptions (14 Oct 2026): the placement order in `scheduleOnce`, and `units()` leaving out minutes that are waiting on a check-in. Exports are unchanged.

#### `js/store.js` — state and transitions
Owns the single state object, saves it to `localStorage`, applies the engine's proposals, keeps fixed commitments protected, and logs every engine output (Phase 1–3 JSON) for inspection.

State shape: see §12.1.

Exports, grouped:
- Lifecycle: `initialState`, `load`, `save`, `reset`, `sanitize`, `storageAvailable`, `clone`, `uid`, `log`, `loadDemo`
- Tasks: `makeTask`, `setDuration`, `taskRemaining`, `taskTotal`, `extendTask`, `completePart`, `completeTask`, `setTaskRemaining`, `applyTaskAction`
- Planning: `replan`, `applyIntent`, `previewIntents`, `suggestAdjustment`, `parseContext`
- Sessions: `findSession`, `startSession`, `pauseSession`, `resumeSession`, `skipSession`, `completeSession`, `snoozeSession`, `focusElapsedMs`, `endFocus`, `dismissCheckin`
- Baseline: `addEvent`, `addRecurring`, `cancelOccurrence`, `classesFromPhase1`, `applyLifestyle`
- Reporting: `weeklyProgress`, `daySummary`
- Adjusting one task: `checkStart`, `nearestStart`, `previewMove`, `recommendAdjustment`; status: `taskStatus`
- Clock and check-ins: `setClock`, `noteMissed`, `checkinDone`, `checkinPartial`, `checkinNotDone`, `dismissCheckin`
- Legacy: `undoAutoDone`, `ackAutoDone`
- Other: `DIFFICULTIES`, `KEY`

`setClock(state, newNow)` is where time passing is handled, and it never completes or credits anything. Going forward, each task block whose planned end has passed becomes a check-in (`noteMissed`), once, and its minutes go on hold. Going back, a check-in for a block that is ahead again is withdrawn. `checkinDone`, `checkinPartial` and `checkinNotDone` apply the student's answer and replan; the app runs the last two on a copy so they can be shown as a proposal first. `snoozeSession` clears a pinned start. Details in §9.

> `CLAUDE.md` allows only the additive changes named in Batch 10 and Batch 11. Authorized exceptions (14 Oct 2026): the check-in functions, `setClock`, and the snooze change above.

#### `js/focus.js` — Focus Mode
Working-method suggestions and session timing. Time blocking decides *when* work happens (engine); a method shapes *how* the student works inside a block already scheduled. Methods never change the plan.

Methods: `chunking` (one step at a time), `pomodoro` (25 minutes on, 5 off), `timebox` (one bounded block), `none` (a running timer).

Exports: `METHODS`, `recommend`, `timer`, `clock`, `pomodoroRounds`, `POMO_WORK`, `POMO_BREAK`.

#### `js/assistant.js` — Ask SIKAD answers
Recognises a question by its wording (regex table `Q`: `feasible`, `usable`, `why`, `whatif`, `list`, `inspect`, `next`) and answers by reading the same tasks, plan and fixed commitments every other view uses. When the state cannot answer, the reply says what is missing rather than guessing. Statements that change the plan are not handled here; they go through `parser.js` → preview → confirm → replan.

Exports: `answer(state, text)` → `null` or `{ kind, title, lines, facts, missing? }`, and `classify`.

#### `js/motion.js` — motion layer
Presentation only; it never reads or changes the plan. The UI rebuilds its HTML on every render, so motion is a FLIP around that rebuild: `capture(root)` → re-render → `play(root, snap)`.

Markup hooks: `data-flip="key"` (slide if the key survives, enter if new), `data-flip-exit` (leave as a ghost), `data-enter="key"` (enter only). Built on CSS and the Web Animations API, with no animation library.

Exports: `reduced`, `capture`, `play`, `strike`, `cancelAll`, `DUR`, `SETTLE`.

#### `js/app.js` — UI layer (263 KB)
Renders every screen as HTML strings into `#app`, `#sheet-root` and `#toast-root`, and routes clicks through `data-action` attributes to handlers. Holds view-only state in a `ui` object (current tab, open sheet, Ask SIKAD thread, dictaphone state, Profile sub-view, and so on).

Section map, by line:

| Line | Section | What it covers |
|---:|---|---|
| 42 | helpers | Escaping, formatting, small HTML builders |
| 122 | theme | Light/dark pill, saved choice |
| 152 | judge mode | Presenter dock; on with `?demo=1` or five taps on the version text |
| 213 | date, time and duration fields | `dtField`, `durField` and their change handlers: two inputs bound to one value |
| 285 | render | Top-level render and re-render |
| 302 | history | Hash routes (`#home`, `#week`, `#tasks`, `#profile`, `#profile/<sub-view>`), Back button |
| 341 | motion | Wiring renders to `TempoMotion` |
| 536 | ONBOARDING | Setup wizard: name, classes, lifestyle, sync, first tasks, review |
| 833 | dictaphone | Tap-to-speak UI |
| 929 | APP SHELL | Header, layout columns, pill nav, the "back to notification previews" bar |
| 963 | HOME | Focus Card, check-in cards (`checkinCards`, `checkinProposal`), Today card, weekly task progress |
| 1135 | Focus Mode | Method, timer, spotlight, outcome question |
| 1339 | timeline | The day as a path |
| 1447 | WEEK | Overview: week navigation, past days, weekly summary |
| 1591 | TASKS | Task list |
| 1634 | PROFILE | Settings, limits, integrations, entry cards for the two preview pages |
| 1730 | WIDGET PREVIEWS | `WIDGETS` (provisional content), `WIDGET_LAYOUT` (how each size is drawn), the gallery page |
| 1853 | NOTIFICATION PREVIEWS | `NOTIFS` (provisional content and buttons), `NOTIF_ACTIONS` (what each button does), the simulated phone |
| 1998 | Profile management | Class schedule editor, Recurring commitments manager |
| 2109 | baseline forms | Add/edit sheets for classes and commitments |
| 2213 | SHEETS | Confirm, brain dump (capture + review), proposal sheet, the Adjust schedule sheet, task details and its validation, fixed commitment, engine output |
| 2777 | ACTIONS | Every `data-action` handler |
| 3492 | clock | Ticking, Demo clock, check-ins for blocks that ended |
| 3530 | voice | Browser speech recognition |
| 3587 | events | Global click/key/input listeners, service worker registration |

## 15. Design system, branding and motion

[design.md](design.md) is the source of truth: the Forest / Paper / Butter palette with verified-contrast tokens, Plus Jakarta Sans for headings and Inter for body text (both self-hosted), the "Grounded Path" direction (the day as a path, fixed commitments as square posts with a lock, flexible tasks as round steps), one primary Butter button per view, and a distinct look for each engine status. [motion-spec.md](motion-spec.md) covers motion: the replan Shuffle, the completion strike, the Focus Mode spotlight, 120 ms for micro interactions and 200 ms for entrances, nothing decorative, and everything off under reduced motion.

The widget previews and the simulated phone use only those tokens: the phone's bezel is the Focus Card's forest and its screen is paper, so both follow Light, Dark and System.

#### `css/styles.css` (106 KB, 1,415 lines)
The only stylesheet. Mobile first.

- **Lines 1–23**: header comment mapping the design-system export's token names to this file's, then `@font-face` rules for the self-hosted fonts.
- **Tokens**: `:root` (line 24) for light; dark is defined twice, under `@media (prefers-color-scheme: dark)` guarded by `:root:not([data-theme="light"])` (line 94) and under `:root[data-theme="dark"]` (line 116). Palette is Forest / Paper / Butter per `design.md` §5.
- **Component sections**, in file order: buttons, inputs/chips/toggles, onboarding, review cards, app shell, timeline, week/overview, tasks, settings, bottom nav, Ask SIKAD menu, sheets, toast, Ask SIKAD panel, dictaphone, proposal sheet, Focus Mode, weekly progress, baseline summary, Motion (line 980), then later additions: sample helpers, judge tools dock, Profile class schedule and limits, integrations, named orgs, Overview week navigation, layout columns, Profile management, date/time/duration fields (line 1241), the legacy "marked done by an earlier version" card (line 1260), the widget previews (line 1266), the notification list and simulated phone (lines 1340 and 1360), and the check-in card (line 1409).
- **Breakpoints**: `560px`, `768px`, `1024px`, `1280px` going up; `767.98px`, `420px`, `380px`, `359px` going down.
- **Accessibility**: `prefers-reduced-motion` and `forced-colors` rules.

## 16. Automated testing and known coverage

```
node tests/run-tests.js
```

#### `tests/run-tests.js` (89 KB, 1,210 lines)
Dependency-free Node script. It `require`s the seven logic modules (everything except `motion.js` and `app.js`), pins `T.now` to Sunday 11 October 2026, 9:30 PM so results repeat, and runs 108 tests with a tiny built-in `test`/`ok`/`eq` harness.

Covers: capture and clarification, Ask SIKAD answers, replanning around a work shift, protected fixed commitments, the 15-minute buffer, infeasible plans, working-method suggestions, focus-session outcomes, weekly progress, completion confidence, save/load, overdue placement and multi-day replanning, snoozing a pinned task, the Adjust schedule recommendation, a chosen time and its reflow, refused times and their alternatives, task status derived from the plan, check-ins for blocks that ended (no automatic completion, one question per block, Completed / Partly done / Not finished, the clock moving back), adjustments that reach later days and ones that cannot fit, legacy automatic-completion records, and the date, time and duration helpers.

Not covered: rendering, voice capture, motion, and anything else that needs a browser.

Current result: **108 passed, 0 failed** (14 Oct 2026).

**Browser checks.** Screens and motion are not covered by the logic suite. On 14 Oct 2026 a headless Chromium run (driving the real screens with the Demo clock fixed) covered: the task edit form; the check-in card, its three answers, the proposal, Accept, Keep current plan and Undo; the clock moving forward, +15 minutes, a reload, and back; the widget page; and the simulated phone with every notification and every button, at 320, 390 and 1280 px in light and dark. The main route in `user_flow.md` was replayed from the written guide. Not checked: a real phone, iOS Safari, voice input, a screen reader, an installed app, offline use.

**Covered since 14 Oct 2026:** overnight times, dates that have passed, vague weeks, impossible dates, and two tasks in one command (`errors.md` §10, E2–E4, E7, E11), each with its own test.

## 17. Implemented features versus simulated features

**Really works:** typed brain dump → tasks → schedule → replan → Done / Snooze / Undo, Ask SIKAD answers, Focus Mode, weekly progress, and saving between visits.

| Area | Status | Notes |
|---|---|---|
| Setup, typed brain dump, review, first plan | Implemented | |
| Ordering, placing, buffer, splitting, replanning | Implemented | Covered by the logic tests. |
| Done, Snooze, Undo | Implemented | Undo is one level. |
| Check-ins for blocks that ended | Implemented | Nothing is completed by the clock; the student answers, and unfinished work is re-planned as a proposal (§9). |
| Widget previews, notification phone simulator | Simulated, in-app only | Profile → Test widgets / Test notifications (§11). |
| Too much work: "A plan that fits" | Implemented | Any deadline edit ends an earlier late agreement. |
| Ask SIKAD questions and task commands | Implemented as fixed patterns | One task per command; naming two asks for one at a time. No free-form language. |
| Date and time understanding | Implemented | One-time commitments may run past midnight. Vague weeks, recently passed dates and impossible dates become questions. A weekly commitment past midnight is not stored. |
| Task dependencies ("Can only start after…") | Implemented | Order is respected. The task sheet no longer offers a task that already waits on this one. |
| Risk states ("At risk today", "Won't fit today", "Not enough time") | Implemented | Statuses and reasons on screen; the rule-based score stays internal (§10). |
| Focus Mode, weekly progress, past weeks | Implemented | |
| Voice | Implemented where the browser supports it | Real browser speech recognition; see below. |
| Schedule import, platform connections | Simulated | Sample data only. |
| AI model, accounts, sync, backup, real (push or system) notifications, home-screen widgets, export | Not implemented | Nothing in the code does these. |

**Simulated in this prototype:**

- **No AI model is connected.** Understanding text, answering questions and suggesting a working method are fixed rules over the app's data.
- **Schedule import** loads sample text. No OCR runs.
- **Platform connections** load sample items. No real account is contacted.
- **Voice** uses the browser's own speech recognition (Chrome and Edge, online). Other browsers get a typed alternative, and "Try an example" loads a sample transcript. Profile's limits text says this.

Time is the device's real date and time, unless a presenter shifts the Demo clock in the judge dock (§13). The sample week is generated relative to today.

## 18. Limitations, known defects and remaining work

- Ask SIKAD recognises a fixed set of question and statement patterns. Anything else gets a clarifying question.
- Data lives on one device and one browser. There is no sync or backup. A failed save and a change made in another tab are announced.
- A running focus session stays open until the student ends it.
- During setup, use the on-screen Back button; the browser Back button leaves the page. After setup, browser Back closes an open panel or returns to the previous tab.
- Undo is one level and does not survive a reload.
- Planning looks at most three weeks ahead.
- SIKAD cannot know whether work was done, so it asks. A check-in stays on Home until it is answered; while it is open, that block's time is not planned anywhere.
- While a check-in is open for one step of a task, a later step of the same task can be planned ahead of it.
- Widgets and notifications exist as in-app previews only. The phone on the notification page is drawn in the page; nothing reaches the device.
- Confirmed defects and items that still need testing are listed in `errors.md` §10 and §11.

Confirmed defects: none open. E1 to E11 in `errors.md` §10 are all fixed; the last five (E2, E3, E4, E7, E11) needed changes in `js/parser.js` and one in `js/engine.js`, which were authorized on 14 Oct 2026. Known limits that remain: the 90-minute midday gap on a busy day flags any one-hour task as at risk, so an adjustment can move the warning to the task that takes that gap (the sheet says so before you accept); a weekly commitment past midnight has to be entered as two; "change the deadline for X to next week" still takes that Sunday; numeric dates are read month first.

Remaining work: replace the provisional widget and notification content (`WIDGETS`, `NOTIFS`); check the items in `errors.md` §11; test on real phones.

Places where other documents and the code disagree:

- `README.md` links `design.md` as `prompts/prompt-2/design.md`. The file is at the repo root.
- `CLAUDE.md` describes `app.js` as about 150 KB. It is 256 KB.
- The `localStorage` key and the globals still use the earlier project name (`tempo-state-v1`, `Tempo*`), while the product is called SIKAD.

## 19. Where to find and modify each feature

| To change or understand… | Go to |
|---|---|
| How text becomes tasks | `js/parser.js` `parse` |
| How the schedule is built | `js/engine.js` `schedule`, `rank` |
| What gets saved, and replan/undo | `js/store.js` `replan`, `save`, `load` |
| A screen's markup | `js/app.js`, section map in §14 |
| What a button does | `js/app.js` ACTIONS (line 2777), by `data-action` name |
| Colours, spacing, type | `css/styles.css` `:root`; rules in `design.md` §4–§6 |
| An animation | `js/motion.js`, `css/styles.css` line 980 (Motion section), `motion-spec.md` |
| Sample data | `js/data.js` |
| Widget or notification wording | `WIDGETS` and `NOTIFS` in `js/app.js` (lines 1730 and 1853) |
| What happens when time passes | `setClock` and `noteMissed` in `js/store.js`; `syncClock` in `js/app.js` (clock section) |
| The Adjust schedule sheet | `openAdjust`, `adjustSheet`, `acceptAdjust` in `js/app.js`; `recommendAdjustment`, `previewMove`, `checkStart` in `js/store.js` |
| Which group a task is in on the Tasks tab | `taskStatus` in `js/store.js` |
| The check-in card and its proposal | `checkinCards`, `checkinProposal` in `js/app.js`; `checkinDone` / `checkinPartial` / `checkinNotDone` in `js/store.js` |
| What a notification button does | `NOTIF_ACTIONS` in `js/app.js` |
| How to demonstrate the app | `user_flow.md` |
| The risk wording a student sees | `completionConfidence` in `js/engine.js` (`label`, `what`, `why`); `riskChip`, `riskText`, `todayCard` in `js/app.js` |
| How to test by hand | `test-guide.md` |
| Presenter tools | `js/app.js` judge mode (line 152); open the app with `?demo=1` |
| Why a change was made | `process-log.md`, then the finding ID in the audit report |
