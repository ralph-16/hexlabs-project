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

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
