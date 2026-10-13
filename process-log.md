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

## Prompt 8 · Real clock, confirmations, pill nav, Ask SIKAD menu, motion
- Changed: the app now follows the device's real date, time and timezone (refreshes each minute and when reopened); the sample week is built from today; the judge clock tools are gone. The mobile nav is a floating pill whose active item shows its label; Ask SIKAD opens a two-choice menu (Speak or type / Form) and keeps both drafts. Remove task, erase data and load sample week ask first in a bottom sheet instead of a browser pop-up; toasts sit above the pill. store.js: three date lines only (approved).
- Why: prompt 8 sections 2–7. A fixed Oct 11 clock made every date wrong on any other day; browser `confirm()` pop-ups broke the sheet pattern; GSAP, anime.js and Animate.css were compared and not added because CLAUDE.md forbids libraries and CSS/WAAPI already cover these short transitions.
- Test: `node tests/run-tests.js` gave 29 passed, 0 failed (2 new: device clock, sample week on four other dates). In headless Chrome at 390 px: Done → Undo and Remove → Undo restored tasks, plan, history and work log exactly; moving the device clock +30 h changed the header from Monday Oct 12 to Wednesday Oct 14 with no reload; Los Angeles, Auckland and Kolkata timezones each showed their own local date.

## Critique and polish pass (make-interfaces-feel-better, web-design-guidelines, frontend-design)
- Changed: "Face-to-face" no longer splits at its hyphens (timeline, Overview, Profile class list, fixed-item sheet); headings balance their line breaks and body text avoids one-word last lines; scrolling to the end of a sheet no longer drags the page behind it; on phones the Judge tools pill sits clear of toasts instead of peeking out from under them.
- Why: screenshots at 390 px showed "Face-/to-face" and "Face-to-/face" breaks and the pill half-hidden behind the toast; the guidelines review flagged missing `text-wrap` and `overscroll-behavior: contain`. Left alone on purpose: press scale stays .98/.97 (motion-spec.md §130 overrides the skill's .96), and straight quotes around task names stay because most of that copy comes from engine.js.
- Test: headless Chrome at 390 px and 360 px after the change: 0 split "Face-to-face" labels, no sideways scroll, sheet reports `overscroll-behavior: contain`, toast and Judge pill no longer overlap. `node --check js/app.js` clean; `node tests/run-tests.js` gave 29 passed, 0 failed.

## Profile follow-up · Class schedule editor and Recurring commitments manager
- Changed: Profile now shows two compact cards (Class schedule, Recurring commitments) instead of the long class list. Each opens its own view with a Back to Profile link (`#profile/classes`, `#profile/commitments`). Class schedule has Monday–Friday sections that open one by one, compact rows with an Edit/Remove menu, and one Add a class form (name, several weekdays, start, end, mode, optional room). Recurring commitments has exactly Work schedule, Organizations and Other commitments, one shared form (category, name, days, times, notes; workplace for work; saved organization names for organizations), and empty states. Overlaps with other fixed weekly items are shown before saving and stay flagged afterwards; nothing is replaced. Removing asks first; every save and removal recalculates the plan and offers Undo. store.js, engine.js and parser.js were not touched: room, notes and workplace are optional extra fields on the existing class and recurring rows.
- Why: prompt-8 `sikad-profile-update.md`. Profile was repeating what Overview already shows, classes could only be added one day at a time and never edited, and an overlapping class was saved without a word.
- Test: headless Chrome at 390 px, 320 px and 1280 px on Alex's week. Added "PE 3" on Tue+Thu 7:30–8:30: the form first listed the two IT 204 overlaps, "Save anyway" saved 2 rows, counts went to 5 classes on each day, tasks stayed at 11, Undo removed both. Edited GE 104 (name, end time, mode): same row id kept, Undo restored it. Empty name, no day and end-before-start each showed their own error. Organization rows stored the way setup writes them appeared under Organizations and were offered as a saved name. A new Sunday work shift appeared on Overview's Sunday timeline. Browser Back and a reload on `#profile/classes` both worked. `node tests/run-tests.js`: 29 passed, 0 failed. Not tested: clicking through setup itself to create the organization, and a real reduced-motion device (the global rule switches the new animations off).

## Logo · route mark reshaped into an S
- Changed: the route in `icons/sikad.svg` is now a slim, smooth S running from the lower left to the upper right, with a solid Forest dot at the start and a Butter dot ringed in Forest at the destination, both the same size, drawn to match the reference image. The middle dot is gone. The same shape replaces the two inline copies of the mark (the in-app logo in `js/app.js` and the favicon in `index.html`), and the two logo stroke widths in `css/styles.css` are thinner to suit it.
- Why: prompt-8 `update-logo.md` plus the reference image sent afterwards. Same file, same 512 viewBox, same cream background, same Forest and Butter values from design.md (the reference image's brighter green and yellow were not copied); design.md was not edited.
- Test: the SVG parses as valid XML and renders with nothing clipped; headless Chrome showed the S clearly on the icon file and on the setup screen logo in light and dark. `node --check js/app.js` is clean.

## Logo · wordmark file (S mark + IKAD)
- Changed: new file `icons/sikad-wordmark.svg`. The S route mark stands in for the first letter and is followed by "IKAD" in the project's display font, Plus Jakarta Sans at weight 800, in Forest with the Butter destination dot. The letters are saved as outlines, so the file looks the same anywhere without loading a font. Transparent background. Nothing in the app points to it yet, and `icons/sikad.svg` is unchanged.
- Why: a logo-with-name file was requested. In this file the S is drawn heavier and rounder than in the app icon, because at the icon's thin line weight the S disappeared next to the bold letters and the word read as "IKAD".
- Test: the SVG parses as valid XML; headless Chrome rendered it at 1400 px wide with nothing clipped and the word reading "SIKAD".

## Logo in the app + opening intro
- Changed: the welcome screen and the desktop side rail now show the full logo (route mark + IKAD) drawn from `icons/sikad-whole.svg`, coloured by the design tokens so it follows light and dark mode; the page heading still reads "SIKAD" to screen readers. On every load of the app, including refresh and hard refresh, a short intro plays: the start dot lands, the route draws, the Butter dot lands, the letters I-K-A-D arrive, then the cover fades (about 1.4 s; tap to skip). The favicon, home-screen icon and the small mark already matched `icons/sikad.svg`. motion-spec.md gained §5.7 for the intro.
- Why: the new logo files were only on disk, not in the product, and an opening intro was requested. motion-design skill: one staged moment on load, existing duration and easing tokens only, no library.
- Test: headless Chrome at 390 px, frames paused at 180 / 400 / 600 / 1000 ms showed the route drawing, the Butter dot landing, the letters arriving in order and the finished logo; afterwards the cover was gone and the name field usable; a reload played the intro again and then showed the same screen as before. `node --check js/app.js` clean; `node tests/run-tests.js` 29 passed, 0 failed. Not tested in a browser: the reduced-motion path and tap-to-skip.

## Ask SIKAD button uses the route mark
- Changed: the Ask SIKAD button (centre of the phone nav, and in the desktop side rail) now shows the SIKAD route mark from `icons/sikad.svg` instead of the speech-bubble icon. The route and start dot take the button's icon colour so they stay visible on the green circle; the destination dot stays Butter. The ✕ shown while the menu is open, the button's label and its `askMenu` action are unchanged.
- Why: requested, so the main action carries the brand mark.
- Test: headless Chrome showed the mark in light and dark on the phone nav, the ✕ when the menu is open, and the mark in the 1280 px side rail. `node --check js/app.js` clean.

## Ask SIKAD opens fresh · Ask button centres on phones
- Changed: closing Ask SIKAD now clears the answers shown in it, and an example question is never kept as a draft, so the next time it opens it is empty. Text the student typed themselves and did not send is still kept. On phones, tapping the Ask SIKAD button closes the active item's label so the button sits in the centre of the nav pill, and the other four items shrink and fade until the menu is closed. motion-spec.md §5.6 has the new row.
- Why: requested. Tapping an example and closing left that example and its answer in the panel on the next open; and the Ask button sat off-centre whenever a label was open.
- Test: headless Chrome at 390 px on the Profile tab: the button's centre moved from x 172 to 195 (the pill's centre) with the other items at 45 % opacity, and returned to 172 with the Profile label back after closing. Example → close → reopen showed 0 answers and an empty box; a typed sentence was still there after close and reopen. `node tests/run-tests.js`: 29 passed, 0 failed. Not tested: reduced motion, and a real phone.

## Home: Today card and Weekly task progress · Overview: Weekly summary (prompt 9)
- Changed: Home has a new Today card under What to Do Next (task time left today, "x of y tasks completed", a bar, and "View schedule →" which switches the timeline to Today and scrolls to it). "This week" is now "Weekly task progress" with "completed of planned", time left, Fits on its own row and "View weekly overview →". Overview's "Available vs. required" card is replaced by a stacked "Weekly summary" (Your time budget, Tasks remaining, Time needed) and the caption under the day chips is reworded. design.md §12 and motion-spec.md §5.4 updated to match. engine.js, parser.js and store.js untouched.
- Why: requested (prompts/prompt-9/updates.md). The weekly percentage was already completed time ÷ (completed + still planned), so the calculation was kept.
- Test: headless Chromium at 390 px with Alex's week: Today showed 3 hrs remaining, 0 of 3; after Done on the Focus Card it showed 2 hrs, the weekly line went from 0 min to 1 hr completed of 6.5 hrs, Overview showed 4 of 5 remaining / 5.5 hrs needed and Today's chip 2h. "View schedule" from Tomorrow's preview returned to "Today's timeline" and scrolled to it; "View weekly overview" opened #week. Light phone and dark 1280 px screenshots checked. `node tests/run-tests.js`: 29 passed. Not tested: reduced motion, keyboard-only, a real phone.

## Old mark removed from onboarding and the Focus Card · dictation no longer doubles
- Changed: the small "step" icon (the old logo shape) now uses the current S-route geometry from icons/sikad.svg, so "What to do next" and the "Next:" lines show the new mark; the onboarding "A few quick questions" tile uses the same mark as the Ask SIKAD button. In Tap to speak, a speech result that repeats what was already heard now replaces it instead of being added after it.
- Why: requested. The old mark was still drawn inline in app.js; and Chrome on Android resends the whole sentence in each result, which the code was joining end to end.
- Test: fed the join five result sequences in Node (repeated full sentence, growing sentence, normal separate phrases, interim repeating the final, interim only): each gave the sentence once. Headless Chromium at 390 px showed the new mark on the Focus Card. `node --check js/app.js` clean; `node tests/run-tests.js`: 29 passed. Not tested: real microphone on a phone, and the onboarding questions step on screen.
