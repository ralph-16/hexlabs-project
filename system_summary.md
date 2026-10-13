# SIKAD — System Summary

SIKAD ("Find your next move") is a time-management app for students. The student tells it about their classes, routine and tasks; it builds a realistic schedule around the things that cannot move, always answers "what should I do now?", and replans when the day changes. The student approves every change.

This document explains what the system does, how a student uses it, and how it works underneath.

## 1. What it is

- A web app that installs to a phone's home screen (a PWA). It also works in a desktop browser.
- Plain HTML, CSS and JavaScript. No framework, no build step, no server, no account.
- Everything the student enters is saved in the browser on that device only.
- **Run it:** open `index.html`, or run `python3 -m http.server` and visit `http://localhost:8000`.

## 2. How a student uses it

### 2.1 First-time setup

| Step | What the student does |
|---|---|
| Welcome | Types a name and taps **Get started**. |
| 1. Set your baseline | Adds classes by uploading a COR / schedule photo, trying the sample schedule, or typing one class per line. |
| 2. A few quick questions | Says when the day starts and ends, whether they work, and whether they are in a school organization. |
| 3. Bring in your due dates | Optionally connects platforms (Google Calendar, Canvas, Teams, Classroom) and reviews what came in. |
| 4. Brain dump | Types or dictates everything on their plate, in their own words. |
| Review before planning | Checks the classes, commitments and tasks SIKAD understood, fixes anything wrong, then generates the plan. |

### 2.2 Everyday use

The app has four tabs and a centre **Ask SIKAD** button.

**Home** — the daily screen, read top to bottom:

1. **What to do next.** One task, when to do it, and a "Why this?" explanation. Three buttons: **Start task**, **Done**, **Snooze**.
2. **Today.** Task time still left today, tasks completed out of today's total, and **View schedule →**, which jumps to today's timeline.
3. **Weekly task progress.** Percent of planned task time completed, completed versus planned time, whether the remaining work **Fits**, and **View weekly overview →**.
4. **Timeline.** Today or tomorrow as a path of classes, commutes, tasks and open time.

When something needs a decision, a card appears near the top: **Plan updated** (what moved, with Undo), **Not enough time**, a missing deadline, or a check-in for a task that was not marked done.

**Overview** — the week, Monday to Sunday:

- **Weekly summary:** *Your time budget* (usable hours for tasks after fixed commitments), *Tasks remaining*, and *Time needed*.
- Seven day cards, each with a bar for the task time left that day. Tapping a day shows its timeline.
- Arrows move between weeks. Past weeks show what was done, missed or moved.

**Tasks** — every task, grouped into *Needs attention*, *Up next* and completed. A task can be opened to change its time, deadline or steps, or added manually.

**Profile** — class schedule, recurring commitments, day start and end, appearance (Light / Dark / System), connected platforms, a plain statement of how SIKAD plans and what is simulated, and Reset.

**Ask SIKAD** — the centre button. The student types or taps to speak. It does two things:

- **Answers questions** from the live plan, such as "How much usable time do I have tomorrow?" or "Can I finish everything before Friday?"
- **Takes changes**, such as "I have a work shift tomorrow from 6 PM to 10 PM" or a new task. SIKAD shows what it understood, then a proposal of what would move. Nothing changes until the student taps **Accept changes**.

### 2.3 Working on a task

1. Tap **Start task**. The card expands and the rest of the screen dims.
2. SIKAD suggests a working method and says why: Task chunking, Pomodoro, Timeboxing, or no method.
3. A timer runs, with Pause and Resume.
4. On finishing or stopping early, the student says how it went: **Completed**, **Partly done** (and how much is left), or **Not finished yet**.
5. The plan, the Today card and the weekly progress update to match.

### 2.4 When plans change

| The student… | SIKAD… |
|---|---|
| Taps **Done** | Strikes the task through, credits the time, and shows the next task. |
| Taps **Snooze** | Moves the task later and shows before → after times, with Undo. |
| Reports a new commitment | Protects it as fixed and moves tasks around it, after approval. |
| Misses a planned block | Asks what happened instead of assuming. |
| Has more work than time | Says "Not enough time" and offers **A plan that fits**: the fewest, lowest-priority tasks finish late, each shown with how late. The student accepts or keeps the current plan. Nothing is shortened and no deadline is edited. |

## 3. How the system works

### 3.1 The pipeline

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

### 3.2 Rules the engine always follows

- Fixed commitments (classes, work shifts, commutes) are never moved by SIKAD. They show a lock and "Fixed".
- Every task gets a 15-minute buffer from other tasks and from fixed commitments. There is none after the last task of the day.
- A task's remaining time is never shortened to make a plan fit.
- A task is never scheduled after its deadline. If it cannot fit, SIKAD says so.
- Deadlines are never invented. A task without one waits for the student to add it.
- Durations SIKAD estimated itself are marked with ≈ and "AI estimate".
- Task steps and dependencies stay in order.
- Every replan shows before → after and can be undone.

### 3.3 How tasks are ordered and placed

One policy is used everywhere (first plan, replans, Snooze, edits, Ask SIKAD). It lives in `rank()` and `schedule()` in `js/engine.js`.

1. Overdue work first, then anything the student marked "Do this first".
2. **Deadline urgency**, compared by day. Priority pulls a task's urgency earlier (high by 36 hours, medium by 12).
3. **Difficulty**, only among tasks that are urgent on the same day: Hard before Medium before Easy, so harder work gets the earlier, longer blocks. A hard task also gets one uninterrupted sitting when one exists. Difficulty never moves a task ahead of one that is urgent on an earlier day. A task with no stated difficulty counts as Medium.
4. Exact deadline, then priority, then creation order.

Steps of one task, and tasks that depend on another, always stay in order. A task with no deadline is not scheduled until the student gives one.

Placing: a time the student asked for is honoured first if it is free of fixed commitments, inside the day, and before the deadline; it may displace other tasks. Sessions from the previous plan are then kept where they are when still valid, and everything else goes into the earliest open slot before its deadline.

**Deadline rescue.** If that leaves out work that could still meet its deadline, the engine tries plain earliest-deadline order with already-overdue work last, and uses it only when it fits strictly more.

**Overruns.** When the student reports on work that was happening now (Done, Partly done, session ended), the next task starts no sooner than 15 minutes later. A session that was due to start before then is placed again with its full duration: later today if it fits, otherwise on the next day that has room before its deadline, where it is ranked with everything else. Three different outcomes are reported: *At risk today*, *Won't fit today*, and *Not enough time before the deadline*.

**Too much work.** When something still has no slot before its deadline, SIKAD does not stop at the warning. `suggestAdjustment()` in `js/store.js` works out a plan that fits, on a copy: it lets one competing task at a time finish after its deadline (lowest priority first, then the one that already did not fit, then the later deadline), stops as soon as everything has a place, and then puts back any choice that turned out not to be needed, most important first. Nothing is shortened, no deadline is edited and no fixed commitment moves. The student sees which tasks would be late and by how much, and accepts or rejects it. An accepted late task is placed as early as the on-time work allows, is marked **Late**, and returns to on time automatically if room appears.

### 3.4 Completion confidence (today)

A rule-based estimate of whether a task planned today will get finished today. It is not a measured probability and not a model prediction. The method and every constant are in `completionConfidence()` and `CONFIDENCE` in `js/engine.js`.

For each task planned today, in plan order:

- **room** = usable time left today (from now to the end of the day, after fixed commitments) minus the planned time and 15-minute gaps of the tasks before it.
- **ratio** = room ÷ the task's time planned today.
- **score** = 0% at a ratio of 0.5 or less, 100% at 2.0 or more, linear in between.
- Then: −10 if Hard, +5 if Easy, −5 if the duration is an AI estimate, −4 per task queued before it (at most −12), −10 if its planned start has passed and it is not started. Clamped to 0–100.

| Score | Shown |
|---|---|
| 70 or more | Nothing. The ordinary task card. |
| 45–69 | **At risk · NN%** with the reason |
| Under 45 | The same, in the stronger warning colour |

"Won't fit today" and "Not enough time before the deadline" are separate states with no percentage, and the second always replaces any percentage. Limits: the thresholds are judgement calls, not calibrated against past outcomes; the estimate only looks at today.

### 3.5 Ask SIKAD commands

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

Title matching: a full title in the message wins; otherwise shared title words; two close matches ask which one; no match says so and never creates a task. Every change goes through the same review → proposal → Accept/Reject → Undo flow and the same engine as manual edits (`applyTaskAction` in `js/store.js`). Not supported: notes editing by voice or text command, moving a commitment, and several tasks named with one "them".

### 3.6 How the numbers are calculated

| Number | Meaning |
|---|---|
| Today — time remaining | Minutes of unfinished task sessions planned for today. Classes and commutes are not counted. |
| Today — tasks completed | Tasks finished today, out of those plus the tasks still planned for today. |
| Weekly task progress | Task time completed this week ÷ (completed + still planned this week). |
| Fits | Shown only when the remaining work fits the open time before its deadlines and nothing is left unscheduled. |
| Your time budget | Open time from now to Sunday night after fixed commitments, including time already given to tasks. |
| Tasks remaining | Unfinished tasks in the selected week, out of unfinished plus completed. |
| Time needed | Estimated time left across the unfinished tasks in the selected week. |

Moving work to another week lowers "planned" only; it never lowers what was completed.

### 3.4 Data and privacy

- One state object holds the baseline, tasks, plan, history and focus sessions. It is saved to the browser's `localStorage` after every change.
- Nothing is sent to a server. No audio is stored.
- A service worker caches the app so it opens offline once it has been loaded over HTTPS or localhost.
- **Profile → Reset** clears everything and restarts setup.

## 4. What is real and what is simulated

**Really works:** typed brain dump → tasks → schedule → replan → Done / Snooze / Undo, Ask SIKAD answers, Focus Mode, weekly progress, and saving between visits.

**Simulated in this prototype:**

- **No AI model is connected.** Understanding text, answering questions and suggesting a working method are fixed rules over the app's data.
- **Schedule import** loads sample text. No OCR runs.
- **Platform connections** load sample items. No real account is contacted.
- **Voice** uses the browser's own speech recognition (Chrome and Edge, online). Other browsers get a typed alternative.

Time is always the device's real date and time. The sample week is generated relative to today.

## 5. For presenters

Add `?demo=1` to the URL to show the **Judge tools** dock. It can load a ready-made sample week ("Alex's week"), run prepared scenarios, and show the engine's JSON output for each request. These tools never appear in the normal product.

## 6. Known limitations

- Ask SIKAD recognises a fixed set of question and statement patterns. Anything else gets a clarifying question.
- Data lives on one device and one browser. There is no sync or backup. A failed save and a change made in another tab are announced.
- A running focus session stays open until the student ends it.
- During setup, use the on-screen Back button; the browser Back button leaves the page.

## 7. Testing

```
node tests/run-tests.js
```

77 logic tests with no dependencies cover capture and clarification, Ask SIKAD answers and task commands, replanning and overruns, deadline-first and difficulty-second ordering, completion confidence, protected commitments, the buffer, infeasible plans, focus sessions, weekly progress and saved data. Screens and motion are checked by hand and with a headless browser.
