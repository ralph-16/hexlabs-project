/*
 * SIKAD — application state and state transitions.
 *
 * This is the "Application Responsibility" side of prompt.md §2: it owns
 * persistence, applies the engine's proposals, keeps fixed commitments
 * protected, and records every engine output (Phase 1–3 JSON) for inspection.
 */
(function (root) {
  'use strict';
  const T = root.TempoTime, E = root.TempoEngine, P = root.TempoParser, D = root.TempoData;
  const { MIN } = T;
  const KEY = 'tempo-state-v1';

  const clone = (o) => JSON.parse(JSON.stringify(o));

  function initialState() {
    return {
      version: 1, onboarded: false, onboardStep: 0, now: T.now(),
      user: { name: '' },
      baseline: { dayStart: '06:00', dayEnd: '22:00', commuteMins: 60, bufferMins: 15, routineMins: 30, protectLunch: false, classes: [], recurring: [] },
      integrations: {},
      tasks: [], events: [], cancellations: [],
      plan: [], unscheduled: [], needsDeadline: [], alerts: [], status: 'SUCCESS',
      history: [], checkins: [], active: null, lastUpdate: null,
      workLog: [],      // { taskId, mins, at } — work actually credited; basis of weekly progress
      focusLog: [],     // { id, taskId, title, method, at, focusedMins, outcome } — one entry per session the student ended
      prefs: {},        // { focusMethod } — last working method the student chose
      daySnapshots: {}, // { 'YYYY-MM-DD': { blocks: [{ id, taskId, title, start, end, kind, movedAt? }] } } — what was planned for each day
      engineLog: [], seq: 1,
    };
  }

  const ARRAYS = ['tasks', 'events', 'cancellations', 'plan', 'unscheduled', 'needsDeadline', 'alerts', 'history', 'checkins', 'workLog', 'focusLog', 'engineLog'];
  /** Stored data from an older build, or damaged by hand, must not break the app: repair what is safe, else start fresh. */
  function sanitize(saved) {
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return null;
    const base = initialState();
    const st = Object.assign(base, saved);
    for (const k of ARRAYS) if (!Array.isArray(st[k])) st[k] = [];
    if (!st.baseline || typeof st.baseline !== 'object' || !Array.isArray(st.baseline.classes) || !Array.isArray(st.baseline.recurring)) return null;
    st.baseline = Object.assign(initialState().baseline, st.baseline);
    if (typeof st.now !== 'number' || !isFinite(st.now)) return null;
    if (!st.user || typeof st.user !== 'object') st.user = { name: '' };
    if (!st.prefs || typeof st.prefs !== 'object') st.prefs = {};
    if (!st.integrations || typeof st.integrations !== 'object') st.integrations = {};
    if (!st.daySnapshots || typeof st.daySnapshots !== 'object' || Array.isArray(st.daySnapshots)) st.daySnapshots = {};
    st.tasks = st.tasks.filter((t) => t && typeof t.id === 'string' && typeof t.title === 'string');
    for (const t of st.tasks) { if (!Array.isArray(t.parts)) t.parts = []; if (!Array.isArray(t.dependencies)) t.dependencies = []; }
    if (st.active && !st.plan.some((x) => x && x.id === st.active.sessionId)) st.active = null;
    return st;
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const st = sanitize(JSON.parse(raw));
        if (st) return st;
        const fresh = initialState(); fresh.loadNotice = 'Saved data could not be read, so SIKAD started fresh.';
        return fresh;
      }
    } catch (e) {
      const fresh = initialState(); fresh.loadNotice = 'Saved data could not be read, so SIKAD started fresh.';
      return fresh;
    }
    return initialState();
  }
  function save(state) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }
  function reset() {
    try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    return initialState();
  }

  const uid = (state, prefix) => `${prefix}_${String(state.seq++).padStart(3, '0')}`;

  function log(state, phase, input, output) {
    state.engineLog.unshift({ phase, at: state.now, input, output });
    state.engineLog = state.engineLog.slice(0, 25);
  }

  // ---------------------------------------------------------------- tasks --
  function taskRemaining(t) {
    if (t.parts && t.parts.length) return t.parts.filter((p) => !p.done).reduce((a, p) => a + p.remainingMins, 0);
    return t.status === 'done' ? 0 : t.remainingMins;
  }
  function taskTotal(t) {
    return t.parts && t.parts.length ? t.parts.reduce((a, p) => a + p.mins, 0) : t.durationMins;
  }

  function makeTask(state, t) {
    const parts = (t.parts || []).filter((p) => p.mins > 0).map((p, i) => ({
      id: `p${i + 1}`, title: p.title, mins: p.mins, remainingMins: p.mins, done: false, aiSuggested: !!p.aiSuggested,
    }));
    return {
      id: uid(state, 't'), title: t.title, type: t.type || 'task', context: t.context || null,
      deadline: t.deadline != null ? t.deadline : null, durationMins: t.durationMins,
      remainingMins: parts.length ? 0 : t.durationMins, isAiEstimate: !!t.isAiEstimate,
      priority: t.priority || 'medium', doFirst: false, status: 'pending', parts,
      dependencies: t.dependencies || [], notBefore: null, pinnedStart: null, notes: t.notes || '', createdAt: state.now,
    };
  }

  /** Change a task's total duration, scaling any pending parts proportionally. */
  function setDuration(task, mins) {
    mins = Math.max(5, Math.round(mins));
    if (task.parts && task.parts.length) {
      const pending = task.parts.filter((p) => !p.done);
      const doneMins = task.parts.filter((p) => p.done).reduce((a, p) => a + p.mins, 0);
      const target = Math.max(pending.length * 5, mins - doneMins);
      const cur = pending.reduce((a, p) => a + p.mins, 0) || 1;
      let used = 0;
      pending.forEach((p, i) => {
        const m = i === pending.length - 1 ? target - used : Math.max(5, Math.round((p.mins / cur) * target / 5) * 5);
        const doneSoFar = p.mins - p.remainingMins;
        p.mins = m; p.remainingMins = Math.max(0, m - doneSoFar); used += m;
      });
    } else {
      const doneSoFar = task.durationMins - task.remainingMins;
      task.remainingMins = Math.max(0, mins - doneSoFar);
    }
    task.durationMins = mins;
    task.isAiEstimate = false;
  }

  // ----------------------------------------------------------------- plan --
  /** Run the engine and record what changed. Every state change funnels through here. */
  function replan(state, trigger, opts = {}) {
    const prevPlan = state.plan.filter((s) => s.end > state.now);
    const res = E.schedule(state, { prevPlan: opts.fresh ? null : prevPlan });
    const changes = opts.fresh ? [] : E.diff(prevPlan, res.plan, state, res.unscheduled);
    const oldPlan = state.plan;
    state.plan = res.plan;
    snapshotDay(state, oldPlan);
    state.unscheduled = res.unscheduled.map((x) => ({ unitId: x.unit.id, taskId: x.unit.taskId, title: x.unit.title, mins: x.unit.mins, deadline: x.unit.deadline, reason: x.reason, waitingOn: x.waitingOn || null }));
    state.needsDeadline = res.needsDeadline;
    state.alerts = res.alerts;
    state.status = res.status;
    if (state.active && !state.plan.some((s) => s.id === state.active.sessionId)) state.active = null;

    const next = E.nextSession(res.plan, state.now);
    const alerts = (opts.alerts || []).concat(res.alerts);
    const output = E.phase3({ status: opts.status || res.status, alerts, clarification: opts.clarification, next, changes, unscheduled: res.unscheduled });
    log(state, 'Phase 3 · Dashboard & replanning', trigger || 'Plan generated', output);
    if (trigger) {
      state.lastUpdate = {
        trigger, at: state.now, status: res.status, notes: opts.notes || [], silent: !!opts.silent,
        changes: changes.map((c) => ({ action: c.action, title: c.title, from: c.from ? { start: c.from.start, end: c.from.end } : null, to: c.to ? { start: c.to.start, end: c.to.end, mins: c.to.mins } : null })),
      };
    }
    return { res, changes, output };
  }

  // -------------------------------------------------------- day snapshots --
  // What was planned for each day, kept so Overview can show past weeks (planned vs done vs missed).
  // Additive record only: nothing here feeds back into planning.
  const SNAPSHOT_DAYS = 56;   // 8 weeks
  function snapshotDay(state, oldPlan) {
    const snaps = state.daySnapshots || (state.daySnapshots = {});
    const today = T.dayStart(state.now);
    const has = (s) => !!snaps[T.key(s.start)] && snaps[T.key(s.start)].blocks.some((b) => b.id === s.id);
    const put = (s) => {
      const day = snaps[T.key(s.start)] || (snaps[T.key(s.start)] = { blocks: [] });
      let b = day.blocks.find((x) => x.id === s.id);
      if (!b) { b = { id: s.id, taskId: s.taskId, title: s.title, kind: 'task' }; day.blocks.push(b); }
      b.title = s.title; b.start = s.start; b.end = s.end;
      delete b.movedAt;
    };
    // Days the clock passed without a replan of their own: keep what was planned for them.
    for (const s of oldPlan || []) if (T.dayStart(s.start) < today && !has(s)) put(s);
    const todays = state.plan.filter((s) => T.dayStart(s.start) === today);
    todays.forEach(put);
    // A block that left today's plan while it was still ahead was moved. It is marked, never deleted.
    const ids = new Set(todays.map((s) => s.id));
    const day = snaps[T.key(today)];
    if (day) for (const b of day.blocks) if (!ids.has(b.id) && !b.movedAt && b.end > state.now) b.movedAt = state.now;
    const cutoff = T.key(today - SNAPSHOT_DAYS * T.DAY);
    for (const k of Object.keys(snaps)) if (k < cutoff) delete snaps[k];
  }

  /**
   * Read-only summary of one day ('YYYY-MM-DD'): what was planned and what became of it.
   *   done   = a history entry for the same task, finished that day
   *   moved  = a replan moved the block away before it happened (and it was not done)
   *   missed = the day is over and the block was neither done nor moved
   */
  function daySummary(state, dateKey) {
    const snap = (state.daySnapshots || {})[dateKey];
    const dayMs = T.fromISO(dateKey + 'T00:00');
    const past = dayMs < T.dayStart(state.now);
    const hist = state.history.filter((h) => h.doneAt != null && T.key(h.doneAt) === dateKey);
    const histKey = (h) => String(h.id).split('@')[0];
    const blockIds = new Set((snap ? snap.blocks : []).map((b) => b.id));
    const blocks = (snap ? snap.blocks : []).slice().sort((a, b) => a.start - b.start).map((b) => {
      // This block's own completion, or a completion of the same task that belongs to no other block that day.
      const done = hist.some((h) => histKey(h) === b.id) || hist.some((h) => h.taskId === b.taskId && !blockIds.has(histKey(h)));
      const moved = !done && !!b.movedAt;
      return Object.assign({}, b, { done, moved, missed: past && !done && !moved });
    });
    const mins = (b) => Math.round((b.end - b.start) / MIN);
    const sum = (list) => list.reduce((a, b) => a + mins(b), 0);
    const done = blocks.filter((b) => b.done), missed = blocks.filter((b) => b.missed), moved = blocks.filter((b) => b.moved);
    return { blocks, done, missed, moved, plannedMins: sum(blocks), doneMins: sum(done) };
  }

  /**
   * Alex's previous week (Oct 5–11): six finished assignments and one that was planned but never
   * marked done, so Overview and Tasks → Completed have real history in the demo.
   * `overdue` is the still-open task behind the block that was not done.
   */
  function seedPastWeek(state, overdue) {
    const monday = T.addDays(T.dayStart(T.endOfWeek(state.now)), -13);   // Monday of last week
    const at = (d, h, mi) => T.at(T.addDays(monday, d - 5), h * 60 + mi);
    const rows = [   // [day, start, end, course, title, due]
      [5, [12, 15], [13, 45], 'IT 207', 'Stakeholder and Problem Analysis', at(5, 17, 0)],
      [5, [20, 0], [20, 45], 'IT 203', 'OOP Concepts Quiz', at(5, 23, 59)],
      [6, [11, 15], [12, 45], 'IT 208', 'HTML and CSS Layout Exercise', at(6, 23, 59)],
      [6, [19, 0], [20, 30], 'IT 204', 'ERD Practice Activity', at(6, 23, 59)],
      [7, [17, 30], [18, 30], 'IT 205', null, null],              // planned for the overdue task, not done
      [7, [18, 45], [19, 45], 'GE 104', 'Stakeholder and Data Privacy Case Reflection', at(7, 23, 59)],
      [7, [20, 0], [20, 45], 'IT 206', 'OSI Model Quick Check', at(8, 17, 0)],
    ];
    for (const [d, [sh, sm], [eh, em], course, title, due] of rows) {
      const start = at(d, sh, sm), end = at(d, eh, em);
      let task = overdue;
      if (title) {
        task = makeTask(state, { title, context: course, deadline: due, durationMins: Math.round((end - start) / MIN) });
        task.status = 'done'; task.remainingMins = 0; task.createdAt = start;
        state.tasks.push(task);
      }
      const id = `${task.id}#0`, key = T.key(start);
      const day = state.daySnapshots[key] || (state.daySnapshots[key] = { blocks: [] });
      day.blocks.push({ id, taskId: task.id, title: task.title, start, end, kind: 'task' });
      if (!title) continue;
      state.history.push({ id: `${id}@${end}`, taskId: task.id, title: task.title, start, end, doneAt: end });
      state.workLog.push({ taskId: task.id, mins: task.durationMins, at: end });
    }
  }

  // -------------------------------------------------------------- actions --
  function findSession(state, id) {
    return state.plan.find((s) => s.id === id) || state.checkins.find((s) => s.id === id) || null;
  }

  /** Run a change to one task and record how many minutes of remaining work it removed (never negative). */
  function withWorkLog(state, task, fn) {
    const before = taskRemaining(task);
    fn();
    const credited = before - taskRemaining(task);
    if (credited > 0) state.workLog.push({ taskId: task.id, mins: credited, at: state.now });
    return credited;
  }

  function creditWork(state, s) {
    const task = state.tasks.find((t) => t.id === s.taskId);
    if (!task) return null;
    withWorkLog(state, task, () => applySessionCredit(task, s));
    if (taskRemaining(task) === 0) task.status = 'done';
    else if (task.status === 'in_progress' && !(state.active && state.active.sessionId !== s.id)) task.status = 'pending';
    return task;
  }

  function applySessionCredit(task, s) {
    if (s.partId) {
      const part = task.parts.find((p) => p.id === s.partId);
      if (part) {
        part.remainingMins = Math.max(0, part.remainingMins - s.mins);
        if (part.remainingMins === 0) part.done = true;
      }
    } else {
      task.remainingMins = Math.max(0, task.remainingMins - s.mins);
    }
  }

  // ------------------------------------------------------- focus sessions --
  // state.active is the one running/paused focus session. Timing uses real elapsed
  // milliseconds (elapsedMs + time since resumedAt) so it survives a page refresh.
  function startSession(state, id, setup = {}) {
    const s = findSession(state, id);
    if (!s) return;
    const real = Date.now();
    state.active = Object.assign({ sessionId: id, startedAt: state.now, realStartedAt: real,
      method: 'none', status: 'running', elapsedMs: 0, resumedAt: real }, setup);
    if (setup.method) state.prefs.focusMethod = setup.method;
    const task = state.tasks.find((t) => t.id === s.taskId);
    if (task) task.status = 'in_progress';
  }
  const focusElapsedMs = (a, real = Date.now()) => (a ? a.elapsedMs + (a.status === 'running' ? Math.max(0, real - a.resumedAt) : 0) : 0);
  function pauseSession(state) {
    const a = state.active;
    if (!a || a.status !== 'running') return;
    a.elapsedMs = focusElapsedMs(a); a.status = 'paused';
  }
  function resumeSession(state) {
    const a = state.active;
    if (!a || a.status !== 'paused') return;
    a.resumedAt = Date.now(); a.status = 'running';
  }
  /** Demo aid: move the session timer forward without waiting. */
  function skipSession(state, mins) {
    if (state.active) state.active.elapsedMs += mins * MIN;
  }

  function setUnitRemaining(task, partId, mins) {
    if (partId) {
      const part = task.parts.find((p) => p.id === partId);
      part.remainingMins = mins; part.done = mins === 0;
      if (mins > part.mins) part.mins = mins;
    } else {
      task.remainingMins = mins;
      if (mins > task.durationMins) task.durationMins = mins;
    }
  }

  /**
   * The student ends a focus session and says how it went. Only this records a session:
   * a timer reaching zero never completes a task or counts a session by itself.
   *   complete   → this piece of work is done
   *   partial    → some is done; `remainingMins` is what the student says is left
   *   unfinished → nothing to credit; the work stays on the plan
   */
  function endFocus(state, { outcome, remainingMins, focusedMins }) {
    const a = state.active;
    if (!a) return null;
    const s = findSession(state, a.sessionId);
    if (!s) { state.active = null; return null; }
    state.focusLog.push({ id: `f_${String(state.focusLog.length + 1).padStart(3, '0')}`, taskId: s.taskId, title: s.title, method: a.method, at: state.now,
      focusedMins: Math.max(0, Math.round(focusedMins || 0)), outcome });
    if (outcome === 'complete') return completeSession(state, s.id);
    const task = state.tasks.find((t) => t.id === s.taskId);
    const notes = [];
    let trigger = `Session ended, not finished yet: ${s.title}`;
    if (outcome === 'partial') {
      const left = Math.max(5, Math.round(remainingMins));
      const before = s.partId ? task.parts.find((p) => p.id === s.partId).remainingMins : task.remainingMins;
      withWorkLog(state, task, () => setUnitRemaining(task, s.partId, left));
      state.history.push({ id: s.id + '@' + state.now, taskId: s.taskId, title: s.title, start: Math.min(s.start, state.now), end: state.now, doneAt: state.now, partial: true });
      trigger = `Partly done: ${s.title} (${T.dur(left)} left)`;
      notes.push(left > before ? 'The estimate grew, so the plan now holds more time for it.' : 'Your progress is saved. The rest is back in the plan.');
    } else {
      notes.push('Nothing is lost. The work is still on your plan.');
    }
    task.status = 'pending';
    state.active = null;
    return replan(state, trigger, { notes, silent: true });
  }

  // ------------------------------------------------- progress statements --
  /** "I need another hour": add time to the next unfinished piece of the task. */
  function extendTask(state, taskId, addMins) {
    const task = state.tasks.find((t) => t.id === taskId);
    if (!task) return null;
    const part = (task.parts || []).find((p) => !p.done);
    if (part) { part.mins += addMins; part.remainingMins += addMins; } else task.remainingMins += addMins;
    task.durationMins += addMins;
    task.isAiEstimate = false;
    return task;
  }
  function completePart(state, taskId, partId) {
    const task = state.tasks.find((t) => t.id === taskId);
    const part = task && task.parts.find((p) => p.id === partId);
    if (!part) return null;
    withWorkLog(state, task, () => { part.done = true; part.remainingMins = 0; });
    state.history.push({ id: `${task.id}:${partId}@${state.now}`, taskId, title: `${task.title} — ${part.title}`, start: state.now, end: state.now, doneAt: state.now });
    if (taskRemaining(task) === 0) task.status = 'done';
    return task;
  }
  function completeTask(state, taskId) {
    const task = state.tasks.find((t) => t.id === taskId);
    if (!task) return null;
    withWorkLog(state, task, () => { (task.parts || []).forEach((p) => { p.done = true; p.remainingMins = 0; }); task.remainingMins = 0; });
    task.status = 'done';
    state.history.push({ id: `${task.id}@${state.now}`, taskId, title: task.title, start: state.now, end: state.now, doneAt: state.now });
    return task;
  }
  function setTaskRemaining(state, taskId, mins) {
    const task = state.tasks.find((t) => t.id === taskId);
    if (!task) return null;
    const part = (task.parts || []).find((p) => !p.done);
    withWorkLog(state, task, () => setUnitRemaining(task, part ? part.id : null, Math.max(5, Math.round(mins))));
    return task;
  }

  // ------------------------------------------------------ weekly progress --
  /**
   * Weekly progress (Mon–Sun, from the current clock):
   *   done    = minutes of work credited this week (completed or partly completed work)
   *   left    = minutes still scheduled between now and Sunday night
   *   percent = done / (done + left)
   * Replanning work into next week lowers `left` (the plan changed); it never lowers `done`.
   */
  function weeklyProgress(state) {
    const now = state.now;
    const weekStart = T.dayStart(now) - ((T.dow(now) + 6) % 7) * T.DAY;
    const weekEnd = weekStart + 7 * T.DAY;
    const inWeek = (ms) => ms >= weekStart && ms < weekEnd;
    const doneMins = state.workLog.filter((w) => inWeek(w.at)).reduce((a, w) => a + w.mins, 0);
    const leftMins = state.plan.filter((x) => x.end > now && x.start < weekEnd).reduce((a, x) => a + x.mins, 0);
    const sessions = state.focusLog.filter((f) => inWeek(f.at));
    const total = doneMins + leftMins;
    return { weekStart, weekEnd, doneMins, leftMins, totalMins: total, percent: total ? Math.round((doneMins / total) * 100) : 0,
      focusSessions: sessions.length, focusedMins: sessions.reduce((a, f) => a + f.focusedMins, 0),
      tasksDone: new Set(state.workLog.filter((w) => inWeek(w.at)).map((w) => w.taskId).filter((id) => (state.tasks.find((t) => t.id === id) || {}).status === 'done')).size };
  }

  function completeSession(state, id) {
    const s = findSession(state, id);
    if (!s) return null;
    const now = state.now;
    const early = now < s.start;
    state.history.push({ id: s.id + '@' + now, taskId: s.taskId, title: s.title,
      start: early ? now : s.start, end: early ? now : Math.min(Math.max(now, s.start + 15 * MIN), s.end), doneAt: now });
    const task = creditWork(state, s);
    state.checkins = state.checkins.filter((c) => c.id !== id);
    if (state.active && state.active.sessionId === id) state.active = null;
    const notes = [];
    if (task && task.status === 'done') notes.push(`"${task.title}" is complete.`);
    return replan(state, `Marked done: ${s.title}`, { notes, silent: true });
  }

  /** One-tap "Snooze / Didn't finish": push this piece of work to the next open block. */
  function snoozeSession(state, id) {
    const s = findSession(state, id);
    if (!s) return null;
    const task = state.tasks.find((t) => t.id === s.taskId);
    const target = s.partId ? task.parts.find((p) => p.id === s.partId) : task;
    target.notBefore = Math.max(s.end, state.now);
    if (task.status === 'in_progress') task.status = 'pending';
    if (state.active && state.active.sessionId === id) state.active = null;
    state.checkins = state.checkins.filter((c) => c.id !== id);
    return replan(state, `Snoozed: ${s.title}`, { silent: true });
  }

  function dismissCheckin(state, id) {
    state.checkins = state.checkins.filter((c) => c.id !== id);
  }

  /** Move the demo clock. Sessions that ended without being marked done become check-ins and get rescheduled. */
  function setClock(state, newNow) {
    const back = newNow < state.now;
    state.now = newNow;
    if (back) {
      state.checkins = [];
      return replan(state, null, { fresh: true });
    }
    const missed = state.plan.filter((s) => s.end <= newNow);
    for (const m of missed) if (!state.checkins.some((c) => c.id === m.id)) state.checkins.push(m);
    state.checkins = state.checkins.filter((c) => newNow - c.end < 2 * T.DAY);
    if (state.active) {
      const a = state.plan.find((s) => s.id === state.active.sessionId);
      if (!a || a.end <= newNow) state.active = null;
    }
    if (!missed.length) {
      const before = JSON.stringify(state.plan.map((s) => [s.unitId, s.start]));
      const r = replan(state, null);
      if (JSON.stringify(state.plan.map((s) => [s.unitId, s.start])) === before) return r;
      state.lastUpdate = { trigger: 'Time moved on', at: newNow, status: state.status, notes: [], silent: true, changes: r.changes.map(simpleChange) };
      return r;
    }
    return replan(state, `Not marked done: ${missed.map((m) => m.title).join(', ')}`, { silent: true,
      notes: ['I moved unfinished work to your next open blocks. If you did finish, confirm it on the check-in card.'] });
  }
  const simpleChange = (c) => ({ action: c.action, title: c.title, from: c.from ? { start: c.from.start, end: c.from.end } : null, to: c.to ? { start: c.to.start, end: c.to.end, mins: c.to.mins } : null });

  // ---------------------------------------------------- commitments edits --
  function addEvent(state, ev) {
    const e = { id: uid(state, 'e'), title: ev.title, kind: ev.kind || 'event', start: ev.start, end: ev.end, recurring: false };
    state.events.push(e);
    return e;
  }

  function addRecurring(state, rec) {
    const ids = [];
    for (const day of rec.days) {
      const r = { id: uid(state, 'r'), title: rec.title, kind: rec.kind || 'event', day, start: rec.start, end: rec.end };
      state.baseline.recurring.push(r);
      ids.push(r.id);
    }
    return ids;
  }

  /** Only called when the student explicitly says a commitment is cancelled — never on the engine's own initiative. */
  function cancelOccurrence(state, occ) {
    if (occ.source === 'temporary') state.events = state.events.filter((e) => e.id !== occ.refId && e.id !== occ.id);
    else if (!state.cancellations.includes(occ.id)) state.cancellations.push(occ.id);
  }

  // ---------------------------------------------------------- onboarding --
  function classesFromPhase1(state, phase1) {
    return phase1.extracted_commitments.map((c) => ({
      id: uid(state, 'c'), title: c.title, day: T.DAY_NAMES.indexOf(c.day_of_week),
      start: c.start_time, end: c.end_time, mode: c.mode === 'Online' ? 'Online' : 'FTF',
    }));
  }

  function applyLifestyle(state, ls) {
    const b = state.baseline;
    b.dayStart = ls.dayStart; b.dayEnd = ls.dayEnd; b.commuteMins = ls.commuteMins;
    b.recurring = b.recurring.filter((r) => r.kind !== 'work' && r.kind !== 'org');
    for (const w of ls.work || []) b.recurring.push({ id: uid(state, 'r'), title: 'Part-time work', kind: 'work', day: w.day, start: w.start, end: w.end });
    for (const o of ls.org || []) b.recurring.push({ id: uid(state, 'r'), title: o.name || 'Org meeting', kind: 'org', day: o.day, start: o.start, end: o.end });
  }

  function parseContext(state) {
    return {
      now: state.now, tasks: state.tasks, dayStartHm: state.baseline.dayStart,
      occurrencesFor: (day) => E.occurrences(state, day),
      // "this task" = the one being worked on, else the next one recommended
      currentTaskId: (state.active && (findSession(state, state.active.sessionId) || {}).taskId) || (E.nextSession(state.plan, state.now) || {}).taskId || null,
    };
  }

  /** Build the full Alex demo (skips onboarding). */
  function loadDemo(state) {
    state.user.name = 'Alex';
    const p1 = P.parseSchedule(D.SAMPLE_COR_TEXT);
    log(state, 'Phase 1 · Schedule extraction', 'Sample COR (BSIT 3B-G1 DBA)', p1);
    state.baseline.classes = classesFromPhase1(state, p1);
    applyLifestyle(state, D.SAMPLE_LIFESTYLE);
    state.integrations = {};
    const parsed = P.parse(D.SAMPLE_BRAIN_DUMP, parseContext(state));
    log(state, 'Phase 2 · Brain dump', D.SAMPLE_BRAIN_DUMP, P.toPhase2(parsed));
    for (const i of parsed.intents) if (i.type === 'task') state.tasks.push(makeTask(state, i.task));
    // Carried over from last week: planned on Wednesday, never marked done, now past its deadline.
    const overdue = makeTask(state, { title: 'Algorithm Tracing Worksheet', context: 'IT 205', deadline: T.at(T.addDays(T.dayStart(T.endOfWeek(state.now)), -11), '23:59'), durationMins: 60, isAiEstimate: true });
    state.tasks.push(overdue);
    seedPastWeek(state, overdue);
    state.onboarded = true;
    replan(state, null, { fresh: true });
    return state;
  }

  root.TempoStore = {
    KEY, clone, initialState, load, save, reset, uid, log, taskRemaining, taskTotal, makeTask, setDuration,
    replan, findSession, startSession, pauseSession, resumeSession, skipSession, focusElapsedMs, endFocus,
    completeSession, snoozeSession, dismissCheckin, setClock,
    extendTask, completePart, completeTask, setTaskRemaining, weeklyProgress, sanitize, daySummary,
    addEvent, addRecurring, cancelOccurrence, classesFromPhase1, applyLifestyle, parseContext, loadDemo,
  };
})(typeof window !== 'undefined' ? window : globalThis);
