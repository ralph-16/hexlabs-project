# SIKAD — Motion Specification

> **Source of truth:** [design.md §9](prompts/prompt-2/design.md) (Tactile Motion) and §7.3 (Focus Mode Spotlight). This file expands those rules into something that can be built and checked. Where it adds a value design.md does not give, the row is marked **added**.
> **Implementation:** [js/motion.js](js/motion.js) (FLIP, enters, exits), [js/app.js](js/app.js) (`render()`, `settle()`, toast and sheet handling), [css/styles.css](css/styles.css) (tokens, keyframes, reduced motion).

---

## 1. Principles

1. **Motion reports state; it never predicts it.** The store is changed and saved first. Every animation runs on the result. If an action throws, nothing animates and the ERROR card appears.
2. **Tactile, physical, snappy.** Things press in, slide to a slot and stop. Nothing drifts or fades slowly.
3. **Show where it went.** After a replan the same card travels to its new slot, so the student sees the change instead of reading about it.
4. **One thing moves for one reason.** No looping, parallax, confetti, streak bursts or animated gradients.
5. **Nothing is lost without motion.** Every animated cue has a static twin (chip, struck-through time, text label).

## 2. Tokens

| Token | Value | Source | Use |
|---|---|---|---|
| `--dur-micro` | 120 ms | design.md | Press, toggle, toast and ghost exits |
| `--dur-enter` | 200 ms | design.md | Sheet, card, toast and view entrances; spotlight dim |
| `--dur-exit` | 160 ms | **added** | Sheet close |
| `--dur-strike` | 240 ms | **added** | Completion strikethrough |
| `--dur-move` | 360 ms | **added** | The Shuffle (cards changing slots) |
| `--dur-spring` | 420 ms | **added** | Focus Card expand / collapse |
| `--dur-wash` | 1200 ms | design.md | "Moved" Butter wash fade |
| `--ease-out` | `cubic-bezier(.2,.7,.2,1)` | design.md | Everything that enters |
| `--ease-in` | `ease-in` | design.md | Everything that leaves |
| `--ease-snap` | `cubic-bezier(.3,1.25,.5,1)` | **added** | The Shuffle: small overshoot, then settle |
| `--ease-spring` | `cubic-bezier(.34,1.4,.64,1)` | **added** | Focus Card spring; toast entrance; active nav icon settle. Success feedback only, never on exits |

**Deviations from design.md.** design.md names three durations (120 / 200 / 1,200 ms) and asks for a "smooth spring" and cards that "slide and snap", without timing them. A 200 ms slide across several rows reads as a jump, so travel gets its own 360 ms token and the spring 420 ms. No design.md value is changed.

## 3. Technology

**Native CSS transitions/keyframes plus the Web Animations API. GSAP, anime.js and Animate.css were evaluated (prompt 8) and not added.**

| Tool | Decision | Reason |
|---|---|---|
| CSS transitions / keyframes | **Kept** | Nav pill, Ask menu, sheets, toasts, press states. State lives in classes, so interruption is free. |
| Web Animations API (`js/motion.js`) | **Kept** | The Shuffle (FLIP), strike, Focus Card spring. One `cancelAll()` per render. |
| GSAP | Rejected | CLAUDE.md forbids libraries. Its timelines persist across frames, but every render here discards its elements. ~70 KB vendored for sequences that are two steps long. |
| anime.js | Rejected | Same rule. Stagger and spring are covered by `animation-delay` and `--ease-spring`. |
| Animate.css | Rejected | Same rule. Its presets (bounce, flip, zoom) are louder than "Calm Momentum" and ignore our tokens. |

- The Shuffle is a FLIP: measure, re-render, measure, play the difference as a transform. `Element.animate()` does this in about 150 lines.
- The app rebuilds its HTML on every render. Animations therefore live for one render and are discarded with their elements. GSAP's timelines and persistent tweens solve a problem this architecture does not have.
- No dependency keeps the demo offline-safe (design.md §4.1) and the stack "no frameworks, no build step, no npm packages" (design.md header).
- Revisit if motion ever needs scrubbing, drag-to-reorder or long sequenced timelines.

## 4. How it works

`render()` does, in order: capture rects of every `[data-flip]` element → rebuild HTML → `Motion.play()`.

| Attribute | Meaning |
|---|---|
| `data-flip="key"` | Same key before and after: slide from the old rect to the new one. New key: enter. |
| `data-flip-exit` | Key gone after the render: the old element is shown once more as a non-interactive ghost that leaves. |
| `data-enter="key"` | Enter only (content inside the Focus Card). |

Keys are stable ids from real data: `s:<session id>` for a planned session and for the history row it becomes, `f:<commitment id>:<start>` for fixed items, `t:<task id>` for task cards.

**View changes** (tab, Focus-only, onboarding step) do not FLIP. The new view enters as one unit.

## 5. Interactions

### 5.1 Replanning — The Shuffle

| | |
|---|---|
| **Trigger** | Any render after the plan changed: Snooze, Done, a focus-session outcome, Accept changes, Save task, deadline set, cancel a commitment, demo clock, Undo. |
| **Initial** | Each timeline row at the position it had before the replan. |
| **Final** | Each row in its new slot. Moved sessions carry the "Moved" chip and `was <old time> →`. |
| **Sequence** | 1. Rows slide: `transform` only, 360 ms, `--ease-snap`. Rows moved by the engine are staggered 30 ms apart (max 5 steps) and ride above their neighbours. 2. Rows that left the visible day (moved to another day, removed) exit as ghosts: 16 px to the right + fade, 120 ms, `ease-in`. 3. New rows enter: 8 px rise + fade, 200 ms, `--ease-out`. 4. Butter wash on moved cards: starts at 360 ms, fades over 1,200 ms, `ease-in`. Plays once per plan update. |
| **Loading** | None. The engine is synchronous; no spinner is shown. |
| **Undo** | The same Shuffle runs in reverse on the restored plan. |
| **Interruption** | A new render mid-flight measures cards where they visually are and starts from there. |
| **Reduced motion** | Rows appear in place. "Moved" chip and struck-through old time remain. |

### 5.2 Task completion — The Satisfaction

| | |
|---|---|
| **Trigger** | Done on the Focus Card; "Mark done" or "Yes, it's complete" in a session. |
| **Sequence** | 1. Button press: `scale(.98)`, 120 ms. 2. The store completes the session and saves. 3. A line draws across the title (and part) on the Focus Card and across the matching timeline row: 240 ms, `--ease-out`. The row's node fills green and its card mutes over 200 ms. 4. At 320 ms the view re-renders: the row is now a Done row, the next task enters on the Focus Card, later rows Shuffle. 5. Toast with Undo. |
| **Failure** | If the store throws at step 2, steps 3–5 never run. The ERROR card and toast show instead. |
| **Interruption** | Any tap during the 320 ms window renders immediately. The tap is dropped if its control no longer exists. Focus Card actions are non-interactive during the window. |
| **Reduced motion** | Step 3 is skipped; the render is immediate. Done rows keep icon, "Done" text and strikethrough. |

Completing from the task sheet or a check-in card has no title to strike on screen: the card exits as a ghost and the list reflows.

### 5.3 Focus Mode — The Spotlight

| | |
|---|---|
| **Trigger** | "Start task" (working-method picker) and "Start session". |
| **Expand** | The card's background grows from its old height to the new one: 420 ms, `--ease-spring`. Content below slides with the same curve. New content inside rises 8 px and fades in, 200 ms, 80 ms delay. |
| **In view** | If the expanded card would run off screen, the page scrolls its top to just under the clock bar (smooth; instant with reduced motion). |
| **Dim** | A scrim (`rgb(19 25 23 / .32)`, `.5` on dark) fades in over everything except the Focus Card: 200 ms, `--ease-out`. No blur. |
| **In progress** | Eyebrow "IN PROGRESS" with a **static** Butter dot. Timer 32 px tabular, updated once a second as text only. |
| **Actions** | Running: **Mark done** (Butter), Pause, Stop early. Paused: **Resume** (Butter), Mark done, Stop early. Stop early asks the existing "Is this piece of work complete?" question. |
| **Exit without losing progress** | Tap the scrim, press Escape, or use "Show my plan" on the card. The scrim fades out (160 ms, `ease-in`); the session and timer keep running. "Dim everything else" turns it back on. Leaving the Home tab also removes the scrim. |
| **End** | Any outcome ends the session through the existing store calls; the card collapses with the same spring and the scrim fades out. |
| **Timer** | Unchanged: real elapsed time in the store. It survives refresh, tab changes and spotlight exit. |
| **Reduced motion** | The card and scrim change instantly. |

### 5.5 Feedback: toast, confirm sheet, Undo

| Interaction | Trigger | Motion | Leaves | Interrupt / cleanup |
|---|---|---|---|---|
| Toast | Any saved action | Rises 12 px + fades in, 240 ms `--ease-spring`. Sits above the nav pill and the safe area. | Sinks 8 px + fades, 120 ms `--ease-in` | One toast node at a time; a new message replaces it. Stays ≥ 5.2 s, longer while hovered or focused. Hidden while a sheet or the Ask menu is open. |
| Confirm sheet | Remove task, erase data, load sample week | Same sheet rise as every sheet (200 ms). When it replaces an open sheet the content swaps with no second rise. | Sheet sink, 160 ms | Cancel, ✕, backdrop and Escape all return to the previous sheet with nothing changed. |
| Undo | Toast button | No motion of its own: the restored plan plays the Shuffle back. | — | Restores the single snapshot taken before the action, then re-reads the clock. One Undo surface (the toast). |

### 5.6 Nav pill and Ask SIKAD menu

| Interaction | Trigger | Motion | Leaves | Interrupt / cleanup |
|---|---|---|---|---|
| Active nav item (< 768 px) | Tap a destination | Label track opens `0fr → 1fr` + 6 px gap, 360 ms `--ease-out`; label fades in 200 ms; tint and colour 200 ms; icon settles to `scale(1.06)` with `--ease-spring`. The previous item collapses on the same clock. Only the fixed pill lays out; the page never moves. | — | Render rebuilds the nav in its previous state with transitions off, then releases it. A second tap mid-transition starts again from the last committed tab. Tapping the current tab only scrolls to top. |
| Ask menu open | Tap Ask SIKAD | Scrim fades 200 ms. Panel scales `.94 → 1` and rises 8 px from the Ask button's centre (`--ask-x`), 200 ms `--ease-out`. The two options rise 6 px, staggered 40 ms. Icon swaps to ✕ with a 200 ms scale-in. | Panel `scale(.96)` + fade, scrim fade, 160 ms `--ease-in` | Leaving nodes are inert and removed on `animationend` (timeout fallback). Choosing a mode skips the exit: the sheet rise takes over. |
| Ask menu, ≥ 768 px | Same | Opens in place under the rail button; same fade/scale, no dimming scrim. | Same | Same |
| Mode switch inside the sheet | "Speak or type" / "Form" tabs | Press feedback, then content swap. Title changes ("Ask SIKAD" / "Add a task"). | — | Both drafts are kept in memory until sent, saved or erased. |

Reduced motion: the pill and menu change state instantly; scrim, tint, label and ✕ still show the state.

### 5.4 Other interactions

| Interaction | Trigger | Motion | Leaves |
|---|---|---|---|
| Buttons, chips, nav, cards | Press | `scale(.98)` buttons, `.97` other targets, 120 ms | Springs back, 120 ms |
| Segmented controls, tabs | Tap | Press, then state swap | — |
| Bottom sheet | Open | Backdrop fade + sheet rises 24 px, 200 ms, `--ease-out`. Plays on open only, not on re-renders inside the sheet. | Slides down 24 px + fade, 160 ms, `ease-in` |
| Toast | Shown | 12 px rise + fade, 200 ms. Not replayed by unrelated renders. | Fade + 8 px drop, 120 ms, `ease-in` |
| Plan-updated card | New update | Enter, 200 ms | Ghost exit on dismiss or Undo |
| Snooze | Tap | Press → Shuffle (5.1). The next task enters on the Focus Card. | — |
| Clarification, conflict, infeasible, error cards | Engine status | Enter, 200 ms. No shake, no pulse. | Ghost exit when resolved |
| Field error | Validation | 4 px rise + fade, 120 ms | — |
| First plan ("Building your plan") | Onboarding | Step marks fill one at a time; the current step is a static Butter mark. No spinner. | — |
| Weekly progress bar | Work credited | Width grows from the previous percent, 600 ms, `--ease-out` | — |
| Theme toggle | Tap | Colours cross-fade, 200 ms | — |
| View change | Tab, Focus-only, onboarding step | 6 px rise + fade on the view, 200 ms | — |
| Recording dot | While recording | Blink (functional: the mic is live). The only loop in the app. | Stops with the recording |

## 6. Rapid actions and overlap

- Each element has at most one FLIP animation. `Motion.play()` cancels what it started before.
- Ghosts are removed when their animation finishes or on the next render, whichever is first.
- The completion window (5.2) is the only deferred render. Any click, Back navigation or timer-driven render flushes it.
- The Butter wash plays for a new plan update only, tracked by the update's trigger, time and changes.

## 7. State sync and cleanup

- State is saved before any animation that delays a render.
- Nothing in the motion layer reads or writes the store.
- No listeners are added per render. Sheet and toast exits use one `animationend` listener with `{ once: true }` plus a timeout fallback.
- Animations use `transform`, `opacity` and (wash, strike) paint-only properties. The Focus Card's growing background is an absolutely positioned pseudo-element, so it does not reflow the page.
- Rows that are off-screen before and after are not animated.

## 8. Reduced motion

`prefers-reduced-motion: reduce` is checked on every call, so changing the OS setting applies without a reload.

- CSS: all animations and transitions are removed.
- JS: `Motion.play()` returns before animating; `settle()` renders immediately; ghosts are not created.
- Kept: Moved chip, old → new time, Done icon and text, status card icons and titles, the scrim (as an instant state).

## 9. Mobile and accessibility

- Focus handling is unchanged: the render restores focus to the same control, sheet title or view heading.
- Ghosts are `aria-hidden`, `inert` and ignore pointer events.
- The scrim is `aria-hidden`. Keyboard and screen-reader users reach everything as before and can leave with Escape or the on-card button.
- Live regions (`role="status"` on the toast and Plan-updated card, `role="alert"` on errors) are not delayed by motion, except the completion toast (320 ms).
- No animation changes layout size, so nothing can cause horizontal scroll.

## 10. Acceptance criteria

| # | Check |
|---|---|
| 1 | Snooze: a timeline row with the same session id ends at a new position and had a non-zero transform at the start. No spinner appears. |
| 2 | After Snooze, moved rows show the "Moved" chip and the old time struck through. Undo restores the previous plan. |
| 3 | Done: the title has the strike class before the render; after it, the session is in history and the Done row keeps its place. |
| 4 | Done when the store throws: no strike, ERROR card shown, plan unchanged. |
| 5 | Start task → Start session: `body.spotlight` is set and the timer counts. Tapping the scrim clears `body.spotlight` while `state.active` is unchanged. |
| 6 | Re-rendering inside an open sheet does not replay its entrance. Closing leaves no node in `#sheet-root` after 400 ms. |
| 7 | A toast is the same DOM node across unrelated renders. |
| 8 | Two Snoozes 50 ms apart leave no ghosts and no running animations after 2 s. |
| 9 | With reduced motion: zero running animations after any action; all information still present. |
| 10 | At 320 px and 390 px wide: `scrollWidth` equals `clientWidth` during and after every interaction. |
| 11 | No console errors or warnings. |
