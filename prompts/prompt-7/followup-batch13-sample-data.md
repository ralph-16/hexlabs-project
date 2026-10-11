# SIKAD Follow-Up: Batch 13 — Data Upgrade to BSIT 3B-G1 DBA Fixture

> **For Claude in your friend's session:**  
> Paste this entire prompt into your session **after** you finish running your current batches (Batches 1–12).  
> Standard `CLAUDE.md` rules apply: minimal edits, no npm/build tools, keep engine/parser intact, run `node --check` before reporting.

---

## Context
You have already built Batches 1 through 12 using the previous starter data.  
This follow-up prompt is **purely data & seed wiring**. It replaces Alex's thin demo data (3 tasks, old course codes) with the realistic **BSIT 3B-G1 DBA course fixture** (17 classes, 31 assignments split across 4 platforms, and a realistic past-week history).

Do **NOT** alter the engine, the parser, or any UI layout components.

---

## Files to touch
1. `js/data.js`
2. `js/store.js` (`loadDemo` function and past-week snapshot/history seed)
3. Batch 6 adapter (where `window.SikadIntegrations` provides sample items)

---

## Instructions

### 1) Update `js/data.js`

#### A. Replace `SAMPLE_COR_TEXT`
Keep the existing 3 header lines, but ensure the program line reads `Program: BSIT 3B-G1 DBA    1st Semester, AY 2026-2027`.  
Use the course codes directly as titles:
```text
IT 203       MON   07:00-10:00   FTF      ICT-204
GE 104       MON   10:30-12:00   ONLINE
IT 207       MON   14:00-17:00   FTF      LAB-3
IT 204       TUE   07:00-09:00   ONLINE
IT 208       TUE   09:00-11:00   ONLINE
IT 206       TUE   13:00-15:00   FTF      NET-105
GE 103       TUE   15:00-17:00   FTF      MATH-302
IT 205       WED   08:00-11:00   FTF      ICT-301
IT 203       WED   13:00-15:00   FTF      COMP-LAB-2
GE 104       WED   15:30-17:00   ONLINE
IT 204       THU   07:00-10:00   FTF      DB-LAB-1
GE 103       THU   10:30-12:00   ONLINE
IT 206       THU   13:00-16:00   FTF      NET-LAB-4
IT 207       THU   16:00-17:00   ONLINE
IT 208       FRI   07:00-09:00   ONLINE
IT 205       FRI   09:30-12:30   FTF      ICT-LAB-5
IT 204       FRI   13:30-15:00   ONLINE
```

#### B. Replace `SAMPLE_BRAIN_DUMP`
Use the following text (avoids "due Monday" parser Sunday ambiguity):
```text
I have a class diagram exercise for IT 203 due tomorrow, about 1 hour. Also a Big-O worksheet for IT 205 due tomorrow, around 1 hour. The ERD and business rules for IT 204 is due Tuesday, probably 2 hours. And I need a use case diagram for IT 207 by Wednesday, about 1.5 hours.
```
*(Expected parse: 4 tasks — Class Diagram Exercise IT 203 Mon 11:59 PM 60m; Big-O Worksheet IT 205 Mon 60m; ERD and Business Rules IT 204 Tue 120m; Use Case Diagram IT 207 Wed 90m; none flagged as AI estimates).*

#### C. Keep `SAMPLE_LIFESTYLE`, `SAMPLE_TRANSCRIPT`, `QUESTIONS`, and `DEMO_START` intact.

#### D. Replace `SCENARIOS`
```javascript
const SCENARIOS = [
  { label: 'Extra work shift tonight', text: 'I have to work tonight from 6:30 PM to 10:30 PM' },
  { label: 'New assignment',           text: 'New report for IT 208 due next Monday, probably 4 hours' },
  { label: 'Deadline moved',           text: 'The Class Diagram Exercise deadline moved to Wednesday' },
  { label: "Didn't finish",            text: "I wasn't able to finish the ERD and business rules today" },
  { label: 'Missing deadline',         text: 'I have a quiz for GE 103' },
  { label: 'Clashes with a class',     text: 'I have a group study session Monday from 3 PM to 5 PM' },
  { label: 'Recurring org',            text: 'I joined an org, we meet every Thursday from 7 PM to 8 PM' },
  { label: 'Group project (depends on…)', text: 'Group project slides for GE 104 due Saturday, about 2 hours, after the ERD and business rules' },
  { label: 'Need another hour',        text: 'I need another hour to finish this task.' },
  { label: 'Write my essay?',          text: "Can you just write my 500-word history essay? I'm so stressed." },
  { label: 'Feeling stressed',         text: "I'm so stressed, I feel like I can't handle anything" },
  { label: 'Vague',                    text: "Ugh, everything's a mess, just fix it" },
  { label: 'Work shift tomorrow',      text: 'I have a work shift tomorrow from 6 PM to 10 PM.' }
];
```

#### E. Export `SAMPLE_ASSIGNMENTS` in `js/data.js`
Split by platform so each connector imports a unique subset:
```javascript
const SAMPLE_ASSIGNMENTS = {
  canvas: [
    { course: 'IT 203', title: 'Encapsulation and Inheritance Lab', due: [10, 14, 23, 59], mins: 120 },
    { course: 'IT 204', title: 'SQL Queries Worksheet',              due: [10, 15, 17, 0],  mins: 90 },
    { course: 'IT 205', title: 'Searching and Sorting Lab',          due: [10, 14, 17, 0],  mins: 150 },
    { course: 'IT 205', title: 'Stack and Queue Activity',           due: [10, 19, 23, 59], mins: 120 },
    { course: 'IT 206', title: 'IPv4 Subnetting Worksheet',          due: [10, 13, 17, 0],  mins: 90 },
    { course: 'IT 206', title: 'Packet Tracer Topology',             due: [10, 15, 23, 59], mins: 150 },
    { course: 'IT 206', title: 'Network Troubleshooting Reflection', due: [10, 20, 23, 59], mins: 60 }
  ],
  teams: [
    { course: 'IT 207', title: 'Problem Statement and Scope',        due: [10, 12, 17, 0],  mins: 90 },
    { course: 'IT 208', title: 'Responsive Page Exercise',           due: [10, 13, 23, 59], mins: 120 },
    { course: 'IT 208', title: 'JavaScript Form Validation',         due: [10, 15, 23, 59], mins: 120 }
  ],
  classroom: [
    { course: 'GE 103', title: 'Logic and Set Theory Exercises',     due: [10, 12, 23, 59], mins: 60 },
    { course: 'GE 103', title: 'Statistics Problem Set',             due: [10, 15, 17, 0],  mins: 90 },
    { course: 'GE 103', title: 'Data Interpretation Short Report',   due: [10, 21, 23, 59], mins: 120 },
    { course: 'GE 104', title: 'Data Privacy Case Reflection II',    due: [10, 13, 23, 59], mins: 60 },
    { course: 'GE 104', title: 'Responsible Technology Position Paper Outline', due: [10, 23, 23, 59], mins: 90 }
  ],
  gcal: [
    { course: 'IT 203', title: 'Mini-System Demonstration',          due: [10, 16, 15, 0],  mins: 180 },
    { course: 'IT 204', title: 'Normalization Exercise',             due: [10, 16, 23, 59], mins: 120 },
    { course: 'IT 207', title: 'Requirements Presentation',          due: [10, 16, 13, 0],  mins: 120 },
    { course: 'IT 208', title: 'Project Progress Demo',              due: [10, 16, 16, 0],  mins: 120 },
    { course: 'GE 104', title: 'Cyberethics Group Discussion Notes', due: [10, 16, 12, 0],  mins: 45 }
  ]
};
```

---

### 2) Update `loadDemo` in `js/store.js`
In `loadDemo()`:
1. Parse the new `SAMPLE_COR_TEXT`, apply lifestyle, convert `SAMPLE_BRAIN_DUMP` to tasks, and replan.
2. Initialize `state.integrations = {}`.
3. Add the overdue task via `makeTask`:
   - Title: `"Algorithm Tracing Worksheet"`, context: `"IT 205"`, deadline: Wed Oct 7 23:59 (2026), 60 min, `isAiEstimate: true`, status: `'pending'`.
4. Previous-week seed (Oct 5–11, 2026):
   - Seed the 6 completed items into `state.history` (and into `state.daySnapshots` if Batch 11 exists):
     - Mon Oct 5 (12:15–1:45 PM): IT 207 Stakeholder and Problem Analysis [due Mon 5:00 PM] (Done)
     - Mon Oct 5 (8:00–8:45 PM): IT 203 OOP Concepts Quiz [due Mon 11:59 PM] (Done)
     - Tue Oct 6 (11:15 AM–12:45 PM): IT 208 HTML and CSS Layout Exercise [due Tue 11:59 PM] (Done)
     - Tue Oct 6 (7:00–8:30 PM): IT 204 ERD Practice Activity [due Tue 11:59 PM] (Done)
     - Wed Oct 7 (5:30–6:30 PM): IT 205 Algorithm Tracing Worksheet [due Wed 11:59 PM] (Planned snapshot, NOT marked done)
     - Wed Oct 7 (6:45–7:45 PM): GE 104 Stakeholder and Data Privacy Case Reflection [due Wed 11:59 PM] (Done)
     - Wed Oct 7 (8:00–8:45 PM): IT 206 OSI Model Quick Check [due Thu 5:00 PM] (Done)

---

### 3) Update Batch 6 Integrations Adapter
Ensure `window.SikadIntegrations[platform].connect()`:
- Returns the matching items from `SAMPLE_ASSIGNMENTS[platform]`.
- Sets `source: platform` and course as context chip.
- Account name: `"alex.s@up.edu.ph"` if the user is Alex, otherwise `"Sample account"`.
- Filters out items whose title already exists in `state.tasks`.
- Pipes items through the existing review sheet and task-addition flow.

---

### Acceptance Criteria
1. Parse of `SAMPLE_COR_TEXT` produces 17 classes (9 in-person, 8 online). Profile shows Mon 3, Tue 4, Wed 3, Thu 4, Fri 3.
2. "Load Alex's week" (Sun Oct 11, 9:30 PM): 5 open tasks, 6.5 hrs planned, 0 unscheduled, fits nicely with 1 overdue warning for Algorithm Tracing Worksheet. Tasks → Completed shows 6.
3. Overview ‹ week Oct 5–11 shows 7 historical items (6 Done, 1 Overdue).
4. Connecting all 4 platforms and adding all items displays a realistic ~15 hr shortage with 9 tasks unplaced.
5. Run `node --check js/data.js js/store.js js/app.js` — zero syntax errors.
6. Old placeholder strings ("database proposal", "SIA", "ADET", "SPEC1") no longer appear in the app.
