# SIKAD — Errors and Problem States

This lists what can go wrong while a student uses SIKAD, in the order of the user journey. For each one: what the student sees, why it happens, and what to do.

Two principles apply everywhere:

- **A failed change never alters the plan.** If SIKAD cannot apply something, the plan stays exactly as it was.
- **SIKAD asks instead of guessing.** A missing deadline, a clash, or unclear input becomes a question for the student.

Quoted text is the wording the app shows.

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
| Bring in due dates | "Couldn't reach … Check your connection." | A platform connection did not complete. | Try again, or skip and add tasks by typing. |
| Brain dump | A question such as "When is … due?" | The text names a task without a deadline, or a date is unclear. | Answer the question. SIKAD will not invent a date. |
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
| **A plan that fits** sheet — "You have more work than time before some deadlines. SIKAD adjusted the plan so all of it has a place. Nothing changes unless you accept." | A change left work with no slot before its deadline. SIKAD works out, on a copy, a plan where as few tasks as possible (lowest priority first) finish after their deadline, and shows each one with its due time, its new finish time and how late that is. It opens by itself after the action that caused the overload, and from **See a plan that fits** on the Not enough time card. Never during a focus session. | **Accept changes** to use it (Undo works afterwards), **Keep my current plan** to leave things as they are, or **Don't adjust** to add an Ask SIKAD change without adjusting. |
| "… is planned to finish …, about … after its deadline. You agreed to this; the deadline itself has not been changed." and a **Late** chip | An accepted adjusted plan. The task keeps its full time and its real deadline. | Ask whether a late hand-in is allowed, or change the task. If room appears later, it goes back to on time by itself. |
| "SIKAD couldn't find a plan that fits, even with late finishes." | There is no room within the planning window (three weeks). | Shorten or remove a task under **Review options**. |
| **At risk · NN%** on a task in the Today card and timeline | The task is planned today but today is tight. The percentage is a rule-based estimate (see system_summary.md §3.4), not a prediction. Tasks that fit comfortably show nothing. | Tap **Adjust** to change the time needed or the deadline, or free up time. |
| **Won't fit today** on a task in the Today card | The remaining work cannot fit in today's usable time, but it is planned on a later day before its deadline (or it is overdue and planned later). | Nothing is required. Adjust the task if it must happen today. |
| "… is past its deadline — I've kept it, after the work that can still meet its deadline." | An overdue task was placed after work that can still be on time, because that was the only way everything fits. | Do it when planned, or adjust or remove it. |
| "… short" or "Not all of it fits" on Weekly task progress, in place of **Fits** | Same cause, shown as a one-line verdict. | As above. |
| "When is … due?" card | A task has no deadline, so it is not scheduled. | Enter the date and tap **Schedule it**. |
| "… is past its deadline — I've kept it and moved it to the front of your plan." | The task is overdue and unfinished. | Do it next, or adjust or remove it. |
| "… is waiting on …, which isn't scheduled yet." | A task depends on another that has no slot. | Give the earlier task a deadline or enough time. |
| "Couldn't keep … at … — …. I placed it in the next open block instead." | A task pinned to a specific time could not stay there; the message says why. The pin is dropped so the warning is shown once. | Check the new slot, or adjust it. |
| "A session ended without 'Done'. Check in on the Home tab." and a check-in card | A planned block passed without being marked. | Say whether it was done, partly done, or missed. |
| **Couldn't update your plan** — "Your plan hasn't changed." | An unexpected failure while applying a change. The whole state is copied before every action and put back if the action fails, so no partial change is kept. | Tap **Try again** to reopen what you were doing, or **Dismiss**. |
| A later task jumps to tomorrow right after you finish one late | The work you just reported ran into the next task's slot. The next task keeps its full time and a 15-minute gap, so if that no longer fits before the end of the day it moves to the next valid slot. | Nothing; use Undo if you would rather keep it. |
| The plan changed in a way the student did not want | Snooze, Done or an accepted proposal triggered a replan. | Tap **Undo** on the Plan updated card or the toast. |

## 6. Focus Mode

| What the student sees | Why | What to do |
|---|---|---|
| "Enter how much time is still needed, e.g. 0.5 for half an hour." | **Partly done** was chosen without saying what is left. | Enter the remaining time. |
| A session still open long after it started | The timer never ends a session by itself; only the student does. | End the session and say how it went. |
| Weekly progress did not go up after a session | Reporting that a task needs *more* time than estimated credits nothing; the plan grows instead. | Expected behaviour. |

## 7. Tasks and editing

| What the student sees | Why | What to do |
|---|---|---|
| "Add a task with a name, deadline and time needed." | A manual task is missing a required detail. | Fill in all three. |
| "Enter how much time is still needed." | Time needed was left empty when adjusting a task. | Enter a duration. |
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

## 9. Limits that can look like errors

- **SIKAD never moves a class, shift or commute.** If the plan seems not to adapt around one, that is by design; they show a lock and "Fixed".
- **Completing a task can add work to today.** Freed time lets the engine pull later work forward, so today's task total can grow.
- **During setup, the browser Back button leaves the page.** Use the on-screen Back button.
- **Past weeks in Overview are read-only.** They show what was done, missed or moved.
