/*
 * SIKAD — demo data. Mirrors the "Alex" walkthrough in user_story.md §20.
 */
(function (root) {
  'use strict';
  const T = root.TempoTime;

  const DATA = {
    /** Text a COR photo would OCR into. Fed to the Phase 1 extractor. */
    SAMPLE_COR_TEXT: [
      'STATE UNIVERSITY — CERTIFICATE OF REGISTRATION',
      'Program: BSIT 3B-G1 DBA    1st Semester, AY 2026-2027',
      'CODE      DAY   TIME          MODE     ROOM',
      'IT 203       MON   07:00-10:00   FTF      ICT-204',
      'GE 104       MON   10:30-12:00   ONLINE',
      'IT 207       MON   14:00-17:00   FTF      LAB-3',
      'IT 204       TUE   07:00-09:00   ONLINE',
      'IT 208       TUE   09:00-11:00   ONLINE',
      'IT 206       TUE   13:00-15:00   FTF      NET-105',
      'GE 103       TUE   15:00-17:00   FTF      MATH-302',
      'IT 205       WED   08:00-11:00   FTF      ICT-301',
      'IT 203       WED   13:00-15:00   FTF      COMP-LAB-2',
      'GE 104       WED   15:30-17:00   ONLINE',
      'IT 204       THU   07:00-10:00   FTF      DB-LAB-1',
      'GE 103       THU   10:30-12:00   ONLINE',
      'IT 206       THU   13:00-16:00   FTF      NET-LAB-4',
      'IT 207       THU   16:00-17:00   ONLINE',
      'IT 208       FRI   07:00-09:00   ONLINE',
      'IT 205       FRI   09:30-12:30   FTF      ICT-LAB-5',
      'IT 204       FRI   13:30-15:00   ONLINE',
    ].join('\n'),

    /** Day names are worked out from today, so the sample reads as "the next few days" on any date. */
    get SAMPLE_BRAIN_DUMP() {
      const day = (n) => T.DAY_NAMES[T.dow(T.addDays(T.now(), n))];
      return 'I have a class diagram exercise for IT 203 due tomorrow, about 1 hour. Also a Big-O worksheet for IT 205 due tomorrow, around 1 hour. ' +
        `The ERD and business rules for IT 204 is due ${day(2)}, probably 2 hours. And I need a use case diagram for IT 207 by ${day(3)}, about 1.5 hours.`;
    },

    /** Alex's questionnaire answers (§20 Step 3). */
    SAMPLE_LIFESTYLE: {
      dayStart: '06:00',
      dayEnd: '22:00',
      commuteMins: 60,
      work: [{ day: 6, start: '09:00', end: '14:00' }],
      org: [],
    },

    /** One-tap demo inputs for the Brain Dump sheet, each exercising a different engine path. */
    SCENARIOS: [
      { label: 'Extra work shift tonight', text: 'I have to work tonight from 6:30 PM to 10:30 PM' },
      { label: 'New assignment', text: 'New report for IT 208 due next Monday, probably 4 hours' },
      { label: 'Deadline moved', text: 'The Class Diagram Exercise deadline moved to Wednesday' },
      { label: "Didn't finish", text: "I wasn't able to finish the ERD and business rules today" },
      { label: 'Missing deadline', text: 'I have a quiz for GE 103' },
      { label: 'Clashes with a class', text: 'I have a group study session Monday from 3 PM to 5 PM' },
      { label: 'Recurring org', text: 'I joined an org, we meet every Thursday from 7 PM to 8 PM' },
      { label: 'Group project (depends on…)', text: 'Group project slides for GE 104 due Saturday, about 2 hours, after the ERD and business rules' },
      { label: 'Need another hour', text: 'I need another hour to finish this task.' },
      { label: 'Write my essay?', text: "Can you just write my 500-word history essay? I'm so stressed." },
      { label: 'Feeling stressed', text: "I'm so stressed, I feel like I can't handle anything" },
      { label: 'Vague', text: "Ugh, everything's a mess, just fix it" },
      { label: 'Work shift tomorrow', text: 'I have a work shift tomorrow from 6 PM to 10 PM.' },
    ],

    /** Example questions for Ask SIKAD. Answered from the live plan by js/assistant.js. */
    QUESTIONS: [
      'What should I work on next?',
      'Why is this my highest priority?',
      'How much usable time do I have tomorrow?',
      'Can I realistically finish everything before Friday?',
    ],

    /** Used only by the clearly labelled demo fallback when the browser has no speech recognition. */
    SAMPLE_TRANSCRIPT: 'I have a work shift tomorrow from 6 PM to 10 PM.',

    INTEGRATIONS: [
      { id: 'gcal', icon: 'week', name: 'Google Calendar', desc: 'Sync events & deadlines' },
      { id: 'canvas', icon: 'doc', name: 'Canvas LMS', desc: 'Auto-import assignment dues' },
      { id: 'teams', icon: 'braindump', name: 'MS Teams', desc: 'Sync class channels & posts' },
      { id: 'classroom', icon: 'tasks', name: 'Google Classroom', desc: 'Pull classwork & announcements' },
    ],

    /**
     * Sample assignments each platform "returns" in this prototype (BSIT 3B-G1 DBA).
     * Split by platform so every connection brings in different work. due = [days from today, hour, minute], so the sample always sits in the coming days.
     */
    SAMPLE_ASSIGNMENTS: {
      canvas: [
        { course: 'IT 203', title: 'Encapsulation and Inheritance Lab', due: [3, 23, 59], mins: 120 },
        { course: 'IT 204', title: 'SQL Queries Worksheet', due: [4, 17, 0], mins: 90 },
        { course: 'IT 205', title: 'Searching and Sorting Lab', due: [3, 17, 0], mins: 150 },
        { course: 'IT 205', title: 'Stack and Queue Activity', due: [8, 23, 59], mins: 120 },
        { course: 'IT 206', title: 'IPv4 Subnetting Worksheet', due: [2, 17, 0], mins: 90 },
        { course: 'IT 206', title: 'Packet Tracer Topology', due: [4, 23, 59], mins: 150 },
        { course: 'IT 206', title: 'Network Troubleshooting Reflection', due: [9, 23, 59], mins: 60 },
      ],
      teams: [
        { course: 'IT 207', title: 'Problem Statement and Scope', due: [1, 17, 0], mins: 90 },
        { course: 'IT 208', title: 'Responsive Page Exercise', due: [2, 23, 59], mins: 120 },
        { course: 'IT 208', title: 'JavaScript Form Validation', due: [4, 23, 59], mins: 120 },
      ],
      classroom: [
        { course: 'GE 103', title: 'Logic and Set Theory Exercises', due: [1, 23, 59], mins: 60 },
        { course: 'GE 103', title: 'Statistics Problem Set', due: [4, 17, 0], mins: 90 },
        { course: 'GE 103', title: 'Data Interpretation Short Report', due: [10, 23, 59], mins: 120 },
        { course: 'GE 104', title: 'Data Privacy Case Reflection II', due: [2, 23, 59], mins: 60 },
        { course: 'GE 104', title: 'Responsible Technology Position Paper Outline', due: [12, 23, 59], mins: 90 },
      ],
      gcal: [
        { course: 'IT 203', title: 'Mini-System Demonstration', due: [5, 15, 0], mins: 180 },
        { course: 'IT 204', title: 'Normalization Exercise', due: [5, 23, 59], mins: 120 },
        { course: 'IT 207', title: 'Requirements Presentation', due: [5, 13, 0], mins: 120 },
        { course: 'IT 208', title: 'Project Progress Demo', due: [5, 16, 0], mins: 120 },
        { course: 'GE 104', title: 'Cyberethics Group Discussion Notes', due: [5, 12, 0], mins: 45 },
      ],
    },
  };

  root.TempoData = DATA;
})(typeof window !== 'undefined' ? window : globalThis);
