# SIKAD Follow-Up Prompt — Profile, Class Schedule & Recurring Commitments

## Context

The previous SIKAD UI/UX implementation prompt has already been executed. **This is a separate follow-up task** focused only on the Profile settings, Class Schedule editor, and Recurring Commitments manager.

Do not repeat or redo the previous product-wide UI/UX, navigation, date/time, toast/Undo, or motion work unless a small change is strictly necessary for this task to integrate correctly. Build on the current implementation.

## Objective

Redesign Profile as a compact management area for maintaining the student's recurring baseline schedule. The Overview already owns the weekly plan, daily timelines, classes, planned tasks, and available-versus-required time. **Do not duplicate the Overview experience inside Profile.**

## 1. Inspect Before Editing

1. Read `CLAUDE.md`, `design.md`, `motion-spec.md`, and the relevant project notes before changing code.
2. Inspect the current Profile UI, Overview, onboarding data, class schedule storage, recurring-commitment storage, persistence, and scheduling/replanning call sites.
3. Reuse the existing data model, components, CSS tokens, navigation, forms, confirmation/feedback patterns, and animation conventions wherever practical.
4. Do not create duplicate sources of truth or change the scheduling engine/parser contracts.
5. Follow all existing project constraints, including permitted changes to `js/store.js`. Do not edit protected files or change business logic outside what is necessary and explicitly allowed for this task.

## 2. Preserve the Existing Design System

Treat `design.md` as the source of truth. Preserve SIKAD's established warm cream background, muted green text and accents, white/warm-white surfaces, restrained borders and corner radii, typography, spacing, and component styles.

- Reuse existing CSS custom properties and components; do not introduce a new palette, arbitrary hardcoded colors, or a separate visual style.
- Keep the new views consistent with the already-implemented navigation, bottom sheets, toasts, confirmation, Undo, and motion patterns.
- Use available and permitted frontend/UI/UX skills for the actual implementation and critique—not just for recommendations.
- Keep the existing vanilla HTML/CSS/JavaScript stack. Do not add a framework or database for this task.

## 3. Profile Landing Page

Replace the long, fully expanded list of classes with two compact management cards.

### Class schedule card

Display:
- Title: **Class schedule**
- Compact total class count
- Days covered by the schedule
- Clear action to manage the schedule

Do not list every class on this landing page. Selecting the card opens the dedicated Class Schedule editor.

### Recurring commitments card

Display:
- Title: **Recurring commitments**
- Short description, such as “Work, organizations, and other regular activities”
- Compact summary of existing recurring commitments
- Clear action to manage them

Selecting the card opens the dedicated Recurring Commitments manager.

## 4. Class Schedule Editor

Create a dedicated view titled **Class schedule** with weekday sections in this order: Monday, Tuesday, Wednesday, Thursday, Friday.

Each weekday is an independently collapsible accordion row.

### Collapsed weekday row

Show:
- Weekday name
- Number of classes that day
- Total scheduled class hours
- Expand/collapse indicator

All weekdays should initially be collapsed unless preserving an explicitly selected day provides a better navigation experience.

### Expanded weekday content

Use compact class rows, not oversized cards. Each row shows:
- Subject code or class name
- Start and end time
- Mode: Online or Face-to-face
- Optional room/location
- Compact action menu with **Edit** and **Remove**

Provide one prominent **Add a class** action. Avoid excessive padding, duplicated labels, and permanently visible Remove buttons.

### Add/Edit Class form

Include:
- Subject or class name
- One or more weekdays
- Start time
- End time
- Mode: Online or Face-to-face
- Optional room/location

Allow a class to repeat across multiple weekdays. Validate required fields and valid time ranges. Detect overlaps with fixed commitments and do not silently overwrite existing classes.

After saving:
- Update the relevant weekday sections and summaries.
- Recalculate class counts and scheduled hours.
- Preserve all unrelated classes and existing data.
- Trigger the appropriate future availability recalculation and re-evaluation of affected flexible task recommendations.
- Surface unresolved conflicts for the student to review.

Ask for confirmation before permanently removing a class, using the existing project confirmation pattern. Provide appropriate success feedback and Undo only if the underlying operation can be reliably reversed.

## 5. Recurring Commitments Manager

Create a separate view titled **Recurring commitments**, organized into exactly these three primary categories:

### A. Work Schedule

For students with work commitments, show:
- Work role or schedule name
- Recurring workdays and hours
- Edit and Remove actions
- Support for multiple recurring shifts

For students without a work schedule, show a concise empty state and an **Add work schedule** action. Do not assume every student has a job.

### B. Organizations

Reuse organization names and information already saved during onboarding; do not make students re-enter existing information.

For each organization, show:
- Organization name
- Recurring meeting days
- Start and end times
- Optional notes
- Edit and Remove actions

Support multiple organizations and their individual schedules. If none exist, show an empty state and an **Add organization** action.

### C. Other Commitments

Support recurring activities outside work and organizations, such as regular appointments, family responsibilities, and other repeating obligations.

Each entry shows:
- Commitment name
- Recurrence weekdays
- Start and end times
- Optional notes
- Edit and Remove actions

Provide an **Add a commitment** action.

### Shared Add/Edit Commitment form

Reuse a single form with:
- Commitment name
- Category: Work, Organization, or Other
- Relevant category-specific details
- Recurrence days
- Start and end times
- Optional notes

Show conditional fields only when relevant to the selected category. Reuse existing saved data and validation patterns.

## 6. Baseline and Scheduling Rules

Keep the distinction between recurring baseline commitments and temporary events explicit.

- Classes and recurring commitments belong to the recurring baseline.
- Editing the baseline must affect future availability calculations and trigger appropriate re-evaluation of flexible task recommendations.
- One-time events entered elsewhere remain temporary unless the student explicitly chooses recurrence.
- Never automatically turn a temporary event into a recurring commitment.
- Fixed classes, confirmed work shifts, and other protected commitments must never be silently moved, shortened, or overwritten during replanning.
- When fixed commitments overlap, show the conflict and ask the student to resolve it.
- Preserve existing tasks, preferences, onboarding information, and schedule entries.
- Do not modify the scheduling engine's behavior or contracts beyond existing supported interfaces. If the UI requires a capability the current engine/data model does not support, identify the exact gap rather than inventing a parallel implementation.

## 7. Navigation, Feedback, and Motion

- Keep Profile as the landing page for these management views.
- Provide clear back navigation from each editor/manager.
- Keep the Overview as the primary weekly planning and daily timeline experience.
- Do not add a second weekly timeline to Profile.
- Make forms compact and usable on narrow mobile screens.
- Use accessible labels, touch targets, keyboard focus, validation, empty, success, loading, and conflict states.
- Follow the existing SIKAD motion specification. Use restrained accordion/form/sheet transitions only where they clarify the interaction; do not add motion for decoration.
- Reuse the existing bottom-sheet confirmation, toast, and Undo patterns rather than creating competing systems.
- Respect reduced-motion preferences and existing safe-area behavior.

## 8. Required Implementation and Verification

**Implement the changes directly in the existing project. Do not return only an audit or recommendations.**

After implementation:

1. Inspect the actual changed screens and critique them against `design.md` and this prompt.
2. Test accordion expansion/collapse, Add/Edit/Remove class, multiple weekdays, validation, overlap/conflict handling, recurring commitment CRUD, empty states, reuse of onboarding organization data, and navigation back to Profile.
3. Verify that changes persist using the existing persistence mechanism and that unrelated saved data remains intact.
4. Verify that baseline changes trigger the appropriate availability recalculation without duplicating or corrupting task data.
5. Test narrow mobile layouts, keyboard/focus behavior, reduced motion where possible, and relevant existing app flows.
6. Run the project's documented tests and `node --check` for each modified JavaScript file. Report only tests actually run and their real results.
7. Update documentation only where needed to reflect actual changes. Follow the project's required process-log format.

## Acceptance Criteria

- Profile no longer shows all classes in a long expanded list.
- Profile contains compact Class schedule and Recurring commitments management cards.
- The Class Schedule editor lists Monday–Friday in order, with independently collapsible sections and accurate class counts/hours.
- Students can add, edit, and remove classes, including recurring classes on multiple weekdays.
- Recurring commitments are organized into exactly Work Schedule, Organizations, and Other Commitments.
- Existing organization names from onboarding are reused.
- Students without work schedules or organizations receive useful empty states.
- Fixed commitment conflicts are surfaced, not silently overwritten.
- Baseline edits trigger appropriate future availability recalculation.
- Overview remains the primary weekly plan and timeline.
- Existing application functionality and saved data are preserved.
- The implementation is responsive and consistent with the current SIKAD design system.

## Final Report

Keep the report concise and state:
- Files modified.
- Profile and editor behaviors implemented.
- How saved data and baseline recalculation were handled.
- Acceptance criteria actually tested and results.
- Any unresolved issue or blocker, with a specific reason.

Do not claim completion for behavior that was only documented or not tested.