# SIKAD: Build Prompt Pack (v3)

Matches `SIKAD-UIUX-AUDIT-REPORT_v3.md` (same finding IDs and batch numbers).

**How to use (saves tokens, which the program grades):**
1. Save **Part 0** as `CLAUDE.md` in the project root (replace the old one).
2. **One batch per fresh session** (`/clear`). Paste only that batch.
3. After each batch: open the app, run its **Accept** check yourself, then `git commit`.
4. Line numbers are from the original files and may have shifted. **grep the function name first.**

## Build status (from your deployed screenshots; verify with each Accept check)
| Batch | Status | What to do |
|---|---|---|
| 1 Judge mode | Built (Judge tools pill visible) | Run **Patch 1** (wording) |
| 2 Quick wins | Appearance row exists | Run **Patch 2** (theme pill) |
| 3 Focus flow | Unknown | Run Batch 3 if Start still opens the picker |
| 4 Class schedule | Built | Check Accept only |
| 5 Limitations | Unknown | Run Batch 5 if the Profile section is missing |
| 6 Integrations | Sample Google Calendar visible | Run Batch 6 (simulated) |
| 7 Desktop | Built but boxed | Run **Patch 7** (fluid) |
| 8, 9 | Not started | Optional |
| 10, 11, 12 | New | Requested features |

**Order:** Patch 1 → Patch 2 → 3 → 5 → 6 → Patch 7 → 10 → 11 → 12 → 8 → 9.
**Minimum shippable:** 1-6, Patch 7, 10. Start 11-12 only after the minimum passes. Freeze is Oct 14.

---

## Part 0: `CLAUDE.md` (save once)

```markdown
# SIKAD build rules

Stack: vanilla HTML/CSS/JS PWA. No frameworks, libraries, build step, npm packages, or new fonts/colors outside design.md tokens.
Source of truth: `design.md` (+ `motion-spec.md`). Audit: `SIKAD-UIUX-AUDIT-REPORT_v3.md`.
Scope: UI/UX. Never change engine.js / parser.js behavior or JSON contracts. store.js: no changes EXCEPT the additive ones named in Batch 10 and Batch 11. Keep every existing `data-action` name working.
Design rules to keep: one primary (Butter) button per view; protected items show lock + "Fixed"; AI estimates show ≈ + "AI estimate"; every replan shows before → after + Undo; the student always decides.

## Product vs prototype
The app must look like a real product. OCR/file reading, speech-to-text, and platform connections may use sample data (organizers allow it), but the core flow (typed brain dump → tasks → schedule → replan → Done/Snooze/Undo) must really work. No DEMO badges or dashed demo boxes in product mode. Where data is simulated show ONE small muted caption (helper-text style), and the Profile "limits" section says what's simulated. Presenter tools live only in the judge-mode dock.

## How to work (token budget is limited; this is graded)
- Do ONLY the batch I paste. No refactors, renames, cleanups, or "while I'm here" changes.
- Never read whole files. `grep -n` the function/selector, then `view` a narrow range. app.js is ~150KB.
- Edit with targeted replacements. Never rewrite a whole file.
- After editing JS run `node --check js/app.js` (and store.js if touched). Fix before reporting.
- Skills: `frontend-design`, `make-interfaces-feel-better` for visual edits; `motion-design` only if motion is touched (native CSS/WAAPI, motion-spec.md); `ios-design` for safe-area/touch. Don't use gsap-* or vercel-* skills.
- Report in ≤ 8 lines: files changed, what the user will see, how I verify it, anything you did NOT do and why.
- Append 3 lines to `process-log.md`: what changed, why (finding IDs), one test you ran and what it showed. Plain language.
- If something conflicts with design.md or the code, stop and ask one question instead of guessing.
```

---

## Patch 1: Product-looking sample helpers (F29, F01)

```markdown
Patch 1. Judge mode already exists. Fix how demo/sample UI looks in product mode.

Find (grep): `demo-tag`, `demo-link`, "Use sample COR" / `obSampleCor`, "Insert a sample transcript", "Use Alex's example", "Connections are simulated", "Skip ahead", `.demo-tag`, `.demo-link`, `.demo-section`.

Do:
1. Product mode: no DEMO tag/badge and no dashed demo box anywhere.
2. Sample helpers stay in product mode as plain secondary text links with a normal icon: Baseline → "Try a sample schedule"; Brain dump → "Try an example" (merge "Insert a sample transcript" and "Use Alex's example"). After one is used show a muted caption (info icon, helper-text style): "Sample data. Edit anything."
3. Sync step and Profile integrations: replace the dashed DEMO box with one muted line: "Prototype: connections use sample data."
4. Skip-ahead, Load Alex's week, Reset demo, clock, engine JSON live ONLY in the Judge tools dock (solid border, not dashed).

Accept: default URL shows no DEMO tags or dashed boxes on any screen; sample links look like normal links and still work; `?demo=1` still shows the dock with clock + Load Alex.
```

---

## Patch 2: One-tap theme pill on setup + Home (F06, F30, F03, F10)

```markdown
Patch 2. Theme toggle, plus verify two earlier quick wins.

A. Theme (F30). `themeToggle()` (~92) used to render a one-tap pill ("Dark" / "Light" with moon/sun icon). The current build only has an Appearance row in Profile, so setup has no toggle.
 - Restore the one-tap pill on: Welcome and every onboarding step (header area), and the Home header. NOT on Overview or Tasks.
 - Behavior: tap flips the effective theme (light ↔ dark) and stores an explicit choice. If the setting is "System", the pill flips from the current effective theme.
 - Profile keeps the Light / Dark / System segmented row. Both read and write the same storage key and stay in sync (re-render on change). Keep the no-flash script in index.html.
 - On desktop (side rail ≥768px) the pill stays in the page header, not the rail.
B. Verify (fix only if broken): only one Undo after Snooze (toast; the Plan-updated card has none and dismisses itself); skipping the name stores '' (see `~1681`), shows "Hey, there" on Home and "You" on Profile.

Accept: pill visible on Welcome, each setup step, and Home; one tap switches theme; Profile row updates to match; no pill on Overview/Tasks; contrast still fine in both themes.
```

---

## Batch 3: Focus flow (F02) · P0

```markdown
Batch 3. Simplify the Focus Card flow. Read `focusCard()` (~746), `focusPicker()` (~805), idle actions (~777-783), and only the method-suggestion function in `js/focus.js`.

Do:
1. "Start task" begins the session immediately using the already-suggested method (keep that logic and the "why" text). No picker step.
2. In-progress card shows "Method: Pomodoro · Change". "Change" opens the existing 4-option picker, then returns to the timer.
3. Idle actions stay: Start (the only Butter button), Done, Snooze. Keep "Why this?".

Don't: change suggestion rules, timers, or the session data model.

Accept: Home → Start → timer running = 1 tap. "Change" switches method mid-session. Done/Snooze unchanged. `node --check` passes.
```

---

## Batch 4: Class schedule (F05): built; verify only
Accept: Profile shows day headers with class count + hours; Remove → toast "Removed IT 302 · Undo"; Undo restores the class and plan; no horizontal scroll at 360px.

---

## Batch 5: Limitations and guardrails (F25) · P0

```markdown
Batch 5. Add "How SIKAD plans & its limits" to Profile (card below Connected platforms, above Reset). Product mode only; the JSON view stays in the judge dock. Short lines, no jargon:
- "SIKAD plans your time. It doesn't do your schoolwork or write graded work for you."
- "It isn't a counselor or a health tool, and it doesn't judge your stress. If things feel like too much, talk to someone you trust or your school's guidance office."
- "Times marked ≈ are guesses. Change them anytime."
- "A plan isn't a promise. SIKAD can't guarantee grades or that everything fits. It shows you when it doesn't."
- "Your classes and fixed commitments never move unless you change them. You decide."
- "In this prototype, reading photos/PDFs, voice input, and calendar or class-platform connections use sample data. Planning, rescheduling and Undo work on what you type."
- "Your data stays on this device." (Verify: grep for fetch/XMLHttpRequest; if none, keep.)

Accept: section visible in product mode; voice matches design.md §1; no new colors.
```

---

## Batch 6: Integrations, simulated but realistic (F12) · P1

```markdown
Batch 6. Organizers allow sample data for connections. Make them feel real; keep a seam for real wiring. Read `integrationRow()` (~452), `toggleIntegration` (~1773), `INTEGRATIONS` in js/data.js (~76).

Do (UI only; keep the `state.integrations` boolean for persistence):
1. UI-only `ui.integrationState[id] = { status, account, lastSync, imported }`, status: idle | connecting | connected | error.
2. Connect → "Connecting…" (spinner ~1.2s, Cancel) → connected row: "Sample account", "Synced just now · 4 items", Disconnect. Error state exists (cause + Try again) but only appears if the adapter rejects.
3. Seam: `window.SikadIntegrations = { [id]: { connect() → Promise<{account, items}> } }`. Default adapter returns sample items from data.js (each with `source`). A real adapter can replace it later with no UI change.
4. After connect, a review sheet: imported items with source chip, checkbox, editable title/due, "Add N to plan" through the EXISTING add-task path. If none exists, ask me.
5. One muted caption on the Sync step and Profile: "Prototype: connections use sample data." (no DEMO badge).
6. Replace emoji icons in INTEGRATIONS with the existing SVG icons if they render as emoji.

Accept: each of the four connects → connected with sample items; the review sheet adds them with a source chip; Disconnect works; exactly one muted caption; no console errors.
```

---

## Patch 7: Fluid desktop, not boxed (R07)

```markdown
Patch 7. Desktop is built (side rail + two columns) but looks boxed: a ~1200px container with visible dark gutters. First edit design.md §11 (if not done): mobile single column; ≥768px side rail; ≥1024px two-column Home and Profile; layout is fluid, not a centered box.

Do (CSS first; add DOM wrappers only if a grid needs them):
1. Remove the outer box: the page background is the same everywhere; no container border, shadow, radius, or different surface around the app.
2. Side rail pinned to the viewport's left edge, full height, border-right only.
3. Main area fills the remaining width: `padding-inline: clamp(24px, 4vw, 64px)`, content max-width ~1400px centered within it.
4. Home grid ≈ `minmax(360px, 5fr) minmax(480px, 7fr)`; Profile two columns. `align-items: start` so a tall card doesn't stretch the neighbor. Balance columns: put the long Class schedule on the left with Your day + commitments on the right; move Appearance into the right column so the left isn't pushed down.
5. Sheets/modals: centered, max ~520px at ≥768px.
6. Mobile (<768px) is unchanged. Keep `env(safe-area-inset-*)`.

Accept: at 1280, 1440, 1920, 2560px there is no visible box or gutters; rail is at the left edge; two balanced columns on Home and Profile; 768px works; mobile unchanged; light + dark both fine.
```

---

## Batch 8: Hierarchy and copy (S01-S06, F04, F13) · skippable

```markdown
Batch 8. Visual hierarchy and copy.
1. Fold `fitCard()` (~954) into `weekCard()` (~932) as one line: "6 of 9 hrs done · 3 sessions · Fits" (or "2 hrs short"). Delete the standalone Home card. Compact This week to a progress bar + that line.
2. `.eyebrow` only for dates/times and "What to do next". Remove from Tasks, Overview, Profile headers.
3. Max 3 chips per card (context + priority + state); the rest go in a plain metadata line.
4. Differentiate cards by role with existing tokens: Focus = largest radius + shadow; status = border only; timeline = left rail.
5. No dashed borders in product UI (`.upload` ~279 → solid; hover = forest border).
6. Sync copy: title "Bring in your due dates"; body "Connect a calendar or class platform to import deadlines. Skip it if you prefer."

Accept (390px): Home above the fold = Focus Card + one This week line; ≤ 3 chips per card; no eyebrows on Tasks/Overview/Profile; no dashed borders in product mode.
```

---

## Batch 9: Reliability and accessibility · partly skippable

```markdown
Batch 9. Verify before changing; skip what already works.
1. F24: `obExtract()` (~1716) buttons: loading state, disabled while running, ignore double taps.
2. F19: in `@media (prefers-reduced-motion: reduce)` (~css 714) also set `transition-duration: .01ms` for buttons/cards.
3. F17: tab through every screen; every custom control needs a visible `:focus-visible` ring (2px, offset 2px). Add only where missing.
4. F23: `html { scroll-padding-bottom: calc(104px + env(safe-area-inset-bottom)); }`; check bottom sheets with inputs.
5. Offline: on `online`/`offline` show a slim banner: "You're offline. Your plan still works. Syncing resumes when you're back." Check for a service worker (none was in the project listing). If missing, add a minimal `sw.js` caching the app shell and register it in try/catch.
6. Touch targets: only interactive elements under 44×44.

Accept: double-tap Extract runs once; ring visible everywhere; OS reduce-motion removes transitions; DevTools offline shows the banner and the app loads after a prior visit.
```

---

## Batch 10: Lifestyle step: commute, named orgs, clearer wording (F28)

```markdown
Batch 10. Lifestyle step (onboarding step 2). Read `obLifestyle`/the code around `app.js:403-430` (chips, org block), the baseline build at `~1690-1692`, and `store.js:412`.

Do:
1. Commute chips: 30 min · 1 hour · 1.5 hours · 2 hours · Custom. REMOVE "No commute". Custom reveals a number input (minutes, 5-240) bound to `ls.commuteMins`; if the current value isn't a preset, Custom is selected and shows it. Keep the default 60. Profile's commute select (~1164): remove "None", options 15-180 in 15-30 min steps. A legacy saved 0 just displays as Custom; don't migrate.
2. School orgs: keep "Are you in a school organization? Yes/No". If Yes, show a list in `ui.ob.ls.orgs = [{id, name, day, start, end}]` starting with one row. Each row: Name input (placeholder "e.g. Junior Programmers Guild"), day select, start–end time, and "Remove" when more than one. Below the list: "+ Add another org". Name optional; empty falls back to "Org meeting"; flag two orgs with the same day + overlapping time.
3. Baseline mapping (~1692): `org: ls.orgs.map(o => ({ day, start, end, name: o.name.trim() }))`. The ONLY store change: in `store.js:412` use `title: o.name || 'Org meeting'`. Nothing else in store/engine.
4. Wording: "Latest you want anything scheduled?" → "Stop scheduling after…" with helper text "SIKAD won't plan tasks after this time." Same chips (9/10/11 PM). Profile label "Latest scheduling" → "Stop scheduling after".
5. Review screen (~493) baseline summary: add "· N orgs" if any.

Accept: no "No commute" chip; Custom works (e.g. 135 min); I can add 2+ named orgs and each shows up by name under Profile → Recurring commitments and in the plan as fixed; one org still works; `node --check app.js store.js` pass.
```

---

## Batch 11: Past-plan snapshots + demo seed (F27, data layer) · additive store change

```markdown
Batch 11. Save what was planned so Overview can show past weeks. `state.history` already stores completed work (`doneAt`); planned-but-not-done blocks are not saved. Read the store's replan/"plan assigned" path (grep `state.plan =`), `ARRAYS` (~store.js:32-38), and `loadDemo` (~store.js:425).

ADDITIVE ONLY. Do not change plan generation, existing fields, or history behavior.
1. State: `daySnapshots: { 'YYYY-MM-DD': { blocks: [{ id, taskId, title, start, end, kind, movedAt? }] } }` (local-date key). Create it in the initial state and on load if missing (old saved data must still load).
2. On every replan, for the date of `state.now`, upsert that day's blocks from the current plan. Never delete a snapshot block when a later replan moves it: set `movedAt` instead. Keep at most 8 weeks.
3. Pure read helper `S.daySummary(dateKey)` → `{ blocks, done, missed, moved, plannedMins, doneMins }`: done = a matching `history` entry (same taskId, `doneAt` that day); moved = `movedAt` set and not done; missed = day is in the past, not done, not moved.
4. `loadDemo`: seed Alex's previous week (Mon Oct 5 – Sat Oct 10) with ~8 plausible planned blocks: most done (history entries with `doneAt`), 1 missed, 1 moved. Use names consistent with Alex's classes (e.g. "IT 302 reading", "SIA problem set", "ADET lab activity").

Accept: after Load Alex's week and a replan, `state.daySnapshots` has today's entry and survives reload; clearing the key (old save) doesn't crash; existing Home/Overview/Tasks behave identically; `node --check js/store.js js/app.js` pass.
```

---

## Batch 12: Overview week navigation (F27, UI) · needs Batch 11

```markdown
Batch 12. Overview with past and future weeks. Read `weekView()` (~1070) and its day-timeline helper. Weeks are Mon–Sun (design.md).

Do:
1. Header: "Overview" + week label ("Oct 5–11") + ‹ › buttons (44px, aria-labels "Previous week"/"Next week") and a "This week" button when away from the current week. Selecting a new week keeps the same weekday selected.
2. Progress card stays on EVERY week. Current/future week: the existing "Available vs required" bar. Past week: "Done X of Y planned hrs" bar + "N missed · N moved". Use `S.daySummary` summed over the week.
3. 7-day strip with per-day planned-hours bar (existing component) for the viewed week.
4. Selected-day timeline: today/future uses the existing timeline. Past day: fixed commitments from the baseline pattern (classes, recurring) + planned blocks from the snapshot with chips Done / Missed / Moved (state chips per design.md §8) + any completed work from history not in the snapshot ("Done (unplanned)").
5. Limits: back to the earliest snapshot/history date (max 8 weeks); forward 2 weeks. Disable the arrow at the limit. Empty week: "Nothing saved for this week."
6. Motion: 160ms crossfade between weeks using existing tokens; none under reduced motion. No new libraries.

Accept: in judge mode with Alex loaded, ‹ shows last week with a done/missed/moved day and a past-week progress bar; › returns; "This week" jumps back; this-week view and its progress bar are unchanged; works at 390px and 1280px.
```

---

## Final regression (read-only, after the batches)

```markdown
Read-only check. Don't edit. Table with pass/fail and tap counts for: (a) first launch → first plan, theme pill present on setup, (b) Home → Start → timer, (c) Snooze → one Undo, (d) remove class + Undo, (e) connect (sample) → review → added with source chip, (f) return visit: Focus Card first, (g) Overview ‹ shows last week with planned/done/missed and a past progress bar; › and "This week" work. Also: no DEMO tags or dashed demo boxes in default mode; `?demo=1` dock works; limits section visible; Lifestyle: no "No commute", Custom commute works, 2+ named orgs; desktop 1280/1920 not boxed; `node --check` passes; no console errors at load. List only failures in detail.
```

---

## Process log (rubric: 20% ownership; also covers "≥3 documented tests")
Each batch appends to `process-log.md`. Before submitting (Oct 14) pick at least 3 entries as **test + correction** evidence, add the final token usage record, and keep each entry in your own words so all three of you can explain it in Q&A.

**Pitch line for the sample-data parts:** "Planning, rescheduling and Undo are real. File reading, voice and platform sync use sample data in this prototype."
