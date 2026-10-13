/*
 * SIKAD — logic tests. No dependencies:  node tests/run-tests.js
 *
 * Covers the deterministic modules (parser, engine, store, focus, assistant) against the
 * scenarios in the implementation brief (Phase D). Browser behaviour (voice capture,
 * rendering, refresh) is not covered here; see README "Testing".
 */
const path = require('path');
for (const f of ['time', 'data', 'parser', 'engine', 'store', 'focus', 'assistant']) require(path.join(__dirname, '..', 'js', f + '.js'));
const { TempoTime: T, TempoData: D, TempoParser: P, TempoEngine: E, TempoStore: S, TempoFocus: F, TempoAssistant: A } = globalThis;

// The app reads the device clock (T.now). Tests pin it to one Sunday evening so results are repeatable.
const realNow = T.now;
const FIXED_NOW = T.make(2026, 10, 11, 21, 30);
T.now = () => FIXED_NOW;

let passed = 0, failed = 0;
const test = (name, fn) => { try { fn(); passed++; console.log('  ok   ' + name); } catch (e) { failed++; console.log('  FAIL ' + name + '\n       ' + e.message); } };
const ok = (cond, msg) => { if (!cond) throw new Error(msg || 'assertion failed'); };
const eq = (a, b, msg) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg || 'not equal'}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`); };

const demo = () => S.loadDemo(S.initialState());
const parse = (st, text) => P.parse(text, S.parseContext(st));
const addTasks = (st, text) => { for (const i of parse(st, text).intents) if (i.type === 'task') st.tasks.push(S.makeTask(st, i.task)); };
const fixedOn = (st, day) => E.occurrences(st, day).filter((o) => !o.soft).map((o) => [o.title, o.start, o.end]);
const week = (st) => Array.from({ length: 7 }, (_, i) => T.make(2026, 10, 12) + i * T.DAY);
/** Every planned session keeps the 15-minute buffer from every other block and never overlaps one. */
function bufferViolations(st) {
  const bad = [];
  for (const s of st.plan) {
    for (const o of E.occurrences(st, T.dayStart(s.start))) {
      if (s.start < o.end + 15 * T.MIN && o.start < s.end + 15 * T.MIN) bad.push(`${s.title} ${T.time(s.start)}-${T.time(s.end)} vs ${o.title} ${T.time(o.start)}-${T.time(o.end)}`);
    }
    for (const x of st.plan) if (x !== s && s.start < x.end + 15 * T.MIN && x.start < s.end + 15 * T.MIN) bad.push(`${s.title} vs ${x.title}`);
  }
  return bad;
}

console.log('\nSetup and first plan');
test('1. setup data produces a plan with a next action', () => {
  const st = demo();
  eq(st.status, 'SUCCESS'); ok(st.plan.length >= 3, 'plan has sessions'); ok(E.nextSession(st.plan, st.now), 'has next action');
  eq(st.baseline.classes.length, 17, 'classes from the demo import');
  eq(st.baseline.classes.filter((c) => c.mode === 'FTF').length, 9, 'nine in person, eight online');
});
test('15. demo reset is repeatable (same scenario every time)', () => {
  const a = demo(), b = demo();
  eq(a.plan.map((s) => [s.title, s.start]), b.plan.map((s) => [s.title, s.start]));
  eq(a.tasks.filter((t) => t.status !== 'done').map((t) => t.title), ['Class Diagram Exercise', 'Big-O Worksheet', 'ERD and Business Rules', 'Use Case Diagram', 'Algorithm Tracing Worksheet']);
  eq([a.tasks.filter((t) => t.status === 'done').length, a.plan.reduce((x, s) => x + s.mins, 0), a.unscheduled.length], [6, 390, 0], 'six finished last week, 6.5 hrs planned, all of it fits');
  ok(a.alerts.some((x) => x.level === 'WARNING' && /Algorithm Tracing Worksheet.*past its deadline/.test(x.message)), 'the overdue task is called out');
});

console.log('\nTask capture');
test('2. complete information is captured as given', () => {
  const i = parse(demo(), 'Math homework due tomorrow, about 45 minutes').intents[0];
  eq(i.type, 'task'); eq(i.task.durationMins, 45); eq(i.task.isAiEstimate, false); ok(i.task.deadline != null); eq(i.clarification, null);
});
test('3. a missing deadline is asked for, never invented', () => {
  const i = parse(demo(), 'I have a physics test').intents[0];
  eq(i.task.deadline, null); ok(/when/i.test(i.clarification), 'asks when'); eq(i.task.isAiEstimate, true, 'duration is flagged as an estimate');
  const st = demo(); st.tasks.push(S.makeTask(st, i.task)); S.replan(st, 'add');
  ok(!st.plan.some((s) => /Physics/.test(s.title)), 'not scheduled without a deadline'); eq(st.needsDeadline.length, 1);
});
test('a dependency in the text links to the right task and orders the plan', () => {
  const st = demo();
  const i = parse(st, 'Group project slides for GE 104 due Saturday, about 2 hours, after the ERD and business rules').intents[0];
  eq(i.task.dependsOnTitle, 'ERD and Business Rules'); eq(i.task.title, 'Group Project Slides');
  st.tasks.push(S.makeTask(st, i.task)); S.replan(st, 'add');
  const dep = st.tasks.find((x) => x.title === 'ERD and Business Rules').id, lastDep = Math.max(...st.plan.filter((s) => s.taskId === dep).map((s) => s.end));
  const first = Math.min(...st.plan.filter((s) => /Group/.test(s.title)).map((s) => s.start));
  ok(first >= lastDep + 15 * T.MIN, 'dependent work starts after the dependency ends (plus buffer)');
});
test('every demo scenario is understood as the kind of input it is', () => {
  const st = demo();
  eq(D.SCENARIOS.map((sc) => parse(st, sc.text).intents.map((i) => i.type).join('+')),
    ['event', 'task', 'deadline_change', 'missed', 'task', 'event', 'event', 'task', 'extend', 'refuse', 'stress', 'unclear', 'event']);
});

console.log('\nAsk SIKAD answers use the current plan');
test('4. "what next" names the same session as the Focus Card', () => {
  const st = demo(); eq(A.answer(st, 'What should I work on next?').title, E.nextSession(st.plan, st.now).title);
});
test('4. usable time tomorrow matches the engine and lists fixed commitments', () => {
  const st = demo(); const a = A.answer(st, 'How much usable time do I have tomorrow?');
  const day = T.make(2026, 10, 12);
  const usable = E.freeSlots(st, T.at(day, '06:00'), T.at(day, '22:00')).reduce((x, s) => x + (s.end - s.start) / T.MIN, 0);
  ok(a.lines[0].includes(T.dur(usable)), 'states the computed usable time'); ok(a.facts[2][1].includes('IT 203') && a.facts[2][1].includes('IT 207'));
});
test('4. an unknown task is reported as missing, not answered about another task', () => {
  const a = A.answer(demo(), 'Why is my thesis first?'); ok(a.missing); ok(/No task matches/.test(a.title));
});
test('4. feasibility answer turns to "No" when work does not fit, without changing deadlines', () => {
  const st = demo(); ok(/^Yes/.test(A.answer(st, 'Can I realistically finish everything before Friday?').title));
  S.setClock(st, T.make(2026, 10, 12, 16, 45));
  const before = st.tasks.map((t) => [t.deadline, t.durationMins]);
  addTasks(st, 'Capstone project due tomorrow, about 10 hours'); S.replan(st, 'big');
  ok(/^No/.test(A.answer(st, 'Can I realistically finish everything before Friday?').title));
  eq(st.tasks.slice(0, before.length).map((t) => [t.deadline, t.durationMins]), before, 'existing deadlines and durations untouched');
});
test('statements are not treated as questions', () => {
  for (const s of ['I have a work shift tomorrow from 6 PM to 10 PM.', 'I finished the first part of my project.', 'I need another hour to finish this task.']) eq(A.answer(demo(), s), null);
});

console.log('\nAdaptive replanning');
test('6+7. a work shift moves only flexible work; fixed commitments stay put', () => {
  const st = demo();
  const fixedBefore = week(st).map((d) => fixedOn(st, d));
  const i = parse(st, 'I have a work shift on Tuesday from 6 PM to 10 PM.').intents[0];
  eq(i.type, 'event'); eq(i.recurring, false, 'one-time by default');
  const overlapped = st.plan.filter((s) => s.start < i.event.end && s.end > i.event.start);
  ok(overlapped.length > 0, 'the shift overlaps planned flexible work');
  eq(E.eventConflicts(st, i.event).hard, [], 'no clash with a fixed commitment');
  S.addEvent(st, i.event); const r = S.replan(st, 'shift');
  eq(st.status, 'SUCCESS'); ok(r.changes.some((c) => c.action === 'RESCHEDULE'), 'work was rescheduled, not just listed');
  ok(!st.plan.some((s) => s.start < i.event.end + 15 * T.MIN && s.end > i.event.start - 15 * T.MIN), 'nothing overlaps the shift or its buffer');
  const fixedAfter = week(st).map((d) => fixedOn(st, d).filter((o) => o[0] !== 'Work shift'));
  eq(fixedAfter, fixedBefore, 'every class and recurring commitment unchanged');
});
test('7. a shift that clashes with a class is flagged as a fixed-fixed conflict', () => {
  const st = demo(); const i = parse(st, 'I have a group study session Monday from 3 PM to 5 PM').intents[0];
  eq(E.eventConflicts(st, i.event).hard.map((o) => o.title), ['IT 207']);
});
test('the 15-minute buffer holds around every task, and back-to-back classes are legal', () => {
  const st = demo(); eq(bufferViolations(st), []);
  const broken = JSON.parse(JSON.stringify(st)); broken.plan[0].start = T.make(2026, 10, 12, 9, 50); broken.plan[0].end = T.make(2026, 10, 12, 10, 20); // starts 10 min before IT 203 ends
  ok(bufferViolations(broken).length > 0, 'the checker itself detects a session placed inside a class or its buffer');
  S.addEvent(st, parse(st, 'I have a work shift on Tuesday from 6 PM to 10 PM.').intents[0].event); S.replan(st, 'shift'); eq(bufferViolations(st), []);
  const tue = fixedOn(st, T.make(2026, 10, 13));
  ok(tue.some((o) => o[0] === 'IT 204') && tue.some((o) => o[0] === 'IT 208'), 'consecutive fixed classes both kept with no gap forced');
});
test('an impossible workload is reported as INFEASIBLE with unscheduled work', () => {
  const st = demo(); S.setClock(st, T.make(2026, 10, 12, 16, 45));
  addTasks(st, 'Capstone project due tomorrow, about 10 hours'); S.replan(st, 'big');
  eq(st.status, 'INFEASIBLE'); ok(st.unscheduled.length > 0); ok(st.alerts.some((a) => a.level === 'CRITICAL'));
  ok(st.plan.every((s) => { const t = st.tasks.find((x) => x.id === s.taskId); return t.deadline <= st.now || s.end <= t.deadline; }), 'nothing is scheduled past its deadline (work that was already overdue aside)');
});
test('"I need another hour" and "I finished the first part" update the right task', () => {
  const st = demo();
  const e = parse(st, 'The ERD and business rules needs another hour').intents[0]; eq([e.type, e.title, e.addMins], ['extend', 'ERD and Business Rules', 60]);
  S.extendTask(st, e.taskId, e.addMins); eq(S.taskRemaining(st.tasks.find((x) => x.id === e.taskId)), 180);
  // A task described in sections keeps them as parts.
  addTasks(st, 'I have a capstone proposal for IT 207 due Friday. I need to do the methodology and results sections, probably 3 hours total.');
  const prop = st.tasks[st.tasks.length - 1];
  const c = parse(st, 'I finished the first part of the capstone proposal.').intents[0]; eq([c.type, c.partTitle], ['complete_part', 'Methodology']);
  S.completePart(st, c.taskId, c.partId); ok(prop.parts[0].done); eq(prop.status, 'pending', 'the rest of the task stays open');
});

console.log('\nFocus Mode');
test('11. the suggested method fits the session and the time available', () => {
  eq(F.recommend({ sessionMins: 45, windowMins: 45, remainingTaskMins: 45, pendingSteps: [] }).method, 'timebox');
  const p = F.recommend({ sessionMins: 120, windowMins: 225, remainingTaskMins: 120, pendingSteps: [] }); eq(p.method, 'pomodoro'); eq(p.setup.rounds, 4);
  eq(F.recommend({ sessionMins: 90, windowMins: 200, remainingTaskMins: 180, pendingSteps: [{ title: 'A', mins: 90 }, { title: 'B', mins: 90 }] }).method, 'chunking');
  const t = F.recommend({ sessionMins: 60, windowMins: 30, remainingTaskMins: 60, pendingSteps: [] }); eq(t.method, 'timebox'); eq(t.setup.workMins, 30, 'never longer than the open window');
  eq(p.options.map((o) => o.method), ['chunking', 'pomodoro', 'timebox', 'none'], 'other methods and "no method" are always offered');
});
test('8. start, pause, resume keep an accurate elapsed time', () => {
  const st = demo(); S.setClock(st, T.make(2026, 10, 12, 10, 15));
  const next = E.nextSession(st.plan, st.now);
  S.startSession(st, next.id, { method: 'timebox', workMins: 120 });
  eq(st.active.status, 'running'); eq(st.tasks.find((x) => x.id === next.taskId).status, 'in_progress');
  st.active.resumedAt -= 10 * T.MIN; S.pauseSession(st);
  ok(Math.abs(st.active.elapsedMs - 10 * T.MIN) < 1000, 'ten minutes counted'); eq(st.active.status, 'paused');
  const frozen = st.active.elapsedMs; eq(S.focusElapsedMs(st.active, Date.now() + 5 * T.MIN), frozen, 'paused time does not grow');
  S.resumeSession(st); eq(st.active.status, 'running');
});
test('13. a timer reaching zero completes nothing and counts no session', () => {
  const st = demo(); S.setClock(st, T.make(2026, 10, 12, 10, 15));
  const next = E.nextSession(st.plan, st.now), logged = st.workLog.length;
  S.startSession(st, next.id, { method: 'timebox', workMins: 25 });
  ok(F.timer(st.active, 30 * T.MIN).finished, 'timer has run out');
  eq(st.focusLog.length, 0); eq(st.tasks.find((x) => x.id === next.taskId).status, 'in_progress'); eq(st.workLog.length, logged, 'nothing credited');
});
test('9+10. complete, partial and unfinished outcomes update task, log and plan', () => {
  const st = demo(); S.setClock(st, T.make(2026, 10, 12, 10, 15));
  const quiz = st.tasks.find((x) => x.id === E.nextSession(st.plan, st.now).taskId), had = quiz.remainingMins;
  S.startSession(st, E.nextSession(st.plan, st.now).id, { method: 'pomodoro', workMins: 25, breakMins: 5, rounds: 4 });
  S.endFocus(st, { outcome: 'partial', remainingMins: 30, focusedMins: 80 });
  eq(quiz.remainingMins, 30); eq(quiz.status, 'pending', 'task preserved'); eq(st.workLog[st.workLog.length - 1].mins, had - 30, 'credited what was reported done');
  eq(st.active, null); eq(st.focusLog.length, 1); ok(st.plan.some((s) => s.taskId === quiz.id && s.mins === 30), 'remaining work is back in the plan');
  S.startSession(st, st.plan.find((s) => s.taskId === quiz.id).id, { method: 'none' });
  S.endFocus(st, { outcome: 'unfinished', focusedMins: 5 });
  eq(quiz.remainingMins, 30, 'nothing lost, nothing credited'); eq(st.focusLog.length, 2); ok(st.plan.some((s) => s.taskId === quiz.id));
  S.startSession(st, st.plan.find((s) => s.taskId === quiz.id).id, { method: 'timebox', workMins: 30 });
  S.endFocus(st, { outcome: 'complete', focusedMins: 30 });
  eq(quiz.status, 'done'); eq(st.focusLog.map((f) => f.outcome), ['partial', 'unfinished', 'complete']);
  ok(E.nextSession(st.plan, st.now).taskId !== quiz.id, 'next action moved on');
});

console.log('\nWeekly progress');
test('12. progress follows completed and partly completed work', () => {
  const st = demo(); S.setClock(st, T.make(2026, 10, 12, 10, 15));
  const w0 = S.weeklyProgress(st); eq([w0.doneMins, w0.totalMins, w0.percent], [0, 390, 0], 'last week\'s finished work does not count toward this week');
  const next = E.nextSession(st.plan, st.now);                       // a 1-hour task
  S.startSession(st, next.id, { method: 'none' }); S.endFocus(st, { outcome: 'partial', remainingMins: 30, focusedMins: 30 });
  const w1 = S.weeklyProgress(st); eq([w1.doneMins, w1.totalMins, w1.percent, w1.focusSessions], [30, 390, 8, 1]);
  S.completeTask(st, next.taskId); S.replan(st, 'done');
  const w2 = S.weeklyProgress(st); eq([w2.doneMins, w2.tasksDone], [60, 1]);
});
test('12. rescheduling changes the plan side only; a new week starts fresh', () => {
  const st = demo(); S.setClock(st, T.make(2026, 10, 12, 10, 15));
  S.completeTask(st, st.tasks[1].id); S.replan(st, 'done');
  const before = S.weeklyProgress(st);
  const movedMins = S.taskRemaining(st.tasks[2]);
  st.tasks[2].deadline = T.make(2026, 10, 25, 23, 59); st.tasks[2].notBefore = T.make(2026, 10, 19, 6, 0); S.replan(st, 'moved one task to next week');
  const after = S.weeklyProgress(st);
  eq(after.doneMins, before.doneMins, 'done work is never reduced by a reschedule'); eq(after.leftMins, before.leftMins - movedMins, 'planned side shrinks');
  ok(after.percent >= before.percent, `percent never drops because of a reschedule (${before.percent} → ${after.percent})`);
  S.setClock(st, T.make(2026, 10, 19, 8, 0)); eq(S.weeklyProgress(st).doneMins, 0, 'next week starts at zero done');
});

console.log('\nPersistence');
test('14. saved state survives a save/load round trip unchanged', () => {
  const st = demo(); S.setClock(st, T.make(2026, 10, 12, 10, 15));
  S.startSession(st, E.nextSession(st.plan, st.now).id, { method: 'none' }); S.endFocus(st, { outcome: 'partial', remainingMins: 45, focusedMins: 70 });
  const loaded = S.sanitize(JSON.parse(JSON.stringify(st)));
  for (const k of ['tasks', 'plan', 'events', 'workLog', 'focusLog', 'history', 'baseline', 'status']) eq(loaded[k], st[k], k);
  eq(S.weeklyProgress(loaded), S.weeklyProgress(st));
});
test('14. damaged or outdated saved data is repaired or rejected, never crashes', () => {
  eq(S.sanitize(null), null); eq(S.sanitize('nope'), null); eq(S.sanitize({ tasks: 'x', baseline: null }), null);
  const old = JSON.parse(JSON.stringify(demo())); delete old.workLog; delete old.focusLog; delete old.prefs; old.active = { sessionId: 'gone' };
  const fixed = S.sanitize(old); eq([fixed.workLog, fixed.focusLog, fixed.prefs, fixed.active], [[], [], {}, null]);
  ok(S.weeklyProgress(fixed).totalMins >= 0);
});

console.log('\nv3: orgs, day snapshots, past weeks');
test('16. named orgs become fixed weekly commitments with their own names', () => {
  const st = S.initialState();
  S.applyLifestyle(st, { dayStart: '06:00', dayEnd: '22:00', commuteMins: 135, work: [],
    org: [{ day: 4, start: '17:00', end: '19:00', name: 'Junior Programmers Guild' }, { day: 5, start: '17:00', end: '18:00', name: '' }] });
  eq(st.baseline.recurring.map((r) => [r.title, r.kind, r.day]), [['Junior Programmers Guild', 'org', 4], ['Org meeting', 'org', 5]]);
  eq(st.baseline.commuteMins, 135, 'custom commute kept');
  ok(fixedOn(st, T.make(2026, 10, 15)).some(([title]) => title === 'Junior Programmers Guild'), 'shows up as a fixed block on Thursday');
});
test('17. a replan saves the day\'s plan; a moved block is marked, never deleted', () => {
  const st = demo();
  S.setClock(st, T.make(2026, 10, 12, 10, 0));
  const key = '2026-10-12';
  const first = st.plan.filter((s) => T.dayStart(s.start) === T.make(2026, 10, 12)).sort((a, b) => a.start - b.start)[0];
  ok(st.daySnapshots[key].blocks.some((b) => b.id === first.id), 'today is saved');
  const before = st.daySnapshots[key].blocks.length;
  S.snoozeSession(st, first.id);
  ok(st.daySnapshots[key].blocks.length >= before, 'no block was deleted');
  const sum = S.daySummary(st, key);
  ok(sum.blocks.every((b) => !b.missed), 'nothing counts as missed while the day is still running');
  const round = S.sanitize(JSON.parse(JSON.stringify(st)));
  eq(round.daySnapshots, st.daySnapshots, 'survives a save/load round trip');
  const old = JSON.parse(JSON.stringify(st)); delete old.daySnapshots;
  eq(S.sanitize(old).daySnapshots, {}, 'a save from before snapshots still loads');
});
test('18. Alex\'s previous week has finished work and one planned block that was not done', () => {
  const st = demo();
  S.setClock(st, T.make(2026, 10, 12, 6, 0));
  const days = ['05', '06', '07', '08', '09', '10'].map((d) => S.daySummary(st, `2026-10-${d}`));
  const count = (k) => days.reduce((a, d) => a + d[k].length, 0);
  eq([count('blocks'), count('done'), count('missed'), count('moved')], [7, 6, 1, 0]);
  eq(days[2].missed.map((b) => b.title), ['Algorithm Tracing Worksheet'], 'the block that was not done belongs to the task that is now overdue');
  ok(st.tasks.some((x) => x.title === 'Algorithm Tracing Worksheet' && x.status !== 'done'), 'and that task is still open');
  ok(days.reduce((a, d) => a + d.doneMins, 0) < days.reduce((a, d) => a + d.plannedMins, 0), 'done is less than planned');
  eq(S.daySummary(st, '2026-09-30').blocks.length, 0, 'an empty day is just empty');
});

console.log('\nReal clock');
test('19. "now" is the device clock, to the minute, in local wall time', () => {
  const real = Date.now(), n = realNow();
  eq(n % T.MIN, 0, 'whole minutes');
  ok(Math.abs(n - (real - new Date(real).getTimezoneOffset() * T.MIN)) <= T.MIN, 'matches the device local time');
  eq(T.parts(n).h, new Date(real).getHours(), 'same local hour as the device');
});
test('20. the sample week is built from today, on any date (mid-week, year end, late night)', () => {
  for (const when of [T.make(2026, 12, 30, 9, 0), T.make(2027, 1, 1, 14, 0), T.make(2027, 3, 6, 23, 50), T.make(2028, 2, 29, 7, 15)]) {
    T.now = () => when;
    const st = demo();
    eq(st.now, when, 'the plan starts from the current time');
    ok(st.plan.length >= 3 && st.plan.every((s) => s.start >= when), 'every planned session is in the future');
    const open = st.tasks.filter((t) => t.status !== 'done');
    eq(open.filter((t) => t.deadline < when).map((t) => t.title), ['Algorithm Tracing Worksheet'], 'only the carried-over task is overdue');
    ok(open.every((t) => Math.abs(t.deadline - when) < 21 * T.DAY), 'deadlines sit near today, not on a fixed calendar date');
    ok(Object.keys(st.daySnapshots).every((k) => k <= T.key(when)) && st.history.every((h) => h.end < when), "last week's records are in the past");
    eq(T.dow(Math.min(...st.history.map((h) => h.start))), 1, "last week's work starts on a Monday");
  }
  T.now = () => FIXED_NOW;
});


// ---------------------------------------------------------------------------------------------
// Prompt 10: adaptive scheduling, deadline-first/difficulty-second, completion confidence,
// Ask SIKAD task commands, persistence. Fixtures use an empty baseline (06:00–22:00, 15-min buffer)
// in October 2026 (the 12th is a Monday) unless a test loads the sample week.
const at = (d, h, m = 0) => T.make(2026, 10, d, h, m);
const blank = (now) => { const st = S.initialState(); st.now = now; st.onboarded = true; st.baseline.routineMins = 0; return st; };
const add = (st, title, deadline, mins, extra) => { const t = Object.assign(S.makeTask(st, { title, deadline, durationMins: mins }), extra || {}); st.tasks.push(t); return t; };
const of = (st, t) => st.plan.filter((s) => s.taskId === t.id).sort((a, b) => a.start - b.start);
const planned = (st, t) => of(st, t).reduce((a, s) => a + s.mins, 0);
const hand = (t, start, end) => ({ id: t.id + '#0', unitId: t.id, taskId: t.id, partId: null, title: t.title, priority: t.priority, start, end, mins: Math.round((end - start) / T.MIN), session: 1, sessions: 1 });
/** No session after its (future) deadline, outside the day window, overlapping a fixed item, or closer than the buffer. */
function planProblems(st) {
  const bad = bufferViolations(st);
  for (const s of st.plan) {
    const t = st.tasks.find((x) => x.id === s.taskId);
    if (t.deadline > st.now && !t.lateOk && s.end > t.deadline) bad.push(`${s.title} ends after its deadline`);
    if (s.start < T.at(T.dayStart(s.start), st.baseline.dayStart) || s.end > T.at(T.dayStart(s.start), st.baseline.dayEnd)) bad.push(`${s.title} is outside the day`);
    if (s.start < st.now - 60 * T.MIN) bad.push(`${s.title} starts in the past`);
  }
  return bad;
}
const core = (st) => JSON.stringify([st.tasks, st.plan, st.events, st.history, st.workLog, st.unscheduled]);
const ask = (st, text) => parse(st, text).intents;
/** Review → proposal on a copy → accept, as the app does it. */
const propose = (st, text) => S.previewIntents(st, ask(st, text).filter((i) => i.taskId && i.type !== 'unclear'));
const conf = (st) => E.completionConfidence(st, st.now);

console.log('\nAdaptive scheduling (overruns and cross-day replans)');
test('overrun: A 8–9 PM done at 9:10 PM; B keeps its full hour and leaves the 10 PM cutoff alone', () => {
  const st = blank(at(12, 19, 0));
  const a = add(st, 'Task A', at(15, 17), 60), b = add(st, 'Task B', at(15, 17), 60);
  st.plan = [hand(a, at(12, 20), at(12, 21)), hand(b, at(12, 21), at(12, 22))];
  st.now = at(12, 21, 10);
  S.completeSession(st, a.id + '#0');
  const sb = of(st, b);
  eq(planned(st, b), 60, 'B is not shortened');
  ok(sb[0].start >= at(12, 21, 25) || T.dayStart(sb[0].start) > at(12, 0), 'B cannot start before 9:25 PM');
  ok(T.dayStart(sb[0].start) === at(13, 0), 'a full hour no longer fits tonight, so B moves to tomorrow');
  eq(planProblems(st), []); eq(a.status, 'done'); eq(b.remainingMins, 60);
});
test('overrun: only the remaining work is rescheduled, and it stays today when it fits', () => {
  const st = blank(at(12, 9, 0));
  const a = add(st, 'Essay', at(14, 17), 120);
  S.replan(st, 'start');
  S.startSession(st, of(st, a)[0].id, { method: 'none' });
  st.now = at(12, 11, 0);
  S.endFocus(st, { outcome: 'partial', remainingMins: 45, focusedMins: 110 });
  eq(a.remainingMins, 45); eq(planned(st, a), 45, 'only what is left is planned');
  eq(T.dayStart(of(st, a)[0].start), at(12, 0), 'placed later today');
  ok(of(st, a)[0].start >= at(12, 11, 15), 'a buffer after the work that just ended');
  eq(st.workLog.reduce((x, w) => x + w.mins, 0), 75, 'only finished minutes are credited');
  eq(planProblems(st), []);
});
test('needing more time than estimated grows the plan and credits nothing', () => {
  const st = blank(at(12, 9, 0));
  const a = add(st, 'Lab', at(14, 17), 60);
  S.replan(st, 'start');
  S.startSession(st, of(st, a)[0].id, { method: 'none' });
  st.now = at(12, 10, 0);
  S.endFocus(st, { outcome: 'partial', remainingMins: 90, focusedMins: 60 });
  eq([a.remainingMins, planned(st, a), st.workLog.length], [90, 90, 0]);
});
test('work that no longer fits today moves to tomorrow before its deadline and competes there by deadline', () => {
  const st = blank(at(12, 20, 0));
  const big = add(st, 'Report', at(13, 12), 90), later = add(st, 'Reading', at(16, 17), 60);
  S.addEvent(st, { title: 'Shift', start: at(12, 20, 15), end: at(12, 22) });
  S.replan(st, 'start');
  ok(of(st, big).every((s) => T.dayStart(s.start) === at(13, 0)), 'nothing is squeezed into tonight');
  ok(of(st, big)[0].start < of(st, later)[0].start, 'the task due sooner goes first tomorrow');
  ok(of(st, big).slice(-1)[0].end <= big.deadline, 'before its deadline'); eq(planProblems(st), []);
});
test('a displaced task is ranked with everything else on its new day, not put on top', () => {
  const st = blank(at(12, 21, 0));
  const urgent = add(st, 'Due first thing', at(13, 9), 60), moved = add(st, 'Snoozed', at(15, 17), 60);
  S.replan(st, 'start');
  const first = E.nextSession(st.plan, st.now);
  S.snoozeSession(st, of(st, moved)[0].id);
  ok(of(st, urgent)[0].start < of(st, moved)[0].start, 'the earlier deadline still goes first');
  ok(first, 'there was a plan'); eq(planProblems(st), []);
});
test('deadline rescue: flexible later-due and overdue work yields when that makes a valid plan', () => {
  const st = blank(at(13, 19, 0));
  const overdue = add(st, 'Overdue sheet', at(7, 17), 60), soon = add(st, 'Problem Statement and Scope', at(14, 8), 90), later = add(st, 'Class diagram', at(16, 17), 60);
  S.replan(st, 'start');
  eq(st.status, 'SUCCESS'); eq(st.unscheduled, []);
  ok(of(st, soon).slice(-1)[0].end <= soon.deadline, 'the task that can still make its deadline does');
  eq([planned(st, overdue), planned(st, later)], [60, 60], 'the others keep their full time'); eq(planProblems(st), []);
});
test('the sample week at 7 PM fits "Problem Statement and Scope" (90 min, due tomorrow 5 PM)', () => {
  T.now = () => at(13, 19, 0);
  const st = demo();
  const t = add(st, 'Problem Statement and Scope', at(14, 17), 90, { context: 'IT 207' });
  S.replan(st, 'import');
  T.now = () => FIXED_NOW;
  eq(st.unscheduled.map((u) => u.title), [], 'a valid plan exists, so nothing is left out');
  eq(planned(st, t), 90); ok(of(st, t).slice(-1)[0].end <= t.deadline); eq(planProblems(st), []);
  eq(fixedOn(st, at(14, 0)), fixedOn(demo(), at(14, 0)), 'fixed commitments did not move');
});
test('no valid plan: reported as not enough time, with honest numbers and no changed deadline or duration', () => {
  const st = blank(at(13, 20, 0));
  const a = add(st, 'Big project', at(14, 8), 300);
  S.replan(st, 'start');
  eq(st.status, 'INFEASIBLE'); eq(st.unscheduled.map((u) => [u.title, u.mins]), [['Big project', 300]]);
  eq([a.deadline, a.remainingMins], [at(14, 8), 300]);
  const c = st.alerts.find((x) => x.code === 'TIME_SHORTAGE');
  ok(c && c.freeMins < 300 && c.shortMins === 300 && /doesn't fit/.test(c.message), 'the message states the real shortage');
  eq(planProblems(st), []);
});
test('dependencies stay in order through a replan', () => {
  const st = blank(at(12, 9, 0));
  const first = add(st, 'Proposal', at(15, 17), 60), second = add(st, 'Slides', at(14, 17), 60, {});
  second.dependencies = [first.id];
  S.replan(st, 'start');
  ok(of(st, first).slice(-1)[0].end + 15 * T.MIN <= of(st, second)[0].start, 'the prerequisite ends a buffer before the dependent task');
});

console.log('\nPrioritization (deadline first, difficulty second)');
const order = (st) => E.rank(E.units(st), st.now).map((u) => u.title);
test('a task due sooner outranks a comparable task due later', () => {
  const st = blank(at(12, 9));
  add(st, 'Later', at(16, 17), 60); add(st, 'Sooner', at(13, 17), 60);
  eq(order(st), ['Sooner', 'Later']);
});
test('difficulty decides between tasks that are urgent on the same day', () => {
  const st = blank(at(12, 9));
  add(st, 'Easy one', at(14, 12), 60, { difficulty: 'easy' }); add(st, 'Hard one', at(14, 18), 60, { difficulty: 'hard' }); add(st, 'Plain one', at(14, 15), 60);
  eq(order(st), ['Hard one', 'Plain one', 'Easy one']);
  S.replan(st, 'start');
  ok(of(st, st.tasks[1])[0].start < of(st, st.tasks[0])[0].start, 'the hard task gets the earlier block');
  eq(planProblems(st), []);
});
test('a hard task due Friday does not jump ahead of an easy task due tomorrow', () => {
  const st = blank(at(12, 9));
  add(st, 'Hard project', at(16, 17), 120, { difficulty: 'hard' }); add(st, 'Easy assignment', at(13, 17), 45, { difficulty: 'easy' });
  eq(order(st), ['Easy assignment', 'Hard project']);
  S.replan(st, 'start');
  eq(st.unscheduled, []); ok(of(st, st.tasks[0]).slice(-1)[0].end <= at(16, 17), 'time is still held for the hard project before Friday');
});
test('a hard task gets one uninterrupted sitting when one exists', () => {
  const st = blank(at(12, 9));
  const h = add(st, 'Hard proof', at(14, 17), 100, { difficulty: 'hard' });
  S.addEvent(st, { title: 'Class', start: at(12, 10), end: at(12, 12) });
  S.replan(st, 'start');
  eq(of(st, h).length, 1);
});
test('overdue first, no-deadline tasks wait for a date, and ties are stable', () => {
  const st = blank(at(12, 9));
  add(st, 'B same', at(14, 17), 60); add(st, 'A same', at(14, 17), 60); add(st, 'Overdue', at(10, 17), 60); add(st, 'No date', null, 60);
  eq(order(st), ['Overdue', 'B same', 'A same', 'No date'], 'overdue first, equal tasks in creation order, no-deadline last');
  eq(order(st), order(st), 'same input, same order');
  S.replan(st, 'start');
  eq(st.needsDeadline.length, 1); ok(!st.plan.some((s) => s.title === 'No date'), 'no deadline is invented');
});
test('unknown difficulty is treated as medium; difficulty words are read from the text', () => {
  const st = blank(at(12, 9));
  const t = add(st, 'Old task', at(14, 17), 60); delete t.difficulty;
  eq(E.units(st)[0].difficulty, 'medium');
  eq(ask(st, 'I have a really difficult calculus problem set due Friday, about 2 hours')[0].task.difficulty, 'hard');
  eq(ask(st, 'Math homework due tomorrow, about 45 minutes')[0].task.difficulty, 'medium');
});

console.log('\nCompletion confidence (today)');
test('a comfortably schedulable task shows no percentage', () => {
  const st = blank(at(12, 9));
  add(st, 'Short task', at(14, 17), 60);
  S.replan(st, 'start');
  const c = conf(st);
  eq(c.length, 1); eq([c[0].level, c[0].show, c[0].percent], ['ok', false, 100]);
});
test('a tight evening shows an estimate and a reason; more load or less time lowers it', () => {
  const mk = (now, n) => { const st = blank(now); for (let i = 0; i < n; i++) add(st, 'Task ' + (i + 1), at(13, 9), 60); S.replan(st, 'start'); return st; };
  const tight = conf(mk(at(12, 19, 30), 2));
  const last = tight[tight.length - 1];
  ok(last.show && last.label === 'At risk' && last.percent < E.CONFIDENCE.SHOW_BELOW, 'the second task tonight is at risk');
  ok(/usable time left today/.test(last.reason) && last.usableMins > 0 && last.neededMins === 60, 'the reason uses the real numbers');
  const roomy = conf(mk(at(12, 14, 0), 2));
  ok(roomy[1].percent > last.percent, 'more usable time, higher estimate');
  const one = conf(mk(at(12, 19, 30), 1));
  ok(one[0].percent > last.percent, 'less competing work, higher estimate');
});
test('reporting partial progress changes the estimate, based on what is left', () => {
  const st = blank(at(12, 18, 30));
  const a = add(st, 'Worksheet', at(13, 9), 150);
  S.replan(st, 'start');
  const before = conf(st).find((x) => x.taskId === a.id);
  S.setTaskRemaining(st, a.id, 45); S.replan(st, 'progress');
  const after = conf(st).find((x) => x.taskId === a.id);
  ok(before.show && after.percent > before.percent && after.neededMins === 45, `${before.percent} → ${after.percent}`);
});
test('a task that left today is "Won\'t fit today"; one with no slot at all is "Not enough time"; neither shows a percentage', () => {
  const st = blank(at(12, 19));
  const a = add(st, 'Task A', at(15, 17), 60), b = add(st, 'Task B', at(15, 17), 60);
  st.plan = [hand(a, at(12, 20), at(12, 21)), hand(b, at(12, 21), at(12, 22))];
  st.now = at(12, 21, 10);
  S.completeSession(st, a.id + '#0');
  const wb = conf(st).find((x) => x.taskId === b.id);
  eq([wb.level, wb.label, wb.percent], ['wont_fit', "Won't fit today", null]); ok(/planned for/.test(wb.reason));
  const st2 = blank(at(13, 20));
  const big = add(st2, 'Big project', at(14, 8), 300);
  S.replan(st2, 'start');
  const ib = conf(st2).filter((x) => x.taskId === big.id);
  eq(ib.map((x) => [x.level, x.percent]), [['infeasible', null]], 'infeasibility replaces any percentage');
});
test('edge cases never crash or give NaN: no time left, bad durations, no deadline, fixed blocks', () => {
  const st = blank(at(12, 21, 58));
  const a = add(st, 'Late', at(12, 23), 60), b = add(st, 'Odd', null, 60);
  st.plan = [hand(a, at(12, 21), at(12, 22)), Object.assign(hand(b, at(12, 21, 30), at(12, 22)), { mins: NaN })];
  S.addEvent(st, { title: 'Shift', start: at(12, 20), end: at(12, 22) });
  const c = conf(st);
  ok(c.every((x) => x.percent == null || (Number.isInteger(x.percent) && x.percent >= 0 && x.percent <= 100)), JSON.stringify(c.map((x) => x.percent)));
  eq(c.find((x) => x.taskId === a.id).percent, 0, 'no usable time means 0%, shown as high risk');
  eq(JSON.stringify(conf(st)), JSON.stringify(c), 'deterministic');
  eq(conf(blank(at(12, 9))), [], 'an empty plan has nothing to report');
});
test('the sample week: confidence is reported only for tasks planned today', () => {
  const st = demo();
  const today = new Set(st.plan.filter((s) => T.dayStart(s.start) === T.dayStart(st.now)).map((s) => s.taskId));
  ok(conf(st).filter((x) => x.percent != null).every((x) => today.has(x.taskId)));
});

console.log('\nAsk SIKAD: commands on existing tasks');
const CDE = 'Class Diagram Exercise';
const cde = (st) => st.tasks.find((t) => t.title === CDE);
test('C8.1 a new task still goes through the creation path', () => {
  const i = ask(demo(), 'New assignment: history essay due Friday, about 2 hours');
  eq(i.map((x) => x.type), ['task']); eq(i[0].task.durationMins, 120);
});
test('C8.2 "Move … to 8 PM if it fits" names the right task and treats 8 PM as a start time', () => {
  const st = demo(), t = cde(st), dl = t.deadline;
  const i = ask(st, `Move ${CDE} to 8 PM tomorrow if it fits`)[0];
  eq([i.type, i.taskId, i.ifFits], ['move', t.id, true]);
  eq(i.start, T.addDays(T.dayStart(st.now), 1) + 20 * 60 * T.MIN); ok(!('deadline' in i));
  const { draft } = S.previewIntents(st, [i]);
  eq(cde(draft).deadline, dl, 'the deadline is untouched');
});
test('C8.3 a time with no clear day asks which day', () => {
  const st = blank(at(12, 9));
  add(st, 'Lab report', at(16, 17), 240);
  S.replan(st, 'start');
  ok(new Set(st.plan.map((s) => T.dayStart(s.start))).size > 1 || st.plan.length >= 1);
  st.plan.push(Object.assign({}, st.plan[0], { id: 'x#9', start: at(13, 9), end: at(13, 10) }));
  const i = ask(st, 'Move Lab report to 8 PM');
  eq([i.length, i[0].type, i[0].code], [1, 'unclear', 'DAY_AMBIGUOUS']); ok(/Which day/.test(i[0].question));
});
test('C8.4 an exact title resolves to that task id, ignoring case and punctuation', () => {
  const st = demo();
  eq(P.resolveTask('please move the CLASS-DIAGRAM exercise!', st.tasks).task.id, cde(st).id);
});
test('C8.5 two similar titles ask which one, and change nothing', () => {
  const st = blank(at(12, 9));
  add(st, 'Class Diagram Exercise', at(14, 17), 60); add(st, 'Class Diagram Quiz', at(15, 17), 60);
  S.replan(st, 'start');
  const before = core(st), i = ask(st, 'Remove the class diagram');
  eq([i[0].type, i[0].code, i[0].candidates.length], ['unclear', 'TASK_AMBIGUOUS', 2]);
  ok(/Class Diagram Exercise/.test(i[0].question) && /Class Diagram Quiz/.test(i[0].question) && /due/.test(i[0].question));
  eq(ask(st, 'Remove Class Diagram Quiz')[0].taskId, st.tasks[1].id, 'the full title is not ambiguous');
  eq(core(st), before);
});
test('C8.6 a task that does not exist is reported, never created', () => {
  const st = demo(), before = core(st);
  for (const text of ['Remove the Thesis Chapter', 'Move Thesis Chapter to 8 PM tomorrow', 'Rename Thesis Chapter to Capstone', 'Mark Thesis Chapter as done']) {
    const i = ask(st, text);
    eq(i.map((x) => [x.type, x.code]), [['unclear', 'TASK_NOT_FOUND']], text); ok(/couldn't find/.test(i[0].question));
  }
  eq(core(st), before);
});
test('C8.7 "Change … to 2 hours" edits the time needed and the plan follows', () => {
  const st = demo(), t = cde(st);
  const i = ask(st, `Change ${CDE} to 2 hours`)[0];
  eq([i.type, i.mins], ['set_duration', 120]);
  const { draft } = S.previewIntents(st, [i]);
  eq([cde(draft).durationMins, planned(draft, cde(draft)), cde(draft).isAiEstimate], [120, 120, false]);
  eq(planned(st, t), 60, 'the real plan waits for approval');
});
test('C8.8 a deadline command changes the deadline, not the planned time', () => {
  const st = demo(), t = cde(st);
  const i = ask(st, `Change the deadline for ${CDE} to Friday at 5 PM`)[0];
  eq([i.type, i.taskId, i.oldDeadline], ['deadline_change', t.id, t.deadline]);
  eq([T.dow(i.deadline), T.time(i.deadline)], [5, '5:00 PM']);
  const { draft } = S.previewIntents(st, [i]);
  eq([cde(draft).deadline, cde(draft).pinnedStart], [i.deadline, null]);
  eq(ask(st, `Change the deadline for ${CDE}`)[0].code, 'DEADLINE_WHEN', 'no date given: ask, do not guess');
});
test('C8.9 removal is a proposal: rejecting it leaves the task; accepting removes it', () => {
  const st = demo(), before = core(st);
  const i = ask(st, `Delete ${CDE} from my tasks`);
  eq(i.map((x) => x.type), ['cancel_task']);
  const { draft } = S.previewIntents(st, i);
  eq(core(st), before, 'nothing is removed until it is accepted');
  eq(cde(draft).status, 'cancelled'); ok(!draft.plan.some((s) => s.taskId === cde(draft).id));
});
test('C8.10 "Mark … as done" completes that task through the normal path and credits its time', () => {
  const st = demo(), t = cde(st), left = S.taskRemaining(t), done0 = S.weeklyProgress(st).doneMins;
  const i = ask(st, `Mark ${CDE} as done`);
  eq(i.map((x) => [x.type, x.taskId]), [['complete', t.id]]);
  eq(S.applyIntent(st, i[0]).ok, true); S.replan(st, 'done');
  eq([t.status, S.weeklyProgress(st).doneMins - done0], ['done', left]); ok(!st.plan.some((s) => s.taskId === t.id));
});
test('C8.11 partial progress uses the stated remaining time and credits only what was done', () => {
  const st = demo(), t = cde(st), done0 = S.weeklyProgress(st).doneMins;
  const i = ask(st, `I finished half of ${CDE}; I still need about 45 minutes`);
  eq(i.map((x) => [x.type, x.taskId, x.remainingMins]), [['partial', t.id, 45]]);
  S.applyIntent(st, i[0]); S.replan(st, 'partial');
  eq([S.taskRemaining(t), planned(st, t), S.weeklyProgress(st).doneMins - done0], [45, 45, 15]);
  const over = ask(st, `${CDE} took longer than expected. Reschedule the remaining work.`);
  eq(over.map((x) => [x.type, x.remainingMins]), [['partial', null]], 'the remaining time is asked for, not invented');
  eq(S.applyIntent(st, over[0]).ok, false);
});
test('C8.12 a requested time inside a fixed commitment is not forced; the commitment does not move', () => {
  const st = blank(at(12, 9));
  const t = add(st, 'Reading', at(15, 17), 60);
  S.addEvent(st, { title: 'Work shift', start: at(12, 18), end: at(12, 22) });
  S.replan(st, 'start');
  const fixed = fixedOn(st, at(12, 0));
  const { draft } = propose(st, 'Move Reading to 8 PM today');
  ok(draft.alerts.some((a) => a.code === 'PIN_FAILED' && /fixed commitment/.test(a.message)), 'the clash is explained');
  eq(fixedOn(draft, at(12, 0)), fixed); eq(planned(draft, draft.tasks[0]), 60);
  ok(!of(draft, draft.tasks[0]).some((s) => s.start < at(12, 22) && s.end > at(12, 18)), 'an open slot is offered instead');
  eq(draft.tasks[0].pinnedStart, null, 'the failed request is not kept'); eq(planProblems(draft), []);
  eq(t.pinnedStart, null);
});
test('C8.13 a feasible move keeps the full duration and replans the task that was in the way', () => {
  const st = blank(at(12, 8, 10));
  const a = add(st, 'Alpha', at(13, 9), 60), b = add(st, 'Beta', at(15, 17), 90);
  S.replan(st, 'start');
  const aStart = of(st, a)[0].start;
  const { draft } = propose(st, `Move Beta to ${T.time(aStart)} today`);
  const [da, db] = draft.tasks;
  eq([of(draft, db)[0].start, planned(draft, db), planned(draft, da)], [aStart, 90, 60]);
  ok(of(draft, da)[0].start !== aStart, 'the flexible task moved out of the way'); eq(planProblems(draft), []);
  ok(draft.lastUpdate.changes.some((c) => c.action === 'RESCHEDULE' && c.from && c.to), 'before → after is recorded');
});
test('C8.14 an infeasible move is explained and changes no deadline or duration', () => {
  const st = blank(at(12, 9));
  const t = add(st, 'Paper', at(12, 20), 120);
  S.replan(st, 'start');
  const { draft } = propose(st, 'Move Paper to 7 PM today');
  ok(draft.alerts.some((a) => a.code === 'PIN_FAILED' && /after the deadline/.test(a.message)));
  eq([draft.tasks[0].deadline, draft.tasks[0].durationMins, planned(draft, draft.tasks[0])], [t.deadline, 120, 120]);
  eq(S.applyTaskAction(st, { type: 'move', taskId: t.id, start: at(12, 8) }).ok, false, 'a time in the past is refused');
  eq(S.applyTaskAction(st, { type: 'set_duration', taskId: t.id, mins: NaN }).ok, false); eq(t.durationMins, 120);
});
test('C8.15 questions and previews never change anything', () => {
  const st = demo(), before = core(st);
  const w = A.answer(st, `What happens to my schedule if I move ${CDE} to 8 PM tomorrow?`);
  eq(w.kind, 'whatif'); ok(w.lines.some((l) => /Nothing was changed/.test(l)));
  const l = A.answer(st, 'Show me the tasks due tomorrow'); eq(l.kind, 'list');
  const one = A.answer(st, `When is ${CDE}?`); eq([one.kind, one.title], ['inspect', CDE]);
  eq(ask(st, 'Show me my grades').map((x) => x.type), ['unclear'], 'an unknown question is not turned into a task');
  eq(core(st), before);
});
test('C8.16 a rejected proposal leaves the whole plan as it was', () => {
  const st = demo(), before = JSON.stringify(st);
  propose(st, `Move ${CDE} to 9 PM tomorrow and mark Big-O Worksheet as done`);
  eq(JSON.stringify(st), before);
});
test('C8.17 an invalid action in a set changes nothing for that action; a failed save reports false', () => {
  const st = demo();
  const r = S.previewIntents(st, [{ type: 'set_duration', taskId: cde(st).id, mins: -5 }, { type: 'rename', taskId: 'nope', newTitle: 'X' }]);
  eq([r.applied.length, r.errors.length], [0, 2]); eq(core(r.draft), core(st));
  const saved = globalThis.localStorage;
  globalThis.localStorage = { setItem() { throw new Error('QuotaExceededError'); }, getItem() { return null; }, removeItem() {} };
  eq([S.save(st), S.storageAvailable()], [false, false]);
  const mem = {};
  globalThis.localStorage = { setItem(k, v) { mem[k] = String(v); }, getItem(k) { return k in mem ? mem[k] : null; }, removeItem(k) { delete mem[k]; } };
  eq([S.save(st), S.storageAvailable()], [true, true]); eq(S.load().tasks.length, st.tasks.length);
  mem[S.KEY] = '{broken';
  const fresh = S.load();
  ok(/could not be read/.test(fresh.loadNotice) && fresh.tasks.length === 0 && mem[S.KEY + ':unreadable'] === '{broken', 'damaged data is set aside and announced');
  globalThis.localStorage = saved;
});
test('C8.18 after a rename, the new title is the one that works', () => {
  const st = demo(), id = cde(st).id;
  const i = ask(st, `Rename ${CDE} to UML Diagram Activity`);
  eq([i[0].type, i[0].newTitle], ['rename', 'UML Diagram Activity']);
  S.applyIntent(st, i[0]); S.replan(st, 'rename');
  eq(ask(st, 'Change UML Diagram Activity to 90 minutes')[0].taskId, id);
  ok(st.plan.filter((s) => s.taskId === id).every((s) => s.title === 'UML Diagram Activity'));
});
test('C8.19 a finished or removed task is not treated as open', () => {
  const st = demo(), t = cde(st);
  S.completeTask(st, t.id); S.replan(st, 'done');
  eq(ask(st, `Move ${CDE} to 8 PM tomorrow`).map((x) => [x.type, x.code]), [['unclear', 'TASK_CLOSED']]);
  eq(S.applyTaskAction(st, { type: 'set_duration', taskId: t.id, mins: 30 }).ok, false);
  eq(A.answer(st, `When is ${CDE}?`).facts[0], ['Status', 'Done']);
});
test('several actions in one message are resolved one by one; "it" needs a named task', () => {
  const st = demo();
  eq(ask(st, `Move ${CDE} to 9 PM tomorrow and mark Big-O Worksheet as done`).map((x) => [x.type, x.title]), [['move', CDE], ['complete', 'Big-O Worksheet']]);
  eq(ask(st, `Edit ${CDE} and set its schedule to 8 PM tomorrow`).map((x) => [x.type, x.title]), [['move', CDE]]);
  eq(ask(st, 'Move it to 8 PM tomorrow').map((x) => [x.type, x.code]), [['unclear', 'TASK_UNNAMED']]);
  eq(ask(st, `Move ${CDE} to tomorrow, but keep the full duration`).map((x) => [x.type, x.day != null]), [['move', true]]);
  eq(ask(st, `Schedule ${CDE} for the next available slot`).map((x) => [x.type, x.auto]), [['move', true]]);
  eq(ask(st, `Mark ${CDE} as hard`).map((x) => [x.type, x.difficulty]), [['set_difficulty', 'hard']]);
});
test('existing inputs still mean what they meant (commitments, cancellations, new tasks)', () => {
  const st = demo();
  eq(ask(st, 'I have a work shift tomorrow from 6 PM to 10 PM').map((x) => x.type), ['event']);
  eq(ask(st, 'Schedule a meeting with my adviser tomorrow from 3 PM to 4 PM').map((x) => x.type), ['event']);
  eq(ask(st, 'I need another hour for the Big-O Worksheet').map((x) => x.type), ['extend']);
  eq(ask(st, 'Can you write my essay for me?').map((x) => x.type), ['refuse']);
});

console.log('\nToo much work: an adjusted plan the student accepts or rejects');
const overloaded = () => {
  const st = blank(at(13, 20, 0));
  add(st, 'Quiz review', at(14, 8), 120, { priority: 'high' }); add(st, 'Reflection', at(14, 8), 120, { priority: 'low' }); add(st, 'Worksheet', at(14, 8), 60, { priority: 'medium' });
  S.replan(st, 'start');
  return st;
};
test('nothing to adjust when everything fits', () => {
  const st = blank(at(12, 9)); add(st, 'Small', at(14, 17), 60); S.replan(st, 'start');
  eq(S.suggestAdjustment(st), null);
});
test('the adjusted plan is worked out on a copy; the real plan waits for a decision', () => {
  const st = overloaded(), before = JSON.stringify(st);
  eq(st.status, 'INFEASIBLE');
  const adj = S.suggestAdjustment(st);
  eq(JSON.stringify(st), before, 'rejecting it (doing nothing) leaves everything as it was');
  ok(adj && adj.draft.status === 'SUCCESS' && adj.stillUnfit.length === 0, 'the copy has a place for everything');
});
test('the lowest-priority competing task gives way; the rest stay on time; nothing is shortened or re-dated', () => {
  const st = overloaded(), adj = S.suggestAdjustment(st), d = adj.draft;
  eq(adj.late.map((l) => l.title), ['Reflection'], 'only the low-priority task is late');
  const late = adj.late[0];
  ok(late.finish > late.deadline && late.lateMins === Math.round((late.finish - late.deadline) / T.MIN) && late.mins === 120);
  eq(d.tasks.map((t) => [t.title, t.deadline, t.remainingMins, !!t.lateOk]), st.tasks.map((t) => [t.title, t.deadline, t.remainingMins, t.title === 'Reflection']));
  eq(d.tasks.map((t) => planned(d, t)), [120, 120, 60], 'every task keeps its full time');
  for (const t of d.tasks.filter((x) => !x.lateOk)) ok(of(d, t).slice(-1)[0].end <= t.deadline, `${t.title} is on time`);
  eq(planProblems(d), []);
  ok(d.alerts.some((x) => x.code === 'PLANNED_LATE' && /Reflection/.test(x.message) && /deadline itself has not been changed/.test(x.message)), 'the student is told what is late');
  ok(d.lastUpdate.changes.length > 0 && /Adjusted plan/.test(d.lastUpdate.trigger), 'before → after is recorded for the proposal and Undo');
});
test('only as many tasks give way as are needed, and fixed commitments do not move', () => {
  const st = blank(at(13, 18, 30));
  S.addEvent(st, { title: 'Shift', start: at(13, 20), end: at(13, 22) });
  add(st, 'A', at(14, 8), 60, { priority: 'low' }); add(st, 'B', at(14, 8), 60, { priority: 'low' }); add(st, 'C', at(14, 8), 60, { priority: 'high' });
  S.replan(st, 'start');
  const fixed = fixedOn(st, at(13, 0)), adj = S.suggestAdjustment(st);
  ok(adj.late.length >= 1 && adj.late.length < 3 && adj.late.every((l) => l.priority === 'low'), JSON.stringify(adj.late.map((l) => l.title)));
  eq(fixedOn(adj.draft, at(13, 0)), fixed); eq(planProblems(adj.draft), []);
});
test('an agreed-late task goes back to on time when room appears, and a new deadline clears the agreement', () => {
  const st = overloaded(), d = S.suggestAdjustment(st).draft;
  const refl = d.tasks.find((t) => t.title === 'Reflection');
  S.completeTask(d, d.tasks[0].id); S.completeTask(d, d.tasks[2].id); S.replan(d, 'two done');
  eq([refl.lateOk, d.late.length], [false, 0]); ok(of(d, refl).slice(-1)[0].end <= refl.deadline);
  const d2 = S.suggestAdjustment(overloaded()).draft, r2 = d2.tasks.find((t) => t.title === 'Reflection');
  S.applyTaskAction(d2, { type: 'deadline_change', taskId: r2.id, deadline: at(16, 17) }); eq(r2.lateOk, false);
});
test('an overloaded sample week gets a plan with a place for everything', () => {
  T.now = () => at(13, 20, 30);
  const st = demo();
  for (const src of ['teams', 'canvas', 'classroom']) for (const a of D.SAMPLE_ASSIGNMENTS[src]) add(st, a.title, T.at(T.addDays(T.dayStart(st.now), a.due[0]), a.due[1] * 60 + a.due[2]), a.mins);
  S.replan(st, 'import');
  T.now = () => FIXED_NOW;
  eq(st.status, 'INFEASIBLE');
  const adj = S.suggestAdjustment(st);
  eq([adj.draft.status, adj.stillUnfit.length], ['SUCCESS', 0]); ok(adj.late.length >= 1); eq(planProblems(adj.draft), []);
  eq(fixedOn(adj.draft, at(14, 0)), fixedOn(st, at(14, 0)));
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
