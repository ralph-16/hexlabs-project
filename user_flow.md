# SIKAD — Demonstration Guide

A step-by-step script for presenting SIKAD to judges. Follow it in order. Each step says what to do, what you should see, what to say, and what to do if the screen shows something else.

Every result in this guide was checked against the app on 14 Oct 2026. Section 15 says how, and what was not checked.

---

## 1. Purpose and demo overview

**The problem.** Students have classes, deadlines, commutes, jobs and only so many hours. A to-do list does not say whether the work fits, or what to do first.

**The promise.** SIKAD helps a student decide what to do next, fits the work around commitments that cannot move, and changes the plan when something changes.

**The principle.** The student decides. SIKAD shows every change as before → after, asks before it changes the plan, and never moves a class or a shift on its own.

**How this demo stays predictable.** SIKAD's plan depends on the date, the time and everything already in it. So this guide does not use today's date. You set a **Demo clock** to one fixed moment and load one fixed sample student. From there, every step has a known result.

| | |
|---|---|
| Sample student | Alex, a BSIT student with 17 weekly classes and a Saturday job |
| Fixed moment | **Next Monday, 9:05 AM** (the Monday after today) |
| Main route | 12 stops, about 11 minutes. A 7-minute cut is marked in §4. |
| Extra scenarios | 9 short ones in §12. Each starts from a fresh sample week. |

---

## 2. What this demonstration proves

| Claim | Where you show it |
|---|---|
| Messy text becomes tasks, and a missing deadline becomes a question | §4, Stop 2 |
| One clear next action, with the reason | §4, Stop 4 |
| Deadline comes first, difficulty second | §5.1 |
| Dates, times and durations can be edited and stick | §5.2 |
| A change in the student's week moves the right work to the right day, with approval | §6 |
| Finishing early frees time, and SIKAD asks before moving anything into it | §7.1, §12 Scenario 11 |
| A tight day is flagged in plain words, with the reason and a next step | §7.1, §12 |
| Adjust schedule recommends a time, takes another, and reflows the plan | §12, Scenario 10 |
| A block that ends is asked about, never assumed done; unfinished work gets a recommended schedule | §7.2 |
| Questions are answered from the live plan | §8 |
| Widgets, and notifications on a simulated phone with working buttons, shown as previews | §10, §11 |

---

## 3. Before you start: setup and safety checklist

Do this before the judges are watching. It takes two minutes.

### 3.1 Launch

1. In the project folder, run: `python3 -m http.server 8010`
2. In Chrome or Edge, open: `http://localhost:8010/index.html?demo=1`

Why port 8010: the browser keeps SIKAD's data separately for each address. If you use SIKAD yourself on another address (for example port 8000), a demo on 8010 cannot touch that data. **Loading the sample week replaces whatever is saved at the address you are on.**

`?demo=1` shows the **Judge tools** pill at the bottom right. It stays for this browser tab.

### 3.2 Set the Demo clock

1. Tap **Judge tools**.
2. Under **Demo clock**, click the date-and-time box and enter **next Monday, 09:05 AM**.
3. Tap **Set**.

Check: the panel reads **Monday, … · 9:05 AM Shifted**. "Shifted" means the Demo clock is on. "real time" means it is off.

The Demo clock only changes what SIKAD thinks the time is. It does not change your computer's clock, and it lasts for this tab only.

### 3.3 Load the sample week

1. In the same panel, tap **Load Alex's week**. If SIKAD was already set up at this address, the button reads **Reset to Alex's week**; tap it, then **Replace my data**.
2. Tap **Judge tools** again to close the panel.

### 3.4 Check the starting state

Home should read **MONDAY, …** and **Hey, Alex**. The plan should be exactly this:

| Day | Time | Task | Due |
|---|---|---|---|
| Monday | 12:15 PM – 1:15 PM | Algorithm Tracing Worksheet (≈ 1 hr, **overdue**) | last Wednesday, 11:59 PM |
| Monday | 6:15 PM – 7:15 PM | Class Diagram Exercise (1 hr) | Tuesday, 11:59 PM |
| Monday | 7:30 PM – 8:30 PM | Big-O Worksheet (1 hr) | Tuesday, 11:59 PM |
| Tuesday | 6:15 PM – 8:15 PM | ERD and Business Rules (2 hrs) | Wednesday, 11:59 PM |
| Tuesday | 8:30 PM – 10:00 PM | Use Case Diagram (1.5 hrs) | Thursday, 11:59 PM |

Monday's fixed items: Commute 6–7 AM, IT 203 7–10 AM, GE 104 10:30 AM–12 PM, IT 207 2–5 PM, Commute home 5–6 PM.

If any row differs, the Demo clock was not on next Monday 9:05 AM when the week was loaded. Repeat 3.2 and 3.3.

### 3.5 Rules while presenting

| Rule | Why |
|---|---|
| **Do not tap "Use real time."** | It jumps back a week to the real date. The sample deadlines then sit a week ahead and the plan no longer matches this guide. |
| Keep one tab. Do not open the app in a second tab. | The Demo clock belongs to the tab. A new tab runs on real time and rewinds the plan. |
| Type the quoted lines exactly. | Ask SIKAD matches fixed patterns. Different wording gets a clarifying question. |
| Type instead of using the microphone. | Voice needs Chrome or Edge, a network and a quiet room. |
| Finish the main route within about 2½ hours of loading. | The Demo clock keeps running. Results hold until it reaches 12:00 PM; after 1:15 PM the first block has ended and a check-in appears. |

### 3.6 What changes the plan and what does not

| Changes nothing | Changes the plan |
|---|---|
| Asking a question in Ask SIKAD | **Accept changes** on a proposal |
| "What happens if…" previews | **Save & replan** in Task details |
| **See plan changes** (opens a proposal only) | **Done**, **Snooze**, ending a focus session (other tasks stay put; a suggestion may appear) |
| Opening a task, switching tabs, Overview, **Decline** on a suggestion | Moving the Demo clock past a planned block (raises a check-in and puts that block's time on hold) |
| Widget previews; showing or dismissing a notification on the phone | Answering a check-in; **Start focus** on a notification |

### 3.7 The one recovery that always works

Open **Judge tools** → set the Demo clock to next Monday 09:05 AM → **Set** → **Reset to Alex's week** → **Replace my data**. This discards the current demo plan and gives you §3.4 again. It takes about ten seconds.

---

## 4. Main presentation: end-to-end walkthrough

| Stop | What | Section | Time | Changes the plan? |
|---|---|---|---|---|
| 1 | The problem and the promise | 4.1 | 0:30 | No |
| 2 | Setup, from name to first plan *(can be skipped)* | 4.2 | 2:00 | Builds a plan |
| 3 | Switch to Alex's week | 4.3 | 0:30 | Replaces the plan |
| 4 | Home: "what do I do now?" | 4.4 | 1:00 | No |
| 5 | Ask SIKAD: three questions *(can be skipped)* | 8.1 | 1:00 | No |
| 6 | Deadline first, difficulty second | 5.1 | 1:00 | Yes |
| 7 | Edit a task's time, deadline and start | 5.2 | 1:00 | Yes |
| 8 | A shift appears: the plan adapts across days | 6.1 | 1:00 | Yes |
| 9 | Focus Mode, finish a task early, accept the suggestion for the freed time | 7.1 | 1:30 | Yes |
| 10 | Weekly Overview *(can be skipped)* | 9 | 0:45 | No |
| 11 | Widgets | 10 | 0:45 | No |
| 12 | Notifications on a simulated phone, then close | 11, 15 | 1:15 | No |

**Stops 6 to 9 build on each other.** Do all four, in this order, with no other changes in between. Skipping one of them changes the results of the ones after it: for example, without Stop 7 the plan after Stop 9 is different from the one in this guide.

**7-minute cut:** skip Stops 2, 5 and 10. They do not change Alex's plan, so every other result stays the same.

### 4.1 Stop 1 — The problem and the promise

Say:

> "A student's week is classes, a commute, deadlines and maybe a job. A task list tells you what is due. It does not tell you whether it all fits, or what to do right now. SIKAD puts the workload and the available hours together, tells you your next move, and updates the plan when your week changes. And you stay in charge: it asks before it changes anything."

### 4.2 Stop 2 — Setup, from name to first plan

**Starting state:** Demo clock on next Monday 9:05 AM (§3.2). The app shows the welcome screen. If it shows Home instead, skip to Stop 3. (To show setup anyway: **Profile → Reset & restart setup**, confirm, then check the Demo clock still reads Monday 9:05 AM.)

| Screen | Do this | You should see |
|---|---|---|
| Welcome | Type `Sam`. Tap **Get started**. | Step 1 of 4 |
| Step 1 — Set your baseline | Tap **Try a sample schedule**. Wait about three seconds. Tap **Continue**. | "Sample data. Edit anything." and a schedule analysis |
| Step 2 — A few quick questions | Choose **6:00 AM**, **1 hour**, working student **No**, school organization **No**, stop scheduling after **10:00 PM**. Tap **Continue**. | Step 3 of 4 |
| Step 3 — Bring in your due dates | Tap **Continue** without connecting. | Step 4 of 4, Brain dump |
| Step 4 — Brain dump | Type the text below. Tap **Extract tasks**. | "Review before planning", **TASKS I CAUGHT (4)** |

```
Database ERD assignment due in 3 days, about 2 hours. Networking lab report due in 4 days, about 3 hours. Read chapter 5 for GE 104 due in 2 days. I also have a statistics quiz.
```

On the review screen, point at three things:

| You see | It shows |
|---|---|
| **Study for Statistics Quiz** first, with "When is the statistics quiz? I need the date to schedule study time." | SIKAD asks. It does not invent a deadline. |
| **Read Chapter 5** with ≈ and **AI estimate** | No time was given, so SIKAD estimated it and says so. |
| **Database ERD Assignment** (2 hr) and **Networking Lab Report** (3 hr, with suggested steps) | Captured as typed. |

Answer the question: in the quiz card's **Due** field, pick **Wednesday** of the demo week in the date box. The time fills in as 11:59 PM; change it to **09:00 AM**.

Tap **Generate my schedule**. Home opens after a few seconds.

**Expected result:** "Hey, Sam". The next task is **Study for Statistics Quiz**, Today · 12:15 PM – 1:45 PM, with "Why this? Your statistics quiz is Wednesday…". Weekly task progress shows 0% of 7.5 hrs and **Fits**.

**Verify before moving on:**
- Classes show in the timeline with a lock and "Class".
- No task overlaps a class or a commute.
- All four tasks are planned (the quiz got its date from you, not from SIKAD).

**Say:**

> "The class schedule here is sample data: this prototype does not really read a photo, and the platform connections are sample data too. Everything after this is real: I typed my tasks the way I would say them, SIKAD asked me the one thing it could not know, and it built a plan around my classes."

**If it differs:**

| You see | Do this |
|---|---|
| **Continue** is greyed out on Step 2 | A question is unanswered. Answer both the work and the org question. |
| A different date on the quiz card | You picked a different day. Change the date box again. |
| The plan differs from the expected result | The Demo clock was off. Carry on to Stop 3, which resets everything. |

### 4.3 Stop 3 — Switch to Alex's week

**Action:** **Judge tools** → **Reset to Alex's week** → **Replace my data** → close the panel. (If you skipped Stop 2, you already did this in §3.3.)

**Verify:** "Hey, Alex" and the five rows in §3.4.

**Say:**

> "That was day one. Let me switch to Alex, who is a week in, with last week's history and one task that is already late."

### 4.4 Stop 4 — Home: "what do I do now?"

Nothing here changes the plan. Read the screen from the top.

| Part of the screen | What it reads | What to say |
|---|---|---|
| **WHAT TO DO NEXT** | Algorithm Tracing Worksheet · Today · 12:15 PM – 1:15 PM · ≈ 1 hr · **AI estimate** | "One thing. Not a list." |
| **Right now** / **Before that** | Right now: IT 203 until 10 AM. Before that: GE 104 · 10:30 AM – 12:00 PM | "It knows I'm in class, so it doesn't tell me to start now." |
| **Why this?** | "This is past its deadline, so I moved it to the front. You have a 2-hour gap before your 2 PM IT 207 (FTF)." | "It always says why." |
| Warning line | "Algorithm Tracing Worksheet" is past its deadline — I've kept it and moved it to the front of your plan. | "Late work is not hidden or dropped." |
| **Today** | 3 hrs remaining · 0 of 3 tasks completed | "Task time left today, not counting classes." |
| **Weekly task progress** | 0% · 0 min completed of 6.5 hrs planned · **Fits** | "Fits means the week's work is no more than the open time." |
| **Today's timeline** | Classes and commutes, then tasks at 12:15, 6:15 and 7:30 PM, then "Open time" | "Classes are fixed. Tasks go around them, with a 15-minute gap." |

Do **not** tap **Start task**, **Done** or **Snooze** yet. Start task comes at Stop 9. Done and Snooze are in §12.

Next: Stop 5 is §8.1.

---

## 5. Task editing and scheduling verification

### 5.1 Stop 6 — Deadline first, difficulty second

**Goal:** Show that difficulty reorders work only among tasks due the same day, and never jumps ahead of an earlier deadline.

**Starting state:** The plan in §3.4. Class Diagram Exercise (6:15 PM) and Big-O Worksheet (7:30 PM) are both due Tuesday 11:59 PM. ERD and Business Rules is due a day later.

**Part A — a preview. Nothing changes.**

1. Tap the centre **Ask SIKAD** button → **Speak or type**.
2. Type: `What happens if I mark ERD and Business Rules as hard?` and tap **Send**.

**Expected result:** "Preview of that change … No planned session would move. This is only a preview. Nothing was changed."

**Say:**

> "ERD is due Wednesday. Making it harder does not push it ahead of the two tasks due Tuesday. Deadline comes first."

3. Close the panel (the ✕ at the top right).

**Part B — a real change.**

1. Tap **Tasks** in the navigation.
2. Tap **Big-O Worksheet**.
3. Set **Difficulty** to **Hard**.
4. Tap **Save & replan**.

**Expected result:** the toast "Changes saved." with **Undo**. The two tasks swap:

| Task | Before | After |
|---|---|---|
| Big-O Worksheet | Today 7:30 PM | Today 6:15 PM |
| Class Diagram Exercise | Today 6:15 PM | Today 7:30 PM |

**Verify:** on **Tasks**, Big-O Worksheet shows **Next: Today, 6:15 PM** and Class Diagram Exercise shows **Next: Today, 7:30 PM**. On **Home**, the **Plan updated** card lists both moves and "Fixed commitments unchanged."

**Why this matters:** the harder task gets the earlier slot when the student is fresher, but only when the deadlines are level.

**Say:**

> "These two are due at the same time. Now that one is harder, it goes first. Nothing else moved, and the card shows exactly what did."

**If it differs:** if nothing swapped, check that the difficulty really saved (open the task again). If the plan looks unfamiliar, use the recovery in §3.7 and redo this stop.

### 5.2 Stop 7 — Edit a task's time, deadline and start

**Goal:** Show that the time needed, the deadline and a requested start are three separate things, and that edits stick.

**Starting state:** After Stop 6. Use Case Diagram is planned Tuesday 8:30 PM – 10:00 PM, due Thursday 11:59 PM, 1.5 hrs.

**Action:**

1. On **Tasks**, tap **Use Case Diagram**.
2. **Time needed:** set `2` hr `0` min.
3. **Deadline:** pick **Friday** of the demo week, and set the time to **05:00 PM**.
4. **Start at (optional):** pick **Thursday** of the demo week. A time fills in; change it to **07:00 PM**.
5. Tap **Save & replan**.

**Expected result:** "Changes saved." The task card reads **Due: Fri, … 5:00 PM · Est: 2 hrs · Next: Thursday, 7 PM**.

**Verify:** tap **Use Case Diagram** again. The fields read 2 hr 0 min, Friday 05:00 PM, Thursday 07:00 PM, and **Scheduled** lists Thursday 7:00 PM – 9:00 PM. Close the sheet.

**Why this matters:** changing a deadline does not move the work by itself, and asking for a start time does not change the deadline. The student controls each one.

**Say:**

> "Three separate fields: how long it takes, when it's due, and, if I want, when I'd like to do it. I asked for Thursday at seven, and that is where it is."

**Optional, 15 seconds — show a refused value.** Open the task, set **Start at** to a date before the demo Monday, tap **Save & replan**. You see "That time has already passed." followed by the closest time that works. Nothing is saved. Put the date back to Thursday and close the sheet with ✕ (not Save).

**If it differs:**

| You see | Do this |
|---|---|
| "That is outside your day…" | The start time is before 6 AM or the work would end after 10 PM. Use 07:00 PM. |
| "Starting then, … would end after the deadline…" | The deadline is earlier than the start. Set the deadline to Friday first. |
| "The … needs both a date and a time." | One of the two boxes is empty. Fill both. |
| "That time runs into IT … or the 15-minute gap around it." | The start is inside a class, shift or commute, or within 15 minutes of one. The message names it and gives the closest time that works. Use Thursday 07:00 PM. |

---

## 6. Adaptive scheduling and multi-day replanning

### 6.1 Stop 8 — A shift appears: the plan adapts across days

**Goal:** Show a real change in the student's week, a proposal the student approves, and work moving to a different day.

**Starting state:** After Stop 7. ERD and Business Rules is planned **Tomorrow 6:15 PM – 8:15 PM**.

**Action:**

1. Go to **Home**. Tap **Ask SIKAD** → **Speak or type**.
2. Type: `I have a work shift tomorrow from 6 PM to 10 PM.` and tap **Send**.
3. Read the card: **NEW FIXED COMMITMENT**, Tue, … 6:00 PM – 10:00 PM, "One-time".
4. Tap **See plan changes**. This opens a proposal. **Nothing has changed yet.**
5. Read the proposal (below). Then tap **Accept changes**.

**Expected proposal:** "Review the updated plan. This is a proposal. Nothing is saved until you accept it."

| Task | Was | Now |
|---|---|---|
| ERD and Business Rules | Tomorrow 6:15 PM | **Wednesday 5:15 PM** |

It also says "Fixed commitments unchanged." and "Next would be: Algorithm Tracing Worksheet · Today 12:15 PM".

**Expected result after Accept:** the toast "Plan updated." with **Undo**, and a **Plan updated** card on Home with the same move.

**Verify:** in **Today's timeline**, tap **Tomorrow**. The evening shows **Work shift 6:00 PM – 10:00 PM · One-time** and no task after it.

**Why this matters:** Tuesday evening is gone, and ERD is due Wednesday night. SIKAD did not squeeze it into the hour left on Tuesday. It looked across the week and found Wednesday, still before the deadline.

**Say:**

> "My manager just gave me a shift tomorrow night. I say it the way I'd text it. SIKAD shows me what it understood, then what would move, and waits. I accept. My Tuesday task is now on Wednesday, still on time, and my classes did not move."

**If it differs:**

| You see | Do this |
|---|---|
| A clarifying question instead of a card | The wording differed. Tap **Edit text** and retype the line exactly. |
| A different task or day in the proposal | Tap **Reject**. Nothing changes. Then use §3.7 and redo Stops 6 to 8. |
| A sheet titled **A plan that fits** | There is more work than time, which this route should not produce. Tap **Keep my current plan**, then use §3.7. |

### 6.2 What "adaptive" means here

Use this if a judge asks how replanning works.

- Overdue unfinished work takes the earliest real slot. It keeps its real deadline and stays marked overdue.
- Every other task is then placed in order: deadline first, difficulty second.
- A task that loses its slot is placed again: later the same day if it fits, otherwise the next day that has room before its deadline. One change can therefore move work on several days.
- Sessions that are still valid and still in order stay where they are.
- Classes, shifts and commutes never move. Every task keeps its full time and a 15-minute gap.
- If something cannot fit before its deadline, SIKAD says so. It does not shorten the task or change the deadline.

A three-day example is in §12, Scenario 3.

---

## 7. Focus Mode and missed blocks

### 7.1 Stop 9 — Focus Mode, finish a task, see the week update

**Goal:** Show doing the work, reporting the outcome, and the plan and progress updating.

**Starting state:** After Stop 8. Home shows Algorithm Tracing Worksheet as the next task.

**Action:**

1. On **Home**, tap **Dismiss** on the Plan updated card if it is in the way.
2. Tap **Start task**.
3. Read the card: **IN PROGRESS**, **Method: Pomodoro**, "round 1 of 2", a reason, and a timer at about 25:00.
4. Tap **Judge tools** → **Skip session ahead 5 min** → close the panel. The timer drops to about 20:00.
5. Tap **Pause** (the card reads **PAUSED**), then **Resume**.
6. Tap **Stop early**.
7. Asked "Is this piece of work complete?", tap **Yes, it's complete**.

**Expected result:** the title is struck through, then the toast ""Algorithm Tracing Worksheet" is done. There is a suggestion for the time you freed."

The **Plan updated** card says the task is complete and lists only that. **No other task has moved.** Below it, a new card:

> **Use the time you freed?** Big-O Worksheet could move to **Today, 12:15 PM – 1:15 PM**. Planned now: Today, 6:15 PM – 7:15 PM · 1 hr. "You finished "Algorithm Tracing Worksheet" early, so today 12:15 PM – 1:15 PM is open. It is the next task by deadline (due tomorrow, 11:59 PM) that fits there, and it is marked hard. No other task would move. Nothing changes unless you accept." **Accept** · **Decline**

8. Tap **Accept**.

**Expected result:** toast "Plan updated." with **Undo**. The Plan updated card reads "You chose to use the time freed by finishing "Algorithm Tracing Worksheet" early. No other task moved." with one move: Big-O Worksheet, Today 6:15 PM → Today 12:15 PM.

**Verify:**

| Where | Reads |
|---|---|
| WHAT TO DO NEXT | Big-O Worksheet · Today · 12:15 PM – 1:15 PM |
| Today | 2 hrs remaining · 1 of 3 tasks completed. No warning rows. |
| Weekly task progress | **14%** · 1 hr completed of 7 hrs planned · **Fits** |
| Tasks | Big-O Worksheet: Next Today, 12:15 PM · Class Diagram Exercise: Next Today, 7:30 PM · ERD and Business Rules: Next Wednesday, 5:15 PM |

**Why this matters:** finishing early frees time, and SIKAD spots the best use for it. But moving another task is an improvement, not a necessity, so it asks first. Only the task it named moves, and only when you say so.

**Say:**

> "I start the task, and SIKAD suggests a way to work and says why. I'm skipping the timer ahead with a presenter tool. A finished timer never marks a task done; I say how it went. I finished early, so SIKAD suggests using the free hour at noon for the next task by deadline. It does not just move it: it asks. I accept, and only that one task moves. If I had declined, my plan would have stayed exactly as it was."

**If it differs:**

| You see | Do this |
|---|---|
| The dimmed screen hides something | Tap the dimmed area or **Show my plan**. The timer keeps running. |
| You tapped **Partly done** by mistake | Tap **Back**, then **Yes, it's complete**. |
| No **Use the time you freed?** card | The Demo clock passed 12:15 PM, or the earlier stops were done differently. Show the feature with §12, Scenario 11 instead. |
| You tapped **Decline** | Nothing moved. Carry on: Stops 10 to 12 then show Big-O Worksheet at 6:15 PM instead of 12:15 PM. |

Next: Stop 10 is §9.

### 7.2 A missed block: the check-in and the recommended schedule (separate scenario)

> **Run this from a fresh sample week (§3.7).** Do it after the main route, or on its own. Do not run it on your own data.

**What it shows.** SIKAD never marks work done because time passed. When a planned block ends without a report, it asks. Until the student answers, that block's time is on hold: nothing is credited and nothing is moved.

**Starting state:** §3.4. The block to watch is **Algorithm Tracing Worksheet, Monday 12:15 PM – 1:15 PM**. The Demo clock reads 9:05 AM, so the block has not happened yet.

**Step 1 — move time past the block.**

1. **Judge tools** → set the Demo clock to the same Monday, **01:30 PM** → **Set** → close the panel.

**Expected result:** on Home, a card: **"Your scheduled time for Algorithm Tracing Worksheet has ended. How did it go?"** It says "It was planned for today, 12:15 PM – 1:15 PM · 1 hr." and "Nothing is marked done until you say so. This block's time is on hold, not moved." Three buttons: **Completed**, **Partly done**, **Not finished**.

**Verify:** the next task is Class Diagram Exercise, Today 6:15 PM, where it already was. Weekly task progress still reads **0%** of 6.5 hrs. Nothing was credited.

**Step 2 — show it asks once.**

2. **Judge tools** → **+15 min**. Then reload the page.

**Verify:** still one card, still 0%. In **Overview**, today's timeline shows the block as "Ended · waiting for your answer".

**Step 3 — choose one answer.**

| Answer | Do this | You should see |
|---|---|---|
| **A. Not finished** *(best for the demo)* | Tap **Not finished**. | A sheet, **Recommended schedule**: "This is a proposal. Nothing is saved until you accept it." It reads: "Algorithm Tracing Worksheet" still needs 1 hr. It was planned today, 12:15 PM – 1:15 PM. The recommended time is today at 6:15 PM. It is past its deadline, so it goes ahead of work that can still be on time. 2 other tasks move to make room. **What would change:** Class Diagram Exercise 6:15 PM → 7:30 PM; Big-O Worksheet 7:30 PM → 8:45 PM; Algorithm Tracing Worksheet 12:15 PM → 6:15 PM. |
| **B. Partly done** | Tap **Partly done**. Enter `0` hr `30` min. Tap **See recommended schedule**. | The same sheet, for 30 minutes: Algorithm Tracing Worksheet at 6:15 PM, Class Diagram Exercise 6:15 PM → 7 PM, Big-O Worksheet 7:30 PM → 8:15 PM. |
| **C. Completed** | Tap **Completed**. | Toast "Logged as done. Plan adjusted." with **Undo**. Weekly task progress reads 15%. The other tasks stay where they were. |

For A and B, the plan has **not** changed yet. Then:

- **Accept changes** applies it. The toast "Plan updated." has **Undo**, and the card is gone. For A, nothing is credited; for B, 30 minutes are.
- **Keep current plan** changes nothing: "No changes were made. Your plan is as it was." The question stays on Home.

**Step 4 (optional) — rewind.** Instead of answering: **Judge tools** → set the Demo clock back to Monday **09:05 AM** → **Set**. The card is gone and the plan is exactly §3.4 again, because that block has not been missed after all.

**Say:**

> "If I don't open the app, time still passes. SIKAD does not pretend I did the work. It asks me. I say I didn't finish, and it shows me a recommended schedule before changing anything: the late task goes first tonight, the two after it shift, and my classes stay put. I accept, or I keep my plan. It is my call."

**If it differs:** if no card appears, the Demo clock is not past 1:15 PM on the demo Monday; check the panel. If more than one card appears, the clock went further than intended; do Step 4, or §3.7.

**After this scenario, reload the sample week (§3.7) before anything else.**

---

## 8. Ask SIKAD

Ask SIKAD follows fixed JavaScript rules over the current plan. **No AI model is connected.** The panel says so itself: "Answers are worked out from your current plan using fixed rules." Say this out loud; do not present it as a chatbot.

### 8.1 Stop 5 — Three questions (nothing changes)

**Starting state:** §3.4, straight after Stop 4.

Tap **Ask SIKAD** (centre button) → **Speak or type**. Type each line and tap **Send**.

| Type | The answer |
|---|---|
| `What should I work on next?` | **Algorithm Tracing Worksheet** — "This is past its deadline, so I moved it to the front." When: Today, 12:15 PM – 1:15 PM. |
| `How much usable time do I have tomorrow?` | "Tomorrow … you have 4 hr 15 min of usable time. 3.5 hrs of that is already planned for tasks, which leaves about 45 min open." It lists the four fixed classes. |
| `Show me the tasks due tomorrow` | "2 tasks due …": Class Diagram Exercise and Big-O Worksheet, each with its time left and planned slot. |

Close the panel with ✕.

**Say:**

> "These answers come from the same plan the Home screen uses. 'Usable time' means what is left of my day after classes, the commute and the gaps around them. It is not the length of the day."

**If it differs:** a clarifying question means the wording was off; retype it. Different numbers mean the plan is not §3.4; use §3.7.

### 8.2 More verified lines

Use these when a judge wants more. The answers shown are for the clean sample week (§3.4).

| Type | Kind | What happens |
|---|---|---|
| `Why is this my highest priority?` | Answer | "Algorithm Tracing Worksheet" ranks first of your 5 scheduled tasks. It is past its deadline and has 1 hr of work left. |
| `Can I realistically finish everything before Friday?` | Answer | "Yes, as currently planned": 5 tasks need 6.5 hrs; about 28 hrs of usable time before then. |
| `When is Big-O Worksheet?` | Answer | Its deadline and its planned slot. |
| `What happens if I move Big-O Worksheet to tomorrow?` | Preview | Lists the two sessions that would swap, and ends "Nothing was changed." |
| `Move Big-O Worksheet to tomorrow` | Change | A **RESCHEDULE TASK** card → **See plan changes** → a proposal. **Reject** gives "No changes were made. Your plan is as it was." |
| `I have a quiz for GE 103` | Missing detail | "When is the quiz? I need the date to schedule study time." SIKAD does not guess. Close with ✕. |
| `Move the worksheet to Friday` | Unclear | "I couldn't find a task called "worksheet", so nothing was changed and no new task was added." It lists the open tasks. Tap **Done**. |

**Preview, proposal, accept.** A "what happens if" line only previews. A plain instruction opens a review card, then a proposal. The plan changes only on **Accept changes**. **Reject** and ✕ change nothing.

**Lines that now get a question instead of a guess** (use them if a judge asks how SIKAD handles unclear input; each was checked):

| Type | What happens |
|---|---|
| `Lab report due next week, about 2 hours` | ""next week" is not a single day. Do you mean by Friday (…) or by Sunday (…)?" with two buttons. No deadline until you choose. |
| `Paper due last Friday, about 1 hour` | ""last friday" has already passed. Is it overdue (…), or do you mean this coming Friday (…)?" |
| `Change the deadline for Big-O Worksheet to February 31` | ""february 31" is not a real date. Which date do you mean? The deadline for "Big-O Worksheet" was not changed." |
| `Move Big-O Worksheet and Class Diagram Exercise to Friday` | "One task at a time. Your message names … Nothing was changed." |
| `I have a work shift tomorrow from 10 PM to 2 AM` | A fixed commitment **10:00 PM – 2:00 AM**. After accepting, Tuesday shows 10 PM to midnight and Wednesday shows midnight to 2 AM. |

Close each with ✕ or **Done** unless you mean to keep it.

---

## 9. Weekly Overview (Stop 10)

Nothing here changes the plan.

**Starting state:** After Stop 9.

1. Tap **Overview**.

| Part | Reads | Meaning |
|---|---|---|
| Header | The demo week, Monday to Sunday · **This week** | |
| **Your time budget** | about **49 hrs** | Usable time for tasks from now to Sunday night, after classes, commutes and the job. Not the length of the week. |
| **Tasks remaining** | **4 of 5** · "1 task completed this week." | |
| **Time needed** | **6 hrs** | Estimated time left on unfinished tasks. |
| Day cards | **Today 2h**, **Wed 2h**, **Thu 2h**, the rest "—" | Task time planned each day. A full bar means that day's open time is all planned. |

2. Tap **Tue**. The timeline shows **Work shift 6:00 PM – 10:00 PM · One-time**, the shift you added.
3. Tap the **Previous week** arrow. You see **Last week**, **Done vs. planned 88%**, "Done 7 hrs of 8 hrs planned · 1 missed · 0 moved". The one missed block belongs to the task that was overdue this morning.
4. Tap **This week** to return.

**Say:**

> "Six hours of work against forty-nine usable hours. That is why the week says it fits even though tonight is tight. And last week is kept as it happened: seven of eight hours done, one block missed, which is the late task we started with."

**If it differs:** small differences in the time budget are normal if the Demo clock has passed 12:00 PM. If the week shown is not the demo week, tap **This week**.

---

## 10. Widget demonstration (Stop 11)

**These are previews inside SIKAD.** Nothing is installed on a phone's home screen. Say so. The content is provisional and can be replaced.

Nothing here changes the plan.

1. Tap **Profile**. Scroll to the **Widgets** card, just above **Reset**.
2. Tap **Test widgets**. The page is titled **Widget previews** and carries the note "Previews inside SIKAD. Nothing is installed on your phone, and your plan is not changed."
3. For each widget, tap **Small**, **Medium**, **Large**. The frame changes size and its content changes with it.

After Stop 9, the three widgets read:

| Widget | Small | Medium | Large |
|---|---|---|---|
| **Next move** | Big-O Worksheet · Today · 12:15 PM | adds the end time, duration, IT 205 and "Due Tomorrow, 11:59 PM" | adds **After that**: the next three sessions |
| **Today** | 2 hrs left today · 1 of 3 tasks done | adds the next two items of the day | adds up to six items, classes marked **Fixed** |
| **This week** | 14% of the week done | adds "1 hr done of 7 hrs planned", **Fits**, and a bar for each day | adds **Coming up**: the next three deadlines |

4. Tap **Restore default sizes**. The defaults are Next move Medium, Today Small, This week Large.
5. Tap **‹ Profile** at the top to go back.

**Say:**

> "This is what SIKAD could put on a home screen: the next move, today at a glance, and the week. Each has three sizes, and each size shows what fits. To be clear, these are previews inside the app. A real home-screen widget needs a native app, which this prototype is not."

**If it differs:** if a widget says "sample content", the plan has nothing to show; reload the sample week. If **Test widgets** is missing, you are on an older copy of the app; skip this stop and say the previews are in the current build.

---

## 11. Notification demonstration (Stop 12)

**This is a simulator.** The phone is drawn inside the page. No push notification or system notification is sent, and the browser is not asked for permission. Say so. The wording is provisional.

Showing and dismissing a notification never changes the plan. You can show each one as many times as you like.

1. On **Profile**, tap **Test notifications** (the card above **Reset**). The page is titled **Notification previews**. It shows a phone with the Demo clock's time and date, and "No notifications".
2. For each of the five kinds, tap **Show on phone**. (The phone and the list stay the same size and in the same place whatever you show.) The notification appears on the phone's lock screen with its own icon, colour and two buttons. Tap the ✕ on it (or press Escape) to dismiss it.

After Stop 9, they read:

| Kind | When it would fire | On the phone | Buttons |
|---|---|---|---|
| **Time to start** | 10 minutes before a planned block begins | Up next: Big-O Worksheet | Start focus · View task |
| **Deadline coming up** | A task is due within a day and still has work left | Class Diagram Exercise is due tomorrow, 11:59 PM | View task · Adjust schedule (opens the recommended-time sheet) |
| **At risk today** *(Sample)* | A task planned today may not get finished today | Big-O Worksheet is at risk today | Review task · Adjust schedule |
| **Plan updated** *(Sample)* | SIKAD moved a block after something changed | Plan updated: Subnetting Drill moved | Review schedule · View changes |
| **Not enough time** *(Sample)* | Some work no longer fits before its deadline | Not enough time for Reflection Paper | Review options · View affected tasks |

A kind marked **Sample** uses example text, because the current plan has nothing that fits it. Here the last three are samples: no task is at risk today, nothing is short of time, and the **Plan updated** card on Home clears itself about 12 seconds after a change, so by now there is no recent change to report. (Right after a change, this kind shows the real move instead.)

3. **Try three buttons.** Each leads to a real part of the app. Do them in this order:

| Show | Tap | You should see | Come back with |
|---|---|---|---|
| **Deadline coming up** | **View task** | **Task details** for Class Diagram Exercise opens over the page. | ✕ on the sheet (do not save) |
| **Plan updated** *(Sample)* | **Review schedule** | **Home**, scrolled to **Today's timeline**: Alex's real schedule. This button only opens a screen, so it works on a sample too. A bar at the top reads **‹ Notification previews**. | Tap **‹ Notification previews** |
| **Not enough time** *(Sample)* | **Review options** | Nothing opens. The notification says "This is sample content: your plan has nothing for this button to open right now." | Already there |

4. Tap **‹ Profile** to go back.

**Do not tap Start focus on the main route.** It starts a real focus session on Big-O Worksheet, exactly as **Start task** does. If you want to show it, end the session afterwards with **Stop early** → **Not yet** (nothing is credited), then tap **‹ Notification previews**.

**Verify (optional):** go to **Home**. The next task, Today and Weekly task progress are exactly as they were after Stop 9.

**Say:**

> "Here is how SIKAD's reminders could look on a phone. Five kinds, each tied to something SIKAD already knows. Two of these are filled in from Alex's real plan right now, and three are marked as samples. A notification alone is not always enough, so each has buttons: this one opens the task, this one takes me to the schedule. On a sample, a button that needs a real task does nothing and says so. To be clear, this phone is a drawing inside the app. Sending these to a real phone while the app is closed needs a push service and a server, which this prototype does not have."

**If it differs:**

| You see | Do this |
|---|---|
| A different task in a notification | The plan is not as it was after Stop 9. The page still works; read what it shows. |
| A different set of kinds marked **Sample** | It depends on the plan at that moment: on a fresh week At risk today is a sample too, and within 12 seconds of a change Plan updated is real. The page works the same either way; a button that cannot act explains itself. |
| The **‹ Notification previews** bar is gone | You tapped a tab. Go to **Profile → Test notifications** again. |

Then close with §15.

---

## 12. Optional judge scenarios

**Each scenario starts from a fresh sample week.** Do §3.7 first, every time, unless the row says otherwise (Scenario 10 continues from Scenario 3). Never assume the plan is as the previous scenario left it.

| # | Shows | Starts from |
|---|---|---|
| 1 | A missed block: the check-in, a recommended schedule, rewind | Fresh week (§7.2) |
| 2 | **At risk** on a tight evening | Fresh week |
| 3 | Work shifting across three days; **Won't fit today** | Fresh week |
| 4 | Not enough time, and **A plan that fits** | Fresh week |
| 5 | A clash with a class: the student decides | Fresh week |
| 6 | A task that depends on another | Fresh week |
| 7 | Snooze and Undo | Fresh week |
| 8 | Partly done in Focus Mode | Fresh week |
| 9 | A proposal rejected; a missing deadline; an unclear command | Any state (§8.2) |
| 10 | **Adjust schedule**: a recommended time, another time, a refused time | The end of Scenario 3 |
| 11 | Finishing early again and again: a new suggestion each time, tomorrow-to-today, Decline, and repairs that do not wait | Fresh week |

### Scenario 2 — At risk on a tight evening

1. **Judge tools** → set the Demo clock to the same Monday, **08:30 PM** → **Set** → close.

**Expected:** three check-in cards appear at the top of Home, one for each block that ended (leave them unanswered; nothing is marked done). Use Case Diagram is pulled forward to tonight, 8:30 PM – 10:00 PM. The **Today** card reads **Use Case Diagram — At risk today**, in the stronger warning colour: "This task may not fit today. You have about 1.5 hrs of usable time left today for about 1.5 hrs of work, which leaves little room to spare." (the time left drops as the Demo clock runs).

**Say:** "The stronger colour, because there is barely enough time left tonight for the task. It says so in words and offers Adjust schedule. Comfortable tasks show nothing at all."

The four states to point out, across Scenarios 2, 3 and 4: a comfortable task shows nothing; **At risk today**; **Won't fit today** (it has a later slot); and **Not enough time** (no slot before the deadline). A rule-based score decides when to warn, but it is never shown.

### Scenario 3 — Work shifting across three days

1. **Ask SIKAD** → **Speak or type** → `I have to work tonight from 6:30 PM to 10:30 PM` → **Send** → **See plan changes**.

**Expected proposal:**

| Task | Was | Now |
|---|---|---|
| Class Diagram Exercise | Today 6:15 PM | Tomorrow 6:15 PM |
| Big-O Worksheet | Today 7:30 PM | Tomorrow 7:30 PM |
| Use Case Diagram | Tomorrow 8:30 PM | Wednesday 11:15 AM |
| ERD and Business Rules | Tomorrow 6:15 PM | Wednesday 5:15 PM |

2. Tap **Accept changes**.

**Verify:** the **Today** card shows **Class Diagram Exercise — Won't fit today** and **Big-O Worksheet — Won't fit today**, each with "This task won't fit today, but it has a later slot." and "It is planned for Tue, … which is still before its deadline." It also shows Algorithm Tracing Worksheet **At risk today**: "You have about 1.5 hrs of usable time left today for about 1 hr of work, which leaves little room to spare. Its time is an estimate."

**Say:** "Tonight is gone. The two tasks due tomorrow take tomorrow evening, so tomorrow's tasks move to Wednesday. One change, three days, and every task is still before its deadline. 'Won't fit today' is not a failure: it has a later slot."

### Scenario 4 — Not enough time, and a plan that fits

1. **Ask SIKAD** → **Speak or type**, then type:

```
New assignment: capstone chapter due tomorrow at 8 AM, about 5 hours. New assignment: network lab due tomorrow at 8 AM, about 4 hours.
```

2. **Send** → **See plan changes**.

**Expected:** a sheet titled **A plan that fits**: "You have more work than time before some deadlines. SIKAD adjusted the plan so all of it has a place. Nothing changes unless you accept." It names **one** task that would finish after its deadline (Assignment Capstone Chapter, about 2 days late) and says "Nothing was shortened, no deadline was edited and no fixed commitment moved."

3. Tap **Keep my current plan**. The plan is §3.4 again and the two assignments are not added.

**Say:** "Nine hours of new work due at 8 AM cannot fit. SIKAD does not pretend. It offers the least bad plan, says which task would be late and by how much, and leaves the choice to me."

Do not tap **Accept changes** unless you want to show the **Late** chip; afterwards, reload the week.

### Scenario 5 — A clash with a class

1. **Ask SIKAD** → **Speak or type** → `I have a group study session today from 3 PM to 5 PM` → **Send**.

**Expected:** **Decision needed** — "You already have IT 207 (2:00 PM – 5:00 PM). Group Study Session overlaps it. Which one takes priority?" with **Keep IT 207**, **Go to Group Study Session instead**, **Keep both (I'll sort it out)**. **See plan changes** is disabled, with "Choose how to handle the conflict first."

2. Tap **Keep IT 207** → **See plan changes**. The proposal says "Kept IT 207; didn't add Group Study Session." Tap **Reject** or **Accept changes**; the plan is the same either way.

**Say:** "SIKAD never skips a class on its own. It only does that if I choose it here."

### Scenario 6 — A task that depends on another

1. **Ask SIKAD** → **Speak or type** → `Group project slides for GE 104 due Saturday, about 2 hours, after the ERD and business rules` → **Send**.

**Expected:** a task card with "Starts after: ERD and Business Rules is finished."

2. **See plan changes** → the proposal adds **Group Project Slides, Wednesday 5:15 PM** → **Accept changes**.

**Verify:** ERD and Business Rules is still Tuesday 6:15 PM – 8:15 PM, and the slides come after it.

### Scenario 7 — Snooze and Undo

1. On **Home**, tap **Snooze**.

**Expected:** toast: Moved "Algorithm Tracing Worksheet" to Today 6:15 PM. Class Diagram Exercise moves up to Today 12:15 PM.

2. Tap **Undo** on the toast (it stays about five seconds). The plan is §3.4 again.

Undo goes back one change only, and is gone after a page reload.

### Scenario 8 — Partly done in Focus Mode

1. **Home** → **Start task** → **Stop early** → **Partly done**.
2. In **Time still needed**, enter `0` hr `30` min → **Save and replan**.

**Expected:** toast "Progress saved. 30 min is back in your plan." The task now reads Today · 12:15 PM – 12:45 PM · ≈ 30 min. The other tasks do not move. **Today** reads 2.5 hrs remaining.

---

### Scenario 10 — Adjust schedule: a recommended time, or your own

> **Starts from the end of Scenario 3** (a work shift tonight). The **Today** card shows Algorithm Tracing Worksheet **At risk today**.

1. On that row, tap **Adjust schedule**.

**Expected:** a sheet titled **Adjust schedule**: the task, **Time still needed: 1 hr**, **Planned now: Today, 12:15 PM – 1:15 PM**, and **Recommended: keep Today, 12:15 PM** with "12:15 PM is already today's earliest open time for it, and overdue work goes first. Moving it later would only delay it." The **Start at** fields hold today, 12:15 PM. **What would change**: nothing. **Accept changes** is greyed out.

2. **Choose another time.** Set **Start at** to **Thursday** of the demo week, **07:00 PM**.

**Expected:** the plan is worked out again: "3 other tasks move to make room, across 2 days", each shown was → now, and a warning that Class Diagram Exercise would then be at risk today. Nothing is saved.

3. **Try a time that cannot work.** Set **Start at** to **Monday** of the demo week, **03:00 PM**.

**Expected:** "That time can't be used", naming IT 207, with a button for the closest time that works. **Accept changes** is greyed out.

4. Tap **Keep current plan**. Nothing changed.

**Say:**

> "SIKAD compares whole plans before it recommends anything. This task is overdue and already in today's first free hour, so the honest recommendation is to keep it there. I can still pick my own time and see exactly what that would do to everything else, including which task would become tight, before I decide."

**If it differs:** a different recommendation means the plan is not Scenario 3's; do §3.7 and repeat Scenario 3.

### Scenario 11 — Finishing early, again and again: every finish asks

> **Fresh week (§3.7).** The Demo clock reads Monday 9:05 AM.

**Part A — three early finishes in a row, each accepted.**

| # | Do this | You should see |
|---|---|---|
| 1 | On **Home**, tap **Done** on the **WHAT TO DO NEXT** card (Algorithm Tracing Worksheet, 12:15 PM). | Toast "… is done. There is a suggestion for the time you freed." No other task has moved. Card: **Class Diagram Exercise could move to Today, 12:15 PM – 1:15 PM** (planned now Today 6:15 PM). |
| 2 | Tap **Accept**. | Only Class Diagram Exercise moves, to 12:15 PM. |
| 3 | Tap **Done** again (now Class Diagram Exercise, 12:15 PM). | A **new** card: **Big-O Worksheet could move to Today, 12:15 PM – 1:15 PM**. Check the timeline: Big-O Worksheet is still at 7:30 PM. The earlier Accept did not approve this. |
| 4 | Tap **Accept**, then **Done** a third time (Big-O Worksheet). | A new card: **Use Case Diagram could move to Today, 12:15 PM – 1:45 PM**, planned now **Tomorrow 8:30 PM**. A task from tomorrow is suggested for today, and it is still tomorrow. |
| 5 | **Judge tools** → **+15 min** twice, then reload the page. | Nothing has moved. The card is still there, unanswered. |
| 6 | Tap **Accept**. | Use Case Diagram is today at 12:15 PM. ERD and Business Rules is still tomorrow at 6:15 PM. |
| 7 | **+15 min** again and reload. | Still exactly the same: nothing is pulled forward later by itself. |

**Part B — decline, and repairs that do not wait.**

1. Make a clean state (§3.7). Tap **Done**, then **Decline** on the card.
   **Expected:** "Kept as it was. "Class Diagram Exercise" stays where it is planned." The plan is unchanged.
2. Reload, then **Judge tools** → **+15 min**.
   **Expected:** the card does not come back; the plan is unchanged.
3. Tap **Done** on the next task (Class Diagram Exercise, 6:15 PM): a separate finish.
   **Expected:** its own card: **Big-O Worksheet could move to Today, 6:15 PM – 7:15 PM**. Nothing has moved.
4. Make a clean state. Tap **Done**, leave the card, and add `I have a work shift tomorrow from 6 PM to 10 PM.` through Ask SIKAD → **See plan changes**.
   **Expected:** the task the shift displaces (ERD and Business Rules) is moved at once, into today's freed time if that is what it takes; after **Accept changes** the card is gone because that time is used.

**Say:** "Finishing early is good news, and SIKAD suggests a use for the time, every time. A yes covers that one move only; the next early finish asks again, even when the best candidate is tomorrow's work. If I say no, nothing moves and it does not nag me. Repairs that keep my plan valid still happen on their own."

---

## 13. Recovery and troubleshooting

**First choice, always:** §3.7. It discards the current demo plan and takes about ten seconds.

| Situation | What to do |
|---|---|
| The starting plan is not §3.4 | Open **Judge tools**. If it does not read "Monday … 9:05 AM Shifted" (give or take the minutes that have passed), do §3.7. |
| The wrong task is the next action | Open **Tasks** and read each task's Due and Next lines against the last stop's expected result. If they do not match, do §3.7 and redo from Stop 6. |
| A proposal lists something unexpected | Tap **Reject**. Nothing is saved until **Accept changes**. |
| A sheet titled **A plan that fits** opens by itself | A change left more work than time. Tap **Keep my current plan**. If you are on the main route, do §3.7. |
| **Not enough time** card on Home | Tap **Review options** or **See a plan that fits** to show the feature, then do §3.7 before continuing the route. |
| A change moved several days and you lost track | Do §3.7. Do not carry on with a plan you cannot describe. |
| A check-in card ("Your scheduled time for … has ended") appears when you did not expect it | The Demo clock passed a planned block. Nothing was marked done. Set the Demo clock back to Monday 09:05 AM and the card goes away. If unsure, §3.7. |
| You tapped **Use real time** | Set the Demo clock again and do §3.7. |
| The page was reloaded or the tab closed | Reload keeps the plan and the Demo clock. A new tab loses the Demo clock: reopen with `?demo=1` and do §3.7. |
| **Undo** is not on the toast | Undo covers one change and disappears after a reload or a new check-in. Use §3.7. |
| "Couldn't update your plan" | The plan was not changed. Tap **Dismiss** and try once more; if it repeats, do §3.7 and skip that step. |
| Ask SIKAD asks a clarifying question | The wording differed. Tap **Edit text** and retype the line from this guide. |
| The microphone does nothing or mishears | Type instead. Voice depends on the browser, the network and the room. |
| Setup shows a schedule that is not "yours", or imported items look generic | That is the sample data. Say so: file reading and platform connections are simulated. |
| **Test widgets** or **Test notifications** is missing | You are on an older copy. Skip the stop; do not improvise a substitute. |
| The Judge tools pill is missing | Add `?demo=1` to the address and reload. |

**What Undo and rewind really do**

| Action | Undoes |
|---|---|
| **Undo** on a toast | The last single change. Not available after a reload. |
| **Reject** / **Keep my current plan** / **Keep current plan** on Adjust schedule / **Decline** on a suggestion | Nothing was applied, so nothing to undo. |
| **Undo** after accepting a suggestion | The move only. The task you finished stays done, and the suggestion card comes back. |
| **Keep current plan** on a Recommended schedule | Nothing was applied. The check-in stays on Home. |
| Demo clock moved back | Withdraws check-ins for blocks that are ahead again. Changes no task, credit or edit. |
| **Reset to Alex's week** | Everything. Replaces all data at this address. |

---

## 14. Final presentation checklist

Before the judges arrive:

- [ ] Server running on port 8010; app open with `?demo=1` in Chrome or Edge, one tab.
- [ ] Demo clock reads **Monday … 9:05 AM Shifted**.
- [ ] Sample week loaded; Home matches §3.4.
- [ ] Judge tools panel closed.
- [ ] This guide open beside the app, at §4.
- [ ] You have decided: full route or the 7-minute cut (no Stops 2, 5, 10).
- [ ] If doing Stop 2: the app must be on the welcome screen. If it is not, **Profile → Reset & restart setup**, confirm, and check the Demo clock.
- [ ] The typed lines are ready to paste (Stops 2, 5, 6, 8).
- [ ] You have run the whole route once today.

After the main route, before any extra scenario:

- [ ] Do §3.7.

---

## 15. Verified capabilities and limitations

### Closing words

> "Everything you saw is one plan in the browser: the workload on one side, the usable hours on the other. SIKAD tells the student the next move, says why, and re-plans when the week changes, and the student approves every change. It is a prototype, and I want to be exact about what is real."

### What is real, simulated, and missing

| | |
|---|---|
| **Works in the app** | Typed tasks → review → plan. Ordering by deadline then difficulty. Replanning across days. Proposals with Accept and Reject. Done, Snooze, Undo. Focus Mode. Check-ins for blocks that ended (Completed, Partly done, Not finished) with a recommended schedule. At-risk estimates. Weekly progress and past weeks. Editing dates, times and durations. Saving between visits. |
| **Rules, not AI** | Understanding text, answering questions, "Why this?", working-method suggestions and the at-risk status are fixed JavaScript rules. No AI model is connected. |
| **Simulated with sample data** | Reading a schedule photo or PDF. Calendar and class-platform connections. |
| **In-app previews only** | Widgets, and notifications on a phone drawn in the page. Notification buttons open real parts of the app. No home-screen widget, no push or system notification. |
| **Depends on the browser** | Voice (Chrome or Edge, online). Installing to a home screen and offline use (HTTPS or localhost). |
| **Not built** | Accounts, sync, backup, a server, a connected AI model, real notification delivery. |
| **Privacy** | All data stays in this browser on this device. Nothing is sent anywhere. Clearing browser data or using another browser starts fresh. |

### Limits worth knowing before a judge finds them

- SIKAD cannot know whether work was done, so it asks. An unanswered check-in keeps that block's time on hold: it is not planned anywhere until the student answers.
- A weekly commitment that runs past midnight has to be entered as two. A one-time one is kept whole.
- "Change the deadline for X to next week" takes that Sunday; only a new task's "this week" or "next week" asks which day.
- Planning looks three weeks ahead.
- Undo is one level and does not survive a reload.

No confirmed defect is open: the eleven recorded in `errors.md` §10 are fixed. Items that still need a real device are in `errors.md` §11.

### How this guide was checked

- **Logic tests:** `node tests/run-tests.js` — 130 passed, 0 failed (14 Oct 2026).
- **Browser:** headless Chromium at 390 px, Demo clock on Monday 19 Oct 2026, 9:05 AM. Checked by driving the real screens and reading the result after every step:
  - Stop 2 (setup) through to the first plan.
  - Stops 3 to 12 in order, as one continuous run, including every expected value in §5, §6.1, §7.1, §9, §10 and §11.
  - §7.2 (forward, +15 min, reload, all three answers, Accept, Keep current plan, Undo, and the rewind).
  - §11: every notification on the phone, and every button, on real and on sample content, with the return bar and the browser's Back button.
  - Scenarios 2 to 8, 10 and 11 in §12.
  - The lines in §8.1 and the last three rows of §8.2.
- **Other Mondays:** the starting plan in §3.4 was computed for four different Mondays and was identical each time.
- **The full route was replayed from this guide** after its latest revision, at a presenter's pace: 270 on-screen checks, all matching, no console errors. The 7-minute cut was not replayed as a whole; it only leaves out stops that do not change the plan, and the run without Stop 2 matched through Stop 8.
- **Why Stops 6 to 9 must not be skipped singly:** a run without Stop 7 gave a different plan at Stop 9 (ERD and Business Rules split across today and Wednesday).
- **Checked by the logic only, not in the browser:** the first four rows of §8.2, and that moving the clock back leaves manual completions and later edits alone.
- **Not checked:** a real phone, iOS Safari, voice input, a screen reader, an installed app, offline use, and the three messages in the "If it differs" table of §5.2.
