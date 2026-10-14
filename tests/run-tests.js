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
  const w0 = S.weeklyProgress(st); eq([w0.doneMins, w0.totalMins, w0.percent], [0, 390, 0], 'last week\'s finished work does not count toward this week, and a block that passed unreported is still planned work');
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
  ok(last.show && last.label === 'At risk today' && last.percent < E.CONFIDENCE.SHOW_BELOW, 'the second task tonight is at risk');
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
test('what the student is shown is a status, a reason and an action, never the score', () => {
  const shown = (r) => [r.label, r.what, r.why].join(' ');
  // comfortable: nothing to show
  const easy = blank(at(12, 9)); add(easy, 'Short task', at(14, 17), 60); S.replan(easy, 'start');
  ok(conf(easy).every((r) => !r.show && r.label == null && r.what == null && r.why == null), 'a task that fits comfortably carries no warning text');
  // at risk today: planned today, tight
  const tight = blank(at(12, 19, 30)); for (let i = 0; i < 2; i++) add(tight, 'Task ' + (i + 1), at(13, 9), 60); S.replan(tight, 'start');
  const r = conf(tight).filter((x) => x.show).pop();
  eq([r.level === 'risk' || r.level === 'high', r.label, r.what, r.next], [true, 'At risk today', 'This task may not fit today.', 'adjust']);
  ok(!/%|\bpercent|\bscore\b/i.test(shown(r)), `no number that needs explaining: ${shown(r)}`);
  ok(r.why.includes(T.dur(r.usableMins)) && r.why.includes(T.dur(r.neededMins)) && /after the task planned before it/.test(r.why), `the reason is built from the real numbers: ${r.why}`);
  ok(!/marked hard|is an estimate|has passed/.test(r.why), 'causes the data does not support are not claimed');
  ok(tight.plan.some((p) => p.taskId === r.taskId && T.dayStart(p.start) === T.dayStart(tight.now)) && tight.status === 'SUCCESS', 'a low score does not say "impossible": the task still has its slot today');
  // causes appear only when true
  const hard = blank(at(12, 20, 40)); add(hard, 'B', at(13, 9), 60, { difficulty: 'hard', isAiEstimate: true }); S.replan(hard, 'start');
  const hb = conf(hard).find((x) => x.title === 'B');
  ok(hb.show && /marked hard/.test(hb.why) && /is an estimate/.test(hb.why), hb.why);
  // won't fit today: a later slot exists
  const st = blank(at(12, 19));
  const a = add(st, 'Task A', at(15, 17), 60), b = add(st, 'Task B', at(15, 17), 60);
  st.plan = [hand(a, at(12, 20), at(12, 21)), hand(b, at(12, 21), at(12, 22))];
  st.now = at(12, 21, 10); S.completeSession(st, a.id + '#0');
  const wb = conf(st).find((x) => x.taskId === b.id), slot = of(st, b)[0];
  eq([wb.label, wb.what, wb.percent], ["Won't fit today", "This task won't fit today, but it has a later slot.", null]);
  ok(wb.why.includes(T.time(slot.start)) && /still before its deadline/.test(wb.why) && slot.end <= b.deadline, `names the real later slot: ${wb.why}`);
  // cannot fit before the deadline: explicit, whatever a score would have said
  const st2 = blank(at(13, 20)); const big = add(st2, 'Big project', at(14, 8), 300); S.replan(st2, 'start');
  const ib = conf(st2).filter((x) => x.taskId === big.id);
  eq(ib.map((x) => [x.level, x.label, x.what, x.next, x.percent]), [['infeasible', 'Not enough time before deadline', 'This task cannot fit before its deadline.', 'options', null]], 'one entry, and it is the infeasible one');
  ok(/no open block before/.test(ib[0].why) && /Nothing was shortened/.test(ib[0].why) && st2.status === 'INFEASIBLE');
  // an edit refreshes the status
  const big2 = st2.tasks[0]; S.applyTaskAction(st2, { type: 'deadline_change', taskId: big2.id, deadline: at(16, 17) }); S.replan(st2, 'more time');
  ok(st2.status === 'SUCCESS' && !conf(st2).some((x) => x.level === 'infeasible'), 'moving the deadline clears the infeasible status');
  S.setTaskRemaining(tight, r.taskId, 5); S.replan(tight, 'nearly done');
  ok(!conf(tight).some((x) => x.taskId === r.taskId && x.show), 'reporting that little is left clears the at-risk status');
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

console.log('\nOverdue work takes a real slot; replans reach later days');
const evening = (now) => { const st = blank(now); st.baseline.dayStart = '18:00'; st.baseline.dayEnd = '22:00'; return st; };
const dayOf = (st, t) => of(st, t).map((s) => T.parts(s.start).d);
const whole = (st) => st.tasks.filter((t) => t.status !== 'done' && t.deadline != null).every((t) => planned(st, t) === S.taskRemaining(t));
test('overdue work takes the earliest slot and the task it displaces is placed again, on time', () => {
  const st = blank(at(12, 9));
  const a = add(st, 'A', at(13, 17), 120), b = add(st, 'B', at(14, 17), 120);
  S.replan(st, 'start');
  eq(of(st, a)[0].start, at(12, 9), 'A starts the day before the overdue task exists');
  const old = add(st, 'Old', at(11, 17), 120);
  S.replan(st, 'an overdue task appears');
  eq([of(st, old)[0].start, of(st, old).slice(-1)[0].end], [at(12, 9), at(12, 11)], 'overdue work is in a real slot, first');
  ok(of(st, a)[0].start >= at(12, 11, 15) && of(st, a).slice(-1)[0].end <= a.deadline, 'A was displaced and still meets its deadline');
  ok(of(st, b)[0].start >= of(st, a).slice(-1)[0].end + 15 * T.MIN, 'B follows A, a buffer later');
  eq(old.deadline, at(11, 17), 'the overdue task keeps its real deadline');
  ok(whole(st), 'nothing lost or duplicated'); eq(planProblems(st), []);
  ok(st.alerts.some((x) => /Old/.test(x.message) && /past its deadline/.test(x.message)), 'and it is named as overdue');
});
test('a displacement carries through tomorrow and the days after, in deadline order', () => {
  const st = evening(at(12, 18));
  const a = add(st, 'A', at(13, 22), 180), b = add(st, 'B', at(14, 22), 180), c = add(st, 'C', at(15, 22), 180);
  S.replan(st, 'start');
  eq([dayOf(st, a)[0], dayOf(st, b)[0], dayOf(st, c)[0]], [12, 13, 14], 'one task an evening');
  const old = add(st, 'Old', at(11, 17), 180);
  S.replan(st, 'an overdue task appears');
  eq([dayOf(st, old), dayOf(st, a), dayOf(st, b), dayOf(st, c)].map((d) => [...new Set(d)]), [[12], [13], [14], [15]], 'each task moved one day on, not all to tomorrow');
  for (const t of [a, b, c]) ok(of(st, t).slice(-1)[0].end <= t.deadline, `${t.title} is still on time`);
  ok(whole(st)); eq(planProblems(st), []); eq(st.status, 'SUCCESS');
});
test('work that cannot fit today goes to tomorrow; work with no slot before its deadline is reported', () => {
  const st = blank(at(12, 21));
  const t = add(st, 'Essay', at(14, 17), 90);
  S.replan(st, 'start');
  eq(dayOf(st, t), [13], 'the whole task is planned tomorrow'); eq(planned(st, t), 90);
  const late = add(st, 'Due tonight', at(12, 22), 120);
  S.replan(st, 'no room');
  eq([st.status, planned(st, late), st.unscheduled.map((x) => x.title)], ['INFEASIBLE', 0, ['Due tonight']], 'not squeezed in, not shortened, not moved past its deadline');
  eq(late.remainingMins, 120);
});
test('a new deadline, time needed or priority changes the order on the next plan', () => {
  const st = blank(at(12, 9));
  const a = add(st, 'A', at(14, 17), 60), b = add(st, 'B', at(15, 17), 60);
  S.replan(st, 'start');
  ok(of(st, a)[0].start < of(st, b)[0].start, 'earlier deadline first');
  S.applyTaskAction(st, { type: 'deadline_change', taskId: b.id, deadline: at(13, 17) }); S.replan(st, 'deadline');
  ok(of(st, b)[0].start < of(st, a)[0].start, 'B is now due sooner, so it goes first');
  S.applyTaskAction(st, { type: 'set_duration', taskId: b.id, mins: 200 }); S.replan(st, 'duration');
  eq([planned(st, b), b.remainingMins], [200, 200], 'the new time needed is what gets planned, to the minute');
  S.applyTaskAction(st, { type: 'deadline_change', taskId: b.id, deadline: at(15, 9) }); S.replan(st, 'deadline back');
  ok(of(st, a)[0].start < of(st, b)[0].start);
  S.applyTaskAction(st, { type: 'set_priority', taskId: b.id, priority: 'high' }); S.replan(st, 'priority');
  ok(of(st, b)[0].start < of(st, a)[0].start, 'high priority pulls B ahead of a task due less than a day and a half earlier');
  eq(planProblems(st), []);
});
test('an overdue task that depends on another still waits for it; fixed commitments and the buffer hold', () => {
  const st = blank(at(12, 9));
  S.addEvent(st, { title: 'Shift', start: at(12, 10), end: at(12, 12) });
  const a = add(st, 'A', at(13, 17), 60), old = add(st, 'Old', at(11, 17), 60, { dependencies: [] });
  old.dependencies = [a.id];
  const fixed = fixedOn(st, at(12, 0));
  S.replan(st, 'start');
  ok(of(st, old)[0].start >= of(st, a).slice(-1)[0].end + 15 * T.MIN, 'the dependency comes first even though the dependant is overdue');
  eq(fixedOn(st, at(12, 0)), fixed); eq(planProblems(st), []);
  for (const s of st.plan) ok(s.end <= at(12, 10) - 15 * T.MIN || s.start >= at(12, 12) + 15 * T.MIN, `${s.title} keeps clear of the shift`);
});
test('snoozing a task that was pinned to a time really moves it', () => {
  const st = blank(at(12, 9));
  const t = add(st, 'Worksheet', at(14, 17), 60);
  S.applyTaskAction(st, { type: 'move', taskId: t.id, start: at(12, 20) }); S.replan(st, 'pin');
  eq(of(st, t)[0].start, at(12, 20));
  S.snoozeSession(st, of(st, t)[0].id);
  ok(of(st, t)[0].start >= at(12, 21), `moved to ${T.when(of(st, t)[0].start, st.now)}`); eq(t.pinnedStart, null); eq(planned(st, t), 60);
});

console.log('\nMissed blocks: a check-in, never an automatic completion');
const credit = (st, t) => st.workLog.filter((w) => w.taskId === t.id).reduce((x, w) => x + w.mins, 0);
const reload = (st) => S.sanitize(JSON.parse(JSON.stringify(st)));
const tick = (st, to) => S.setClock(st, to);
const heldFor = (st, t) => st.checkins.filter((c) => c.taskId === t.id).reduce((x, c) => x + c.mins, 0);
/** Every open task's time is either planned or waiting on a check-in: nothing lost, nothing doubled. */
const accounted = (st) => st.tasks.filter((t) => t.status !== 'done' && t.deadline != null).every((t) => planned(st, t) + heldFor(st, t) === S.taskRemaining(t));
const ahead = (st) => JSON.stringify(st.plan.filter((s) => s.end > st.now).map((s) => [s.unitId, s.start, s.end]));
test('a block whose planned end has passed completes nothing: it becomes one check-in', () => {
  let st = blank(at(12, 9));
  const a = add(st, 'A', at(13, 17), 60), b = add(st, 'B', at(13, 18), 60);
  S.replan(st, 'start'); eq([of(st, a)[0].end, of(st, b)[0].start], [at(12, 10), at(12, 10, 15)]);
  tick(st, at(12, 9, 59)); eq(st.checkins.length, 0, 'not before its end');
  const r = tick(st, at(12, 10, 5));
  eq([a.status, a.remainingMins, credit(st, a), st.history.length, st.autoDone.length], ['pending', 60, 0, 0, 0], 'no status change, no credit, no history, no automatic record');
  eq(st.checkins.map((c) => [c.taskId, c.start, c.end, c.mins, c.ck]), [[a.id, at(12, 9), at(12, 10), 60, `${a.id}#0@${at(12, 10)}`]], 'the question is tied to that task and that block');
  eq(r.missed.length, 1);
  eq([planned(st, a), of(st, b)[0].start], [0, at(12, 10, 15)], 'its minutes are on hold, not moved, and nothing else was rearranged');
  for (const t of [at(12, 10, 6), at(12, 10, 7), at(12, 10, 30)]) eq(tick(st, t).missed.length, 0, 'later ticks do not ask again');
  st = reload(st); tick(st, at(12, 10, 40)); S.replan(st, 'something else'); S.noteMissed(st);
  eq([st.checkins.filter((c) => c.taskId === st.tasks[0].id).length, credit(st, st.tasks[0]), st.tasks[0].status], [1, 0, 'pending'], 'a reload, more ticks and other replans add no second question and no credit');
});
test('"Completed" credits that block only; a split task or a later step stays unfinished', () => {
  const st = blank(at(12, 9));
  const a = add(st, 'Long', at(14, 17), 240);
  S.replan(st, 'start');
  const first = of(st, a)[0];
  tick(st, first.end + 5 * T.MIN);
  eq([a.remainingMins, credit(st, a)], [240, 0]);
  S.checkinDone(st, st.checkins[0].ck);
  eq([a.remainingMins, a.status, credit(st, a), st.checkins.length, planned(st, a)], [240 - first.mins, 'pending', first.mins, 0, 240 - first.mins]);
  eq(st.workLog[0].at, first.end, 'credited on the day the work was planned');
  eq(st.history.map((h) => [h.start, h.end, !!h.partial]), [[first.start, first.end, false]]); eq(planProblems(st), []);
  const st2 = blank(at(12, 9)); const r = S.makeTask(st2, { title: 'Report', deadline: at(14, 17), durationMins: 120, parts: [{ title: 'Outline', mins: 60 }, { title: 'Draft', mins: 60 }] }); st2.tasks.push(r);
  S.replan(st2, 'start'); tick(st2, at(12, 10, 5));
  eq(r.parts.map((p) => p.done), [false, false], 'time passing ticks no step');
  S.checkinDone(st2, st2.checkins[0].ck);
  eq([r.parts.map((p) => p.done), r.status, credit(st2, r)], [[true, false], 'pending', 60], 'the confirmed step is done, the next is not');
});
test('"Partly done" keeps the finished part, plans only what is left, and cannot be counted twice', () => {
  const st = blank(at(12, 9));
  const a = add(st, 'Essay', at(13, 17), 120); S.replan(st, 'start');
  tick(st, at(12, 11, 5)); const ck = st.checkins[0].ck;
  eq([S.checkinPartial(st, ck, 0), S.checkinPartial(st, ck, NaN), S.checkinPartial(st, ck, 9999)], [null, null, null], 'an unusable amount is refused');
  eq([a.remainingMins, st.checkins.length], [120, 1], 'and changes nothing');
  S.checkinPartial(st, ck, 45);
  eq([a.remainingMins, a.durationMins, a.status, credit(st, a), planned(st, a), st.checkins.length], [45, 120, 'pending', 75, 45, 0]);
  eq(S.checkinPartial(st, ck, 45), null); eq(S.checkinDone(st, ck), null); eq(credit(st, a), 75, 'the same block cannot be answered again');
  ok(of(st, a)[0].start >= st.now && of(st, a).slice(-1)[0].end <= a.deadline); eq(planProblems(st), []);
  ok(/Partly done: Essay \(45 min left\)/.test(st.lastUpdate.trigger) && st.lastUpdate.notes.some((x) => /still needs 45 min/.test(x)), JSON.stringify(st.lastUpdate.notes));
});
test('"Not finished" credits nothing and plans the work again; the proposal says where and why', () => {
  const st = blank(at(12, 9));
  const a = add(st, 'A', at(13, 17), 60), b = add(st, 'B', at(13, 18), 60), c = add(st, 'C', at(14, 18), 60);
  S.replan(st, 'start'); tick(st, at(12, 10, 5));
  const before = JSON.stringify(st), draft = S.clone(st);
  S.checkinNotDone(draft, draft.checkins[0].ck);
  eq(JSON.stringify(st), before, 'worked out on a copy: the real plan waits for the student');
  const [a2, b2, c2] = draft.tasks;
  eq([a2.remainingMins, a2.status, credit(draft, a2), draft.checkins.length, planned(draft, a2)], [60, 'pending', 0, 0, 60]);
  ok(accounted(draft)); eq(planProblems(draft), []);
  ok(of(draft, a2)[0].start >= draft.now && of(draft, a2).slice(-1)[0].end <= a2.deadline, 'a real, open slot before its deadline');
  ok(of(draft, a2)[0].start < of(draft, c2)[0].start, 'still ahead of the task due a day later');
  const ch = draft.lastUpdate.changes.find((x) => x.title === 'A');
  eq([ch.action, ch.from.start, ch.to.start], ['RESCHEDULE', at(12, 9), of(draft, a2)[0].start], 'shown as was → now');
  ok(draft.lastUpdate.notes.some((x) => /"A" still needs 1 hr\. It was planned today, 9:00 AM – 10:00 AM\./.test(x)) && draft.lastUpdate.notes.some((x) => /recommended time is today at/.test(x)), JSON.stringify(draft.lastUpdate.notes));
  const once = ahead(draft); for (let i = 0; i < 3; i++) S.replan(draft, 'again'); eq(ahead(draft), once, 'replanning again moves nothing more');
});
test('work the student marked done gets no check-in', () => {
  const st = blank(at(12, 9));
  const a = add(st, 'A', at(13, 17), 60); S.replan(st, 'start');
  st.now = at(12, 9, 30); S.completeSession(st, of(st, a)[0].id);
  tick(st, at(12, 12));
  eq([st.checkins.length, credit(st, a), a.status], [0, 60, 'done']);
});
test('no room left today: the work goes to the next day and the tasks it displaces move on in deadline order', () => {
  const st = evening(at(12, 18));
  S.addEvent(st, { title: 'Club', start: at(12, 20, 15), end: at(12, 22) });
  const a = add(st, 'A', at(13, 22), 120), b = add(st, 'B', at(14, 22), 180), c = add(st, 'C', at(15, 22), 180);
  S.replan(st, 'start');
  const days = (t) => [...new Set(dayOf(st, t))];
  eq([days(a), days(b)], [[12], [13]]); const cBefore = of(st, c).slice(-1)[0].end, bBefore = of(st, b).slice(-1)[0].end;
  tick(st, at(12, 21, 40));                                     // A's block passed and the rest of Monday is taken
  eq([st.checkins.length, a.remainingMins, planned(st, a)], [1, 120, 0]);
  S.checkinNotDone(st, st.checkins[0].ck);
  eq(days(a), [13], 'the unfinished work goes to tomorrow, before its deadline');
  ok(of(st, a)[0].start < of(st, b)[0].start && of(st, b)[0].start < of(st, c)[0].start, 'earlier deadline first, on every day');
  ok(of(st, b).slice(-1)[0].end > bBefore && of(st, c).slice(-1)[0].end > cBefore && Math.max(...dayOf(st, c)) >= 14, 'the tasks it displaces move on in turn, into later days');
  for (const t of [a, b, c]) ok(of(st, t).slice(-1)[0].end <= t.deadline, `${t.title} is still on time`);
  for (const s of st.plan) ok(T.minsOfDay(s.end) <= 22 * 60 && T.minsOfDay(s.start) >= 18 * 60, 'nothing is planned past the end of the day');
  ok(accounted(st)); eq(planProblems(st), []); eq(st.status, 'SUCCESS');
  ok(st.lastUpdate.notes.some((x) => /Your day is not made longer/.test(x)) && st.lastUpdate.notes.some((x) => /other tasks? moves? to make room/.test(x)), JSON.stringify(st.lastUpdate.notes));
  tick(st, of(st, a)[0].end + T.MIN);                           // an overrun on a later day works the same way
  S.checkinNotDone(st, st.checkins.find((x) => x.taskId === a.id).ck);
  // Tuesday evening is now too full to fit A again before 10 PM: it is either planned on time or reported, never slipped past its deadline.
  if (planned(st, a)) ok(of(st, a)[0].start >= st.now && of(st, a).slice(-1)[0].end <= a.deadline, 'planned again, on time');
  else ok(st.status === 'INFEASIBLE' && st.unscheduled.some((u) => u.taskId === a.id && u.reason === 'no_time') && a.remainingMins === 120, 'reported as not fitting, with its full time and real deadline');
  eq(planProblems(st), []);
});
test('no time before the deadline: said plainly, a late plan is offered, and rejecting it changes nothing', () => {
  const st = blank(at(12, 9));
  S.addEvent(st, { title: 'Exam', start: at(12, 12, 30), end: at(12, 22) });
  const a = add(st, 'A', at(12, 12, 30), 120, { priority: 'low' }), b = add(st, 'B', at(12, 12, 30), 60, { priority: 'high' });
  S.replan(st, 'start'); eq(st.status, 'SUCCESS');
  tick(st, at(12, 11, 20));
  const missedIds = st.checkins.map((c) => c.taskId); ok(missedIds.length >= 1);
  const before = JSON.stringify(st), fixed = fixedOn(st, at(12, 0)), draft = S.clone(st);
  for (const c of draft.checkins.slice()) S.checkinNotDone(draft, c.ck);
  eq(draft.status, 'INFEASIBLE'); ok(draft.unscheduled.length >= 1 && draft.unscheduled.every((u) => u.reason === 'no_time'));
  ok(draft.lastUpdate.notes.some((x) => /does not fit before its deadline|recommended time/.test(x)), JSON.stringify(draft.lastUpdate.notes));
  eq(draft.tasks.map((t) => [t.remainingMins, t.deadline]), st.tasks.map((t) => [t.remainingMins, t.deadline]), 'nothing shortened, no deadline changed');
  const adj = S.suggestAdjustment(draft, { basePlan: st.plan });
  ok(adj && adj.late.length >= 1 && adj.draft.status === 'SUCCESS', 'a plan that fits names what would be late'); eq(planProblems(adj.draft), []);
  eq(fixedOn(adj.draft, at(12, 0)), fixed, 'the exam did not move');
  eq(JSON.stringify(st), before, 'the student has accepted nothing yet, so the real plan is untouched');
});
test('moving the clock back withdraws the question and touches no task, credit or edit', () => {
  const st = blank(at(12, 9));
  const a = add(st, 'A', at(13, 17), 60), b = add(st, 'B', at(13, 18), 60), c = add(st, 'C', at(13, 19), 60);
  S.replan(st, 'start'); const start = ahead(st);
  tick(st, of(st, a)[0].end + 5 * T.MIN); eq(st.checkins.length, 1);
  S.completeSession(st, of(st, c)[0].id);                       // the student's own Done
  const d = add(st, 'Added later', at(14, 17), 45); d.notes = 'typed meanwhile'; S.replan(st, 'added');
  tick(st, at(12, 9));
  eq([st.checkins.length, a.status, b.status, c.status, credit(st, a), credit(st, c)], [0, 'pending', 'pending', 'done', 0, 60]);
  eq([planned(st, a), planned(st, d), d.notes], [60, 45, 'typed meanwhile']); eq(of(st, a)[0].start, at(12, 9), 'A is simply planned again, as before'); eq(planProblems(st), []);
  const st2 = blank(at(12, 9)); add(st2, 'A', at(13, 17), 60); S.replan(st2, 'start'); const s0 = ahead(st2), t0 = JSON.stringify(st2.tasks);
  for (let i = 0; i < 3; i++) { tick(st2, at(12, 10, 30)); tick(st2, at(12, 9)); }
  eq([ahead(st2), JSON.stringify(st2.tasks), st2.workLog.length, st2.history.length], [s0, t0, 0, 0], 'forward and back any number of times leaves the saved plan exactly as it was');
});
test('opening the app days later asks about every elapsed block and credits none until answered', () => {
  let st = evening(at(12, 18));
  add(st, 'A', at(13, 22), 120); add(st, 'B', at(14, 22), 120); add(st, 'C', at(15, 22), 300);
  S.replan(st, 'start');
  st = reload(st); tick(st, at(14, 8));                          // closed since Monday evening
  const [a, b, c] = st.tasks;
  eq([a.status, b.status, c.status, st.workLog.length], ['pending', 'pending', 'pending', 0]);
  ok(st.checkins.length >= 2 && new Set(st.checkins.map((x) => x.ck)).size === st.checkins.length, 'one question per block'); ok(accounted(st));
  for (const k of st.checkins.filter((x) => x.taskId === a.id).map((x) => x.ck)) S.checkinDone(st, k);
  eq([a.status, credit(st, a)], ['done', 120]); ok(st.workLog.every((w) => T.dayStart(w.at) < T.dayStart(st.now)), 'credited on the day it was planned, not the day the app was opened');
  for (const k of st.checkins.map((x) => x.ck)) S.checkinNotDone(st, k);
  eq(st.checkins.length, 0); ok(accounted(st)); eq(planProblems(st), []);
});
test('records from the old automatic completion are left alone by the clock and can still be put back', () => {
  let st = blank(at(12, 9));
  const a = add(st, 'Old', at(13, 17), 60), b = add(st, 'B', at(13, 18), 60);
  a.remainingMins = 0; a.status = 'done';
  const id = `${a.id}#0@${at(12, 8)}`;
  st.autoDone = [{ id, sessionId: `${a.id}#0`, taskId: a.id, partId: null, title: 'Old', start: at(12, 7), end: at(12, 8), mins: 60, credited: 60, origin: 'demo', finishedTask: true, seen: false }];
  st.workLog.push({ taskId: a.id, mins: 60, at: at(12, 8), auto: id }); st.history.push({ id, taskId: a.id, title: 'Old', start: at(12, 7), end: at(12, 8), doneAt: at(12, 8), auto: 'demo' });
  S.replan(st, 'start'); st = reload(st);
  tick(st, at(12, 12)); tick(st, at(12, 6)); tick(st, at(12, 9));
  eq([st.tasks[0].status, st.autoDone.length, st.workLog.length, st.history.length], ['done', 1, 1, 1], 'moving the clock neither adds to nor reverses the old record');
  S.undoAutoDone(st, id);
  eq([st.tasks[0].status, st.tasks[0].remainingMins, st.autoDone.length, st.workLog.length, planned(st, st.tasks[0])], ['pending', 60, 0, 0, 60]);
});

console.log('\nDate, time and duration fields');
test('a date and a time typed into a form stay the same wall-clock time when saved and reopened', () => {
  const ms = T.joinInput('2026-10-20', '14:35');
  eq([ms, T.dateInput(ms), T.timeInput(ms), T.time(ms)], [T.make(2026, 10, 20, 14, 35), '2026-10-20', '14:35', '2:35 PM']);
  eq(T.joinInput(T.dateInput(ms), T.timeInput(ms)), ms, 'round trip');
  eq(T.joinInput('2026-10-21', T.timeInput(ms)), ms + T.DAY, 'changing only the date keeps the hour and minute');
  eq(T.joinInput(T.dateInput(ms), '00:05'), T.make(2026, 10, 20, 0, 5));
  eq([T.joinInput('', '10:00'), T.joinInput('2026-10-20', ''), T.joinInput('2026-02-31', '10:00'), T.joinInput('2026-10-20', '25:00')], [null, null, null, null], 'missing or impossible values are refused');
  eq([T.dateInput(null), T.timeInput(null)], ['', '']);
});
test('a duration is hours and minutes, to the minute', () => {
  eq([T.joinDur('1', '20'), T.joinDur('', '45'), T.joinDur('2', ''), T.joinDur('0', '0'), T.joinDur('', ''), T.joinDur('x', '5'), T.joinDur('-1', '5')], [80, 45, 120, 0, null, null, null]);
  eq([T.splitDur(80), T.splitDur(45), T.splitDur(125)], [{ h: 1, m: 20 }, { h: 0, m: 45 }, { h: 2, m: 5 }]);
  for (const m of [5, 35, 50, 80, 135, 2400]) { const p = T.splitDur(m); eq(T.joinDur(String(p.h), String(p.m)), m, 'no precision lost'); }
});
test('edits to the deadline, time needed and start time reach the plan, survive a reload, and keep the rest of the task', () => {
  let st = blank(at(12, 9));
  const t = add(st, 'Paper', at(13, 17), 50, { notes: 'keep me', priority: 'high' }), other = add(st, 'Other', at(15, 17), 60);
  t.dependencies = []; other.dependencies = [t.id];
  S.replan(st, 'start');
  const dl = T.joinInput('2026-10-16', '09:30'), start = T.joinInput('2026-10-14', '19:45');
  S.applyTaskAction(st, { type: 'deadline_change', taskId: t.id, deadline: dl });
  S.applyTaskAction(st, { type: 'set_duration', taskId: t.id, mins: T.joinDur('1', '20') });
  S.applyTaskAction(st, { type: 'move', taskId: t.id, start });
  S.applyTaskAction(st, { type: 'deadline_change', taskId: other.id, deadline: at(17, 17) });
  S.replan(st, 'edited');
  st = reload(st);
  const [t2, o2] = st.tasks;
  eq([t2.deadline, t2.durationMins, t2.remainingMins, t2.pinnedStart, t2.notes, t2.priority, o2.dependencies], [dl, 80, 80, start, 'keep me', 'high', [t.id]]);
  eq(of(st, t2).map((s) => [T.dateInput(s.start), T.timeInput(s.start), s.mins]), [['2026-10-14', '19:45', 80]], 'planned at the time asked for, for the time needed');
  ok(of(st, o2)[0].start >= of(st, t2)[0].end + 15 * T.MIN, 'the dependant still follows'); eq(planProblems(st), []);
  eq(S.applyTaskAction(st, { type: 'set_duration', taskId: t2.id, mins: 0 }).ok, false); eq(S.applyTaskAction(st, { type: 'move', taskId: t2.id, start: at(12, 8) }).ok, false, 'a start in the past is refused');
  eq(S.applyTaskAction(st, { type: 'deadline_change', taskId: t2.id, deadline: NaN }).ok, false); eq(t2.durationMins, 80);
});

console.log('\nDates, times and commands that used to be read wrongly (E2, E3, E4, E7, E11)');
const demoMon = () => { const st = demo(); S.setClock(st, at(12, 9, 5)); return st; };
const taskIntent = (st, text) => parse(st, text).intents.find((i) => i.type === 'task');
const unclearOf = (st, text) => parse(st, text).intents.filter((i) => i.type === 'unclear').map((i) => i.question).join(' ');
test('E2: a commitment that runs past midnight keeps its real end and blocks both days', () => {
  const st = demoMon();
  const ev = parse(st, 'I have a work shift tomorrow from 10 PM to 2 AM').intents.find((i) => i.type === 'event');
  eq([ev.event.start, ev.event.end, ev.recurring], [at(13, 22), at(14, 2), false], 'Tuesday 10 PM to Wednesday 2 AM');
  S.addEvent(st, ev.event); S.replan(st, 'shift');
  eq(fixedOn(st, at(13, 0)).filter(([t]) => /shift/i.test(t)).map(([, a, b]) => [a, b]), [[at(13, 22), at(14, 0)]], 'Tuesday shows its part');
  eq(fixedOn(st, at(14, 0)).filter(([t]) => /shift/i.test(t)).map(([, a, b]) => [a, b]), [[at(14, 0), at(14, 2)]], 'Wednesday shows the hours after midnight');
  ok(st.plan.every((s) => s.end <= at(13, 22) - 15 * T.MIN || s.start >= at(14, 2) + 15 * T.MIN), 'no task is planned inside it'); eq(planProblems(st), []);
  const ev2 = parse(st, 'Training on Thursday from 9 PM to 1 AM').intents.find((i) => i.type === 'event');
  eq([ev2.event.start, ev2.event.end], [at(15, 21), at(16, 1)]);
  const same = parse(st, 'I have a work shift tomorrow from 6 PM to 10 PM').intents.find((i) => i.type === 'event');
  eq([same.event.start, same.event.end], [at(13, 18), at(13, 22)], 'an ordinary evening shift is unchanged');
  ok(/runs past midnight has to be entered as two/.test(unclearOf(st, 'I work every Friday from 10 PM to 2 AM')), 'a weekly overnight commitment is not cut silently: it is explained');
});
test('E3: a date that has passed is asked about, not moved a year ahead; "last Friday" is last Friday', () => {
  const st = demoMon();
  const a = taskIntent(st, 'Paper due Oct 5');
  eq([a.task.deadline, a.ambiguous.map((o) => T.key(o.deadline))], [null, ['2026-10-05', '2027-10-05']], 'no deadline until the student chooses');
  ok(/has already passed this year/.test(a.clarification) && /overdue/.test(a.clarification), a.clarification);
  const b = taskIntent(st, 'Paper due last Friday');
  eq([b.task.title, b.task.deadline, b.ambiguous.map((o) => T.key(o.deadline))], ['Paper', null, ['2026-10-09', '2026-10-16']]);
  ok(/"last friday" has already passed/i.test(b.clarification), b.clarification);
  const c = taskIntent(st, 'Paper due Oct 20');
  eq([T.key(c.task.deadline), c.ambiguous, c.clarification], ['2026-10-20', null, null], 'a date still ahead is taken as given');
  const d = taskIntent(st, 'Paper due January 15');
  eq([T.key(d.task.deadline), d.ambiguous], ['2027-01-15', null], 'a date long past this year still means next year');
});
test('E4: "this week" and "next week" ask which day instead of choosing Sunday', () => {
  const st = demoMon();
  const a = taskIntent(st, 'Reflection paper due this week');
  eq([a.task.deadline, a.task.deadlineIsWeekEnd, a.ambiguous.map((o) => T.key(o.deadline))], [null, true, ['2026-10-16', '2026-10-18']]);
  ok(/is not a single day\. Do you mean by Friday \(Fri, Oct 16\) or by Sunday \(Sun, Oct 18\)/.test(a.clarification), a.clarification);
  const b = taskIntent(st, 'Lab report due next week');
  eq(b.ambiguous.map((o) => T.key(o.deadline)), ['2026-10-23', '2026-10-25']); eq(b.task.deadline, null);
  st.tasks.push(S.makeTask(st, Object.assign({}, a.task, { deadline: a.ambiguous[0].deadline }))); S.replan(st, 'chosen');
  ok(of(st, st.tasks[st.tasks.length - 1]).length > 0, 'once a day is chosen it is scheduled'); eq(planProblems(st), []);
});
test('E7: a command that names two tasks changes neither and says so', () => {
  const st = demoMon(), before = JSON.stringify(st.tasks);
  const out = ask(st, 'Move Big-O Worksheet and Class Diagram Exercise to Friday');
  eq(out.map((i) => [i.type, i.code]), [['unclear', 'TASK_MULTIPLE']]);
  ok(/One task at a time/.test(out[0].question) && /"Class Diagram Exercise"/.test(out[0].question) && /"Big-O Worksheet"/.test(out[0].question) && /Nothing was changed/.test(out[0].question), out[0].question);
  eq(JSON.stringify(st.tasks), before);
  const one = ask(st, 'Move Big-O Worksheet to Friday');
  eq(one.map((i) => [i.type, i.title]), [['move', 'Big-O Worksheet']], 'one task still works');
});
test('E11: a date that does not exist is refused with a question, in a new task and in a command', () => {
  const st = demoMon(), before = JSON.stringify(st.tasks);
  const cmd = ask(st, 'Change the deadline for Big-O Worksheet to February 31');
  eq(cmd.map((i) => [i.type, i.code]), [['unclear', 'DATE_INVALID']]); ok(/"february 31" is not a real date/i.test(cmd[0].question) && /was not changed/.test(cmd[0].question), cmd[0].question);
  ok(/is not a real date/.test(unclearOf(st, 'Essay due April 31, about 2 hours')) && !taskIntent(st, 'Essay due April 31, about 2 hours'), 'no task is made from it');
  ok(/is not a real date/.test(unclearOf(st, 'Move Big-O Worksheet to 13/40')));
  eq(JSON.stringify(st.tasks), before);
  eq([T.key(taskIntent(st, 'Essay due April 30, about 2 hours').task.deadline), T.key(taskIntent(st, 'Essay due December 10, about 2 hours').task.deadline)], ['2027-04-30', '2026-12-10'], 'real dates are still read');
  eq(P.parseDate('feb 29', at(12, 9)).day, T.make(2027, 2, 29) === T.make(2027, 3, 1) ? null : T.make(2027, 2, 29));
});

console.log('\nAdjust schedule: a recommended time, a chosen time, and the whole plan reflowing');
const tightMonday = () => { T.now = () => at(12, 9, 5); const st = demo(); T.now = () => FIXED_NOW; S.addEvent(st, { title: 'Work shift', kind: 'work', start: at(12, 18, 30), end: at(12, 22, 30) }); S.replan(st, 'a shift tonight'); return st; };
const named = (st, title) => st.tasks.find((t) => t.title === title);
const risky = (st, t) => conf(st).filter((r) => r.taskId === t.id && r.show).map((r) => r.level);
const startOf = (st, t) => (of(st, t)[0] || {}).start;
test('an at-risk task gets a recommendation from whole-plan comparison, and nothing changes until it is accepted', () => {
  const st = blank(at(12, 19, 40));
  const a = add(st, 'A', at(14, 17), 60), b = add(st, 'B', at(14, 17), 60);
  S.replan(st, 'start');
  eq([startOf(st, a), startOf(st, b), risky(st, a), risky(st, b)], [at(12, 19, 45), at(12, 21), [], ['high']], 'the starting point: B is the second task tonight and at risk');
  const before = JSON.stringify(st), rec = S.recommendAdjustment(st, b.id);
  eq([rec.title, rec.mins, rec.remainingMins, rec.current.start, rec.basis, rec.start, rec.newRisks], ['B', 60, 60, at(12, 21), 'later_day', at(13, 6), []]);
  ok(/Today is too tight for 1 hr of work\. Tomorrow at 6 AM is the next open time and still before its deadline/.test(rec.reason) && /leaves no task at risk today instead of 1/.test(rec.reason), rec.reason);
  eq(S.checkStart(st, { mins: rec.mins, deadline: b.deadline }, rec.start).ok, true, 'the recommendation is itself a valid time');
  const swap = S.previewMove(st, b.id, at(12, 19, 45));
  ok(swap.ok, JSON.stringify(swap).slice(0, 200));
  ok(swap.ok && risky(swap.draft, swap.draft.tasks[0]).length === 1, 'starting B first tonight would only hand the risk to A, which is why that is not the recommendation');
  const p = S.previewMove(st, b.id, rec.start);
  eq(JSON.stringify(st), before, 'recommending and previewing change nothing');
  const d = p.draft, [a2, b2] = d.tasks;
  eq([startOf(d, b2), planned(d, b2), b2.pinnedStart, startOf(d, a2)], [rec.start, 60, rec.start, at(12, 19, 45)], 'accepted: B is where it was recommended and A did not move');
  ok(whole(d)); eq(planProblems(d), []);
  eq([risky(d, a2), risky(d, b2), S.taskStatus(d, b2).key, S.taskStatus(d, b2).attention], [[], [], 'scheduled', false], 'no task is at risk in the accepted plan');
  const r = reload(d); eq([risky(r, r.tasks[1]), S.taskStatus(r, r.tasks[1]).key], [[], 'scheduled'], 'and no warning comes back after a reload');
});
test('when every other time only moves the risk to another task, the recommendation is to stay put', () => {
  const st = blank(at(12, 19, 40));
  const a = add(st, 'A', at(12, 22), 60), b = add(st, 'B', at(12, 22), 60);   // both due tonight: no later day is possible
  S.replan(st, 'start');
  const rec = S.recommendAdjustment(st, b.id);
  eq([rec.basis, rec.start, risky(st, b).length], ['keep', at(12, 21), 1]);
  ok(/is the best available: every other open time would leave as many tasks at risk, or more/.test(rec.reason) && /It stays tight today/.test(rec.reason), rec.reason);
});
test('overdue work is recommended into today\'s earliest opening, ahead of everything else', () => {
  const st = tightMonday(), a = named(st, 'Algorithm Tracing Worksheet');
  eq([startOf(st, a), risky(st, a)], [at(12, 12, 15), ['risk']], 'it already holds today\'s first opening and is tight');
  const rec = S.recommendAdjustment(st, a.id);
  eq([rec.basis, rec.start], ['keep', at(12, 12, 15)], 'so it stays today; tomorrow is not recommended');
  ok(/already today's earliest open time for it, and overdue work goes first/.test(rec.reason), rec.reason);
  // the same task after the student pushed it to tomorrow: the recommendation brings it back to today
  const st2 = tightMonday(), a2 = named(st2, a.title);
  S.applyTaskAction(st2, { type: 'move', taskId: a2.id, day: at(13, 0) }); S.replan(st2, 'pushed to tomorrow');
  ok(T.dayStart(startOf(st2, a2)) === at(13, 0), 'planned tomorrow');
  const rec2 = S.recommendAdjustment(st2, a2.id);
  eq([rec2.basis, T.dayStart(rec2.start)], ['earlier_today', at(12, 0)]); ok(/It is overdue, so it goes into today's earliest open time/.test(rec2.reason), rec2.reason);
  const p = S.previewMove(st2, a2.id, rec2.start); ok(p.ok && accounted(p.draft)); eq(planProblems(p.draft), []);
});
test('overdue work goes to a later day only when today truly has no opening, and the reason says what is in the way', () => {
  const st = blank(at(12, 21, 30));
  const o = add(st, 'Old', at(11, 17), 60); S.replan(st, 'start');
  eq(T.dayStart(startOf(st, o)), at(13, 0), 'half an hour is left today, so the engine planned it tomorrow');
  const rec = S.recommendAdjustment(st, o.id);
  eq([rec.start, T.dayStart(rec.start)], [startOf(st, o), at(13, 0)]);
  ok(/Today has only 30 min of open time left before 10 PM, and no single opening long enough for 1 hr of work/.test(rec.reason), rec.reason);
  const st2 = blank(at(12, 21, 58)); const o2 = add(st2, 'Old', at(11, 17), 60); S.replan(st2, 'start');
  ok(/Today has no open time left before 10 PM/.test(S.recommendAdjustment(st2, o2.id).reason));
});
test('the student can choose another time; the proposal is worked out again, across days', () => {
  const st = tightMonday(), a = named(st, 'Algorithm Tracing Worksheet'), before = JSON.stringify(st);
  const p = S.previewMove(st, a.id, at(15, 19));
  ok(p.ok, JSON.stringify(p)); const d = p.draft;
  eq(startOf(d, named(d, a.title)), at(15, 19), 'Thursday 7 PM, as asked');
  const moved = d.lastUpdate.changes.filter((c) => c.title !== a.title && c.from && c.to);
  ok(moved.length >= 2 && new Set(moved.map((c) => T.dayStart(c.to.start))).size >= 2, `other tasks were placed again on more than one day: ${moved.map((c) => c.title)}`);
  ok(/other tasks move to make room, across \d days/.test(d.lastUpdate.notes.join(' ')));
  for (const t of d.tasks.filter((x) => x.status !== 'done' && x.deadline > d.now)) ok(of(d, t).slice(-1)[0].end <= t.deadline, `${t.title} is still on time`);
  ok(accounted(d)); eq(planProblems(d), []); eq(JSON.stringify(st), before, 'still nothing saved: rejecting is simply not accepting');
  const p2 = S.previewMove(st, a.id, at(14, 19)); ok(p2.ok && startOf(p2.draft, named(p2.draft, a.title)) === at(14, 19), 'a second choice gives a second proposal');
});
test('a time that cannot be used says why and offers the closest one that can', () => {
  const st = tightMonday(), a = named(st, 'Algorithm Tracing Worksheet'), before = JSON.stringify(st);
  const tries = [[at(12, 15), 'FIXED', /runs into IT 207 \(2:00 PM – 5:00 PM\)/], [at(12, 23), 'OUTSIDE_DAY', /outside your day \(6 AM to 10 PM\)/], [at(12, 8), 'PAST', /already passed/], [at(12, 19), 'FIXED', /Work shift/], [NaN, 'NO_TIME', /Pick a date and a time/]];
  for (const [when, code, re] of tries) {
    const p = S.previewMove(st, a.id, when);
    eq([p.ok, p.code], [false, code]); ok(re.test(p.message), p.message);
    ok(p.alt != null && S.checkStart(st, { mins: 60, deadline: a.deadline }, p.alt).ok, `the alternative for ${code} is a time that works`);
    ok(S.previewMove(st, a.id, p.alt).ok, 'and using it gives a proposal');
  }
  const c = named(st, 'Class Diagram Exercise'), late = S.previewMove(st, c.id, at(14, 19));
  eq([late.ok, late.code], [false, 'AFTER_DEADLINE']); ok(/would end after the deadline \(Tue, Oct 13 11:59 PM\)/.test(late.message) && late.alt + 60 * T.MIN <= c.deadline, late.message);
  eq(fixedOn(st, at(12, 0)).length > 0 && JSON.stringify(st), before, 'no refused time touched the plan or a fixed commitment');
});
test('adding a task and editing one both reflow the plan through the same engine', () => {
  const st = blank(at(12, 9));
  const a = add(st, 'A', at(13, 17), 60), b = add(st, 'B', at(14, 17), 120);
  S.replan(st, 'start'); eq([startOf(st, a), startOf(st, b)], [at(12, 9), at(12, 10, 15)]);
  // a new task with a requested start takes that time; what was there is placed again
  const n = add(st, 'New', at(15, 17), 60); ok(S.checkStart(st, { mins: 60, deadline: n.deadline }, at(12, 9, 15)).ok, 'the requested time is allowed');
  eq(S.checkStart(st, { mins: 60, deadline: n.deadline }, at(12, 9)).code, 'PAST', 'a start that is not ahead of now is not');
  n.pinnedStart = at(12, 9, 15); S.replan(st, 'added with a start time');
  eq(startOf(st, n), at(12, 9, 15), 'the requested start is honoured');
  ok(startOf(st, a) >= at(12, 10, 30) && startOf(st, a) < startOf(st, b), 'A moved out of the way and still comes before B, which is due later');
  ok(whole(st), 'check 2'); eq(planProblems(st), []);
  // editing the start time moves it again and closes the gap it leaves
  const p = S.previewMove(st, n.id, at(13, 9)); ok(p.ok, 'check 3'); const d = p.draft, [a2, b2, n2] = d.tasks;
  eq(startOf(d, n2), at(13, 9), 'New is on Tuesday now');
  ok(startOf(d, a2) < startOf(st, a) && startOf(d, b2) < startOf(st, b) && startOf(d, a2) < startOf(d, b2), 'A and B move up into the time it left, still in deadline order');
  ok(whole(d), 'check 4'); eq(planProblems(d), []);
  // a longer duration takes the room it needs and pushes what follows
  S.applyTaskAction(d, { type: 'set_duration', taskId: a2.id, mins: 150 }); S.replan(d, 'longer');
  ok(planned(d, a2) === 150 && startOf(d, b2) >= of(d, a2).slice(-1)[0].end + 15 * T.MIN, 'B starts after all of A, with the gap'); eq(planProblems(d), []);
  // a nearer deadline changes the order; difficulty alone, across different days, does not
  S.applyTaskAction(d, { type: 'deadline_change', taskId: b2.id, deadline: at(12, 20) }); S.replan(d, 'B is due tonight');
  ok(startOf(d, b2) < startOf(d, a2), 'B is due first, so it goes first');
  S.applyTaskAction(d, { type: 'set_difficulty', taskId: a2.id, difficulty: 'hard' }); S.replan(d, 'A is hard');
  ok(startOf(d, b2) < startOf(d, a2), 'a harder task due later does not jump ahead');
  eq([d.plan.length, new Set(d.plan.map((s) => s.id)).size, whole(d)], [d.plan.length, d.plan.length, true], 'no session is doubled or lost'); eq(planProblems(d), []);
});
test('where a task stands is read from the plan, so it cannot go stale', () => {
  const st = blank(at(12, 9));
  const a = add(st, 'A', at(13, 17), 60), nd = add(st, 'No date', null, 60), big = add(st, 'Too big', at(12, 11), 300);
  S.replan(st, 'start');
  eq([a, nd, big].map((t) => [S.taskStatus(st, t).key, S.taskStatus(st, t).attention]), [['scheduled', false], ['needs_deadline', true], ['not_enough_time', true]]);
  tick(st, of(st, a)[0].end + T.MIN);
  eq([S.taskStatus(st, a).key, S.taskStatus(st, a).attention], ['awaiting_answer', true], 'a block that ended is waiting on the student');
  const draft = S.clone(st); S.checkinNotDone(draft, draft.checkins[0].ck);
  eq(S.taskStatus(st, a).key, 'awaiting_answer', 'a proposal that is only being looked at changes nothing');
  eq([S.taskStatus(draft, draft.tasks[0]).key, S.taskStatus(draft, draft.tasks[0]).attention], ['scheduled', false], 'once accepted and placed, it needs no more attention');
  eq(S.taskStatus(draft, draft.tasks[2]).key, 'not_enough_time', 'but work that still has no slot keeps its warning');
  const r = reload(draft); eq(r.tasks.map((t) => S.taskStatus(r, t).key), ['scheduled', 'needs_deadline', 'not_enough_time'], 'the same after a reload');
  S.applyTaskAction(draft, { type: 'deadline_change', taskId: draft.tasks[2].id, deadline: at(15, 17) }); S.replan(draft, 'more time');
  eq(S.taskStatus(draft, draft.tasks[2]).key, 'scheduled', 'and it clears by itself when the plan really fits');
  const od = blank(at(12, 9)); const late = add(od, 'Late', at(11, 17), 60); S.replan(od, 'start');
  eq([S.taskStatus(od, late).key, S.taskStatus(od, late).attention, S.taskStatus(od, late).overdue], ['scheduled', false, true], 'an overdue task that has its slot is scheduled, and still marked overdue');
});
test('a commitment that starts right at the end of the day still gets its 15-minute gap', () => {
  const st = blank(at(12, 20));
  S.addEvent(st, { title: 'Night shift', start: at(12, 22), end: at(13, 2) });
  const t = add(st, 'Essay', at(13, 17), 105); S.replan(st, 'start');
  ok(of(st, t).every((s) => s.end <= at(12, 21, 45) || s.start >= at(13, 2, 15)), `ends by 9:45 PM or starts after the shift: ${of(st, t).map((s) => T.when(s.start, st.now))}`);
  eq(planned(st, t), 105);
});

console.log('\nCompaction: closing a gap a change opened, and nothing else');
const three = () => { const st = blank(at(12, 9)); const a = add(st, 'A', at(13, 17), 60), b = add(st, 'B', at(14, 17), 60), c = add(st, 'C', at(15, 17), 60); S.replan(st, 'start'); return { st, a, b, c }; };
const starts = (st, list) => list.map((t) => startOf(st, t));
test('a flexible session moves into an earlier gap that a change opened, in deadline order', () => {
  const { st, a, b, c } = three();
  eq(starts(st, [a, b, c]), [at(12, 9), at(12, 10, 15), at(12, 11, 30)]);
  S.completeTask(st, a.id); S.replan(st, 'A finished early');
  eq(starts(st, [b, c]), [at(12, 9), at(12, 10, 15)], 'B takes the gap and C follows, each a buffer apart');
  ok(whole(st)); eq(planProblems(st), []);
  eq(st.lastUpdate.changes.filter((x) => x.from && x.to).map((x) => x.title).sort(), ['B', 'C'], 'the moves are reported as was → now');
});
test('compaction leaves sessions alone when moving would break a rule or is not worth the churn', () => {
  let f;
  // a time the student asked for stays, and work due later does not jump ahead of it by compaction alone
  f = three(); S.applyTaskAction(f.st, { type: 'move', taskId: f.b.id, start: at(12, 14) }); S.replan(f.st, 'B pinned at 2 PM');
  S.applyTaskAction(f.st, { type: 'cancel_task', taskId: f.a.id }); S.replan(f.st, 'A removed');
  eq(startOf(f.st, f.b), at(12, 14), 'the requested start is kept'); eq(planProblems(f.st), []);
  // a gain of less than half an hour is not worth a move
  const st = blank(at(12, 9)); const x = add(st, 'X', at(13, 17), 20), y = add(st, 'Y', at(14, 17), 60); S.replan(st, 'start');
  const yBefore = startOf(st, y); S.applyTaskAction(st, { type: 'cancel_task', taskId: x.id }); S.replan(st, 'X removed');
  ok(yBefore - at(12, 9) > 30 * T.MIN || startOf(st, y) === yBefore, `Y: ${T.time(yBefore)} → ${T.time(startOf(st, y))}`);
  const st3 = blank(at(12, 9)); const x3 = add(st3, 'X', at(13, 17), 15), y3 = add(st3, 'Y', at(14, 17), 60); S.replan(st3, 'start');
  const y3Before = startOf(st3, y3); S.applyTaskAction(st3, { type: 'set_duration', taskId: x3.id, mins: 5 }); S.replan(st3, 'X shorter');
  eq(startOf(st3, y3), y3Before, 'ten minutes gained: Y stays where it was');
  // a session is not split into more sittings just to start sooner
  const ev = evening(at(12, 18)); S.addEvent(ev, { title: 'Club', start: at(12, 19, 30), end: at(12, 22) });
  const s1 = add(ev, 'Short', at(13, 22), 60), long = add(ev, 'Long', at(14, 22), 120); S.replan(ev, 'start');
  eq([startOf(ev, s1), dayOf(ev, long)], [at(12, 18), [13]]);
  S.applyTaskAction(ev, { type: 'cancel_task', taskId: s1.id }); S.replan(ev, 'Short removed');
  eq([dayOf(ev, long), of(ev, long).length], [[13], 1], 'two hours do not fit the 75 minutes that opened tonight, so Long is not broken up'); eq(planProblems(ev), []);
  // a step never moves ahead of the step before it
  const dp = blank(at(12, 9)); const first = add(dp, 'First', at(14, 17), 60), g = add(dp, 'Gap', at(13, 17), 60), dep = add(dp, 'Then', at(15, 17), 60); dep.dependencies = [first.id];
  S.replan(dp, 'start'); S.applyTaskAction(dp, { type: 'cancel_task', taskId: g.id }); S.replan(dp, 'Gap removed');
  ok(startOf(dp, dep) >= of(dp, first).slice(-1)[0].end + 15 * T.MIN, 'the dependant still follows what it depends on'); eq(planProblems(dp), []);
});
test('after compaction every hard rule still holds, including the gap before a 10 PM commitment', () => {
  const st = blank(at(12, 18));
  S.addEvent(st, { title: 'Night shift', start: at(12, 22), end: at(13, 2) });
  const a = add(st, 'A', at(13, 17), 60), b = add(st, 'B', at(13, 17), 60), c = add(st, 'C', at(13, 17), 90);
  S.replan(st, 'start');
  ok(st.plan.filter((s) => T.dayStart(s.start) === at(12, 0)).every((s) => s.end <= at(12, 21, 45)), 'nothing tonight ends later than 9:45 PM');
  S.completeTask(st, a.id); S.replan(st, 'A finished early');
  ok(st.plan.every((s) => s.end <= at(12, 21, 45) || s.start >= at(13, 2, 15)), `after the plan closed up, still clear of the shift: ${st.plan.map((s) => s.title + ' ' + T.when(s.start, st.now) + '–' + T.time(s.end))}`);
  ok(whole(st)); eq(planProblems(st), []);
  const v = S.checkStart(st, { mins: 60, deadline: b.deadline }, at(12, 21));
  eq([v.ok, v.code], [false, 'FIXED']); ok(/Night shift/.test(v.message) && v.alt + 60 * T.MIN <= at(12, 21, 45), 'a start at 9 PM is refused, and the closest time ends by 9:45 PM');
  eq(S.checkStart(st, { mins: 60, deadline: b.deadline }, at(12, 20, 45)).ok, true, '8:45 PM for an hour is allowed');
  eq(S.previewMove(st, b.id, at(12, 21)).ok, false, 'Adjust schedule applies the same rule');
});
test('a requested start and the deadline order both survive a reflow with compaction', () => {
  const { st, a, b, c } = three();
  const hi = add(st, 'Urgent', at(12, 20), 60); hi.priority = 'high';
  const p = S.previewMove(st, c.id, at(12, 15)); ok(p.ok); const d = p.draft, [a2, b2, c2, h2] = d.tasks;
  eq(startOf(d, c2), at(12, 15), 'C is at the time asked for');
  ok(startOf(d, h2) < startOf(d, a2) && startOf(d, a2) < startOf(d, b2), 'due tonight, then tomorrow, then the day after: the flexible tasks stay in deadline order');
  for (const t of [a2, b2, c2, h2]) ok(of(d, t).slice(-1)[0].end <= t.deadline, `${t.title} on time`);
  ok(whole(d)); eq(planProblems(d), []);
  S.applyTaskAction(d, { type: 'cancel_task', taskId: a2.id }); S.replan(d, 'A removed');
  eq(startOf(d, c2), at(12, 15), 'and C stays at its requested time when the plan closes up around it'); eq(planProblems(d), []);
});

console.log('\nFinishing early: an offer the student accepts or declines, never an automatic move');
/** A 9–11, B 11:15–12:15, C 12:30–1:30 on Monday; A is then finished at 9:20. */
const earlyDay = (prep) => {
  const st = blank(at(12, 9));
  const a = add(st, 'A', at(13, 17), 120), b = add(st, 'B', at(14, 17), 60), c = add(st, 'C', at(15, 17), 60);
  if (prep) prep(st, a, b, c);
  S.replan(st, 'start');
  const before = starts(st, [b, c]);
  st.now = at(12, 9, 20); S.completeSession(st, of(st, a)[0].id);
  return { st, a, b, c, before };
};
test('finishing early makes one suggestion and moves no other task', () => {
  const { st, a, b, c, before } = earlyDay();
  eq(before, [at(12, 11, 15), at(12, 12, 30)]);
  eq([a.status, credit(st, a)], ['done', 120], 'the finished task is recorded as usual');
  eq(starts(st, [b, c]), before, 'B and C are exactly where they were');
  const o = st.offer;
  eq([o.status, o.title, o.taskId, o.from.start, o.to.start, o.to.end, o.mins], ['pending', 'B', b.id, at(12, 11, 15), at(12, 9, 35), at(12, 10, 35), 60], 'B, the next task by deadline, is suggested for the freed time');
  eq(o.to.start - st.now, 15 * T.MIN, 'the suggested start is a full 15-minute buffer after the moment the work actually ended, not after its planned end');
  ok(/You finished "A" early/.test(o.reason) && /next task by deadline/.test(o.reason) && /No other task would move/.test(o.reason), o.reason);
  eq([b.status, credit(st, b), b.remainingMins, b.pinnedStart], ['pending', 0, 60, null], 'the suggestion itself changes nothing about B');
  eq(typeof st.offer, 'object'); ok(!Array.isArray(st.offer), 'one suggestion at a time');
});
test('no suggestion when nothing suitable fits the freed time', () => {
  // too little time: 25 minutes are left after the buffer, and B needs an hour
  const st = blank(at(12, 9)); const a = add(st, 'A', at(13, 17), 60), b = add(st, 'B', at(14, 17), 60); S.replan(st, 'start');
  st.now = at(12, 9, 20); S.completeSession(st, of(st, a)[0].id);
  eq([st.offer, startOf(st, b)], [null, at(12, 10, 15)], 'B needs an hour; it is not squeezed in or split');
  // a fixed commitment takes the freed time
  const f = earlyDay((st2) => S.addEvent(st2, { title: 'Meeting', start: at(12, 11, 30), end: at(12, 13) }));
  ok(f.st.offer == null || (f.st.offer.to.end <= at(12, 11, 15)), 'nothing is suggested into, or within a buffer of, the meeting');
  // finishing late frees nothing
  const l = blank(at(12, 9)); const la = add(l, 'A', at(13, 17), 60); add(l, 'B', at(14, 17), 60); S.replan(l, 'start');
  l.now = at(12, 10, 5); S.completeSession(l, of(l, la)[0].id); eq(l.offer, null);
  // a time the student asked for is not suggested away: the next task in line is offered instead
  const p = earlyDay((st2, a2, b2) => { b2.pinnedStart = at(12, 14); });
  eq([p.st.offer && p.st.offer.title, startOf(p.st, p.b)], ['C', at(12, 14)], 'B keeps its requested 2 PM; C is the suggestion');
  // a move that would put a task at risk is not suggested
  const r = blank(at(12, 19)); const ra = add(r, 'A', at(13, 9), 60), rb = add(r, 'B', at(14, 9), 60); S.replan(r, 'start'); rb.notBefore = at(13, 6); S.replan(r, 'B tomorrow');
  r.now = at(12, 19, 5); S.completeSession(r, of(r, ra)[0].id);
  ok(r.offer == null || conf(r).filter((x) => x.show).length === 0, 'either nothing is offered, or what is offered leaves no task at risk');
});
test('accepting applies exactly that move, after checking it again, and completes nothing', () => {
  const { st, b, c, before } = earlyDay();
  const res = S.acceptOffer(st);
  ok(res.ok, JSON.stringify(res).slice(0, 200)); eq(starts(st, [b, c]), before, 'nothing changes until the result is swapped in');
  const d = res.draft, [, b2, c2] = d.tasks;
  eq([startOf(d, b2), startOf(d, c2), d.offer], [at(12, 9, 35), before[1], null], 'B moved to the suggested time; C did not move');
  eq([b2.status, b2.remainingMins, credit(d, b2), b2.pinnedStart], ['pending', 60, 0, null], 'accepting does not mark B done, credit it, or pin it');
  ok(whole(d)); eq(planProblems(d), []);
  eq(d.lastUpdate.changes.filter((x) => x.from && x.to).map((x) => x.title), ['B'], 'the plan update shows one move, was → now');
  eq(S.acceptOffer(d).ok, false, 'it cannot be applied a second time');
  const after = JSON.stringify(d.plan.map((x) => [x.unitId, x.start]));
  tick(d, at(12, 9, 21)); tick(d, at(12, 9, 50)); S.replan(d, null);
  eq(JSON.stringify(d.plan.map((x) => [x.unitId, x.start])), after, 'time passing afterwards does not quietly pull C into the time B left');
});
test('declining keeps the plan, and the same suggestion does not come back by itself', () => {
  let { st, b, c, before } = earlyDay();
  S.declineOffer(st);
  eq([st.offer.status, starts(st, [b, c])], ['declined', before]);
  tick(st, at(12, 9, 21)); tick(st, at(12, 9, 40)); S.replan(st, null); st = reload(st);
  const [, b2, c2] = st.tasks;
  eq([st.offer.status, starts(st, [b2, c2])], ['declined', before], 'ticks, a routine recalculation and a reload: still declined, and B was not moved into the gap anyway');
  eq(S.acceptOffer(st).ok, false, 'a declined suggestion cannot be accepted');
  // another change the student makes is a reason to look again
  S.applyTaskAction(st, { type: 'set_priority', taskId: c2.id, priority: 'low' }); S.replan(st, 'C is low priority');
  eq([st.offer && st.offer.status, st.offer && st.offer.title, startOf(st, b2)], ['pending', 'B', before[0]], 'looked at again: B is suggested once more, and still not moved without a yes');
  tick(st, at(12, 11, 5)); eq(st.offer, null, 'once the freed time has passed, the suggestion is gone');
});
test('a suggestion that the plan has overtaken is worked out again, never applied as it was', () => {
  const { st, b, c } = earlyDay();
  const stale = JSON.parse(JSON.stringify(st.offer));
  S.applyTaskAction(st, { type: 'move', taskId: b.id, day: at(13, 0) }); S.replan(st, 'the student moved B to tomorrow');
  ok(T.dayStart(startOf(st, b)) === at(13, 0), 'B is where the student put it');
  ok(st.offer == null || st.offer.title !== 'B' || st.offer.from.start === startOf(st, b), 'the suggestion was looked at again against the new plan');
  st.offer = stale;                                             // as if an old card were still on screen
  const res = S.acceptOffer(st), bStart = startOf(st, b);
  ok(!res.ok || (res.draft && startOf(res.draft, res.draft.tasks[1]) !== stale.to.start) || stale.from.start === bStart, 'the old suggestion is not applied over the newer decision');
  eq(T.dayStart(startOf(st, b)), at(13, 0), 'B stays on the day the student chose');
  ok(st.offer == null || st.offer.from.start !== stale.from.start, 'what is pending now is the up-to-date suggestion, or none');
});
test('required repairs still happen at once while a suggestion waits', () => {
  const { st, b, c } = earlyDay();
  ok(st.offer && st.offer.status === 'pending');
  S.addEvent(st, { title: 'Lab', start: at(12, 12, 15), end: at(12, 14) }); S.replan(st, 'a lab was added over C');
  ok(of(st, c).every((s) => s.end <= at(12, 12) || s.start >= at(12, 14, 15)), `C was moved clear of the lab straight away: ${T.when(startOf(st, c), st.now)}`);
  ok(whole(st)); eq(planProblems(st), []);
  const big = add(st, 'Due soon', at(12, 12), 90); S.replan(st, 'urgent work added');
  ok(planned(st, big) === 90 && of(st, big).slice(-1)[0].end <= big.deadline, 'new urgent work is placed, in the freed time if that is what it takes'); eq(planProblems(st), []);
  S.declineOffer(st); const x = add(st, 'Tiny', at(12, 20), 30); S.replan(st, 'another task'); ok(planned(st, x) === 30, 'and a declined suggestion blocks nothing either');
});
test('marking a whole task done early offers the freed time in the same way', () => {
  const st = blank(at(12, 9)); const a = add(st, 'A', at(13, 17), 120), b = add(st, 'B', at(14, 17), 60); S.replan(st, 'start');
  const bStart = startOf(st, b); st.now = at(12, 9, 5); S.finishTask(st, a.id);
  eq([a.status, startOf(st, b), st.offer && st.offer.title, st.offer && st.offer.to.start], ['done', bStart, 'B', at(12, 9, 15)]);
  eq(planProblems(st), []);
});

console.log('\nEarly finishes one after another: every one asks, none moves anything by itself');
const monWeek = () => { T.now = () => at(12, 9, 5); const st = demo(); T.now = () => FIXED_NOW; return st; };
const snapPlan = (st) => st.plan.filter((x) => x.end > st.now).map((x) => `${x.title}@${x.start}`).sort();
const othersSame = (before, after, title) => JSON.stringify(before.filter((x) => !x.startsWith(title + '@'))) === JSON.stringify(after.filter((x) => !x.startsWith(title + '@')));
const finishNext = (st) => { const n = E.nextSession(st.plan, st.now); S.completeSession(st, n.id); return n; };
test('A: the first early finish records the work, moves nothing and makes one suggestion', () => {
  const st = monWeek(), before = snapPlan(st);
  const n = finishNext(st), t = st.tasks.find((x) => x.id === n.taskId);
  eq([n.title, t.status, credit(st, t)], ['Algorithm Tracing Worksheet', 'done', 60]);
  ok(othersSame(before, snapPlan(st), n.title), 'every other task is where it was');
  eq([st.offer.status, st.offer.title, st.offer.to.start], ['pending', 'Class Diagram Exercise', at(12, 12, 15)]);
  eq(planProblems(st), []);
});
test('B and D: after accepting, the next early finish asks again, and only the named task ever moves', () => {
  let st = monWeek();
  const seen = [];
  for (let k = 0; k < 3; k++) {
    const before = snapPlan(st);
    const n = finishNext(st);
    const afterDone = snapPlan(st);
    ok(othersSame(before, afterDone, n.title), `finish ${k + 1} (${n.title}) moved no other task`);
    ok(st.offer && st.offer.status === 'pending', `finish ${k + 1} produced a fresh suggestion`);
    const o = st.offer; seen.push(o.title);
    const t = named(st, o.title); eq([startOf(st, t), t.pinnedStart], [o.from.start, null], `${o.title} has not moved before the yes`);
    const r = S.acceptOffer(st); ok(r.ok); st = r.draft;
    ok(othersSame(afterDone, snapPlan(st), o.title), `accepting suggestion ${k + 1} moved only ${o.title}`);
    eq(startOf(st, named(st, o.title)), o.to.start); eq(st.offer, null); eq(planProblems(st), []); ok(accounted(st));
  }
  eq(seen, ['Class Diagram Exercise', 'Big-O Worksheet', 'Use Case Diagram'], 'each finish was looked at on its own, in rank order of what fits');
});
test('C and J: a task planned for tomorrow is suggested for today, stays put until accepted, and time passing never moves it or anything else', () => {
  let st = monWeek();
  for (let k = 0; k < 2; k++) { finishNext(st); st = S.acceptOffer(st).draft; }
  const before = snapPlan(st); finishNext(st);
  const uc = named(st, 'Use Case Diagram'), erd = named(st, 'ERD and Business Rules');
  eq([st.offer.title, T.dayStart(st.offer.from.start), st.offer.to.start, T.dayStart(startOf(st, uc))], ['Use Case Diagram', at(13, 0), at(12, 12, 15), at(13, 0)], 'tomorrow → today, offered, not applied');
  const waiting = snapPlan(st);
  tick(st, at(12, 9, 6)); tick(st, at(12, 9, 30)); S.replan(st, null); st = reload(st); tick(st, at(12, 9, 45));
  eq(snapPlan(st), waiting, 'unanswered: ticks, a routine recalculation and a reload moved nothing');
  const declined = S.clone(st); S.declineOffer(declined); tick(declined, at(12, 10));
  eq([T.dayStart(startOf(declined, named(declined, 'Use Case Diagram'))), snapPlan(declined).length], [at(13, 0), waiting.length], 'declined: it stays tomorrow');
  const r = S.acceptOffer(st); ok(r.ok); st = r.draft;
  eq([startOf(st, named(st, 'Use Case Diagram')), T.dayStart(startOf(st, named(st, 'ERD and Business Rules')))], [at(12, 12, 15), at(13, 0)], 'accepted: it is today; ERD has not moved');
  const accepted = snapPlan(st);
  tick(st, at(12, 9, 50)); tick(st, at(12, 10, 30)); S.replan(st, null); st = reload(st); tick(st, at(12, 11));
  eq(snapPlan(st), accepted, 'the regression: a later clock tick no longer pulls ERD and Business Rules into tonight by itself');
  eq(planProblems(st), []); ok(accounted(st));
});
test('E: a declined suggestion stays declined, but a separate early finish is looked at on its own', () => {
  const st = monWeek(); finishNext(st);
  const declinedTitle = st.offer.title; S.declineOffer(st);
  const plan0 = snapPlan(st); tick(st, at(12, 9, 10)); S.replan(st, null);
  eq([st.offer.status, snapPlan(st)], ['declined', plan0]);
  const cd = named(st, 'Class Diagram Exercise'); S.completeSession(st, of(st, cd)[0].id);   // a second, separate early finish (its 6:15 PM block)
  ok(st.offer && st.offer.status === 'pending' && st.offer.gap.start === at(12, 18, 15), `the new finish has its own suggestion: ${st.offer && st.offer.title}`);
  ok(othersSame(plan0.filter((x) => !x.startsWith('Class Diagram Exercise@')), snapPlan(st), 'none'), 'and nothing moved');
  eq(declinedTitle, 'Class Diagram Exercise');
});
test('F: every way of finishing early goes through the same suggestion', () => {
  const paths = {
    'Done': (st, n) => S.completeSession(st, n.id),
    'Focus Mode: Yes, it is complete': (st, n) => { S.startSession(st, n.id, { method: 'none' }); S.endFocus(st, { outcome: 'complete', focusedMins: 20 }); },
    'Mark whole task done': (st, n) => S.finishTask(st, n.taskId),
  };
  for (const [name, finish] of Object.entries(paths)) {
    const st = monWeek(), before = snapPlan(st), n = E.nextSession(st.plan, st.now);
    finish(st, n);
    const t = st.tasks.find((x) => x.id === n.taskId);
    eq([name, t.status, credit(st, t)], [name, 'done', 60]);
    ok(othersSame(before, snapPlan(st), n.title), `${name}: no other task moved`);
    eq([name, st.offer && st.offer.status, st.offer && st.offer.title], [name, 'pending', 'Class Diagram Exercise']);
  }
});
test('G: finishing at or after the planned end frees nothing and suggests nothing', () => {
  const st = monWeek(), n = E.nextSession(st.plan, st.now);
  st.now = n.end; S.completeSession(st, n.id); eq(st.offer, null, 'exactly at the end');
  const st2 = monWeek(); tick(st2, at(12, 13, 30)); S.checkinDone(st2, st2.checkins[0].ck); eq(st2.offer, null, 'a check-in answered after the block ended');
});
test('H: moving work earlier is asked for; a repair that a change makes necessary is not', () => {
  const st = monWeek(); finishNext(st);
  const erd = named(st, 'ERD and Business Rules'), erdBefore = startOf(st, erd);
  eq(T.dayStart(erdBefore), at(13, 0), 'ERD has a valid slot tomorrow, so nothing pulls it into today without a yes');
  S.addEvent(st, { title: 'Work shift', kind: 'work', start: at(13, 18), end: at(13, 22) }); S.replan(st, 'a shift tomorrow evening');
  ok(startOf(st, erd) !== erdBefore && of(st, erd).slice(-1)[0].end <= erd.deadline, `the shift displaced ERD, so it was re-placed at once: ${T.when(startOf(st, erd), st.now)}`);
  eq(planProblems(st), []); ok(accounted(st));
});
test('I: a suggestion the plan has overtaken is checked again; going back after accepting keeps the finished task done', () => {
  const st = monWeek(); finishNext(st);
  const beforeAccept = S.clone(st), o = st.offer;
  S.addEvent(st, { title: 'Meeting', start: at(12, 12), end: at(12, 13, 30) }); S.replan(st, 'a meeting over the freed hour');
  const r = S.acceptOffer(st);
  ok(!r.ok || startOf(r.draft, named(r.draft, o.title)) !== o.to.start, 'the old suggestion is not applied over the meeting');
  eq(fixedOn(st, at(12, 0)).filter(([t]) => t === 'Meeting').length, 1); eq(planProblems(st), []);
  const ok2 = S.acceptOffer(beforeAccept); ok(ok2.ok);
  const restored = beforeAccept;                                // what Undo puts back is the state before the yes
  eq([restored.offer.status, named(restored, 'Algorithm Tracing Worksheet').status, startOf(restored, named(restored, o.title))], ['pending', 'done', o.from.start]);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
