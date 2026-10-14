# SIKAD — Errors and Problem States

This lists what can go wrong while a student uses SIKAD, in the order of the user journey. For each one: what the student sees, why it happens, and what to do.

Two principles apply everywhere:

- **A failed change never alters the plan.** If SIKAD cannot apply something, the plan stays exactly as it was.
- **SIKAD asks instead of guessing.** A missing deadline, a clash, or unclear input becomes a question for the student.

Quoted text is the wording the app shows.

§1–§9 describe messages and states the app is designed to show. §10 lists confirmed defects, where the app does something other than intended. §11 lists possible problems that still need testing. These three kinds are kept apart on purpose: a bug (§10), a missing feature or simulated part (§8, §9), and an intentional limit (§9).

Last reviewed against the code on 14 Oct 2026, after automatic completion was removed, check-ins took its place, the risk percentage was replaced by statuses and reasons, the date, time and command defects were fixed, Adjust schedule gained a recommended time, the recommendation and gap closing were improved, finishing early became a suggestion, and its regression (E22) was fixed. `node tests/run-tests.js` gave 131 passed, 0 failed. All twenty-two confirmed defects (E1 to E22) are now fixed (E21 regressed once and was fixed again as E22) and marked so in §10; the original reports are kept for the record. The defects in §10 were reproduced by calling the app's own logic files (`js/parser.js`, `js/engine.js`, `js/store.js`, `js/assistant.js`) from a throwaway Node script, unless an entry says "read in the code". Unless an entry says otherwise, on-screen results in §10 are taken from the code that draws them. E21 and E22 were also checked in headless Chromium, and the readability pass on the same day (shorter cards and sheets, longer reasons behind **Why?**; see `process-log.md`) was replayed there too. That pass changed wording only; it introduced no new defect. No check was run on a real phone, in iOS Safari or with a screen reader.

## 1. Opening the app

| What the student sees | Why | What to do |
|---|---|---|
| "Saved data on this device could not be read (it was damaged or from an older version), so SIKAD started fresh. The old plan cannot be restored in the app." | The data saved in the browser was damaged or is from an incompatible version. The unreadable copy is set aside in the browser, not written over. | Go through setup again. |
| "This browser isn't saving SIKAD's data (storage is full or blocked, or this is a private window). Your changes will be lost when you close this page." | The browser refused to store the plan. Shown once, the first time a save fails. | Free up browser storage, leave private browsing, or keep the page open. |
| "Your plan was changed in another tab. This tab now shows that newer plan." | SIKAD is open in two tabs and the other one saved a change. This tab loads the newer plan instead of writing over it; an open panel is closed. | Keep working in one tab. |
| Setup starts again with no message | Browser data was cleared, or the app was opened in a different browser, device, or private window. Data is stored on one device and one browser only. | Use the same browser and avoid private windows. |
| The page does not load when offline | The app was never loaded online in this browser, or it was opened as a file instead of from a web address, so nothing was cached. | Open it once online over HTTPS or localhost. |
| "Install" is not offered | Installing needs HTTPS or localhost and a supporting browser. | Use Chrome or Edge on a served address. |

## 2. Setup

| Step | What the student sees | Why | What to do |
|---|---|---|---|
| Set your baseline | "Add at least one class to continue." and Continue is disabled | No class has been added. | Upload, try the sample schedule, or type one class per line. |
| Set your baseline | The schedule that appears is not their own | Reading a COR file or photo is simulated; sample classes are loaded. | Edit the classes or type them in. |
| Quick questions | "Enter your commute in minutes, from 5 to 240." | The commute is empty or out of range. | Enter a number from 5 to 240. |
| Quick questions | "Pick at least one day." | A weekly commitment has no day selected. | Select at least one day. |
| Quick questions | "End time must be later than the start time." | The end is the same as or before the start. | Fix the times. |
| Quick questions | "Same time as … Check the day or time." | Two organization commitments overlap. | Change the day or time of one. |
| Bring in due dates | "Couldn't reach … Check your connection." | A platform connection did not complete. In this prototype the connections return sample data and cannot fail, so this message is not reachable today; it is there for a real connection. | Try again, or skip and add tasks by typing. |
| Brain dump | A question such as "When is … due?" | The text names a task without a deadline, or gives a time with no day. "This week", "next week", a date that passed recently and a date that does not exist are asked about too. | Answer the question, and check each due date on the review step. |
| Review | "… overlap(s) to review" | Two fixed commitments share a time. SIKAD keeps both and moves neither. | Edit one of them, or leave both knowingly. |

## 3. Voice input (Tap to speak)

| What the student sees | Why | What to do |
|---|---|---|
| "Microphone access was blocked. Allow it in your browser's site settings, or type instead." | Microphone permission was denied. | Allow the microphone for the site, or type. |
| "No microphone was found. Connect one, or type instead." | The device has no working microphone. | Connect one, or type. |
| "The browser's speech service could not be reached. It needs an internet connection. You can type instead." | Speech recognition runs in the browser's online service. | Go online, or type. |
| "No speech was heard. Try again a little closer to the microphone, or type instead." | Silence or very quiet audio. | Speak closer and try again. |
| "Nothing was transcribed. Try again, or type instead." | Recording ended with no usable text. | Try again, or type. |
| No recording; a typed alternative and an example are offered | The browser has no speech recognition (anything other than Chrome or Edge). | Type, or use Chrome or Edge. |
| Words are wrong or misheard | Speech recognition is imperfect, especially with names and course codes. | Edit the text before sending; it is always editable. |

Leaving the panel while recording discards the recording without a message.

## 4. Ask SIKAD

| What the student sees | Why | What to do |
|---|---|---|
| A clarifying question instead of an answer | The wording is outside the fixed set of questions and statements SIKAD recognises. No AI model is connected. | Rephrase, or tap one of the examples. |
| "I couldn't find a task called "…", so nothing was changed and no new task was added." | A command (move, change, rename, remove, mark done) named a task that is not on the list. | Use the task's name; the message lists the open tasks. |
| "Which task do you mean: "…" (due …) or "…" (due …)?" | The words match more than one task. SIKAD does not pick the first match. | Say the full name. |
| "Which task do you mean? Name it…" | The command said "it" with no task named in the same message. | Name the task. |
| "… is already marked done, so there is nothing to …" | The command targets a finished or removed task. | Nothing to do. |
| "One task at a time. Your message names "…" and "…"." | A command named two tasks. Neither is changed. | Say it again for one task. |
| "… is not a real date. Which date do you mean?" | The date does not exist (for example February 31). Nothing is added or changed. | Give a real date. |
| "… is not a single day. Do you mean by Friday or by Sunday?" | A deadline was given as "this week" or "next week". The deadline stays empty until chosen. | Tap one of the two days, or set the date. |
| "… has already passed. Is it overdue, or do you mean …?" | A deadline named a date or weekday that has just gone by. | Tap the one you mean. |
| "A weekly commitment that runs past midnight has to be entered as two…" | Weekly commitments are stored within one day. Nothing was added. | Enter one until 11:59 PM and one from 12:00 AM the next day. |
| "Which day should "…" start at 8:00 PM?" | A time was given without a day and the task is not planned on exactly one day. | Say the day too. |
| "What is the new deadline for "…"?" | A deadline change gave no date. | Give the day, and a time if it matters. |
| **The time you asked for is not available** — "Couldn't keep "…" at … I placed it in the next open block instead." | The requested start is inside a fixed commitment, past the end of the day, after the task's deadline, or already past. Shown on the proposal, before anything is saved. | Accept the offered slot, or reject and ask for another time. |
| A preview that ends "This is only a preview. Nothing was changed." | The message was a "what if…" question. | Say it as an instruction to get a proposal. |
| "Remove task … Nothing is removed yet." | Removal always needs confirming on the proposal step. | Accept to remove, Reject to keep. Undo works afterwards. |
| "Nothing is scheduled yet" / "No open tasks" / "Nothing is due" | The plan has nothing to answer from. | Add a task with a deadline. |
| "… has no deadline yet, so I can't rank it." | The task asked about has no deadline. | Add the date. |
| A refusal to do the work itself (for example, writing an essay) | SIKAD plans time; it does not produce coursework. | Ask it to schedule the task instead. |
| **Decision needed** | The new item overlaps a fixed commitment such as a class or shift. | Choose: keep the existing one, go to the new one, or keep both. |
| "Choose how to handle the conflict first." | Accept was tapped before the decision was made. | Make the choice, then continue. |
| "Add a due date so I can schedule the steps." | A task broken into steps has no deadline. | Add the due date. |
| "No changes were made. Your plan is as it was." | The proposal was rejected or closed. | Nothing to do; this is confirmation. |

## 5. Planning and the Home screen

| What the student sees | Why | What to do |
|---|---|---|
| **Not enough time**, with a list of tasks that do not fit | No valid plan fits the work before its deadline, even after later-due and already-overdue work gives way. The message states the usable time before that deadline, the work due by then, and the time other work takes. SIKAD will not squeeze work in or push it past the deadline. | Open **Review options**: shorten a task, check whether a deadline can move, defer low-priority work, or free up a commitment. |
| **A plan that fits** sheet — "There is more work than time before some deadlines. This plan gives all of it a place. Nothing changes until you accept." | A change left work with no slot before its deadline. SIKAD works out, on a copy, a plan where as few tasks as possible (lowest priority first) finish after their deadline, and shows each one with its due time, its new finish time and how late that is. It opens by itself after the action that caused the overload, and from **See a plan that fits** on the Not enough time card. Never during a focus session. | **Accept changes** to use it (Undo works afterwards), **Keep my current plan** to leave things as they are, or **Don't adjust** to add an Ask SIKAD change without adjusting. |
| "… is planned to finish …, about … after its deadline. You agreed to this; the deadline itself has not been changed." and a **Late** chip | An accepted adjusted plan. The task keeps its full time and its real deadline. | Ask whether a late hand-in is allowed, or change the task. If room appears later, it goes back to on time by itself. |
| "SIKAD couldn't find a plan that fits, even with late finishes." | There is no room within the planning window (three weeks). | Shorten or remove a task under **Review options**. |
| **At risk today** on a task in the Today card and timeline, with "You may not finish this today." and **Why?** | The task is planned today but today is tight. **Why?** gives the real numbers: usable time left, time needed, tasks planned before it; and, only when true, that its start has passed, it is marked hard, or its time is an estimate. No percentage is shown. A rule-based score decides only whether to warn (see system_codebase_summary.md §10). Tasks that fit comfortably show nothing. | Tap **Adjust schedule**: a sheet opens with a recommended time already filled in. Accept it, choose another time, or keep the plan. |
| **Adjust schedule** sheet — "No better time found" | No earlier time today and no later day before the deadline has room for the task. | Choose a time yourself, or tap **Task details** to change the time needed or the deadline. |
| **Adjust schedule** sheet — "… would then be at risk today" | Moving this task frees time today that another task takes, and today is tight. Shown before you accept. | Accept anyway, pick another time, or keep the current plan. |
| **Adjust schedule** sheet — "That time can't be used" | The chosen time breaks a hard rule; the reason is given. **Accept changes** is disabled. | Tap the offered closest time, or pick another. |
| **Won't fit today** on a task in the Today card, with "Planned … instead." | The remaining work cannot fit in today's usable time, but it is planned on a later day before its deadline (or it is overdue and planned later). The line names that day and time; **Why?** gives the numbers. | Nothing is required. **Adjust schedule** if it must happen today. |
| "… is past its deadline — I've kept it, after the work that can still meet its deadline." | An overdue task was placed after work that can still be on time, because that was the only way everything fits. | Do it when planned, or adjust or remove it. |
| "… short" or "Not all of it fits" on Weekly task progress, in place of **Fits** | Same cause, shown as a one-line verdict. | As above. |
| "When is … due?" card | A task has no deadline, so it is not scheduled. | Enter the date and tap **Schedule it**. |
| "… is past its deadline — I've kept it and moved it to the front of your plan." | The task is overdue and unfinished. Not shown for the task already on the **What to do next** card: its **Why this?** says the same. | Do it next, or adjust or remove it. |
| "… is waiting on …, which isn't scheduled yet." | A task depends on another that has no slot. | Give the earlier task a deadline or enough time. |
| "Couldn't keep … at … — …. I placed it in the next open block instead." | A task pinned to a specific time could not stay there; the message says why. The pin is dropped so the warning is shown once. | Check the new slot, or adjust it. |
| A card "How did … go?" and a toast "The time for … has ended. How did it go?" | A planned block's end time passed with no report. This is a check-in, an intended feature. Nothing is marked done or credited, and that block's time is on hold: it is not planned anywhere until the student answers. Asked once per block. A running focus session is never interrupted this way. | **Completed** credits that block (Undo on the toast). **Partly done** asks for the time still needed. **Not finished** keeps the work. The last two open **Recommended schedule** first. |
| **Recommended schedule** sheet | The answer to a check-in, worked out on a copy. It says how much the task still needs, when it was planned, the recommended new time, whether it moves to a later day and why, and every other task that would move, before → after. | **Accept changes** applies it in one step (Undo afterwards). **Keep current plan** changes nothing and leaves the question on Home. |
| "… so the recommended time is Tomorrow at … Your day is not made longer." | The unfinished work does not fit in what is left of today before the stop-scheduling time. SIKAD does not extend the day; it uses the next day with room before the deadline and re-places the tasks that displaces. | Accept, or keep the current plan and change the task instead. |
| **Not enough time** inside a Recommended schedule, or **A plan that fits** opening instead | The unfinished work cannot be placed before its deadline. Nothing is shortened, no deadline is changed and no fixed commitment moves. | Accept a late finish that names what is late and by how much, or **Keep my current plan**, or **Don't adjust** to see the plain result. |
| "If nothing is left, tap Back and choose Completed." / "Enter how much time is still needed, from 5 minutes to 40 hours." | **Partly done** was given no usable amount. | Enter hours, minutes or both. |
| "That block is no longer waiting for an answer." | The check-in was already answered, or its task was finished or removed meanwhile. | Nothing to do. |
| **Marked done by an earlier version** card | Saved data from the version that marked blocks done when their time passed. SIKAD no longer does that. The card appears only for such records. | **I didn't finish** puts that block back and removes its credit. **OK, that's right** closes the card. |
| A check-in that is days old | Check-ins do not expire. A block missed last week is still asked about. | Answer it; **Completed** credits it on the day it was planned. |
| **Couldn't update your plan** — "Your plan hasn't changed." | An unexpected failure while applying a change. The whole state is copied before every action and put back if the action fails, so no partial change is kept. | Tap **Try again** to reopen what you were doing, or **Dismiss**. |
| A later task jumps to tomorrow right after you finish one late | The work you just reported ran into the next task's slot. The next task keeps its full time and a 15-minute gap, so if that no longer fits before the end of the day it moves to the next valid slot. | Nothing; use Undo if you would rather keep it. |
| The plan changed in a way the student did not want | Snooze, Done or an accepted proposal triggered a replan. | Tap **Undo** on the toast that follows the change. The Plan updated card has no Undo button. Undo goes back one change only and is gone after a reload, a new day or a new check-in. |

## 6. Focus Mode

| What the student sees | Why | What to do |
|---|---|---|
| "Enter how much time is still needed, in hours and minutes." | **Partly done** was chosen without saying what is left. | Enter the remaining time. |
| A session still open long after it started | The timer never ends a session by itself; only the student does. | End the session and say how it went. |
| Weekly progress did not go up after a session | Reporting that a task needs *more* time than estimated credits nothing; the plan grows instead. | Expected behaviour. |

## 7. Tasks and editing

| What the student sees | Why | What to do |
|---|---|---|
| "Task name is missing. Type a short name, e.g. "IT 208 report"." | A manual task was saved with no name. The name is the only required field. ("Add a task with a name, deadline and time needed." is the description of the Form option, not an error.) | Type a name. |
| "Task added. It needs a deadline before it can be scheduled." | A manual task was saved without a deadline. It is listed under Needs attention and is not scheduled. With no time given, SIKAD estimates one and marks it ≈. | Add the deadline on the "When is … due?" card or in the task. |
| "Enter the time needed in hours and minutes." / "Time needed must be between 5 minutes and 40 hours." | Time needed was left empty, or is out of range. | Enter hours, minutes or both. |
| "The deadline needs both a date and a time." (or "start time") | One half of a date-and-time pair is missing or not a real date. | Fill in both, or clear the date to remove the value. |
| "That deadline is more than a year away from today. Check the date." | Usually a mistyped year. | Correct the date. |
| "That time has already passed." / "That is outside your day (…) for … of work." / "Starting then, … would end after the deadline (…)." / "That time runs into IT 207 (2:00 PM – 5:00 PM) or the 15-minute gap around it. SIKAD never moves a fixed commitment." Each may end "The closest time that works is …" | A **Start at** time cannot be used, in Task details, Add a task or Adjust schedule. Nothing is saved until it is fixed. In Adjust schedule the closest time is a button. | Use the closest time, pick another, or clear the date and let SIKAD choose. |
| "Add the deadline too. A start time alone does not tell SIKAD when the work is due." | Add a task was given a start time with no deadline. | Add the deadline. |
| "This overlaps a fixed commitment" | A new or edited commitment clashes with an existing fixed one. | Change the time, or keep both knowingly. |
| A ≈ and "AI estimate" on a duration | SIKAD estimated the time because none was given. It may be wrong. | Open the task and set the real time needed. |

## 8. Things that fail without a message

These are worth knowing because the app does not announce them.

| Situation | Effect |
|---|---|
| The browser refuses to save | Now announced once (see §1). Still true: the changes are gone after the page closes. A browser that accepts the write and later clears it cannot be detected. |
| The same app open in two tabs | The other tab's change is loaded and announced (see §1). Two changes made in the same instant in both tabs can still overwrite each other. |
| The device clock or timezone is wrong | The plan is built on real device time, so "now", today's timeline and deadlines shift with it. |
| Imported platform items or scanned schedules | These are sample data in this prototype, not the student's real records. |
| A check-in is left unanswered | That block's time stays on hold: it is not in the plan, and the task is not offered as the next action for those minutes. Weekly task progress still counts it as planned. |
| A later step of a task while an earlier step waits on a check-in | The later step can be planned and offered before the earlier one is answered. |
| The page is reloaded right after a change | Undo is no longer offered. The change itself is saved. |
| A weekly commitment that runs past midnight | Not stored. SIKAD says so and asks for it as two commitments. A one-time one is kept whole. |

## 9. Limits that can look like errors

- **SIKAD never moves a class, shift or commute.** If the plan seems not to adapt around one, that is by design; they show a lock and "Fixed".
- **Completing a task can add work to today.** Freed time lets the engine pull later work forward, so today's task total can grow.
- **During setup, the browser Back button leaves the page.** Use the on-screen Back button.
- **Past weeks in Overview are read-only.** They show what was done, missed or moved.
- **Commutes, the morning routine and the lunch hour have no lock.** They are worked out from the classes and Profile settings, and change when those change.
- **Marking Done on one session of a split task credits that session only.** The rest of the task stays planned. "Mark whole task done" is in the task's details.
- **Planning stops three weeks ahead.** Work that cannot be placed inside that window is reported as not fitting.
- **The risk percentage is gone on purpose.** "At risk today", "Won't fit today" and "Not enough time" are statuses with reasons. The rule-based score behind "At risk today" is internal and is not a probability.
- **"Won't fit today" can show equal numbers.** "About 1 hr of work is left and today has 1 hr of usable time" is followed by the reason: it is not enough once the 15-minute gaps are counted.
- **"Change the deadline for X to next week" takes that Sunday.** Only a new task's "this week" / "next week" deadline asks which day.
- **"Use the time you freed?" appears only for time that is genuinely free.** No card when the block had already ended, when the freed time is shorter than the next task, when the move would split a task, put a task at risk, or gain less than 30 minutes, or when the next task has a time you asked for or a day you chose.
- **Every early finish is looked at on its own.** Accepting one suggestion does not approve anything later; the next early finish brings its own card. Only one card shows at a time: a new suggestion replaces a waiting one, and if the new finish frees nothing usable, the waiting one stays.
- **A task planned for tomorrow can be suggested for today.** It stays tomorrow until you accept.
- **A declined suggestion stays declined until the plan changes for another reason.** Reloading or time passing does not bring it back; editing any task does, if it still makes sense.
- **A replaced suggestion is not shown again.** If you leave a card unanswered and finish another task early, the new card replaces it. A later change you make may then use the time the first finish freed, as an ordinary replan shown before → after with Undo, without a card for it.
- **A required repair can use freed time without asking.** If a change would otherwise leave a task without a slot, it is placed at once, even into time a suggestion was offered for; the suggestion then disappears.
- **No reminders or notifications are delivered.** The app only updates while it is open. Profile → **Test notifications** shows a phone drawn inside the page; nothing reaches the device, and no permission is asked for.
- **No home-screen widgets.** Profile → **Test widgets** shows previews inside the app.
- **A planned block that ends is never marked done by itself.** SIKAD asks how it went. Until the student answers, that block's time is on hold and is not re-planned.
- **A button on a Sample notification that needs a real task opens nothing.** It says so on the notification. **Review schedule** still opens the timeline, because it needs no task. Sample content never touches the real plan.
- **The "Plan updated" notification is usually a sample.** It reads the Plan updated card's record, which clears itself about 12 seconds after a change.
- **On a notification, "Adjust schedule" opens the Adjust schedule sheet and "Review task" opens Task details.**
- **A time you choose yourself can leave another task at risk.** The recommendation avoids this; a time you type may not. The sheet says so before you accept.
- **A gap is closed only when it is worth it.** A session is not moved for less than 30 minutes' gain, is not split to fit a smaller gap, and a time you asked for is never moved.
- **"Recommended: keep …" with Accept greyed out** means the current time is already the best one. Change the time needed or the deadline in Task details, or pick a time yourself.
- **A start within the current quarter hour is refused** ("That is too close to now. The earliest start is …"), because the engine plans from the next quarter hour.
- **Moving the Demo clock back withdraws check-ins** for blocks that are ahead again. It changes no task.

## 10. Confirmed defects

Each entry was reproduced on 14 Oct 2026 as described at the top of this file. The clock in the examples is Monday 12 Oct 2026, 9:05 AM, with the sample week loaded. Entries marked **Fixed** were corrected on 14 Oct 2026 and are kept for the record; the rest are open.

### E1. Snoozing a task that is pinned to a time does not move it (Fixed)

- **Fixed 14 Oct 2026:** `snoozeSession` in `js/store.js` now clears the pin, so the task moves and the toast is true. Test: "snoozing a task that was pinned to a time really moves it".
- The original report follows.

- **Affected:** Snooze on the Home "What to do next" card (`snoozeSession` in `js/store.js`; pinned placement, step 1 of `scheduleOnce` in `js/engine.js`).
- **Expected:** the task moves to the next open block after its current one, and the toast says where.
- **Actual:** "Algorithm Tracing Worksheet" was pinned to 8:00 PM today, then snoozed. It stayed at 8:00 PM with no changes recorded. The Home toast is built from the task's current slot, so it reads "Moved … to Today 8 PM" although nothing moved.
- **Likely cause:** Snooze sets "not before" on the task but leaves the pin. The engine places pinned tasks first and does not check "not before" for them.
- **Recommended correction:** clear the pin when a task is snoozed (the student is overriding their own earlier choice), or make the pinned step respect "not before". Build the toast from whether the start time actually changed.

### E2. A commitment that runs past midnight is cut off at midnight (Fixed)

- **Fixed 14 Oct 2026:** A one-time commitment said with both times ("10 PM to 2 AM") now keeps its real end. `parseTimes` in `js/parser.js` no longer cuts it at midnight, and `occurrences` in `js/engine.js` blocks its hours on both days; each day's timeline shows its own part. Limit: a **weekly** commitment past midnight is not stored; SIKAD says to enter it as two and adds nothing. Tested in the logic suite and seen in the browser.
- The original report follows.

- **Affected:** Ask SIKAD and the brain dump, for commitments with a time range (`parseTimes` in `js/parser.js`, the line `end = Math.min(start + 12 * 60, 24 * 60)`); `occurrences` in `js/engine.js`.
- **Expected:** "I have a work shift tomorrow from 10 PM to 2 AM" protects 10 PM to 2 AM, or SIKAD asks.
- **Actual:** the commitment is saved as 10:00 PM to 12:00 AM. "Training on Thursday from 9 PM to 1 AM" becomes 9:00 PM to 12:00 AM. There is no question or note. The hours after midnight are not protected.
- **Likely cause:** end times are capped at the end of the start day, and the engine only counts a one-time commitment on the day it starts.
- **Recommended correction:** keep the real end time and block both days, or ask the student to confirm when the end time is earlier than the start time. This touches `parser.js` and `engine.js`, which the build rules protect, so it needs an explicit decision.

### E3. A date that has already passed is read as next year, and "last Friday" as the coming Friday (Fixed)

- **Fixed 14 Oct 2026:** For a deadline, a month-and-day date that passed within the last 60 days now asks: overdue, or next year? "Last Friday" is read as the Friday that has gone by, and also asks. A date long past this year still means next year. `parseDate` in `js/parser.js`. Tested in the logic suite and seen in the browser.
- The original report follows.

- **Affected:** brain dump and Ask SIKAD date reading (`parseDate` in `js/parser.js`).
- **Expected:** "Paper due Oct 5", said on 12 Oct, is treated as overdue or questioned. "Paper due last Friday" is treated as overdue or questioned.
- **Actual:** "Paper due Oct 5" gets the deadline Tue, Oct 5 of the following year, so the task looks a year away and sinks to the bottom of the plan. "Paper due last Friday" gets the coming Friday (Oct 16) and the title "Paper Due Last".
- **Likely cause:** a month-and-day date more than one day in the past is rolled forward a year. The word "last" before a weekday is not recognised, so the weekday is read as the next one.
- **Recommended correction:** for a date in the recent past, ask "Did you mean … (already past)?" instead of rolling forward. Recognise "last <weekday>". The review step should show the year when it is not the current one.

### E4. "This week" and "next week" become a Sunday deadline without a question (Fixed)

- **Fixed 14 Oct 2026:** For a deadline, "this week" and "next week" now ask "by Friday or by Sunday?" and leave the deadline empty until the student chooses or sets a date. Limit: the Ask SIKAD command "change the deadline for X to next week" still takes that Sunday. Tested in the logic suite and seen in the browser.
- The original report follows.

- **Affected:** brain dump and Ask SIKAD (`parseDate` in `js/parser.js`); the review cards in `js/app.js`.
- **Expected:** the stated rule is that a deadline is never invented and an unclear date becomes a question.
- **Actual:** "Lab report due next week" gets Sun, Oct 25, 11:59 PM. "Reflection paper due this week" gets Sun, Oct 18, 11:59 PM. "Quiz in IT 206 next week" gets Sun, Oct 25, 6:00 AM (the start of that day). No question is asked. Said on a Sunday, "this week" means the following Sunday.
- **Likely cause:** the parser marks these dates (`deadlineIsWeekEnd`), but nothing in the app reads that mark, so the review step shows the date like any other.
- **Recommended correction:** use the mark that is already there: show "end of the week, please confirm" on the review card, or ask which day. Decide whether this is a bug or an accepted shortcut; as built it conflicts with the rule in `system_codebase_summary.md` §7.1.

### E5. Two tasks that each wait on the other are never scheduled (Fixed)

- **Fixed 14 Oct 2026:** The task sheet no longer lists a task that already waits on this one, directly or through others (`taskSheet` in `js/app.js`). Checked by reading the code and in the browser form; a loop already saved in old data is still shown as "Waiting on".
- The original report follows.

- **Affected:** "Can only start after…" in the task details (`saveTask` in `js/app.js`); dependency handling in `scheduleOnce` in `js/engine.js`.
- **Expected:** the app refuses a circular dependency, or explains it.
- **Actual:** with "Big-O Worksheet" set to start after "Class Diagram Exercise" and the reverse, both tasks drop out of the plan and the plan status becomes "not feasible". They are listed on the **Not enough time** card as "Waiting on: …", although time is not the problem. **See a plan that fits** cannot help and answers "SIKAD couldn't find a plan that fits, even with late finishes." The engine result was reproduced; the on-screen wording is read in the code.
- **Likely cause:** the dependency list offers every other open task with no check for a loop, and blocked tasks share the card used for a time shortage.
- **Recommended correction:** leave out of the list any task that already depends on this one (directly or through others), and give blocked work its own message: "These two tasks are waiting on each other."

### E6. An agreed late finish stays in force after the deadline is edited in the task details (Fixed)

- **Fixed 14 Oct 2026:** `saveTask` and `setDeadline` in `js/app.js` now end the late agreement when the deadline changes, as the Ask SIKAD path does.
- The original report follows.

- **Affected:** task details and the "When is … due?" card (`saveTask` and `setDeadline` in `js/app.js`), compared with `deadline_change` in `applyTaskAction` in `js/store.js`.
- **Expected:** a new deadline ends the earlier agreement, as the Ask SIKAD command does and as the logic test "a new deadline clears the agreement" checks.
- **Actual:** a 10-hour task due tonight was accepted as late. Its deadline was then moved two hours later the way the task details do it. The task was still marked **Late** with "You agreed to this", now against a deadline the student never agreed to be late for. The agreement only clears if the task happens to fit before the new deadline.
- **Likely cause:** the Ask SIKAD path resets the late agreement when the deadline changes; the two on-screen paths set the deadline directly and do not.
- **Recommended correction:** reset the agreement in `saveTask` and `setDeadline` when the deadline changes (an `app.js` change), so a still-overloaded plan offers "A plan that fits" again.

### E7. A command that names two tasks changes only one (Fixed)

- **Fixed 14 Oct 2026:** A command that names two open tasks in full now changes neither and says "One task at a time", naming both (`resolveTask` in `js/parser.js`). Tested in the logic suite and seen in the browser.
- The original report follows.

- **Affected:** Ask SIKAD task commands (`taskCommand` in `js/parser.js`).
- **Expected:** both tasks are changed, or SIKAD says it handles one task at a time.
- **Actual:** "Move Big-O Worksheet and Class Diagram Exercise to Friday" produces one change, for "Class Diagram Exercise" only. "Big-O Worksheet" is ignored without a message. The review step does show which task was understood, so the student can notice before accepting.
- **Likely cause:** a command is matched to one task title; the rest of the phrase is discarded.
- **Recommended correction:** when the phrase contains two task titles, either produce one change per task or ask "One task at a time: which one?".

### E8. Overview day bars cannot show a full day (Fixed)

- **Fixed 14 Oct 2026:** The bar is now planned time ÷ the day's open time, capped at 100%, and the legend says what a full bar means.
- The original report follows.

- **Affected:** Overview day cards for today and later (`weekView` in `js/app.js`).
- **Expected:** the bar shows how much of the day's usable time is taken by tasks, reaching full when the day is full.
- **Actual:** the bar is planned time ÷ (planned time + open time), but "open time" already includes the time the tasks sit in. Monday had 3 hrs planned in 5 hr 15 min of open time and the bar value was 36%, not 57%. A day packed with tasks reads about half.
- **Likely cause:** the open-time figure comes from the fixed commitments only and is then added to the planned time again.
- **Recommended correction:** divide planned time by the day's open time (capped at 100%), or subtract planned time from open time first. The legend under the bars should say what a full bar means.

### E9. On Sundays the "Fits" verdict looks at a different week from the progress bar (Fixed)

- **Fixed 14 Oct 2026:** `weekCard` passes the progress bar's own week end to `capacity`. `endOfWeek` is unchanged.
- The original report follows.

- **Affected:** Weekly task progress on Home (`weekCard` in `js/app.js`, `capacity` in `js/engine.js`, `endOfWeek` in `js/time.js`).
- **Expected:** the verdict and the bar cover the same Monday-to-Sunday week.
- **Actual:** on Sun, Oct 18 the bar covers the week ending that night, while the verdict compares work and open time up to Sun, Oct 25 (3,885 minutes of open time). "Fits" can be shown for a week that is not the one on screen.
- **Likely cause:** `endOfWeek` deliberately returns the coming Sunday when today is Sunday; the progress bar does not use it.
- **Recommended correction:** give the verdict the same week end as the bar. The helper is in a protected file, so pass the week end from `app.js` instead of changing it.

### E10. Profile says voice input uses sample data, but it is real (Fixed)

- **Fixed 14 Oct 2026:** The limits text now says voice uses the browser's speech recognition.
- The original report follows.

- **Affected:** Profile → "How SIKAD plans & its limits" (`profileView` in `js/app.js`); voice in `dictStart`. Read in the code.
- **Expected:** the limits text states what is simulated.
- **Actual:** the text reads "reading photos/PDFs, voice input, and calendar or class-platform connections use sample data". Voice uses the browser's speech recognition (`en-PH`) and sends audio to the browser's online service; only "Try an example" loads a sample transcript.
- **Likely cause:** the sentence was written before voice was connected.
- **Recommended correction:** reword it: voice uses the browser's speech service where available; file reading and platform connections use sample data.

### E11. A date that does not exist is accepted as a later real date (Fixed)

- **Fixed 14 Oct 2026:** A date that does not exist is now refused with "… is not a real date. Which date do you mean?" in a new task, a deadline change and a move. Nothing is added or changed. Tested in the logic suite and seen in the browser.
- The original report follows.

- **Affected:** Ask SIKAD and the brain dump (`parseDate` in `js/parser.js`). Seen in the browser on 14 Oct 2026.
- **Expected:** "Change the deadline for Big-O Worksheet to February 31" is refused, or SIKAD asks which date was meant.
- **Actual:** the review card shows a new deadline of Wed, Mar 3. The day overflows into the next month without a note. The student can still notice it on the review card before accepting.
- **Likely cause:** the month and day are passed to the date constructor without checking that the day exists in that month.
- **Recommended correction:** after building the date, check that its month and day are the ones typed; if not, ask. The form fields already do this (`T.joinInput`). This is a `parser.js` change.

### E12. "Adjust schedule" opened Task details with no recommendation (Fixed)

- **Fixed 14 Oct 2026.** Seen in use and in the code (`todayCard` in `js/app.js` called `openTask`).
- **Was:** the button on an "At risk today" or "Won't fit today" row opened the ordinary Task details sheet. The student had to work out a better time alone.
- **Now:** it opens the **Adjust schedule** sheet with a recommended date and time already filled in, the reason, and the plan that would result. Another time can be typed; the plan is worked out again each time. Tested in the logic suite and driven in the browser.

### E13. "Won't fit today" vanished about 12 seconds after it appeared (Fixed)

- **Fixed 14 Oct 2026.** Found in the browser while testing E12.
- **Was:** the status was read from the last plan change. That record is cleared when the Plan updated card dismisses itself, so the warning disappeared without anything being resolved, and came back in other cases without cause.
- **Now:** it is read from the saved record of what was planned for today, and it is not shown for a task whose day or time the student chose. Seen in the browser 14 seconds after the change.

### E14. A requested start inside a class was saved, then dropped without a message (Fixed)

- **Fixed 14 Oct 2026.** `saveTask` in `js/app.js` did not check fixed commitments.
- **Now:** Task details, Add a task and Adjust schedule all use one check (`checkStart` in `js/store.js`). The message names the commitment and gives the closest time that works.

### E15. A task ended exactly when a commitment at the end of the day began (Fixed)

- **Fixed 14 Oct 2026.** `freeSlots` in `js/engine.js` ignored commitments that start at or after the stop-scheduling time, so no 15-minute gap was kept before a 10 PM shift.
- **Now:** such a commitment shortens the last open block by the gap. Tested in the logic suite.

### E16. Overdue tasks stayed under "Needs attention" after they were given a slot (Fixed)

- **Fixed 14 Oct 2026.** The group was built from "no deadline, no slot, or past its deadline", so an overdue task could never leave it by being scheduled.
- **Now:** the group is built from `taskStatus` (`js/store.js`): needs a deadline, does not fit, or waiting for a check-in answer. An overdue task with a slot is listed under Up next and keeps its Overdue mark.

### E17. Adjust schedule recommended tomorrow for an overdue task that already held today's earliest opening (Fixed)

- **Fixed 14 Oct 2026.** `recommendAdjustment` in `js/store.js`.
- **Cause:** the rule only looked for a time *earlier* than the task's current one today. An overdue task already sits in today's first opening, so nothing earlier existed and the rule fell through to "the first later day". The task's "at risk" state was treated as a reason to move it, even though moving overdue work later can only delay it.
- **Now:** for overdue work the earliest opening today always wins, including the one it already has ("Recommended: keep Today, …"). It goes to a later day only when today has no opening long enough, and the reason says how much open time today has. Tests: "overdue work is recommended into today's earliest opening" and "overdue work goes to a later day only when today truly has no opening".

### E18. A recommendation could move the risk onto another task (Fixed)

- **Fixed 14 Oct 2026.**
- **Was:** the recommendation was judged by where the one task landed. Moving it could free a tight gap that another task then took, so the warning simply changed owner.
- **Now:** each candidate is a whole plan from the engine, and the one with the fewest at-risk tasks in total wins; a tie means "stay put". The sheet still warns, before acceptance, when a time the student picks would put another task at risk. Tests: "an at-risk task gets a recommendation from whole-plan comparison" and "when every other time only moves the risk to another task, the recommendation is to stay put". Seen in the browser at the end of the demo route: the recommended time left no task at risk.

### E19. Closing a check-in proposal with Escape threw an error (Fixed)

- **Fixed 14 Oct 2026.** Found in the browser. The close handler assumed every proposal came from typed text. The plan was not changed by the error, but the next action could misbehave. `js/app.js` now checks first.

### E20. Open time left by a change was not always closed up (Fixed)

- **Fixed 14 Oct 2026.** A session that was still valid stayed where it was even when a change opened an earlier gap, unless a completely fresh plan was judged clearly better.
- **Now:** after a change the student made, a session moves into an earlier gap when the gap is truly empty (no fixed commitment, buffer, or other task's session), the gain is an earlier day or at least 30 minutes, it finishes no later, and it is not split into more sittings. A requested start is never moved this way. Tests: "a flexible session moves into an earlier gap…", "compaction leaves sessions alone…", "after compaction every hard rule still holds…".

### E21. Finishing early moved other tasks without asking (Fixed, then regressed: see E22)

- **Fixed 14 Oct 2026.** `completeSession` replanned like any other change, so the gap-closing and "fresh plan is clearly better" rules pulled later work into the freed time, and could make a task at risk (seen on the demo route: ERD and Business Rules moved from Wednesday into tonight and showed At risk today).
- **Now:** finishing early (Done, Focus Mode "Yes, it's complete", or Mark whole task done before its time) records the completion and leaves every other task where it is. If a task could use the freed time under the existing rules, Home shows one **Use the time you freed?** card. **Accept** applies that one move after checking it again; **Decline** keeps the plan and is remembered until the plan changes for another reason. Changes that keep the plan valid still happen at once. Found while checking: a routine clock tick could also swap in a tidier plan a minute later and move tasks into the freed time; routine recalculations now only repair. Tests: the seven "Finishing early" tests. Seen in the browser: Accept, Decline, reload, an unrelated edit bringing the card back, Undo, and a required repair using the freed time.

### E22. After an accepted suggestion, later replans moved tasks without asking (regression of E21; Fixed)

- **Found 14 Oct 2026**, reported in use and reproduced in the browser: three early finishes in a row through Focus Mode, each suggestion accepted; about a minute after the third, ERD and Business Rules moved from tomorrow into tonight by itself.
- **Cause, verified:** accepting a suggestion can put a task that is due later (Use Case Diagram, due Thursday) ahead of one due sooner (ERD, due Wednesday). Every replan, including the "hold" replan after an early finish and the routine one on each clock tick, ran a rank-order rule that moves a task up when lower-ranked work sits ahead of it. Both sessions were still valid, so that move was an optional improvement, but it was made without asking. A second path: moving the Demo clock back rebuilt the whole plan from scratch, which also reshuffled tasks.
- **Fix:** the rank-order rule now runs only after a change the student makes, never in a settled replan (an early finish, a clock tick, a reload) (`opts.settled` in `scheduleOnce`, `js/engine.js`). Moving the clock back keeps the plan and only repairs it (`setClock`, `js/store.js`). Each early finish is looked at on its own; a suggestion still waiting is kept (checked again) if the new finish frees nothing usable. Ask SIKAD "Mark … as done" now goes through the same flow (`finishTask`).
- **Tests:** "A" to "I" under "Early finishes one after another" in `tests/run-tests.js`. The test "C and J" fails on the code before the fix and passes after it. Still passing after the readability pass (131 passed, 0 failed); the early-finish replay in the browser gave the same moves with the new card wording ("Move … to …?").
- **Browser (headless Chromium, 14 Oct 2026):** three Focus Mode early finishes in a row each showed a new card and moved nothing else; after each Accept, +30 minutes and a reload changed nothing; a declined card stayed away and a separate finish got its own card; Ask SIKAD "Mark Big-O Worksheet as done" led to a card; Undo after Accept brought the card back with the finished task still done.

### Documentation that did not match the app (corrected in this review)

| Was documented | What the app does |
|---|---|
| Undo on the Plan updated card | Undo is on the toast only. |
| Check-in offers done, partly done or missed | Now true: **Completed**, **Partly done**, **Not finished**. (Earlier: two buttons, then automatic completion.) |
| A manual task needs a name, deadline and time | Only the name is required. |
| Commutes show a lock and "Fixed" | Commutes are worked out from classes and have no lock. |
| A missed block: SIKAD asks instead of assuming | The work is moved first, then the question is asked. |
| Time is always the device clock | True in the product; the judge dock can shift it. |

## 11. Possible problems that need testing

These are supported by reading the code but were not reproduced. They need a browser or a device.

| Possible problem | Why it is suspected | How to check |
|---|---|---|
| Unticking a completed step counts its time twice | In the task details, unticking a done step restores its time but leaves the credit in the weekly log. Completing it again adds the credit again. A finished task reopened this way keeps the status "done" and is not rescheduled. | Complete a step, untick it, save, complete it again, and compare Weekly task progress. |
| Blocks of other tasks that pass during a long focus session | The clock notes them as check-ins while the session runs, without replanning. Checked in the logic (`noteMissed`), not in a browser. | Start a session, shift the Demo clock past another task's block, end the session, and look for its check-in on Home. |
| Fonts missing offline after the first visit | `sw.js` pre-caches the scripts, styles and icon but not the four font files; they are cached only once the service worker controls the page. | Load once online, go offline, reload, and check the typeface. |
| Home-screen icon and install prompt | The manifest and `apple-touch-icon` use one SVG. Some browsers, iOS Safari in particular, expect PNG icons. | Install on Android Chrome and iOS Safari and look at the icon. |
| The word "Fixed" on timeline rows | Timeline rows for fixed commitments show a lock and the type ("Class · Face-to-face", "Weekly", "One-time"). The word "fixed" is in the screen-reader label; the design rule asks for lock + "Fixed". | Look at a class row in the timeline. |
| Numeric dates such as "5/10" | Always read as month/day. | Type a day-first date and check the review step. |
| Two tabs changing the plan in the same instant | Carried over from §8; cannot be shown from the code. | Act in two tabs at once. |
| Check-ins across a timezone or device-clock change | If the device clock moves back, check-ins for blocks that are ahead again are withdrawn; nothing else changes. Tested in the logic only. | Change the device time and reopen the app. |
| Many check-ins after days away | Up to three cards show, oldest first, with a count of the rest. Three at once were seen in the browser; a longer queue was not. | Leave the sample week for several demo days, then open Home. |
| Legacy "Marked done by an earlier version" card | Its logic is tested; the card itself was not opened in a browser in this review. | Load data saved by the earlier version. |
| Widget page and notification phone simulator on real phones | Checked in headless Chromium at 320, 390 and 1280 px, light and dark, including every notification button. Not checked on iOS Safari or with a screen reader. | Open Profile → Test widgets / Test notifications on a phone. |
| Date and time fields on iOS Safari | The fields are native date and time inputs; checked in Chromium only. | Edit a task's deadline and start time on an iPhone. |
| Short cards and **Why?** toggles on real devices | The readability pass put longer reasons in native `<details>` toggles. Checked in headless Chromium at 390 and 1280 px in light theme, including opening one with Tab + Enter. Not checked in dark theme, in iOS Safari or with a screen reader (is the toggle announced as expandable, and is the hidden text read after opening?). | Open a risk row's **Why?** and the early-finish card's **Why this task?** on a phone, in dark theme and with VoiceOver or TalkBack. |
| Voice on real devices | Depends on the browser, microphone permission and network. | Try Chrome on Android and Safari on iOS. |

