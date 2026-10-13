# SIKAD — Design System & UI Specification

> **Status:** Final for implementation review. The rationale, evaluations and open questions are in [design-audit.md](design-audit.md).
> **Sources of truth:** [user_story.md](user_story.md) (product and UX), [prompt.md](prompt.md) (engine behaviour and output contracts), and the existing vanilla implementation in [js/](js/) and [css/](css/).
> **Stack constraint:** vanilla HTML, CSS and JS. All tokens are plain CSS custom properties in one `:root` block, plus one dark override. No frameworks, no build step, no npm packages.
> **Evidence labels:**
> - **Verified** means a WCAG 2.x contrast ratio I computed with a script.
> - **Judgment** means a design decision.
> - **Validate** means it must be checked during implementation.

---

## 1. Brand positioning

| | |
|---|---|
| **Name** | **SIKAD** (Meaning "kick", "pedal", or "forward momentum" in Filipino) |
| **Concept (internal)** | *Calm Momentum.* The name provides the energy; the interface provides the calm. Think of a bicycle: when life throws an obstacle or unexpected shift, you don't crash. You just adjust your path and keep pedaling (*sikad lang*). We reject toxic productivity. |
| **Tagline** | **Find your next move.** (Alternative campaign line: "Life changes. Just keep moving.") |
| **Support line** | Plan realistically. Focus on one thing. Adjust when life changes. |
| **Audience** | Filipino senior high school and college students juggling classes (FTF and online), commutes, and sometimes work or org duties. |
| **Promise** | At any moment you can see what's due, how much real time you have, whether it fits, and the one thing to do next, even after your plan breaks. |
| **Personality** | Grounded, honest, encouraging, quietly energetic. A thoughtful companion, not a coach, cheerleader or chatbot. |
| **Identity Beyond Colors**| SIKAD's identity extends beyond its palette. It relies on a consistent logo mark, a unified 2px-stroke icon style, a specific guilt-free microcopy voice, and unmistakable task states (e.g. fixed square vs flexible circle). |
| **Pitch Summary** | "We noticed every AI app today looks like a glowing spaceship and promises to do your homework for you. SIKAD is different. We built a grounded, tactile time-management engine that doesn't do the work for you—it just clears the path. Designed with a calm, paper-like aesthetic and a guilt-free replanning engine, SIKAD helps students find their momentum when life gets chaotic." |
| **It is not** | A chatbot, a tutor, an LMS, a wellness app, a gamified habit tracker, or a sports/hustle brand. |

### Voice and microcopy

- **Plain, specific and time-based.** Write "You have 3 hrs before your 2 PM class", not "Let's crush it!".
- **Honest about limits.** Write "This doesn't fit before Friday", not "Almost there!".
- **No judgment after a miss.** Write "Task carried over" or "Moved to Tue 9:30 AM", never "You missed your deadline!".
- **No diagnosis and no promised outcomes** (story §19).
- **The engine stays invisible** (story §23.8). Prefer "SIKAD moved…" or a passive "Moved to…" over "The AI decided…". Use the label **"AI estimate"** only where prompt.md sets `is_ai_estimate: true`.
- **No sparkle.** Drop ✨ and "magic" wording. "Find my next move" or "Adjust my plan" are better than "Generate AI Magic".
- **Keep sentences ≤ 20 words** on cards. Body text is English. Taglish microcopy is a pending decision (audit A6.5).

---

## 2. Design principles

1. **The next move first.** On any screen with a plan, the Focus Card or the current step is the most prominent element.
2. **Show the plan, not a conversation** (story §23.1). Use cards, timelines and chips. Paragraphs appear only in "Why this?" and clarifications.
3. **Protected looks protected.** Fixed commitments always carry a lock icon, a Harbor rail and a "Fixed" text label. Flexible tasks never use those.
4. **Uncertainty is visible.** Every AI estimate gets an "≈" prefix, a violet dashed underline and the text "AI estimate". Never colour alone.
5. **Each engine status has its own look.** `SUCCESS`, `CLARIFICATION_NEEDED`, `CONFLICT`, `INFEASIBLE` and `ERROR` each have a distinct icon, title, colour and primary action (§8).
6. **Changes are shown, not implied.** After a replan, every moved item states its before → after, and **Undo** is always offered.
7. **The student decides.** Anything that would touch a fixed commitment or a deadline is a choice the student makes, never a default.
8. **Calm density.** The design is information-dense where the student scans (timeline, tasks) and spacious where they decide (Focus Card, status cards).
9. **One primary action per view.** Only one Butter button is visible at a time.

---

## 3. Visual direction: "Grounded Path" (Analog-Digital Hybrid)

We are designing for an experience that feels like **high-end Japanese stationery (Muji, Midori planners) combined with elite modern software (Notion, Linear).**

- **A Planner, Not a Marketing Website:** Prioritize legibility, real scheduling information, and restrained surfaces. Completely avoid oversized hero sections, massive gradients, or decorative animations that distract from the student's actual schedule.
- **What we AVOID (The "AI Slop" Blacklist):** Glowing purple/blue gradients, dark space backgrounds, glassmorphism (heavy blurs), sparkle emojis (✨), or floating robot mascots.

The nature-editorial palette and typographic hierarchy, plus **one functional motif: the path.**

- **The day is a path.** The timeline rail is a continuous vertical line with nodes. Completed steps are filled. The current or next step is a Butter ring. Upcoming steps are hollow. Fixed commitments are square "posts" on the path (they don't move); flexible tasks are round "steps" (they can move).
- **The Focus Card is "your next step"** on that path. A small path glyph in its label ties the two together.
- **Replanning re-routes the path.** Moved steps briefly show a "moved" marker and their old time struck through. No decorative animation.
- **Editorial means hierarchy, not decoration:**
  - generous margins
  - a confident heading face
  - small-caps eyebrows
  - generous line height in reading text
  - no textures, gradients, glassmorphism or stock illustration
- **Nature means palette and restraint:** greens, paper, a single warm Butter accent (acting like a physical highlighter pen), and no leaf clip-art.

---

## 4. Typography

### 4.1 Families and loading

| Role | Family | Weights | Why |
|---|---|---|---|
| Headings, wordmark, Focus Card title | **Plus Jakarta Sans** | 600, 700 (800 only for the wordmark) | Warm, distinctive, Southeast Asian origin; pairs with the nature palette |
| Body, UI, labels, **all numbers** (times, durations, dates, timers) | **Inter** | 400, 500, 600 | Best small-size legibility, clear numerals, tabular figures |

Both fonts are under the SIL OFL 1.1. **Validate:** keep `OFL.txt` from each download in `/fonts/`.

**Self-host** variable or static WOFF2 files in `/fonts/`. This keeps the demo working offline, which matters on venue Wi-Fi, and avoids a third-party request. The trade-off is a one-time download and about 150–300 KB of files. A Google Fonts `<link>` is acceptable only as a temporary fallback during development.

```css
@font-face { font-family: "Inter"; src: url("../fonts/Inter-Variable.woff2") format("woff2"); font-weight: 400 700; font-display: swap; }
@font-face { font-family: "Plus Jakarta Sans"; src: url("../fonts/PlusJakartaSans-Variable.woff2") format("woff2"); font-weight: 600 800; font-display: swap; }

:root {
  --font-body: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --font-display: "Plus Jakarta Sans", "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; /* COR paste box and engine JSON only */
}
```

- Preload only the body font: `<link rel="preload" href="fonts/Inter-Variable.woff2" as="font" type="font/woff2" crossorigin>`.
- **Validate:** confirm the self-hosted Inter build supports `tnum`. Numbers are always set in Inter; never rely on `tnum` in Plus Jakarta Sans.

### 4.2 Type scale (mobile base, 16 px root)

| Token | Size / line height | Family · weight · tracking | Use |
|---|---|---|---|
| `--type-display` | 36 / 40 | Display · 800 · −0.03em | Welcome wordmark only |
| `--type-h1` | 26 / 32 | Display · 700 · −0.02em | Screen titles ("Hey, Alex", "Tasks") |
| `--type-h2` | 20 / 26 | Display · 700 · −0.01em | Focus Card title, sheet titles, status card titles |
| `--type-h3` | 16 / 22 | Display · 600 · 0 | Section heads, task card titles |
| `--type-body` | 15 / 22 | Body · 400 · 0 | Default text, "Why this?" |
| `--type-body-strong` | 15 / 22 | Body · 600 | Inline emphasis, button labels |
| `--type-small` | 13 / 18 | Body · 400–500 | Metadata, helper text |
| `--type-caption` | 12 / 16 | Body · 600 · +0.02em | Chips, timeline times, nav labels |
| `--type-eyebrow` | 12 / 16 | Body · 700 · +0.08em · UPPERCASE | "WHAT TO DO NEXT", "CHECK-IN", dates above titles |

- **Minimum text size is 12 px.** Never use 11 px; the current build has 11–11.5 px chips, so raise them.
- Body text inputs are 16 px to stop iOS zooming on focus.

### 4.3 Numeric and time styles

All of these use Inter with `font-variant-numeric: tabular-nums`:

| Style | Spec | Example |
|---|---|---|
| Time range | 15/22 · 600 | `10:15 AM – 12:15 PM`. Use an en dash with thin spaces, and always show AM/PM (12-hour time is the PH norm) |
| Timeline time label | 12/16 · 600 · `--ink-3` · right-aligned | `2 PM`, `10:15 AM` (drop `:00`) |
| Duration | 13/18 · 600 | `1.5 hrs`, `45 min`. An AI estimate is `≈ 2 hrs` plus the "AI estimate" label |
| Date | 13/18 · 500 | `Mon, Oct 12`. In headers, the eyebrow is `MONDAY, OCTOBER 12` |
| Relative day | Same as Date | `Today`, `Tomorrow`, then the weekday name within 6 days, then `Mon, Oct 19` |
| Focus timer | 32/36 · 600 · tabular | `24:05` |
| Capacity numbers | 15/22 · 700 | `6 hrs` of work · `53 hrs` free |

---

## 5. Colour

### 5.1 Brand palette

| Name | HEX | Role |
|---|---|---|
| Forest | `#294B3A` | Brand, Focus Card, progress fill, flexible rail, light focus ring |
| Ink | `#26332D` | Text, and labels on Butter. Feels like print on paper. |
| Paper | `#F7F5EC` | App background. Reduces eye strain, mimics physical notebook. |
| Butter | `#EBCB70` | The one primary action, the "next step" node, and AI recommendations (like a highlighter). |
| Sage | `#A8B99A` | Decorative tint only (light). Rails and progress on dark |
| Sky | `#B9D2DF` | Tint source for fixed and calendar surfaces |
| Harbor *(new)* | `#2F5468` | Fixed / protected and info: text, icons, rails |

### 5.2 Semantic tokens

This block replaces the `:root` block in `css/styles.css`.

```css
:root {
  /* surfaces */
  --bg: #F7F5EC;            /* Paper */
  --surface: #FFFDF7;       /* cards, sheets */
  --surface-2: #EFECE0;     /* sunken: segmented controls, inputs on cards, chips */
  --line: #DDD8C8;          /* decorative dividers only (not a component boundary) */
  --line-strong: #7F8A80;   /* input/checkbox borders, component boundaries */

  /* text */
  --ink: #26332D;
  --ink-2: #4A5750;         /* secondary text; REQUIRED for secondary text on any status tint */
  --ink-3: #5F6B64;         /* metadata on bg/surface/surface-2/sky/sage/warn/conflict tints only */
  --ink-disabled: #8B938D;  /* disabled controls (WCAG-exempt); always paired with not-allowed cursor + aria-disabled */

  /* brand & actions */
  --forest: #294B3A;
  --forest-hover: #22402F;
  --forest-pressed: #1B3428;
  --butter: #EBCB70;
  --butter-hover: #E0BC55;
  --butter-pressed: #CFA944;
  --butter-edge: #9A7A22;   /* 1px border on Butter buttons over light backgrounds */
  --on-butter: #26332D;
  --sage: #A8B99A;
  --sage-tint: #E6EDDE;     /* flexible-task surface, progress track */
  --sky: #B9D2DF;
  --sky-tint: #E3EEF3;      /* fixed-commitment surface, info surface */
  --harbor: #2F5468;        /* fixed/protected + info foreground */

  /* meaning */
  --estimate: #5B4A86;       --estimate-tint: #ECE8F4;   /* AI estimate (uncertain) */
  --warn: #7A5300;           --warn-tint: #FBF1D3;       /* CLARIFICATION_NEEDED, WARNING, needs-deadline, check-in */
  --conflict: #9A3F22;       --conflict-tint: #F8E5DC;   /* CONFLICT: decision needed */
  --critical: #9E2A2B;       --critical-tint: #F7E0DE;   /* INFEASIBLE, CRITICAL, ERROR, overdue */
  --success: #2E6B47;        --success-tint: #E2EFE0;    /* SUCCESS, done */
  --info: #2F5468;           --info-tint: #E3EEF3;       /* INFO */

  /* Focus Card (dark island on light theme) */
  --focus-bg: #294B3A;
  --focus-ink: #F7F5EC;
  --focus-muted: #C8D5C9;
  --focus-panel: #33594A;   /* "Why this?" panel inside the card */
  --focus-edge: #90A093;    /* on-dark button border (= Paper at 50% over Forest) */

  /* interaction */
  --ring: #294B3A;          /* focus ring on light */
  --ring-on-dark: #EBCB70;  /* focus ring on Forest/dark */
  --progress: #294B3A;
  --progress-track: #E6EDDE;
  color-scheme: light;
}

@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { /* same values as [data-theme="dark"] below */ } }
:root[data-theme="dark"] {
  --bg: #131917; --surface: #1B2320; --surface-2: #24302B; --line: #34413A; --line-strong: #6E7D74;
  --ink: #EDEBE1; --ink-2: #C2C8BE; --ink-3: #9BA59D; --ink-disabled: #6E7D74;
  --forest: #A8B99A; --forest-hover: #B7C6AA; --forest-pressed: #98AA8A;   /* brand accent becomes Sage on dark */
  --butter: #EBCB70; --butter-hover: #F0D486; --butter-pressed: #E0BC55; --butter-edge: #EBCB70; --on-butter: #26332D;
  --sage-tint: #22302A; --sky-tint: #1E2B32; --harbor: #A9CBDD;
  --estimate: #C9BDEB; --estimate-tint: #29253A;
  --warn: #F0C766;     --warn-tint: #2E2714;
  --conflict: #F2A98A; --conflict-tint: #33231C;
  --critical: #F4A3A0; --critical-tint: #36201F;
  --success: #A6D3A8;  --success-tint: #1D2E23;
  --info: #A9CBDD;     --info-tint: #1E2B32;
  --focus-bg: #22392D; --focus-ink: #F7F5EC; --focus-muted: #B9C9BC; --focus-panel: #2C4638; --focus-edge: #8C978C;
  --ring: #EBCB70; --ring-on-dark: #EBCB70;
  --progress: #A8B99A; --progress-track: #24302B;
  color-scheme: dark;
}
```

### 5.4 Meaning map (never by colour alone)

| Meaning | Colour | Required non-colour cue |
|---|---|---|
| Fixed / protected commitment | Harbor on Sky tint, Harbor rail | 🔒 lock icon, plus a "Fixed" or "Class · Face-to-face" label, plus a **square** path node |
| Flexible task | Forest rail on surface (Sage on dark) | **Round** path node, task icon, duration |
| One-time vs weekly | Inherits fixed styling | The text "One-time" or "Weekly" |
| AI estimate | Violet | "≈" prefix, a dashed underline on the duration, and the "AI estimate" text chip |
| Next / current step | Butter ring node, Focus Card | "Now" chip, the "WHAT TO DO NEXT" eyebrow |
| Done | Success (green) | ✓ icon, strikethrough title, filled node |
| Missed / check-in | Warn | ↺ icon, "Not marked done" text |
| Moved by a replan | Butter wash (transient) | "Moved" chip, old time struck through, before → after line |
| Clarification needed | Warn | ? icon, a question as the title |
| Conflict (two fixed items overlap) | Conflict / Clay | Overlap icon, "Decision needed" title, both items shown with locks |
| Infeasible / unscheduled | Critical / Brick | Hourglass icon, "Not enough time" title, required-vs-available numbers |
| Error | Critical | ⚠ icon, "Couldn't update your plan", plus "Your plan hasn't changed" |
| Priority (High / Med / Low) | **Neutral** (Ink on surface-2) | A three-bar glyph (▮▮▮ / ▮▮▯ / ▮▯▯) plus the word. **Never** red, amber or green |

---

## 6. Space, shape and depth

| Token | Value | Use |
|---|---|---|
| `--space-1…8` | 4, 8, 12, 16, 20, 24, 32, 40 px | 4-px base. 16 px is the screen gutter (required at phone width) |
| Card padding | 16 px (Focus Card 20 px) | |
| Stack gap | 12 px between cards, 24 px between sections | |
| `--radius-sm` | 8 px | Inputs, chips inside cards, small buttons |
| `--radius-md` | 12 px | Timeline blocks, list rows |
| `--radius-lg` | 16 px | Cards, status cards |
| `--radius-xl` | 24 px | Focus Card, bottom sheet top corners |
| `--radius-pill` | 999 px | Buttons, chips, segmented controls |
| Borders | 1 px `--line` (decorative); 1 px `--line-strong` (interactive boundaries); 4 px left rail on timeline blocks | |
| `--shadow-1` | `0 1px 2px rgb(38 51 45 / .06)` | Cards (optional; the border is primary) |
| `--shadow-2` | `0 8px 24px rgb(38 51 45 / .10)` | Focus Card, sheets, FAB, toast |

Depth comes mainly from the border plus a tint. Shadows are reserved for the Focus Card and overlays. No glassmorphism: the existing `backdrop-filter` blur on the clock bar and nav becomes a solid `--surface`.

---

## 7. Components

### 7.3 Focus Card (the most important component)

```
┌ --focus-bg (Forest) · radius-xl · shadow-2 · 20px padding ┐
│ ◦—● WHAT TO DO NEXT            (eyebrow, Butter, path glyph) │
│ Right now: IT 306D until 5 PM   (13px, --focus-muted)        │
│ Start Database Proposal         (h2, Display 700, --focus-ink)│
│ — Methodology                   (17px, Body 500)             │
│ Today · 10:15 AM – 11:45 AM · 1.5 hrs  (time style, tnum)     │
│ [IT 306D] [▮▮▮ High] [≈ AI estimate?] [Session 1/2]           │
│ Before that: 🔒 Work shift 6:30–10:30 PM  (if applicable)     │
│ ┌ --focus-panel · radius-md ┐                                │
│ │ Why this?  (600)  explanation, ≤ 3 sentences              │
│ └───────────────────────────┘                                │
│ [▶ Start task (Butter)] [✓ Done] [Snooze]                     │
└──────────────────────────────────────────────────────────────┘
```

- **In progress (Focus Mode Spotlight):**
  - When "Start Task" is clicked, the Focus Card expands using a smooth spring animation.
  - The rest of the screen (the timeline below) subtly dims with a backdrop overlay to create a "spotlight" effect on the task.
  - Eyebrow becomes "IN PROGRESS" with a static Butter dot.
  - Timer at 32 px tabular.
  - Actions: **Mark done** (Butter) and **Didn't finish / Stop Early** (on-dark).

### 7.4 Timeline ("the path")

- **Layout:** a 56 px time column (right-aligned, tabular), a 2 px path rail (`--line-strong` light / `--line-strong` dark) with 12 px nodes, then the block card.
- **Nodes:**

  | Node | Meaning |
  |---|---|
  | ■ Harbor square | Fixed |
  | ● Forest/Sage circle | Flexible, filled once done |
  | ◎ Butter ring | Current or next |
  | ○ hollow | Upcoming flexible |
  | dashed ○ | Free time |

---

## 8. Status and error states (engine → UI)

| Engine signal (prompt.md) | Title | Icon | Colour | Where | Primary action | Secondary |
|---|---|---|---|---|---|---|
| `status: SUCCESS` after a change | **Plan updated** | ✓ on path | Success | Top of Home (Plan-updated card) | Dismiss | **Undo** |
| `CLARIFICATION_NEEDED` / `clarification_needed` (missing deadline, ambiguous date, contradiction, vague input) | The question itself, e.g. **"When is the physics test?"** | ? | Warn | Inline in the review card that needs it; Home shows "Needs a deadline" | Answer control (date or chips) | "Keep as is" where it applies |
| `CONFLICT` (overlaps a fixed commitment) | **Decision needed** | Two overlapping squares | Conflict / Clay | Inline in the review sheet, blocking Apply | Radio group: "Keep IT 306D" / "Go to Group study instead" / "Keep both" | Explanation: "SIKAD never skips a class or shift on its own." |
| `INFEASIBLE` + `unscheduled_tasks` | **Not enough time** | Hourglass | Critical / Brick | Home, below the Focus Card | "Review options", which expands the triage list | Per task: "Adjust" |
| `ERROR` | **Couldn't update your plan** | ⚠ | Critical | Toast plus inline at the trigger | "Try again" | Body text: "Your plan hasn't changed." |

---

## 9. Motion and interaction (Tactile Motion)

To make SIKAD feel premium, motion must feel **tactile, physical, and snappy**.

- **Durations:** 120 ms for micro interactions (press, toggle), 200 ms for entrances (sheet, card), and 1,200 ms for the "moved" highlight fade. 
- **Easing:** Use premium easing curves `cubic-bezier(.2,.7,.2,1)` (ease-out) for entering and `ease-in` for leaving. Do not use slow linear fades.
- **Signature Interactions:**
  - **Replanning (The Shuffle):** When the AI recalculates a schedule (e.g. after tapping Snooze), do not use a standard spinning loading wheel. Animate the task cards physically sliding and snapping into their new slots on the timeline, like sorting a deck of cards. 
  - **Completion (The Satisfaction):** Checking off a task should feel instantly rewarding. Use a crisp interaction—like a strike-through line animating across the title, a subtle scale-down ("press") on the button, or a satisfying fade to a muted state.
- **Not allowed:** Looping decorative animation, parallax, confetti, streak bursts, or animated gradients.
- **Reduced motion:** `@media (prefers-reduced-motion: reduce)` removes all transforms and animations. The Butter wash becomes a static "Moved" chip; nothing is lost.

---

## 10. Iconography and illustration

- **One icon set:** 24 px grid, 1.75 px stroke, round caps and joins, `currentColor`, inline SVG. This matches the existing nav icons.
- **Emoji:** None in system UI. Replace all emojis with clean 2px SVG icons.
- **Logo:** An abstract mark showing a short curved path with a dot ahead of it (the "next move"), in Forest with a Butter dot. It represents adjusting around obstacles but maintaining momentum.

---

## 11. Responsive, PWA, and Accessibility Guidance

**Layout & PWA (Progressive Web App):**
- **Mobile & Installable First:** SIKAD is designed to be a PWA installable from Chrome to a phone's home screen. The layout must be fluidly responsive and feel like a native app.
- **Phones are primary:** 320–480 px, single column, 16 px gutters, absolutely no horizontal scroll. Must use `env(safe-area-inset-bottom)` and `env(safe-area-inset-top)` on the nav and bottom sheets to accommodate phone notches and home bars. Mobile (<768px) remains a single column.
- **Responsive Layout:**
  - **< 768 px (Mobile):** Single column, centered mobile container, and a floating **pill navigation** anchored 12 px above the bottom safe area (`--surface`, `--line` border, `--radius-pill`, `--shadow-2`). Inactive destinations are 48 px icon targets (44 px under 360 px); the active one opens to show its label on a `--sage-tint` fill with `--forest` text. Ask SIKAD is the Forest circle in the middle.
  - **Ask SIKAD entry:** tapping it opens a small panel attached to the nav with two choices, **Speak or type** and **Form**. Both lead into the same sheet and the same review → confirm → replan flow; the tabs inside the sheet switch between them and both drafts are kept. Close with ✕, the scrim, Escape, or the Ask button again.
  - **Feedback:** success and Undo use one toast above the pill; destructive actions (remove task, erase data, replace with the sample week) ask first in a bottom sheet with Cancel + a `--critical` outlined action. Native browser dialogs are not used.
  - **Time:** every date and time shown comes from the device clock and timezone. No simulated clock exists outside the automated tests.
  - **Motion tools:** native CSS and the Web Animations API only; no animation library (see motion-spec.md §3).
  - **≥ 768 px (Tablet/Desktop):** Left side rail (~208px) replaces the bottom nav. It is pinned to the viewport's left edge, full height, with a right border only. Logo, navigation buttons, and the Ask SIKAD button live in the rail; bottom navigation padding removed; bottom sheets and modals max ~520px, centered.
  - **≥ 1024 px (Wide Desktop):** Two-column layouts for Home (left: Focus Card + This week; right: Timeline), Overview (left: week progress + day strip; right: the selected day) and Profile (left: Class schedule, limits; right: Your day, commitments, Appearance, integrations). Columns keep their own height (`align-items: start`).
  - **Fluid, not boxed:** the page background is the same everywhere. No outer container border, shadow, radius or different surface around the app. The main area fills the width left of the rail with `padding-inline: clamp(24px, 4vw, 64px)`; content is centered within it up to ~1400px.

**Accessibility (WCAG 2.2 AA):**
- **Focus visible:** a 2 px ring with 2 px offset on every interactive element.
- **Focus not obscured (2.4.11):** set `scroll-padding-top: 64px; scroll-padding-bottom: 104px` on `html` so sticky bars never cover focused fields.
- **Target size:** 44 px for primary targets, ≥ 24 px absolute minimum.

---

## 12. Screen specifications

1. **Welcome**
   - **Goal:** set expectations and capture a name.
   - **Hierarchy:** logo mark → wordmark (display) → tagline "Find your next move." (h2, `--ink-2`) → the line "See what you can realistically get done with the time you actually have." → name field → **Get started** (Butter) → demo link.
2. **Dashboard and Focus Card (Home)**
   - **Goal:** answer "what now?" at a glance.
   - **Hierarchy (fixed order):**
     1. eyebrow date plus h1 greeting
     2. **Plan updated** (if any)
     3. **check-ins**
     4. **Focus Card**
     5. blocking status (Not enough time / Needs a deadline / warnings)
     6. "Today": remaining task time today, "3 of 5 tasks completed" with a bar, and a "View schedule →" link that brings today's timeline into view
     7. "Weekly task progress": percent and bar of planned task time completed ("13 hrs completed of 15 hrs 15 min planned", then time left · sessions), with the Fits verdict on its own row beside "View weekly overview →"
     8. timeline (Today / Tomorrow segmented control)
   - **Primary action:** the Focus Card's Butter button (the only Butter on screen).
3. **Daily timeline and task list**
   - **Timeline:** §7.4 (Home and Overview).
   - **Tasks tab:** h1 "Tasks" with a plain count line → secondary "+ Add a task manually" → groups.
   - **Eyebrows** are for dates/times and "WHAT TO DO NEXT" only. Tasks, Overview and Profile headers have none.
   - **Theme:** a one-tap Light/Dark pill sits in the header on Welcome, every setup step and Home. Profile has the full Light / Dark / System row. Both use the same saved choice.
   - **Navigation:** the centre action is labelled "Ask SIKAD" (it opens the brain-dump sheet).
4. **Overview**
   - **Header:** h1 "Overview", then ‹ week label ("Oct 5–11") › and a "This week" button when away from the current week. Weeks run Monday to Sunday.
   - **Progress card on every week:** current and future weeks show "Weekly summary", three stacked metrics (Your time budget, Tasks remaining, Time needed); past weeks show "Done vs. planned" with missed and moved counts.
   - **Past days** list fixed commitments plus what was planned, each with a Done, Missed or Moved chip (icon + word, §5.4).

---

## 13. Rules for preserving existing UX and AI behaviour

The redesign is **visual and copy only.** The implementation pass must not:
1. Change any prompt.md contract or the engine's logic.
2. Add gamification (streaks, points, badges) or "magic" AI styling.
3. Turn Brain Dump into a chat transcript.

---

## 14. Copy changes required by this spec

| Current | New |
|---|---|
| "Tempo" (all user-facing strings) | "SIKAD" |
| "Figure out what you can realistically accomplish…" | Tagline "Find your next move." plus "See what you can realistically get done with the time you actually have." |
| "Generate my schedule ✨" | "Generate my schedule" |
| "⚡ What to do next" | "WHAT TO DO NEXT" (path glyph) |
| "💡 Why this?" | "Why this?" |
| "📋 Plan updated" | "Plan updated" (check icon) |

---

## 15. Phase D — Implementation handoff

### 15.1 Files to update
`css/styles.css`, `index.html`, `js/app.js`, `README.md`, `fonts/`.
Do not change engine behavior.
