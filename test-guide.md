# SIKAD — Manual Test Guide

Five manual tests for the user/developer to run in the real app. Each one says where to go, what to do, what should happen, and how to record the result.

**Nobody has run these tests yet.** Every row in the test log (§7) starts as `NOT RUN`. The coding agent ran the automated logic tests and its own browser checks while building the app (see `process-log.md`); those do not count as these tests.

Related documents: `user_flow.md` (the demonstration script), `errors.md` (known error states and defects), `system_codebase_summary.md` (how the system works).

---

## 1. Rules for testing

- Correct input should work as described.
- Incomplete input should get a question or a message under the field. SIKAD should not guess.
- Invalid or unsupported input should not pass silently or damage the plan.
- A refused or rejected change should leave the plan exactly as it was.
- Record every failure, including ones already listed in `errors.md`.
- A fix is not done until the failed test is run again and passes.
- Use the sample week for these tests. Do not use your own saved data.
- Use only the controls named here. Do not edit browser storage by hand.

## 2. Getting started

### 2.1 Run the app

1. In the project folder, run: `python3 -m http.server`
2. In Chrome or Edge, open: `http://localhost:8000/index.html?demo=1`

`?demo=1` shows the **Judge tools** pill at the bottom right. It lasts for this browser tab.

> **Warning.** SIKAD saves its data in the browser, separately for each address. Loading the sample week (below) **replaces whatever is saved at `localhost:8000`**. **Profile → Reset & restart setup** erases it. If you already keep your own SIKAD data at this address, start the server on another port instead (`python3 -m http.server 8010`) and use that address for testing.

### 2.2 Make a clean test state

Do this before every test, and again whenever a step says "clean state".

1. Tap **Judge tools**.
2. Under **Demo clock**, enter **next Monday, 09:05 AM** in the date-and-time box and tap **Set**. The panel should read **Monday, … · 9:05 AM Shifted**.
3. Tap **Load Alex's week**. If the button reads **Reset to Alex's week**, tap it, then **Replace my data**.
4. Tap **Judge tools** again to close the panel.

The Demo clock changes only what SIKAD thinks the time is. It does not change your computer's clock. Do not tap **Use real time** during a test.

### 2.3 Check the clean state

Home should read **Hey, Alex**. The plan should be:

| Day | Time | Task | Due |
|---|---|---|---|
| Monday | 12:15 PM – 1:15 PM | Algorithm Tracing Worksheet (overdue) | last Wednesday, 11:59 PM |
| Monday | 6:15 PM – 7:15 PM | Class Diagram Exercise | Tuesday, 11:59 PM |
| Monday | 7:30 PM – 8:30 PM | Big-O Worksheet | Tuesday, 11:59 PM |
| Tuesday | 6:15 PM – 8:15 PM | ERD and Business Rules | Wednesday, 11:59 PM |
| Tuesday | 8:30 PM – 10:00 PM | Use Case Diagram | Thursday, 11:59 PM |

If it differs, repeat §2.2.

### 2.4 How to compare "before" and "after"

Several tests ask whether the plan changed. Open **Tasks** and note each task's **Due**, **Est** and **Next** lines before the step, then compare afterwards. For a wider view, open **Overview** and tap each day.

### 2.5 Automated tests (run after any code change)

```
node tests/run-tests.js
```

It prints one line per test and ends with a count such as `130 passed, 0 failed`. Record the count you get.

---

## 3. The five tests

### Test 1 — Normal input

**Objective:** valid input is understood and applied correctly.

**Start from:** a clean state (§2.2).

**Procedure:**

1. Tap **Tasks**, then **Add a task manually**.
2. Fill in:

   | Field | Enter |
   |---|---|
   | Task name | `Lab Summary` |
   | Deadline | **Wednesday** of the demo week, **05:00 PM** |
   | Time needed | `1` hr `30` min |
   | Priority | Medium |
   | Difficulty | Hard |

3. Tap **Add to plan**.
4. On **Tasks**, find **Lab Summary** and read its card.
5. Tap it. Check that the fields show what you entered. Close the sheet with ✕.
6. Read the other tasks' **Next** lines and compare with §2.3.
7. Open **Overview** and tap **Tue**. Check the timeline.
8. Tap **Lab Summary** again, change **Time needed** to `2` hr `0` min and **Deadline** time to **06:00 PM**, tap **Save & replan**, then reopen it.
9. **Add a task with a requested start.** Make a clean state. **Tasks → Add a task manually**: name `Group Notes`, deadline **Wednesday 05:00 PM**, time needed `1` hr `0` min, **Start at** **Tuesday 06:15 PM**. Tap **Add to plan**. Read the **Plan updated** card on Home.
10. **Edit the start time.** **Tasks** → **Group Notes** → change **Start at** to **Wednesday 11:15 AM** → **Save & replan**. Read the plan again.

**Expected result:**

- A toast: "Task added." with **Undo**.
- The card reads **Due: Wed, … 5:00 PM · Est: 1.5 hrs · Status: Scheduled**, with a **Next** time before its deadline (tomorrow evening on the sample week).
- Lab Summary is due before ERD and Business Rules (Wednesday 11:59 PM), so it is planned ahead of it: on the sample week, **Tomorrow 6:15 PM**, with ERD after it at 8:00 PM. Use Case Diagram, the last deadline, is placed again around them (on the sample week it is split: an hour Monday at 8:45 PM and half an hour Tuesday at 11:15 AM). Every task is still before its own deadline. The three earlier Monday tasks do not move.
- Tuesday's timeline shows classes and commutes unchanged, at least 15 minutes between tasks and between a task and a class, and each task once.
- After step 9, Group Notes is at **Tomorrow 6:15 PM**, exactly as asked. The task that was there (ERD and Business Rules) has moved to 7:30 PM, and Use Case Diagram has been placed again around them; both are still before their deadlines. The Plan updated card lists each move as was → now. No class moved.
- After step 10, Group Notes is at **Wednesday 11:15 AM**. ERD and Business Rules has moved back up into the time it left (Tomorrow 6:15 PM): a gap that a change opens is closed. Every task is still planned once and before its deadline.
- After step 8 the sheet shows 2 hr 0 min and 06:00 PM, the card shows **Due: Wed, … 6:00 PM · Est: 2 hrs**, and ERD and Business Rules has moved to Wednesday, still before its deadline.

**Pass:** all of the above.

**Fail:** the task is refused, saved with different values, shown twice, missing, planned over a class or after its deadline, or ordered against the rule "deadline first, difficulty second".

---

### Test 2 — Incomplete input

**Objective:** missing information is noticed and never invented.

**Start from:** a clean state (§2.2).

**Procedure and expected result, step by step:**

| # | Do this | Expected |
|---|---|---|
| 1 | **Tasks → Add a task manually**. Leave everything empty. Tap **Add to plan**. | Under the name field: "Task name is missing. Type a short name, e.g. "IT 208 report"." Nothing is added. |
| 2 | Type `Lab Summary` as the name. Leave the deadline empty. Tap **Add to plan**. | Toast: "Task added. It needs a deadline before it can be scheduled." On **Tasks** it is under **Needs attention** with **Due: Not set** and **Status: Needs a deadline**. It has no **Next** line. |
| 3 | Go to **Home**. | A card: "When is "Lab Summary" due?" with "SIKAD won't guess a deadline." |
| 4 | On that card, tap **Schedule it** without picking a date. | "No date picked yet. Choose the due date, then tap Schedule it." |
| 5 | Pick **Wednesday** of the demo week, set the time to **05:00 PM**, tap **Schedule it**. | Toast "Plan updated." The task now has a **Next** time before Wednesday 5:00 PM. |
| 6 | **Tasks** → tap **Lab Summary**. Clear both **Time needed** boxes. Tap **Save & replan**. | A message under the field: "Time needed must be between 5 minutes and 40 hours." (or "Enter the time needed in hours and minutes."). The sheet stays open and nothing is saved. Close with ✕. |
| 6a | **Tasks → Add a task manually**. Name `Draft`. Set **Start at** to **Tuesday 06:15 PM** and leave the deadline empty. Tap **Add to plan**. | "Add the deadline too. A start time alone does not tell SIKAD when the work is due." Nothing is added. Close with ✕. |
| 6b | In the same form, pick a **Start at** date and do not touch the time. | The time fills in by itself, so a half-entered start cannot be saved. Clearing the date clears the time too. Close with ✕. |
| 7 | Tap the centre **Ask SIKAD** button → **Speak or type**. Type `Finish my programming assignment` and tap **Send**. | A task card with the question "When is the finish my programming assignment due? I need the date to schedule it." and "SIKAD won't guess a deadline." The time needed is marked ≈ **AI estimate**. |
| 8 | Without setting a date, tap **See plan changes**, then **Accept changes**. | The proposal says the task "is saved but won't be scheduled until it has a deadline" and "No other task needs to move." After accepting, it appears under **Needs attention** with **Due: Not set** and **Needs a deadline**. No other task moved. |
| 9 | Give it a deadline from the Home card, as in step 5. | It is scheduled before that deadline. |

**Pass:** every row behaves as described; no deadline or duration was made up without being marked as an estimate; nothing unrelated changed.

**Fail:** SIKAD gives a task a deadline you did not enter, schedules a task that has no deadline, accepts an empty required field, or changes another task as a side effect.

---

### Test 3 — Unexpected or invalid input

**Objective:** unsupported, contradictory or invalid input is handled safely.

**Start from:** a clean state (§2.2). Before each step, note the plan (§2.4). After each step, check it again.

| # | Do this | Expected |
|---|---|---|
| 1 | **Ask SIKAD → Speak or type** → `Tell me a joke` → **Send**. | "I don't have an answer for that yet." followed by examples of what it can do. Tap **Done**. Plan unchanged. |
| 2 | `Move the thesis to Friday` → **Send**. | "I couldn't find a task called "thesis", so nothing was changed and no new task was added." It lists the open tasks. Tap **Done**. Plan unchanged, and no task named thesis exists. |
| 3 | **Tasks** → tap **Big-O Worksheet**. Set **Start at** to a date before the demo Monday. Tap **Save & replan**. | "That time has already passed." followed by "The closest time that works is …". Nothing is saved. |
| 3a | In the same sheet, set **Start at** to **Monday** of the demo week, **03:00 PM**. Tap **Save & replan**. | "That time runs into IT 207 (2:00 PM – 5:00 PM) or the 15-minute gap around it. SIKAD never moves a fixed commitment." with the closest time that works. Nothing is saved. |
| 3b | Set **Start at** to **Monday 11:00 PM**, then to **Wednesday 07:00 PM** (after its Tuesday deadline). Tap **Save & replan** each time. | First: "That is outside your day (6 AM to 10 PM) for 1 hr of work." Second: "Starting then, 1 hr of work would end after the deadline (…)." Each offers the closest time that works. Nothing is saved. |
| 4 | In the same sheet, clear the Start at date. Set **Time needed** to `0` hr `0` min. Tap **Save & replan**. | "Time needed must be between 5 minutes and 40 hours." Nothing is saved. Close with ✕. |
| 5 | **Ask SIKAD** → `I have a group study session today from 3 PM to 5 PM` → **Send**. | **Decision needed**: "You already have IT 207 (2:00 PM – 5:00 PM). Group Study Session overlaps it." **See plan changes** is disabled until you choose. Choose **Keep IT 207**, then **See plan changes**, then **Reject**. The class is still there and the plan is unchanged. |
| 6 | **Ask SIKAD** → `I have a work shift tomorrow from 10 PM to 2 AM` → **Send**. | A **NEW FIXED COMMITMENT** card reading **10:00 PM – 2:00 AM**. Tap **See plan changes**, then **Reject**. (To check both days instead: **Accept changes**, then in **Overview** tap Tue, which ends with Work shift 10:00 PM – 12:00 AM, and Wed, which starts with Work shift 12:00 AM – 2:00 AM. Make a clean state afterwards.) |
| 7 | **Ask SIKAD** → `Change the deadline for Big-O Worksheet to February 31` → **Send**. | ""february 31" is not a real date. Which date do you mean? The deadline for "Big-O Worksheet" was not changed." Tap **Done**. Plan unchanged. |
| 8 | **Ask SIKAD** → `Move Big-O Worksheet and Class Diagram Exercise to Friday` → **Send**. | "One task at a time. Your message names "Class Diagram Exercise" and "Big-O Worksheet". … Nothing was changed." Tap **Done**. Plan unchanged. |
| 9 | **Ask SIKAD** → `Lab report due next week, about 2 hours` → **Send**. | A question: ""next week" is not a single day. Do you mean by Friday (…) or by Sunday (…)?" with two buttons, and an empty **Due** field. Close with ✕. Nothing was added. |

**Pass:** every row behaves as described, and the plan is unchanged after each one that was refused, rejected or closed.

**Fail:** wrong input is accepted silently, a task that does not exist is created or another task is changed in its place, a class or shift moves, or a refused change leaves part of itself behind.

Write down any other wrong behaviour you notice, even if it is not in `errors.md`.

---

### Test 4 — Challenge-specific safety test

**Objective:** SIKAD is honest and safe about limited time, deadlines, fixed commitments, progress and simulated features.

**Part A — fixed commitments and too much work.** Start from a clean state.

| # | Do this | Expected |
|---|---|---|
| 1 | **Tasks** → **Use Case Diagram** → **Start at**: **Monday** of the demo week, **03:00 PM** → **Save & replan**. | Monday 3 PM is inside the IT 207 class. The sheet refuses: "That time runs into IT 207 (2:00 PM – 5:00 PM) or the 15-minute gap around it. SIKAD never moves a fixed commitment." and names the closest time that works. Nothing is saved. Close with ✕. The class and the task are where they were. |
| 2 | Make a clean state again. **Ask SIKAD → Speak or type**, enter the text below, tap **Send**, then **See plan changes**. | A sheet titled **A plan that fits**. It names the task that would finish after its deadline and by how much, and says "Nothing was shortened, no deadline was edited and no fixed commitment moved." |
| 3 | Read **What would change**. | Every listed task shows was → now. No class or commute is in the list. |
| 4 | Tap **Keep my current plan**. | The plan is §2.3 again. The two new assignments were not added. |

```
New assignment: capstone chapter due tomorrow at 8 AM, about 5 hours. New assignment: network lab due tomorrow at 8 AM, about 4 hours.
```

**Part B — time passing does not complete work.** Start from a clean state.

| # | Do this | Expected |
|---|---|---|
| 5 | Note **Weekly task progress** on Home (0%). **Judge tools** → Demo clock to the same Monday **01:30 PM** → **Set** → close. | A card: "Your scheduled time for Algorithm Tracing Worksheet has ended. How did it go?" with **Completed**, **Partly done**, **Not finished**. Progress is still 0%. On **Tasks**, the task is still open, not under Completed. |
| 6 | **Judge tools** → **+15 min**. Reload the page. | Still exactly one card. Still 0%. |
| 7 | Tap **Partly done**. Enter `0` hr `30` min. Tap **See recommended schedule**. | A sheet, **Recommended schedule**. It says the task still needs 30 min, when it was planned, the recommended new time, and lists the other tasks that move. The plan has not changed yet. |
| 8 | Tap **Keep current plan**. | "No changes were made. Your plan is as it was." The card is still on Home. Progress still 0%. |
| 9 | Tap **See recommended schedule** again, then **Accept changes**. | The card is gone. The task shows 30 min left at its new time. Progress has gone up by the half hour that was done. Toast with **Undo**. |
| 10 | Make a clean state, repeat step 5, then tap **Not finished** and **Accept changes**. | Nothing is credited (0%). The task keeps its full hour and is planned again; because it is overdue it goes first, and the tasks after it shift. |
| 11 | Make a clean state, repeat step 5, then tap **Completed**. | Only now is the hour credited: progress reads 15%. Toast "Logged as done. Plan adjusted." with **Undo**. |

**Part D — finishing early: a suggestion, never an automatic move.** Start from a clean state.

| # | Do this | Expected |
|---|---|---|
| 16 | Note the plan (§2.4). On **Home**, tap **Done** on the next task (Algorithm Tracing Worksheet, planned 12:15 PM). | The task is done. **No other task has moved.** A card **Use the time you freed?** names Class Diagram Exercise, **Today, 12:15 PM – 1:15 PM**, where it is planned now, and why. It has **Accept** and **Decline**. Only one such card is shown. |
| 17 | Check the suggested time. | It starts no earlier than 15 minutes after you tapped Done, and on the next quarter hour. It does not overlap a class or commute, ends before the task's deadline, and is one sitting. |
| 18 | Tap **Decline**. | "Kept as it was…". The card is gone and the plan is exactly as noted in step 16. |
| 19 | Reload the page, then **Judge tools** → **+15 min**. | The card does not come back. The plan is unchanged. |
| 20 | **Tasks → Use Case Diagram → Difficulty: Easy → Save & replan**, then **Home**. | The card is back (the plan changed for another reason). Nothing has moved yet. |
| 21 | Tap **Accept**. | Toast "Plan updated." with **Undo**. Only Class Diagram Exercise moved, to 12:15 PM. Every other task is where it was. It is still open (not marked done) and its time needed is unchanged. |
| 22 | Tap **Undo** on the toast. | Class Diagram Exercise is back at 6:15 PM, the card is back, and Algorithm Tracing Worksheet is still done. |
| 23 | Make a clean state. Tap **Done**, leave the card. Add `I have a work shift tomorrow from 6 PM to 10 PM.` through Ask SIKAD → **See plan changes** → **Accept changes**. | The task the shift displaces (ERD and Business Rules) is moved at once, using today's freed time if needed. The card is gone because that time is now used. A required repair does not wait for the suggestion. |
| 24 | Make a clean state. Move the Demo clock to **01:30 PM** and answer the check-in with **Completed**. | No suggestion appears: the block had already ended, so no time was freed. |
| 25 | Make a clean state. Tap **Done**, **Accept**, then **Done** again on the task that just moved. | A **new** card for a different task (Big-O Worksheet, Today 12:15 PM). Check the timeline before answering: that task has not moved. The first Accept did not approve this one. |
| 26 | **Accept**, then **Done** a third time. | A card that suggests **Use Case Diagram**, planned **tomorrow**, for **today** 12:15 PM. On the timeline it is still tomorrow. |
| 27 | **Judge tools** → **+15 min** twice, reload. | Nothing moved; the card is still there. |
| 28 | Tap **Decline** on it. Then **+15 min** and reload. | Use Case Diagram stays tomorrow. The card does not come back. |
| 29 | Make a clean state. Repeat rows 16 and 21 (Done, Accept), wait one minute, **+15 min**, reload. | After accepting, nothing else moves by itself afterwards. In particular ERD and Business Rules stays tomorrow. |
| 30 | Make a clean state. Start the next task in **Focus Mode**, **Stop early**, **Yes, it's complete**. Then repeat with **Tasks → (task) → Mark whole task done**, and with Ask SIKAD `Mark Big-O Worksheet as done` → **See plan changes** → **Accept changes**. | Each way of finishing early ends in the same card and moves nothing until you accept. |

**Part C — warnings and honesty.**

| # | Do this | Expected |
|---|---|---|
| 12 | Make a clean state. **Ask SIKAD** → `I have to work tonight from 6:30 PM to 10:30 PM` → **Send** → **See plan changes** → **Accept changes**. Read the **Today** card. | **At risk today** and **Won't fit today** appear as words, each with a sentence that gives the real time left and time needed, and an **Adjust schedule** button. **No percentage** appears beside them. |
| 13 | On the **At risk today** row (Algorithm Tracing Worksheet, which is overdue), tap **Adjust schedule**. | A sheet titled **Adjust schedule**. It shows the task, **Time still needed**, **Planned now: Today, 12:15 PM – 1:15 PM**, and **Recommended: keep Today, 12:15 PM** with the reason that this is already today's earliest open time and overdue work goes first. The **Start at** date and time are already filled in. **What would change** says nothing moves, and **Accept changes** is greyed out. Tomorrow is **not** recommended. |
| 13a | Set **Start at** to **Thursday 07:00 PM**. | The plan is worked out again: several tasks move across more than one day, each shown was → now, and a warning says Class Diagram Exercise would then be at risk today. Still nothing saved. |
| 13b | Set **Start at** to **Monday 03:00 PM**. | "That time can't be used", naming IT 207, with a button for the closest time that works. **Accept changes** is disabled. |
| 13c | Tap **Keep current plan**. Compare the plan (§2.4). | Nothing changed. |
| 13d | Tap **Adjust schedule** again, set **Start at** to **Tuesday 06:15 PM** (your own choice, against the recommendation), read the warning, tap **Accept changes**. | Toast "Plan updated." with **Undo**. The **Today** card no longer has a row for Algorithm Tracing Worksheet. On **Tasks** it reads **Scheduled · Next: Tomorrow, 6:15 PM** under **Up next**, not under Needs attention. **Overview → Tue** shows it at 6:15 PM. |
| 13e | Read the **Today** card again, wait 15 seconds, read it again. | Warnings that are still true are still there both times: Class Diagram Exercise **At risk today** (it took the tight midday gap, as the sheet warned) and Big-O Worksheet **Won't fit today**. Nothing vanishes or reappears by itself. |
| 13f | Make a clean state. Add the two-assignment text from Part A, **See plan changes**, **Don't adjust**, **Accept changes**, then **Keep my current plan** if a sheet opens. Open **Tasks**. | The work that has no slot is under **Needs attention** with **Doesn't fit yet**, and Home shows **Not enough time**. A genuine problem is not cleared by replanning. |
| 14 | **Profile → Test notifications**. Tap **Show on phone** for each kind. Try the buttons on one real and one **Sample** notification. | Each notification appears inside the drawn phone. The phone and the list of kinds do not move or change size when you show, switch or clear one. A button on a real one opens that task or screen. A button on a sample that needs a real task opens nothing and says "This is sample content…". The page states that the phone is a drawing and nothing is sent. |
| 15 | **Profile**, read **How SIKAD plans & its limits** and **Connected platforms**. | They say that reading photos and platform connections use sample data, that no AI model is connected, and that widgets and notifications are previews. |

**Pass:** fixed commitments never move; nothing is planned after its deadline unless it was already overdue or you accepted a late plan; too much work is stated plainly; rejecting a proposal changes nothing; time passing alone never completes a task or adds progress; completion needs your tap; the remaining time is the one you entered; warnings explain themselves in words; Adjust schedule arrives with a recommended time, takes another, refuses an impossible one, and after acceptance every screen shows the same plan with no stale warning; finishing early moves nothing until you accept the suggestion, every early finish asks again, and declining it sticks; simulated features are labelled.

**Fail:** any of those is violated.

---

### Test 5 — Test log, corrections and retesting

**Objective:** results, defects, fixes and retests can be traced.

**Procedure:**

1. Finish Tests 1 to 4.
2. For each, write the expected and the actual result in the test log (§7).
3. Mark each `PASS`, `FAIL` or `BLOCKED`.
4. For every failure, add a row to the correction log (§8) with the steps to reproduce it and what you saw.
5. Describe the correction that is needed.
6. When a correction is made, record what was changed and in which files.
7. Run the failed test again. Record `RETEST PASS` or `RETEST FAIL`.
8. After any code change, run `node tests/run-tests.js` and record the count.
9. Update `errors.md` when a defect is confirmed, fixed, or still open.

**Expected result:** every test has a recorded result; every failure can be reproduced from its description; no fix is called successful before its retest; blocked tests stay blocked until their precondition is met; known limits (for example "no real notifications") are kept apart from defects.

**Pass:** the log is complete and every claimed fix has a recorded retest.

**Fail:** a result was assumed, a failure was left out, or a fix was reported as working without a retest.

---

## 4. Statuses

| Status | Meaning |
|---|---|
| `NOT RUN` | The test has not been performed. |
| `PASS` | The expected behaviour was seen. |
| `FAIL` | The actual behaviour did not match. |
| `BLOCKED` | The test could not be completed because something it needs was unavailable. |
| `RETEST PASS` | A scenario that failed now passes after a correction. |
| `RETEST FAIL` | The problem is still there after a correction. |

## 4a. Compatibility checks (all untested)

These need a real device or setting. None has been run by anyone yet. Record each in the test log under T5 when you do it.

| Check | How | Status |
|---|---|---|
| iOS Safari | Open the app on an iPhone. Edit a task's deadline and start time; open Adjust schedule; open Test notifications. | UNTESTED |
| A real Android or iOS phone | Run the main route in `user_flow.md` on the phone. | UNTESTED |
| Screen reader | With VoiceOver or TalkBack on, answer a check-in and accept an Adjust schedule proposal. | UNTESTED |
| Installed PWA | Install from Chrome over HTTPS or localhost; open it from the home screen; check the icon. | UNTESTED |
| Offline | Load once online, switch off the network, reload, and check the plan and the typeface. | UNTESTED |
| System theme | Profile → Appearance → System; switch the device between light and dark. | UNTESTED |

## 5. Known limits you may meet

No confirmed defect is open in `errors.md` §10. These are limits, not failures; if the app does something else, record it.

| Limit | What you see |
|---|---|
| A weekly commitment past midnight ("every Friday from 10 PM to 2 AM") | SIKAD says to enter it as two and adds nothing. |
| "Change the deadline for X to next week" | Takes that Sunday. Only a new task's "next week" asks which day. |
| Numeric dates such as 5/10 | Read as month/day. |
| Anything listed in `errors.md` §11 | Not yet checked on a real device. |

## 6. Who does what

| The coding agent | The user/developer |
|---|---|
| Wrote these instructions against the current app | Runs the app |
| Defined the preconditions and expected results | Performs the five tests |
| Ran the automated tests and its own browser checks | Records the actual outcomes |
| Did **not** run or pass these manual tests | Reports failures, applies or requests corrections, retests |

## 7. Manual test log

| Test ID | Date | Input or scenario | Expected result | Actual result | Status | Correction or next step | Retest result |
|---|---|---|---|---|---|---|---|
| T1 | | Normal input | | | NOT RUN | | |
| T2 | | Incomplete input | | | NOT RUN | | |
| T3 | | Unexpected input | | | NOT RUN | | |
| T4 | | Challenge-specific safety | | | NOT RUN | | |
| T5 | | Test log and corrections | | | NOT RUN | | |

## 8. Correction log

| Issue ID | Related test | Defect description | Reproduction steps | Correction made | Files changed | Retest result |
|---|---|---|---|---|---|---|
| E-001 | | | | | | |
