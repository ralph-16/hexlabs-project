# SIKAD process log

Each entry: what changed, why (audit finding IDs), and one test with its result.
Browser checks were run in headless Chromium against the local files; logic tests are `node tests/run-tests.js`.

## 2026-10-11 · Starting point
- The v3 pack listed judge mode, the side rail, the grouped class schedule and the Appearance row as already built. This repo (commit b140ab5) had none of them, so every batch was built here from scratch instead of patched.

## Batch 1 + Patch 1 · Judge mode and product-looking samples (F01, F29, F14)
- Changed: presenter tools (clock, Load/Reset Alex's week, engine JSON, scenarios, skip-ahead) moved into one "Judge tools" dock that only appears with `?demo=1` or five taps on the version text. DEMO tags, dashed demo boxes, the clock bar and the "Under the hood" card are gone from the product UI. Sample helpers are plain links ("Try a sample schedule", "Try an example") with one muted caption.
- Why: demo chrome made the app look unfinished even where sample data is allowed.
- Test: opened the default URL at 390px and counted `.demo-tag, .demo-link, .demo-note, .clock-bar, .judge-dock` on Welcome and Home: 0. With `?demo=1` the dock showed the clock, Reset to Alex's week, Engine JSON and Scenarios, and no element in it had a dashed border.

## Patch 2 · Theme pill, single Undo, name fallback (F06, F30, F03, F10)
- Changed: one-tap Light/Dark pill on Welcome, every setup step and Home only. Profile has a Light / Dark / System row using the same saved key. The Plan-updated card no longer has its own Undo and clears itself after about 12 seconds; Undo lives in the toast. Skipping the name stores an empty name.
- Why: the toggle was missing during setup and repeated where it wasn't needed; two Undo buttons appeared after one action.
- Test: after Snooze there was exactly 1 Undo button on screen (in the toast) and 0 in the update card; Undo restored the plan. First attempt found that seven actions (set deadline, manual task, accept proposal, complete/remove task, cancel a commitment, edit task) had no toast at all, so removing the card's Undo would have left them with none. Correction: they now show "Plan updated. Undo".

## Batch 3 · Focus flow (F02)
- Changed: Start begins the session immediately with the suggested working method. The running card shows "Method: Pomodoro · Change"; Change opens the same four-option picker and returns to the timer. Suggestion rules, timers and the session data are untouched.
- Why: the picker in front of every session cost a tap and a decision before any work started.
- Test: Home → Start = timer running in 1 tap with no picker; Change → Timeboxing → Use this method switched `active.method` from pomodoro to timebox with the timer still running.

## Batch 4 · Class schedule (F05)
- Changed: Profile groups classes by day with a count and total hours; each row has a text "Remove" and the toast names the class with Undo.
- Test: Monday header read "2 classes · 6 hrs"; Remove showed "Removed IT 302 · Undo"; Undo brought the class back; no horizontal scroll at 360px.

## Batch 5 · Limits (F25)
- Changed: "How SIKAD plans & its limits" card in Profile with the seven plain statements, including what is sample data in this prototype.
- Test: searched the code for fetch / XMLHttpRequest / sendBeacon / WebSocket before keeping "Your data stays on this device": none found.

## Batch 6 · Integrations, simulated (F12, F20)
- Changed: Connect → "Connecting…" with Cancel → connected row ("Sample account · Synced just now · 4 items") → a review sheet where each item has a checkbox, editable title and due date and a source chip. "Add N to plan" uses the same path as adding a task by hand. `window.SikadIntegrations[id].connect()` is the seam a real adapter can replace. Emoji removed from the integration data.
- Test: all four platforms connected with 4 sample items each. Replacing the Teams adapter with one that rejects showed the error row with its cause and "Try again", with no code change in the UI.

## Patch 7 · Fluid desktop (R01, R02, R03, R07)
- Changed: from 768px the nav is a left rail pinned to the viewport edge; the page has one background and no outer box. From 1024px Home, Overview and Profile use two columns. Sheets are centered and 520px wide. design.md §11 updated first.
- Test: measured at 768, 1024, 1280, 1440, 1920 and 2560px on all four tabs: rail at x=0 and full height, app width = viewport, body and app background identical, no horizontal scroll. First run had Profile columns 1005px vs 1524px tall; moving the limits card under the schedule made them 1391px vs 1218px.

## Batch 10 · Lifestyle step (F28)
- Changed: commute chips are 30 min / 1 hour / 1.5 hours / 2 hours / Custom (5 to 240 minutes); "No commute" removed. One or more named orgs, each with day and time, with a flag when two overlap. "Stop scheduling after…" with helper text. Only store change: an org's own name is used as its title.
- Test: custom commute 135 and two orgs → the review screen read "commute 2 hr 15 min · 2 orgs" and Profile listed "Junior Programmers Guild" and "Org meeting" as fixed weekly commitments (logic test 16).

## Batch 11 · Past-plan snapshots (F27, data)
- Changed (additive): `state.daySnapshots` keeps each day's planned blocks on every replan; a block that is moved away is marked `movedAt`, never deleted; 8 weeks are kept. `S.daySummary(dateKey)` returns done / missed / moved. Alex's demo seeds Oct 5–10 with 9 blocks.
- Test: logic tests 17 and 18. A save with `daySnapshots` deleted still loaded. Correction during the work: matching "done" by task alone would have counted a moved block as done when another block of the same task was finished that day, so a completion is matched to its own block first.

## Batch 12 · Overview weeks (F27, UI)
- Changed: ‹ week label › with "This week" when away; past weeks show "Done vs. planned" with missed and moved counts; past days list fixed commitments and planned blocks with Done / Missed / Moved chips.
- Test: with Alex loaded and the clock on Mon Oct 12, ‹ showed "Oct 5–11 · Last week", "Done 8 hr 15 min of 10 hr 15 min planned · 1 missed · 1 moved"; Friday showed a Missed block; › and "This week" returned; the arrows disabled at the earliest saved week and two weeks ahead. Correction: missed blocks inherited a strikethrough from the live timeline, which reads as done, so past days show them with a plain title.

## Batch 8 + 9 · Hierarchy, copy, reliability (F04, F13, S02–S05, F23, F24)
- Changed: "Does it all fit?" is one word inside This week; eyebrows removed from Tasks, Overview and Profile; at most three chips per card; upload box border is solid; Sync step copy; Extract shows "Reading…" and ignores a second tap; offline banner; a network-first service worker (`sw.js`).
- Test: two fast taps on Extract produced one run (1 class row, button disabled in between). Dispatching `offline` showed the banner and `online` removed it.
- Not changed: dashed lines that carry meaning in design.md (AI-estimate underline, free-time and missed nodes on the timeline).

## Batch 13 · BSIT 3B-G1 DBA sample data (data and seed only)
- Changed: the sample schedule is now 17 classes with real course codes; Alex's brain dump gives 4 tasks; one overdue task (Algorithm Tracing Worksheet) carries over from last week; last week has 6 finished assignments and 1 planned block that was not done. Each platform returns its own assignments (Canvas 7, Teams 3, Classroom 5, Calendar 5) with course, time needed and due date, and skips work that is already a task. No engine, parser or layout change.
- Why: the old fixture (3 tasks, placeholder course codes) was too thin to show a realistic week or a real time shortage.
- Test: loading Alex's week gave 5 open tasks, 6.5 hrs planned, nothing unscheduled, one overdue warning, and Completed (6). Connecting all four platforms and adding everything gave "15 hrs of work doesn't fit" with 8 tasks unplaced (the brief predicted 9). Correction: 17 of the 27 logic tests were written against the old fixture and failed; they now follow the new data, and the work-shift test uses a Tuesday shift because a Monday 6–10 PM shift is honestly infeasible with three pieces of work due that night.
