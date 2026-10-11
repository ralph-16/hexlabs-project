# SIKAD UI/UX Audit Report (v3)

> Read-only audit. Rubric weights (35/35/20/10) confirmed against the hackathon program PDF. Freeze: **Oct 14, 2026**. (The PDF says the showcase is Oct 16 in the schedule table but Oct 18 in §8; confirm with organizers.)
> Build prompts that implement this report: `build-prompts_v3.md` (same finding IDs and batch numbers).

**Evidence labels:** **Verified** (cited code/CSS checked), **Judgment**, **Validate** (check before relying), **Agent render**, **Screenshot** (seen in the deployed build).

## What changed in v3
- **Organizer guidance (new, from your chat with the organizers):** secondary features (OCR/file reading, integrations, speech-to-text) may use sample data. Core features must really work. Judges expect a working prototype, not a deployed product. This replaces my earlier advice that integrations should be real: see F12, F29 and decisions D4/D6.
- **Your decisions are now applied:** one-tap theme toggle on setup + Home (Profile keeps Light/Dark/System); desktop layout allowed but fluid, not boxed; Overview gets full past weeks including what was planned; "No commute" removed; multiple named school orgs.
- **New findings:** F27 (Overview shows only the current week), F28 (Lifestyle step), F29 (DEMO badges and sample helpers), F30 (no theme toggle during setup), R07 (boxed desktop look).
- **Build status (Screenshot of deployed app):** judge-tools pill, side rail + two columns, class schedule grouped by day with Remove, Appearance row, and a sample Google Calendar connection are visible. Treat these as built but unverified until each batch's Accept check passes.
- Earlier v2 corrections still hold: F08/F09 removed (onboarding step counter is correct), contrast recomputed (no P0), "there" bug is at the storage line, "Does it all fit?" is folded, not deleted.

---

## 1. Verdict

SIKAD already has a real planning core. What still makes it feel like a prototype:
1. **Demo chrome and DEMO badges** appear throughout product mode (now gated behind judge mode; sample helpers still need to look like normal links).
2. **Flat hierarchy and repeated patterns:** equal-weight cards on Home; uniform cards, caps eyebrows, chips, dashed borders.
3. **Heavy Focus flow** and duplicate Undo.
4. **Desktop looks boxed:** a 1200px container with visible dark gutters (Screenshot, 1920px).
5. **Overview is shallow:** this week only, no history.

**Top changes for rubric impact:** (1) product-looking UI with sample-data disclosure kept to one muted caption; (2) Focus flow + single Undo; (3) limitations/guardrails statement; (4) Overview with past weeks; (5) fluid desktop layout.

---

## 2. Journey Table (tap counts are estimates)

| Flow | Taps now (necessary / removable) | Main friction | Proposed fix | Target |
|---|---|---|---|---|
| (a) First launch → first plan | ~7 / ~2 | Demo links in setup; theme toggle only reachable in Profile; Lifestyle step limited (F28) | Plain sample links; pill toggle on setup; richer Lifestyle | ≤ 6 |
| (b) Focus → Start → Done | 4 / 1 | Method picker before timer | Start immediately with suggested method; "Change" link | 2 |
| (c) Snooze / replan + Undo | 1 + 2 Undo surfaces | Banner AND toast Undo | One Undo (toast) | 1 |
| (d) Fix a class | 3 / 0 | Flat list, bare ✕ | Grouped by day; Remove + Undo (built) | 3 |
| (e) Connect integration → import | 2 / 1 | Needs states and an import review | Simulated connect + review sheet (sample data allowed) | 2 |
| (f) Return visit | 0 | Attention cards may push Focus Card down | Focus Card first | 0 |
| (g) Review last week (new) | n/a | Not possible today (F27) | Week arrows in Overview | 2 |

---

## 3. Findings

| ID | Screen | Issue | Evidence | Impact | Effort | Fix |
|---|---|---|---|---|---|---|
| F01 | All | Demo UI exposed in product mode | Verified: `.demo-tag` `css:235`; many `app.js` sites | P0 | S | Judge mode (`?demo=1` + 5-tap), one dock. **Built (Screenshot: "Judge tools" pill).** |
| F02 | Home | Focus flow too heavy | Verified: `focusPicker()` ~805, idle actions ~777 | P0 | M | Start begins immediately with the suggested method; "Method · Change" opens the picker |
| F03 | Home | Duplicate Undo (card + toast) | Verified: `app.js:726`, `:286` | P0 | S | Toast Undo only; card dismisses itself |
| F04 | Home | Flat hierarchy; "Does it all fit?" duplicates Overview bar | Verified: `app.js:672-692`, `954-967` | P1 | S | Fold into This week as one line |
| F05 | Profile | Class schedule flat list, bare ✕ | Verified (original) | P1 | S | Grouped by day + Remove + Undo. **Built (Screenshot).** |
| F06 | Overview, Tasks | Theme toggle pill repeated on screens where it isn't needed | Verified: `themeToggle()` at ~668, 673, 1086, 1115 | P2 | S | Keep the pill only on setup + Home (see F30); remove from Overview and Tasks |
| F07 | All | Identical outline pills for every role | Verified: `.btn.ghost` | P1 | S | Distinct roles (Back, Edit, Connect, Pause) |
| F10 | Welcome → Profile | Name stored as `'there'` | Verified: `app.js:1681` | P2 | S | Store `''`; fallbacks "Hey, there" / "You" |
| F11 | Nav | FAB "Ask SIKAD" vs design.md "Brain Dump FAB" | Verified: `app.js:645` | P2 | S | Update design.md to "Ask SIKAD" |
| F12 | Sync / Profile | Integration rows need realistic states | Verified: `app.js:452-456` | P1 | M | **Simulated is allowed (organizers).** Connecting → connected (sample account, "Synced just now · N items") + import review sheet. Real adapter seam kept for later. |
| F13 | Home | This week is paragraph-heavy | Verified | P2 | S | Progress bar + one line |
| F14 | All | Token drift | Verified: only demo chrome | P2 | S | Disappears with F01 |
| F15 | All | Contrast | Computed: secondary text passes AA | P2 | S | Only `--butter-edge` on boundaries |
| F16 | All | Touch targets | **Validate** | P2 | S | Interactive elements only |
| F17 | All | Focus rings | **Validate** | P1 | S | Tab through everything |
| F19 | All | Reduced motion | **Validate** `css:714` | P1 | S | Extend rule |
| F20 | Sync | Emoji icons in `INTEGRATIONS` | Verified `data.js:76-79` | P2 | S | Use SVG icons if emoji render |
| F22 | All | State coverage gaps | Judgment | P1 | M | §7 |
| F23 | Mobile | Keyboard may cover inputs | **Validate** | P1 | S | Safe-area padding |
| F24 | Onboarding | Extract wait not double-tap safe | Verified `app.js:1716` | P1 | S | Loading state |
| F25 | Profile | No limitations statement | Verified (reviewer) | P0 | S | "How SIKAD plans & its limits" |
| F26 | Demo | Demo path may exceed 3-5 min | **Validate** | P1 | S | Time one run |
| **F27** | Overview | **Overview shows only the next 7 days; no past weeks or past tasks.** | Screenshot (user report); `weekView()` ~1070; `state.history` stores completed work only | P1 | L | Week navigation (‹ ›, "This week") over Mon-Sun weeks. Past weeks show planned vs done vs missed. Needs saved plan snapshots (additive store change). Progress bar stays on every week. |
| **F28** | Onboarding → Lifestyle | **Limited options:** commute chips cap at 1.5 hrs; "No commute" shown; only one org with no name; "Latest you want anything scheduled?" is unclear | Verified: `app.js:413` (chips), `:423-426` (single org), `:429`; `store.js:412` titles every org "Org meeting" | P1 | M | Commute: 30 min / 1 hr / 1.5 hrs / 2 hrs / Custom (no "No commute"). Orgs: add one or more, each with a name, day, time. Rename the question to "Stop scheduling after…" with helper text. |
| **F29** | Setup, Sync | **DEMO badges and dashed "demo" boxes make the UI look unfinished** even where sample data is allowed | Screenshot: "Use sample COR", "DEMO Connections are simulated", DEMO clock bar | P0 | S | Sample helpers become plain links ("Try a sample schedule", "Try an example"). One muted caption where data is simulated: "Prototype: connections use sample data." Disclosure also goes in Profile limits and the pitch. |
| **F30** | Onboarding | **No theme toggle during setup** (it only exists in Profile after the Appearance change) | Screenshot: Appearance row in Profile only | P1 | S | One-tap pill on every setup step and on Home; Profile keeps Light/Dark/System; both stay in sync |

### F15: contrast (recomputed from tokens, light mode)
Ink on bg 12.06; Forest 8.89; Ink on Butter 8.35; Forest on Butter 6.16; **Ink-2 6.94; Ink-3 5.10**; Harbor on Sky-tint 6.87: all pass AA. Butter on bg 1.44 fails as a boundary (use `--butter-edge`, 3.71). Sage/Sky fail as text, and no CSS uses them as text. Disabled text 2.89 is exempt.

---

## 4. Desktop / Responsive (D1 resolved: allow desktop layout)

| ID | Screen | Issue | Fix |
|---|---|---|---|
| R01 | Home | Single narrow column, dead space | Two columns ≥1024px |
| R02 | Home | Bottom nav at ≥768 | Side rail. **Built (Screenshot).** |
| R03 | Profile | Long list in a narrow column | Two columns, schedule left. **Built.** |
| R04 | Profile | Inputs cramped at 768 | Stack below ~500px; 44px targets |
| R05 | Welcome | Mobile layout blown up | Wider container, content above the fold |
| R06 | Baseline | `.class-row` grid cramped | Wider columns ≥768 |
| **R07** | All (≥1280) | **Looks "square":** a 1200px container with visible dark gutters and a different surface from the page (Screenshot at 1920px). Also the schedule card is tall while the right column is short, so columns look unbalanced. | **Fluid layout:** same page background everywhere; rail pinned to the viewport's left edge; content fills the rest with `clamp()` padding and max ~1400px; no outer box/border/shadow/radius; balanced column ratio; `align-items: start` |

---

## 5. AI-Slop Findings

| ID | Signal | Evidence | Rule |
|---|---|---|---|
| S01 | Uniform rounded cards | **Validate** | Vary by role (Focus = large + shadow; status = border only; timeline = rail) |
| S02 | Caps `.eyebrow` everywhere | Verified `css:162` | Eyebrows for date/time only |
| S03 | Chip overuse | **Validate** `css:215-233` | ≤ 3 chips per card |
| S04 | Dashed borders as decoration | Verified `css:235, 279, 410` | Dashed only in the judge dock |
| S05 | Generic copy ("Sync your world") | Verified `app.js:441-444` | "Bring in your due dates" |
| S06 | Dead vertical space on Welcome/Baseline | Agent render | Content above the fold |

---

## 6. Rubric Mapping

| Area | Weight | Linked findings |
|---|---|---|
| Problem understanding & solution design | 35% | F04, F25, F27, F28, S01-S06 |
| System & functionality | 35% | F02, F03, F05, F12, F24, F27, F28, R01-R07, F17, F19 |
| Student ownership & process | 20% | F25 + `process-log.md` + documented tests (not UI polish) |
| Presentation & demo | 10% | F01, F03, F26, F29, R07 |

Core must really work (organizers): typed brain dump → tasks → schedule → replan → Done/Snooze/Undo. Sample data is acceptable for OCR/file reading, speech-to-text, and platform connections, as long as it's disclosed.

---

## 7. State Coverage (agent code-trace; not independently re-checked)

| Screen | Missing |
|---|---|
| Sync / Profile integrations | connecting, error |
| Home, Overview, Tasks, Profile | loading skeleton, offline banner |
| Ask SIKAD | offline banner |
| **Overview past weeks (new)** | empty state ("Nothing saved for this week") |

---

## 8. Proposed Structure per Tab

| Tab | Primary | Secondary | Disclosed | Move / remove |
|---|---|---|---|---|
| Home | Focus Card | This week (bar + fit line), Timeline | "Needs attention" | Standalone "Does it all fit?"; keep the theme pill in the header |
| **Overview** | **Week bar: ‹ Oct 5-11 › + "This week"; progress bar for the viewed week; 7-day strip; selected-day timeline** | Per-day planned hours | Past-day detail with Done / Missed / Moved chips | Remove the theme pill |
| Tasks | Needs attention | Upcoming | Completed | Keep "Add a task manually" |
| Profile | Class schedule by day, commitments | Your day, Appearance (Light/Dark/System), Integrations, "How SIKAD plans & its limits" | Judge tools (dock only) | n/a |
| Onboarding | One step per screen; theme pill in header | Progress | Samples as plain links | Keep Sync skippable |

**Overview progress bar:** this week and future weeks keep "Available vs required". Past weeks show "Done vs planned" (needs the snapshots in F27).

---

## 9. Build Backlog (see `build-prompts_v3.md` for the prompts)

| # | Goal | Status | Skip? |
|---|---|---|---|
| 1 | Judge mode + product-looking UI (incl. F29 wording) | Built; wording patch needed | No |
| 2 | Single Undo, name fix, **theme pill on setup + Home** | Partly built; patch needed | No |
| 3 | Focus flow | Not verified | No |
| 4 | Class schedule | Built (Screenshot) | n/a |
| 5 | Limitations section (incl. sample-data line) | Not verified | No |
| 6 | Simulated integration states + import review | Partly built (sample Google Calendar visible) | No |
| 7 | Desktop layout, **fluid fix (R07)** | Built boxed; patch needed | Yes if time is short |
| 8 | Hierarchy and copy | Not started | Yes |
| 9 | Reliability and accessibility | Not started | Partly |
| **10** | **Lifestyle step: commute, named orgs, wording (F28)** | New | No (cheap) |
| **11** | **Past-plan snapshots + demo seed (F27, store change)** | New | Only if time runs out |
| **12** | **Overview week navigation UI (F27)** | New, depends on 11 | Only if time runs out |

**Shippable minimum by Oct 14:** 1-6 plus patches for 1, 2, 7 and batch 10. Batches 11-12 are requested features; do them next, and don't start them until the minimum passes its Accept checks.

---

## 10. Coverage Note

| Item | Status |
|---|---|
| Journey walk, state coverage | Agent code-trace (not re-checked) |
| Desktop findings R01-R06 | Agent render; **R07 seen by reviewer in the deployed screenshot at 1920px** |
| Contrast | Computed by reviewer from tokens (light mode only) |
| Store capability for history | **Verified:** `state.history` keeps completed work (`doneAt`); past planned blocks are not stored |
| Orgs | **Verified:** `baseline.org` is already an array (`app.js:1692`); `store.js:412` hardcodes the title "Org meeting" |
| Not verified | S01, S03, F16, F17, F19, F23, F26, whether batch 3 and 5 are applied |

---

## 11. Decisions

| ID | Decision | Status |
|---|---|---|
| D1 | Desktop layout | **Resolved: yes, fluid (not boxed)**. design.md §11 is updated first. |
| D2 | Judge-mode trigger | **Resolved:** `?demo=1` + 5 taps on the version text |
| D3 | Import review | **Resolved:** a sheet after connect, using sample items |
| D4 | First real integration | **Resolved: none needs to be real.** Integrations are simulated with a clean adapter seam (organizers allow sample data). |
| D5 | "Why this?" on the Focus Card | Open: keep visible unless you say otherwise |
| D6 | Theme toggle | **Resolved:** pill on setup + Home; Profile keeps Light/Dark/System |
| D7 | Overview history | **Resolved:** full past timeline incl. what was planned (saves plan snapshots) |
| D8 | "No commute" | **Resolved:** removed; commute = 30 min / 1 hr / 1.5 hrs / 2 hrs / Custom |
| D9 | Orgs | **Resolved (default):** one or more, each with a name, day, time; each becomes a fixed weekly commitment |
