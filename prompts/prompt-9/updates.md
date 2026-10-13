# Task: Refine Home and Overview — Daily Workload, Weekly Progress, and Weekly Planning

Update the existing SIKAD application to improve how students understand their daily workload, weekly progress, and remaining time. Implement the specified Home and Overview changes together, using the existing architecture and design system.

This is a targeted refinement of the existing application, not a redesign. Preserve existing functionality outside the requested changes.

## 1. Inspect the Project Before Implementing

Before modifying any files:

1. Inspect the project structure, entry points, page rendering, navigation, task data model, state management, scheduling logic, and existing UI components.
2. Read `design.md` and `motion-spec.md` completely. Treat them as the source of truth for the visual design, component styling, interaction patterns, animation timing, and reduced-motion behavior.
3. Inspect the relevant installed skills and follow their instructions where applicable.

Use the appropriate installed skills:
- `frontend-design` for consistent, polished interface implementation.
- `ui-ux-pro-max` for information hierarchy, usability, responsive behavior, accessibility, and interaction patterns.
- `make-interfaces-feel-better` for component polish, typography, transitions, and micro-interactions.
- `motion-design` for purposeful animation design consistent with the project's motion specification.

Use `design-taste-frontend` only if its guidance is applicable to this dashboard task; do not apply landing-page or portfolio conventions that conflict with the existing product.

Inspect existing implementations and reuse them instead of creating duplicate components or calculation logic. Determine the project's actual technology stack before making implementation decisions.

## 2. Home Page Changes

### 2.1 Preserve “What to Do Next” Completely

The existing **What to Do Next** task card must remain completely unchanged.

Do not modify its:
- Content or recommendation logic.
- Layout, dimensions, spacing, or styling.
- Start Task, Done, or Snooze buttons.
- Interactions, animations, or behavior.

The existing card must remain the primary visual focus of Home.

### 2.2 Add a “Today” Summary Card

Add a compact **Today** card directly below What to Do Next and above the weekly progress card.

Purpose: help students understand how much task work remains for the current day without opening the full timeline.

Display:

- **Title:** Today
- **Primary metric:** Remaining estimated task time, such as `2.3 hrs remaining`.
- **Supporting text:** “Time needed for your remaining tasks today.”
- **Secondary metric:** Completed tasks out of today's total, if reliable data is available, such as `3 of 5 tasks completed`.
- **Progress bar:** A compact indicator representing the proportion of today's tasks completed.
- **Link:** `View schedule →`

Use actual application data. Do not hardcode example values.

#### Calculation rules

- Calculate remaining task time from unfinished tasks assigned to today, using their remaining estimated durations.
- Exclude completed tasks and fixed commitments such as classes and commutes.
- Calculate the task-completion progress from actual task statuses.
- Update the card when tasks are completed, added, removed, or rescheduled.
- Do not count a completed task's original duration as remaining work.
- If no tasks remain, display “All tasks completed for today!” rather than a misleading warning.
- If the necessary data is unavailable, avoid displaying invented values.

#### “View schedule →” behavior

When tapped:
1. Navigate to the existing Home page if necessary.
2. Select today's timeline, even if another day was previously selected.
3. Bring the existing daily timeline into view so the student can see today's classes, commitments, and tasks.
4. Reuse the existing timeline and navigation functionality. Do not create a separate schedule page.

If the user is already on Home, simply bring today's timeline into view.

### 2.3 Refine the Existing Weekly Progress Card

Keep the existing weekly card below Today.

Change its title from **“This week”** to **“Weekly task progress”** to make its purpose immediately clear.

Preserve its existing visual style, progress bar, percentage calculation, and compact layout.

Display the following information using actual calculated values:

- **Title:** Weekly task progress
- **Percentage:** Proportion of planned task time completed.
- **Supporting text:** Completed task time relative to total planned task time.
- **Optional secondary text:** Remaining planned task time.

Example format:

`85%`

`13 hrs completed of 15 hrs 15 min planned`

`2 hrs 15 min of planned task time left`

These are examples only. Never hardcode these values.

#### Weekly progress calculation

The percentage must represent:

Completed planned task time ÷ Total planned task time × 100.

Use the same data scope for the percentage, completed hours, and total planned hours.

Do not substitute task count completion, free time, or available hours for task-time completion.

Inspect the existing calculation first. Preserve it if it is correct; only fix it if the displayed metric and actual calculation disagree.

#### Preserve the “Fits” indicator

Retain the existing **Fits** indicator when the scheduling logic confirms that the remaining workload can realistically fit into usable time before its deadlines.

- Do not remove an existing meaningful indicator.
- Do not determine feasibility solely by comparing total available hours with total task hours.
- Account for deadlines, fixed commitments, and scheduling conflicts where supported by the existing scheduling engine.
- If the workload does not fit, use the existing appropriate warning or status.
- Do not create an unrelated status system.

Keep Fits visually separate from the completion percentage and progress bar. It communicates scheduling feasibility, not task completion.

#### Add “View weekly overview →”

Add a subtle secondary link inside the weekly progress card.

When tapped:
1. Navigate to the existing Overview page.
2. Show the current week's summary and daily breakdown.
3. Preserve the existing week navigation and selected-day behavior.
4. Reuse the existing Overview page rather than creating a duplicate.

### 2.4 Home Page Hierarchy

Preserve this order:

1. Header: date, greeting, and theme toggle.
2. What to Do Next: existing card, completely unchanged.
3. Today: remaining task hours, completion progress, and View schedule.
4. Weekly task progress: weekly completion percentage, completed-versus-planned time, conditional Fits indicator, and View weekly overview.
5. Existing bottom navigation.

Keep Today and Weekly task progress visually secondary to What to Do Next. Optimize the hierarchy for mobile while preserving the existing desktop layout.

## 3. Overview Page Changes

Modify only the existing weekly summary card and its daily-breakdown caption. Everything else on Overview must remain unchanged.

### 3.1 Replace “Available vs. required” with “Weekly summary”

Remove the current **Available vs. required** summary card, including its old progress bar, explanatory sentence, and associated Fits badge.

Replace it with a vertically organized **Weekly summary** section containing three metrics in this exact order:

#### A. Your time budget

**Label:** Your time budget

**Primary value:** Total number of hours available for task work this week, after accounting for fixed commitments.

**Supporting text:** “Total usable time for tasks this week.”

Calculation:
- Account for classes, commutes, and other fixed commitments.
- Include usable time that is already scheduled for tasks as well as usable time that has not yet been scheduled.
- Exclude fixed commitments from the available-time total.
- Do not label this metric as unallocated or unscheduled time; it represents total usable capacity for task work.

#### B. Tasks remaining

**Label:** Tasks remaining

**Primary value:** Number of unfinished tasks out of the total tasks in the selected week.

Example: `21 of 25`

**Supporting text:** “4 tasks completed this week.”

Calculation:
- Use actual task statuses.
- Count completed and unfinished tasks consistently.
- Use the selected week's scope, including overdue unfinished tasks where appropriate to the existing scheduling model.
- Do not hardcode example values.

#### C. Time needed

**Label:** Time needed

**Primary value:** Estimated time required to finish all remaining tasks in the selected week.

Example: `30 hrs`

**Supporting text:** “Estimated time to finish remaining tasks.”

Calculation:
- Sum the remaining estimated duration of unfinished tasks in the selected week.
- Exclude completed work.
- Update the value when tasks are completed, added, removed, rescheduled, or have their remaining duration changed.
- Avoid double-counting tasks or counting fixed commitments as task time.

All example values above are illustrative. Derive the displayed values from the application's real data and existing scheduling model.

### 3.2 Weekly summary layout and hierarchy

The three metrics must be displayed **vertically, one below another**, following the visual hierarchy of the provided reference image.

Do not arrange the three metrics as three side-by-side cards or a horizontal row.

Use this order:

1. Weekly summary heading.
2. Your time budget.
3. Tasks remaining.
4. Time needed.

Each metric should have:
- A clear, readable label.
- A prominent primary value.
- A smaller supporting description.
- An appropriate existing icon, if consistent with the project's icon system.

Use restrained dividers or spacing to distinguish the three metrics. Keep the hierarchy clear without making the section unnecessarily tall.

Follow the existing SIKAD visual design, including its paper-like surfaces, Forest green, warm Butter accents, established typography, and semantic color tokens. The reference image establishes the vertical information hierarchy; it does not authorize introducing a new black dashboard theme or replacing the existing palette.

Preserve dark mode by using the existing semantic theme tokens rather than hardcoded surface colors.

### 3.3 Preserve the daily breakdown

Do not redesign or otherwise modify the existing daily breakdown.

Keep:
- Week navigation and date range.
- Seven daily cards, Monday through Sunday.
- Today and selected-day highlighting.
- Daily progress bars and hour labels.
- Selected day's timeline.
- Existing interactions, layout, and responsive behavior.

The daily cards must continue displaying the remaining estimated task time scheduled for each day.

Completing a task must reduce the remaining task time for the relevant day. Preserve the existing selected-day behavior and timeline navigation.

### 3.4 Change only the explanatory caption

Replace the existing caption:

“Bar and hours = time planned for tasks that day.”

With exactly:

**“Bars show the time needed for your remaining tasks each day.”**

Keep the caption in the same position and preserve its existing typography, color, and spacing.

Do not add another explanation or duplicate caption.

## 4. Data Consistency Across Both Pages

Home and Overview must use consistent underlying task data, completion statuses, and remaining-duration calculations.

However, their metrics serve different purposes:

- **Home — Today:** Remaining task duration and completion progress for today.
- **Home — Weekly task progress:** Completed planned task time divided by total planned task time.
- **Overview — Your time budget:** Total usable time for task work after fixed commitments, including time already scheduled for tasks.
- **Overview — Tasks remaining:** Unfinished task count relative to total tasks in the selected week.
- **Overview — Time needed:** Remaining estimated task duration for the selected week.
- **Overview — Daily bars:** Remaining estimated task duration assigned to each day.

Do not conflate total usable capacity, unscheduled time, scheduled task time, completed work, or remaining work. Your time budget includes task time already scheduled; do not subtract that scheduled time from the total budget. When comparing capacity with remaining workload or evaluating feasibility, compare the remaining task duration against usable time that is actually available before each deadline, accounting for commitments and existing task allocations so the same time is not counted twice.

When a task is completed, added, removed, or rescheduled, update all affected metrics consistently. Preserve the existing scheduling engine and data architecture wherever possible.

Do not introduce invented availability, estimated durations, or task counts to make the interface look complete. If a calculation cannot be supported by existing data, inspect the model and implement the smallest appropriate correction without fabricating values.

## 5. Design Consistency and Motion

Read and follow `design.md` and `motion-spec.md` as the project's design and motion source of truth.

Use the relevant installed skills to support the implementation, but do not let generic skill defaults override the project's established design system.

### Visual requirements

- Maintain the existing SIKAD aesthetic: calm, legible, nature-inspired, and planner-like.
- Preserve the existing Forest, Paper, Butter, Sage, Sky, and Harbor semantic palette as applicable.
- Use the established typography, spacing, border radii, icon conventions, and responsive breakpoints.
- Use existing CSS tokens and components instead of introducing another styling system.
- Maintain clear information hierarchy and readable text in both light and dark modes.
- Avoid heavy gradients, glassmorphism, decorative effects, unnecessary shadows, and generic dashboard styling.
- Do not redesign unrelated pages or components.

### Animation requirements

Add subtle, purposeful animations to the new or modified UI where they improve clarity and feedback.

Follow `motion-spec.md` for timing, easing, interaction behavior, and reduced-motion support.

Appropriate examples include:
- A restrained entrance for the new Today card.
- A subtle transition when weekly metrics update.
- Smooth progress-bar changes when task completion changes.
- Existing button press feedback and navigation transitions.
- Subtle appearance of the vertically stacked weekly metrics when the summary is first rendered, if consistent with the existing render architecture.

Use motion to communicate real state changes, not to decorate the interface.

Requirements:
- Do not add looping, parallax, confetti, animated gradients, or unnecessary decorative animation.
- Do not animate a state change before it has been saved successfully.
- Avoid re-triggering entrance animations on every routine render.
- Preserve existing task-completion, replanning, navigation, and Focus Card animations.
- Respect reduced-motion preferences.
- Use the project's existing native CSS and Web Animations API approach where appropriate.
- Do not add GSAP, anime.js, Animate.css, or other animation dependencies.

## 6. Navigation and Interaction Requirements

Ensure the following actions work correctly:

- **View schedule:** Focuses the existing Home timeline on today's schedule.
- **View weekly overview:** Opens the existing Overview page.
- Existing bottom navigation continues to work as before.
- Existing week navigation and selected-day timeline interactions remain functional.
- Existing theme switching remains functional.
- Links remain accessible by keyboard and have appropriate accessible labels and focus states.

Do not add duplicate pages, duplicate navigation systems, or unrelated buttons.

## 7. Implementation and Validation

Before editing, inspect:
- The project structure and relevant source files.
- `design.md` and `motion-spec.md`.
- Existing task models, completion states, and duration calculations.
- Existing weekly progress and scheduling-feasibility logic.
- Existing Home timeline navigation and Overview routing.
- Existing styles, semantic tokens, and animation utilities.
- Relevant installed skill instructions.

Implement changes using the current architecture and real data. Keep the patch focused and avoid unrelated refactoring.

After implementation, verify:

### Home
1. The What to Do Next card remains completely unchanged.
2. The Today card displays accurate remaining task time and completion progress.
3. Completing a task updates the relevant daily and weekly metrics.
4. View schedule opens today's existing timeline.
5. Weekly task progress displays consistent completed-versus-planned time and percentage.
6. Fits is shown only when supported by the scheduling logic.
7. View weekly overview opens the existing Overview page.

### Overview
8. The Available vs. required card is replaced by the vertically stacked Weekly summary.
9. Your time budget, Tasks remaining, and Time needed use actual calculated values.
10. Completed tasks are excluded from remaining task count and remaining task duration.
11. The daily bars update when remaining task durations change.
12. The caption is updated exactly as specified.
13. Week navigation, seven daily cards, selected-day highlighting, and timeline behavior remain unchanged.

### Overall
14. Both pages remain consistent with `design.md` and `motion-spec.md`.
15. Animations are subtle, purposeful, performant, and compatible with reduced-motion preferences.
16. Light mode, dark mode, mobile, and desktop layouts remain usable.
17. Existing functionality outside the requested changes continues to work.

Report the files changed, summarize the implementation, and identify any calculation or data limitations discovered during inspection.

## Scope restriction

Implement only the specified Home and Overview changes, their necessary data consistency, navigation behavior, and associated subtle motion.

Do not redesign unrelated components, modify the What to Do Next card, introduce new dependencies, or perform broad refactoring.