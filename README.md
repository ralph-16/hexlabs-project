# SIKAD — Find your next move

AI adaptive time-management engine for students (hackathon MVP).

SIKAD is a working, clickable prototype of the product in [user_story.md](prompts/prompt-1/user_story.md). It's plain HTML, CSS and JavaScript, with no build step and no network calls.

**Run it:** open `index.html` in a browser. To serve it locally instead, run `python3 -m http.server` and visit http://localhost:8000.

## Demo script (about 4 minutes)

The full, checked script is [user_flow.md](user_flow.md). The short version below is older; where they differ, follow `user_flow.md`.

1. Open `index.html`. Either do the full setup (name → **Use sample COR** → questions → sync → record or type your tasks → review baseline and tasks → *Generate my schedule*) or tap **Skip setup and load Alex's week**.
2. Home shows the **Focus Card** ("What to do next" with *Why this?*), **This week** progress, "Does it all fit?", and the timeline.
3. Open **Ask SIKAD** (centre button). Tap *How much usable time do I have tomorrow?* and *Can I realistically finish everything before Friday?* The answers are computed from the current plan.
4. In Ask SIKAD, say or type **"I have a work shift tomorrow from 6 PM to 10 PM."** Review the interpreted commitment → *See plan changes* → the proposal lists what would move → **Accept changes** (or Reject: nothing changes).
5. Tap **Start task**. The Focus Card expands, the rest of the screen dims, and SIKAD suggests a working method and says why. Pick one → *Start session* → Pause / Resume → *Stop early* → answer **Partly done** and enter what is left. The plan and **This week** update. Tap the dimmed area (or *Show my plan*) to leave the spotlight without stopping the timer.
6. Tap **Snooze** on the Focus Card for a one-tap replan: the timeline cards slide to their new slots. Tap **Done** to see the title struck through before the next task appears.
7. Try the other demo scenarios in Ask SIKAD: a clash with a class, a missing deadline, a task that depends on another, "write my essay", "I need another hour".
8. **Profile → View engine output** shows the JSON for every request. **Profile → Reset demo to the initial scenario** restores Alex's week so the demo can be repeated.

How the whole system works and where each part lives in the code: [system_codebase_summary.md](system_codebase_summary.md). A step-by-step demonstration script: [user_flow.md](user_flow.md).

## How it maps to the spec

| Pipeline stage | Where |
|---|---|
| PERSONALIZE (baseline, COR extraction → Phase 1) | `js/parser.js` `parseSchedule`, onboarding in `js/app.js` |
| CAPTURE / UNDERSTAND (brain dump → Phase 2) | `js/parser.js` `parse` (rule-based stand-in for the LLM) |
| PRIORITIZE / BREAK DOWN / SCHEDULE | `js/engine.js` `rank`, `suggestParts`, `schedule` |
| NEXT ACTION + "Why this?" | `js/engine.js` `nextSession`, `explain` |
| REPLAN (→ Phase 3) | `js/store.js` `replan`; stable replans keep still-valid sessions in place |

Rules the engine enforces:
- Fixed commitments are never moved by the engine. A class is only skipped when the student chooses that in a conflict prompt.
- Every task gets a 15-minute buffer.
- Tasks never land after their deadline. When there isn't enough time, the status is `INFEASIBLE`, with honest triage.
- Overdue tasks are kept and scheduled first.
- Task parts and dependencies stay in order.
- Overdue unfinished work takes the earliest real slot; work it displaces is placed again in deadline order (difficulty second), across as many days as needed.
- Time passing never marks work done. A block that ends without a report becomes a check-in: **Completed**, **Partly done** or **Not finished**. Unfinished work is planned again, across later days if needed, and shown as a recommended schedule before the plan changes.
- A tight day is shown as a status with a reason (**At risk today**, **Won't fit today**, **Not enough time**), not as a percentage. The rule-based score behind it is internal.
- New commitments are one-time unless the input says they recur.
- AI-estimated durations are labelled as estimates.
- Deadlines are never invented.

## Design

The visual system follows [design.md](prompts/prompt-2/design.md) (rationale in [design-audit.md](prompts/prompt-2/design-audit.md)): Forest/Paper/Butter palette with verified-contrast tokens in `css/styles.css`, Plus Jakarta Sans + Inter self-hosted in `fonts/` (latin + latin-ext subsets, SIL OFL 1.1), and the "Grounded Path" timeline.

Motion follows [motion-spec.md](motion-spec.md): the replan Shuffle, the completion strike and the Focus Mode spotlight are built with CSS and the Web Animations API in `js/motion.js`. There is no animation library. With "reduce motion" switched on in the OS, nothing animates and no information is lost.

`manifest.webmanifest` and `icons/sikad.svg` let Chrome install SIKAD to a phone's home screen when it is served over HTTPS or localhost. `sw.js` caches the app shell (network first), so it opens offline after one online visit over HTTPS or localhost.

## What is in the prototype

| Part | What it does | Where |
|---|---|---|
| Setup | Classes (manual or labelled demo import), routine, weekly commitments, first tasks, review, first plan | `js/app.js` |
| Ask SIKAD | Answers questions from the live plan; turns statements into reviewable changes | `js/assistant.js`, `js/parser.js` |
| Dictaphone | Browser speech recognition with Stop / Cancel; transcript is editable before sending | `js/app.js` |
| Scheduling and replanning | Priority, 15-minute buffer, protected fixed commitments, honest `INFEASIBLE` | `js/engine.js` |
| Proposals | A confirmed change is replanned on a copy; the student accepts or rejects the result | `js/app.js` `applyDump` |
| Focus Mode | Working-method suggestion, spotlight, timer, pause/resume, mark done or stop early, outcome question | `js/focus.js`, `js/store.js` |
| Motion | Cards slide to their new slots after a replan; completion strike; sheet, toast and card transitions | `js/motion.js`, `motion-spec.md` |
| Weekly progress | Done work against planned work, focus-session history | `js/store.js` `weeklyProgress` |

All of these read and write one state object, saved to `localStorage` after every change.

### How weekly progress is calculated

- **Done** = minutes of work credited this week (Monday to Sunday). Completing a session credits its planned minutes. Reporting "partly done" credits the difference between what was left before and what you say is left now.
- **Planned** = done + minutes still scheduled between now and Sunday night.
- **Percent** = done ÷ planned.
- Rescheduling work to another week lowers "planned" only. It never lowers "done", so a replan cannot reduce your progress.
- If you report that a task needs more time than estimated, nothing is credited and the plan grows.
- A new week starts at zero done. Earlier weeks are not shown.
- Focus sessions are counted when you end a session and say how it went. A timer reaching zero counts nothing.

### Streaks: evaluated, not built

A daily streak rewards showing up every day. Student schedules are uneven (exam weeks, shifts, commute days), so a streak would break for reasons the student cannot control and would turn a sensible reschedule into a visible loss. The weekly bar and session count show effort without that penalty. A "days active this week" count could be added later if the team wants one, as long as it never resets or warns.

### What is simulated

- **Widgets and notifications** are previews inside the app (Profile → Test widgets / Test notifications). The notification page draws a phone and shows each notification on it, with buttons that open the matching part of the app. No home-screen widget is installed and no push or system notification is sent.
- **No AI model is connected.** Understanding text, answering questions and suggesting a working method are fixed JavaScript rules over the app's data.
- **Schedule import** loads sample text; no OCR runs.
- **Platform connections** (Google Calendar, Canvas, Teams, Classroom) are toggles only.
- **Voice** uses the browser's own speech recognition (Chrome and Edge; it needs an internet connection). Other browsers get a typed alternative and a sample transcript labelled as demo. SIKAD stores no audio.
- **Time** is the device's real local date, time and timezone (`T.now()` in `js/time.js`). Nothing simulates the clock; the sample week is generated relative to today. Only the automated tests pin the clock.

## Testing

Manual tests for the user/developer are in [test-guide.md](test-guide.md): five tests, a test log and a correction log. They start as NOT RUN.

```
node tests/run-tests.js
```

102 logic tests with no dependencies (102 passed, 0 failed on 14 Oct 2026): capture and clarification, Ask SIKAD answers, replanning around a work shift, protected fixed commitments, the 15-minute buffer, infeasible plans, working-method suggestions, focus-session outcomes, weekly progress, and saved-data handling.

Browser behaviour (rendering, motion, Focus Mode, reduced motion, refresh, reset) was checked with a headless Chromium script during development, against the acceptance criteria in `motion-spec.md` §10. That script is not part of this repository.

## Changes from user_story.md

The final implementation brief (`prompts/prompt-5/`) extends the original user story:

- The dashboard capture sheet is now **Ask SIKAD** and also answers questions about the plan. It is a side panel, not a chat screen.
- Changes made through Ask SIKAD are shown as a **proposal to accept or reject** before the plan changes.
- **Focus Mode** adds working-method suggestions and a pause/resume/end session flow.
- **Weekly progress** and focus-session history are new.
- Tasks can name a **dependency** in plain text ("…after the database proposal").

## Navigation and accessibility

- Each tab has its own URL (`#home`, `#week`, `#tasks`, `#profile`). The browser or phone Back button closes an open sheet first, then steps back through tabs.
- Unsent Ask SIKAD text is kept if the panel is dismissed.
- Validation errors appear under the field they belong to and are announced to screen readers.
- A "Skip to main content" control is the first keyboard stop. Controls are at least 44px tall, and layouts hold at 320px width and at 200% and 400% zoom.

## Deliberate design choices

- Body text is 15px, as design.md specifies. Inputs are 16px so iPhones do not zoom in on focus.
- Font sizes are fixed pixels. Phone text-size settings still scale them; a desktop browser's default-font-size setting does not.
- During the 4-step setup, the on-screen Back button moves between steps. The browser Back button is wired up only after setup.

## Known limitations

- Ask SIKAD recognises a fixed set of question and statement patterns. Anything else gets a clarifying question.
- A running focus session is never ended by the clock; it stays open until the student ends it.
- SIKAD cannot know whether work was done, so it asks. A check-in stays on Home until it is answered, and that block's time is not planned anywhere until then.
- Limits that remain: a weekly commitment past midnight has to be entered as two, and "change the deadline for X to next week" takes that Sunday. The confirmed defects in `errors.md` §10 are all fixed.
- The session timer and the plan both use real time. "Skip session ahead 5 min" in the judge dock moves only the session timer.
- During the 4-step setup the browser Back button leaves the page; use the on-screen Back button.
- Data is saved in `localStorage` on this device only. Use **Profile → Reset** to start over.
- To use a real model later: call it with `prompts/prompt-1/prompt.md` as the system prompt from inside `TempoParser.parse`, and keep `engine.js` as the deterministic validator described in prompt.md §2.
