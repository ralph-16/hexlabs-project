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
      offer: null,      // one optional suggestion after an early finish: { status: 'pending'|'declined', unitId, taskId, title, mins, from, to, gap, doneTitle, reason }
      autoDone: [],     // LEGACY, never added to now: blocks an earlier version marked done when their time passed. Kept so the student can still put one back.
      engineLog: [], seq: 1,
    };
  }

  const ARRAYS = ['tasks', 'events', 'cancellations', 'plan', 'unscheduled', 'needsDeadline', 'alerts', 'history', 'checkins', 'workLog', 'focusLog', 'engineLog', 'autoDone'];
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
    st.checkins = st.checkins.filter((c) => c && typeof c.id === 'string' && typeof c.taskId === 'string' && isFinite(c.end));
    for (const c of st.checkins) if (!c.ck) c.ck = `${c.id}@${c.end}`;
    if (!st.offer || typeof st.offer !== 'object' || !st.offer.gap || !st.offer.to || !st.offer.from) st.offer = null;
    if (st.active && !st.plan.some((x) => x && x.id === st.active.sessionId)) st.active = null;
    return st;
  }

  const UNREADABLE = 'Saved data on this device could not be read (it was damaged or from an older version), so SIKAD started fresh. The old plan cannot be restored in the app.';
  function load() {
    let raw = null;
    try {
      raw = localStorage.getItem(KEY);
      if (raw) {
        const st = sanitize(JSON.parse(raw));
        if (st) return st;
      }
    } catch (e) { /* unreadable storage or damaged JSON: handled below */ }
    if (raw) {
      // Keep the unreadable copy aside instead of silently writing over it, and say what happened.
      try { localStorage.setItem(KEY + ':unreadable', raw); } catch (e) { /* no room: nothing more can be done */ }
      const fresh = initialState(); fresh.loadNotice = UNREADABLE;
      return fresh;
    }
    return initialState();
  }
  /** → true when the state was written. false means the browser refused (storage full, blocked, private window). */
  function save(state) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); return true; } catch (e) { return false; }
  }
  /** Can this browser store anything at all? Checked once at start so the app can say so up front. */
  function storageAvailable() {
    try { const k = KEY + ':probe'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return true; } catch (e) { return false; }
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

  const DIFFICULTIES = ['easy', 'medium', 'hard'];   // 'medium' is the default when the student has not said
  function makeTask(state, t) {
    const parts = (t.parts || []).filter((p) => p.mins > 0).map((p, i) => ({
      id: `p${i + 1}`, title: p.title, mins: p.mins, remainingMins: p.mins, done: false, aiSuggested: !!p.aiSuggested,
    }));
    return {
      id: uid(state, 't'), title: t.title, type: t.type || 'task', context: t.context || null,
      deadline: t.deadline != null ? t.deadline : null, durationMins: t.durationMins,
      remainingMins: parts.length ? 0 : t.durationMins, isAiEstimate: !!t.isAiEstimate,
      priority: t.priority || 'medium', difficulty: DIFFICULTIES.includes(t.difficulty) ? t.difficulty : 'medium', doFirst: false, status: 'pending', parts,
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
    // A question about a block is dropped once its task is finished, removed, or has nothing left in that piece.
    state.checkins = (state.checkins || []).filter((c) => {
      const t = state.tasks.find((x) => x.id === c.taskId);
      if (!t || t.status === 'done' || t.status === 'cancelled') return false;
      const part = c.partId ? (t.parts || []).find((x) => x.id === c.partId) : null;
      return c.partId ? !!part && !part.done && part.remainingMins > 0 : t.remainingMins > 0;
    });
    const prevPlan = state.plan.filter((s) => s.end > state.now);
    // A change the student made (it has a trigger) may also close gaps it opened; time simply passing never reshuffles.
    // Time that an early finish freed, and that is still ahead, is offered to the student (state.offer).
    // Until that is settled, nothing is moved into it as an optimisation. Required placements may still use it.
    const openGap = state.offer && state.offer.gap && state.offer.gap.end > state.now ? state.offer.gap : null;
    // A routine recalculation (no trigger: time passing, a reload) only repairs; it never swaps in a
    // tidier plan by itself, so nothing moves without a reason the student can see.
    const res = E.schedule(state, { prevPlan: opts.fresh ? null : prevPlan, compact: !!trigger, hold: !!opts.hold || !trigger, gap: opts.early ? opts.early.gap : openGap });
    const changes = opts.fresh ? [] : E.diff(prevPlan, res.plan, state, res.unscheduled);
    const oldPlan = state.plan;
    state.plan = res.plan;
    snapshotDay(state, oldPlan);
    state.unscheduled = res.unscheduled.map((x) => ({ unitId: x.unit.id, taskId: x.unit.taskId, title: x.unit.title, mins: x.unit.mins, deadline: x.unit.deadline, reason: x.reason, waitingOn: x.waitingOn || null }));
    state.needsDeadline = res.needsDeadline;
    state.alerts = res.alerts;
    state.status = res.status;
    state.late = res.late || [];
    // An agreed-late task that now fits before its deadline is simply on time again.
    for (const t of state.tasks) if (t.lateOk && !state.late.some((l) => l.taskId === t.id) && !res.unscheduled.some((x) => x.unit.taskId === t.id)) t.lateOk = false;
    for (const a of res.alerts) if (a.code === 'PIN_FAILED') { const t = state.tasks.find((x) => x.id === a.taskId); if (t) t.pinnedStart = null; }
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
    // The early-finish suggestion. A task was just finished early: look for one. Any OTHER change the student
    // makes is an independent reason to look again, which also ends an earlier "no". Time passing changes nothing.
    if (!opts.noOffer) {
      if (opts.early) {
        // Each early finish is looked at on its own. One card at a time: the new suggestion replaces any
        // earlier one; if the new finish frees nothing usable, a suggestion still waiting for an answer is
        // checked again against the current plan and kept, so it is neither lost nor applied by itself.
        const prior = state.offer && state.offer.status === 'pending' && state.offer.gap.end > state.now ? state.offer : null;
        state.offer = earlyFinishOffer(state, opts.early.gap, opts.early.title, opts.early.taskId) ||
          (prior ? earlyFinishOffer(state, prior.gap, prior.doneTitle, null) : null);
      }
      else if (trigger && state.offer) state.offer = openGap ? earlyFinishOffer(state, openGap, state.offer.doneTitle, null) : null;
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
    // A block that was planned for later today but was never recorded is recorded now, so that its move is not lost.
    for (const s of oldPlan || []) if (T.dayStart(s.start) === today && s.end > state.now && !has(s)) put(s);
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
  const OVERRUN_GRACE = 30 * MIN;
  /** The student just reported on work that was happening now (not an old check-in): the engine starts the next task a buffer later. */
  function markBusy(state, s) {
    const live = (state.active && state.active.sessionId === s.id) || (state.now >= s.start && state.now <= s.end + OVERRUN_GRACE);
    if (live) state.busyUntil = state.now;
  }
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
    markBusy(state, s);
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

  // ------------------------------------------- one task: adjust its time --
  // Everything that changes when a task is worked on goes the same way: the change is applied to a
  // COPY of the state, the engine replans the whole horizon, and the copy is shown before it replaces
  // the real state. The three functions below serve "Adjust schedule" and every form that takes a
  // requested start time (Task details, Add a task), so they cannot disagree about what is allowed.
  //
  // HARD CONSTRAINTS, checked in this order, never traded against a preference:
  //   a real time · not in the past · inside the student's day · finished by the deadline (unless the
  //   task is already overdue or agreed late) · clear of every fixed commitment and its buffer.
  /** The piece of the task a requested start applies to (its first unfinished step), in minutes. */
  function firstUnitMins(state, task) {
    const u = E.units(state).find((x) => x.taskId === task.id && x.seq === 0);
    return u ? u.mins : taskRemaining(task);
  }
  /** Fixed-free time on one day, from now on, as the engine sees it (buffers already taken off). */
  const openOn = (state, day) => E.freeSlots(state, Math.max(T.ceilTo(state.now, 15), T.at(day, state.baseline.dayStart)), T.at(day, state.baseline.dayEnd));   // the engine plans from the next quarter hour
  /**
   * The valid start closest to `want` for `mins` of work that must end by `limit` (null = no limit).
   * Looks at every day from today to the limit, or three weeks. → ms | null
   */
  function nearestStart(state, mins, want, limit) {
    const today = T.dayStart(state.now), lastDay = Math.min(limit != null ? T.dayStart(limit) : Infinity, today + 21 * T.DAY);
    let best = null;
    for (let day = today; day <= lastDay; day += T.DAY) {
      for (const f of openOn(state, day)) {
        const latest = Math.min(f.end, limit != null ? limit : Infinity) - mins * MIN;
        if (latest < f.start) continue;
        const cand = Math.min(latest, Math.max(f.start, T.ceilTo(want, 5)));
        if (cand <= state.now) continue;
        if (best == null || Math.abs(cand - want) < Math.abs(best - want)) best = cand;
      }
    }
    return best;
  }
  /**
   * May work of `spec.mins` minutes, due at `spec.deadline`, start at `start`?
   * → { ok: true } | { ok: false, code, message, alt } where alt is the closest start that is allowed (or null).
   */
  function checkStart(state, spec, start) {
    const b = state.baseline, now = state.now, mins = Math.max(5, Math.round(spec.mins || 0));
    const limit = spec.deadline != null && spec.deadline > now && !spec.lateOk ? spec.deadline : null;
    const no = (code, message) => ({ ok: false, code, message, alt: nearestStart(state, mins, isFinite(start) ? start : now, limit) });
    if (start == null || !isFinite(start)) return no('NO_TIME', 'Pick a date and a time.');
    const end = start + mins * MIN, day = T.dayStart(start);
    if (start <= now) return no('PAST', 'That time has already passed.');
    if (start < T.ceilTo(now, 15)) return no('TOO_SOON', `That is too close to now. The earliest start is ${T.time(T.ceilTo(now, 15))}.`);
    if (start < T.at(day, b.dayStart) || end > T.at(day, b.dayEnd)) return no('OUTSIDE_DAY', `That is outside your day (${T.hmLabel(b.dayStart)} to ${T.hmLabel(b.dayEnd)}) for ${T.dur(mins)} of work.`);
    if (limit != null && end > limit) return no('AFTER_DEADLINE', `Starting then, ${T.dur(mins)} of work would end after the deadline (${T.short(limit)} ${T.time(limit)}).`);
    if (!openOn(state, day).some((f) => f.start <= start && end <= f.end)) {
      const hit = E.occurrences(state, day).find((o) => o.start < end + b.bufferMins * MIN && o.end > start - b.bufferMins * MIN);
      return no('FIXED', `That time runs into ${hit ? `${hit.title} (${T.range(hit.start, hit.end)})` : 'a fixed commitment'} or the ${b.bufferMins}-minute gap around it. SIKAD never moves a fixed commitment.`);
    }
    return { ok: true };
  }
  /**
   * Work out, on a copy, the plan that results from starting this task at `start`. Other flexible tasks
   * that are in the way are placed again by the ordinary engine, on later days if need be.
   * → { ok: true, draft } | { ok: false, code, message, alt }
   */
  function previewMove(state, taskId, start) {
    const task = state.tasks.find((t) => t.id === taskId);
    if (!task || task.status === 'done' || task.status === 'cancelled') return { ok: false, code: 'GONE', message: 'That task is no longer open.', alt: null };
    const mins = firstUnitMins(state, task);
    const v = checkStart(state, { mins, deadline: task.deadline, lateOk: task.lateOk }, start);
    if (!v.ok) return v;
    const draft = clone(state);
    const was = state.plan.filter((s) => s.taskId === taskId && s.end > state.now).sort((a, b) => a.start - b.start)[0];
    const r = applyTaskAction(draft, { type: 'move', taskId, start });
    if (!r.ok) return { ok: false, code: 'REFUSED', message: r.error, alt: null };
    replan(draft, `Adjust schedule: ${task.title} → ${T.rel(start, state.now)} ${T.timeShort(start)}`, { silent: true });
    if (!draft.plan.some((s) => s.taskId === taskId && s.start === start)) {   // the engine could not keep it (for example a step it depends on comes later)
      const a = (draft.alerts || []).find((x) => x.code === 'PIN_FAILED' && x.taskId === taskId);
      return { ok: false, code: 'NOT_KEPT', message: a ? a.message : 'That time could not be kept.', alt: nearestStart(state, mins, start, task.deadline != null && task.deadline > state.now ? task.deadline : null) };
    }
    const others = draft.lastUpdate.changes.filter((c) => c.title !== task.title && !(c.title || '').startsWith(task.title + ' — ') && c.from && c.to);
    const days = new Set(others.map((c) => T.dayStart(c.to.start))).size;
    const notes = [`"${task.title}" needs ${T.dur(mins)}${was ? ` and is planned ${T.rel(was.start, state.now).toLowerCase()} at ${T.timeShort(was.start)}` : ' and is not planned yet'}. New start: ${T.rel(start, state.now)} at ${T.timeShort(start)}.`];
    if (task.deadline != null && task.deadline > state.now) notes.push(`That is before its deadline (${T.short(task.deadline)} ${T.time(task.deadline)}).`);
    notes.push(others.length ? `${others.length === 1 ? 'One other task moves' : `${others.length} other tasks move`} to make room${days > 1 ? `, across ${days} days` : ''}. Work due sooner stays ahead of work due later.` : 'No other task needs to move.');
    if (draft.status === 'INFEASIBLE' && (draft.unscheduled || []).length > (state.unscheduled || []).length) notes.push('With this time, some other work no longer fits before its deadline. It is listed below.');
    draft.lastUpdate.notes = notes;
    return { ok: true, draft };
  }
  /**
   * The time SIKAD recommends for a task that is at risk today or does not fit today. Every candidate
   * is a complete plan worked out by the engine on a copy (previewMove), and the candidates are compared
   * as WHOLE plans, not just by where this one task lands (nothing here changes `state`):
   *   candidates: where it is now · today's first open time · the first open time on each later day
   *               that is still before its deadline.
   *   1. A candidate that leaves more work without a slot than now is dropped.
   *   2. Overdue work: the earliest candidate today wins, whatever else is true. Only when today has no
   *      opening at all does it go to the earliest later one, and the reason says what is in the way.
   *   3. Otherwise the plan with the fewest at-risk tasks IN TOTAL wins, so a move that only hands the risk
   *      to another task is never recommended; on a tie, staying put beats moving, and earlier beats later.
   * → { taskId, title, mins, remainingMins, deadline, current, start, basis: 'keep'|'earlier_today'|'later_day'|'none',
   *     reason, newRisks: [titles of other tasks the recommended plan would put at risk] }
   */
  function recommendAdjustment(state, taskId) {
    const task = state.tasks.find((t) => t.id === taskId);
    if (!task || task.status === 'done' || task.status === 'cancelled') return null;
    const now = state.now, today = T.dayStart(now), mins = firstUnitMins(state, task), b = state.baseline;
    const overdue = task.deadline != null && task.deadline <= now;
    const limit = task.deadline != null && task.deadline > now && !task.lateOk ? task.deadline : null;
    const current = state.plan.filter((s) => s.taskId === taskId && s.end > now).sort((a, c) => a.start - c.start)[0] || null;
    const base = { taskId, title: task.title, mins, remainingMins: taskRemaining(task), deadline: task.deadline, current, newRisks: [] };
    const lost = (st) => (st.unscheduled || []).filter((u) => u.reason === 'no_time').length;
    const risks = (st) => E.completionConfidence(st, st.now).filter((r) => r.level === 'risk' || r.level === 'high');
    const fits = (f) => f.end - f.start >= mins * MIN && (limit == null || f.start + mins * MIN <= limit);
    const dl = limit != null ? ` and still before its deadline (${T.short(limit)} ${T.time(limit)})` : '';
    const wasRisk = new Set(risks(state).map((r) => r.taskId));
    const mk = (start, draft, keep) => ({ start, draft, keep: !!keep, today: T.dayStart(start) === today, lost: lost(draft), risk: risks(draft).length,
      newRisks: risks(draft).filter((r) => r.taskId !== taskId && !wasRisk.has(r.taskId)).map((r) => r.title) });
    const tryAt = (start) => { const p = previewMove(state, taskId, start); return p.ok && lost(p.draft) <= lost(state) ? mk(start, p.draft) : null; };
    const keep = current ? mk(current.start, state, true) : null;
    const cands = [];
    const firstToday = (openOn(state, today).filter(fits)[0] || {}).start;
    if (firstToday != null && !(current && firstToday === current.start)) { const c = tryAt(firstToday); if (c) cands.push(c); }
    for (let day = today + T.DAY, n = 0; n < 5 && day <= Math.min(limit != null ? T.dayStart(limit) : Infinity, today + 21 * T.DAY); day += T.DAY) {
      const f = openOn(state, day).filter(fits)[0];
      if (!f || (current && f.start === current.start)) continue;
      const c = tryAt(f.start); if (c) { cands.push(c); n += 1; }
    }
    const tight = (c) => (risks(c.draft).some((r) => r.taskId === taskId) ? ' It stays tight today: if the time needed is too high, lower it in Task details, or free up time.' : '');
    const done = (c, basis, reason) => Object.assign(base, { start: c.start, basis, reason, newRisks: c.newRisks });

    if (overdue) {   // 2. earliest feasible slot from now on; today before any later day
      const todays = [keep].concat(cands).filter((c) => c && c.today).sort((a, c) => a.start - c.start);
      if (todays.length) {
        const c = todays[0];
        return c.keep ? done(c, 'keep', `${T.timeShort(c.start)} is already today's earliest open time for it, and overdue work goes first. Moving it later would only delay it.${tight(c)}`)
          : done(c, 'earlier_today', `It is overdue, so it goes into today's earliest open time, ${T.timeShort(c.start)}.${tight(c)}`);
      }
      const later = [keep].concat(cands).filter(Boolean).sort((a, c) => a.start - c.start)[0];
      const openToday = Math.round(openOn(state, today).reduce((a, f) => a + (f.end - f.start) / MIN, 0));
      const why = `Today has ${openToday >= 15 ? `only ${T.dur(openToday)} of open time left before ${T.hmLabel(b.dayEnd)}, and no single opening long enough` : `no open time left before ${T.hmLabel(b.dayEnd)}`} for ${T.dur(mins)} of work`;
      if (later) return done(later, later.keep ? 'keep' : 'later_day', `${why}, so ${later.keep ? 'it stays at' : 'the earliest time is'} ${T.rel(later.start, now)} at ${T.timeShort(later.start)}.`);
      return Object.assign(base, { start: null, basis: 'none', reason: `${why}, and no later opening was found in the next three weeks.` });
    }

    // 3. fewest at-risk tasks in the whole plan; then stay put; then earlier
    const best = cands.slice().sort((a, c) => a.risk - c.risk || a.start - c.start)[0] || null;
    if (keep && (!best || keep.risk <= best.risk)) {
      const reason = !best ? `There is no other open time for it${limit != null ? ` before its deadline (${T.short(limit)} ${T.time(limit)})` : ''}.`
        : `Its current time, ${T.rel(keep.start, now)} at ${T.timeShort(keep.start)}, is the best available: every other open time would leave as many tasks at risk, or more.`;
      return done(keep, 'keep', `${reason}${tight(keep)}`);
    }
    if (best) {
      const helps = keep ? ` That leaves ${best.risk === 0 ? 'no task' : best.risk === 1 ? 'one task' : `${best.risk} tasks`} at risk today instead of ${keep.risk}.` : '';
      return best.today
        ? done(best, 'earlier_today', `${T.timeShort(best.start)} is today's first open time. Starting then puts it ahead of the tasks planned before it.${helps}`)
        : done(best, 'later_day', `Today is too tight for ${T.dur(mins)} of work. ${T.rel(best.start, now)} at ${T.timeShort(best.start)} is the next open time${dl}.${helps}`);
    }
    return Object.assign(base, { start: null, basis: 'none', reason: `There is no open time for it${limit != null ? ` before its deadline (${T.short(limit)} ${T.time(limit)})` : ''}. You can still choose a time below, or change the time needed or the deadline in Task details.` });
  }
  /**
   * Where a task stands right now, worked out from the plan every time (never a stored flag):
   *   done · needs_deadline · not_enough_time · awaiting_answer (a check-in is open) · in_progress · scheduled.
   * `attention` is true only while something is genuinely unresolved.
   */
  function taskStatus(state, task) {
    const overdue = task.deadline != null && task.deadline <= state.now && task.status !== 'done';
    const out = (key, label, attention) => ({ key, label, attention, overdue });
    if (task.status === 'done') return out('done', 'Done', false);
    if (task.deadline == null) return out('needs_deadline', 'Needs a deadline', true);
    if ((state.unscheduled || []).some((u) => u.taskId === task.id)) return out('not_enough_time', "Doesn't fit yet", true);
    if ((state.checkins || []).some((c) => c.taskId === task.id)) return out('awaiting_answer', 'Waiting for your answer', true);
    if (task.status === 'in_progress') return out('in_progress', 'In progress', false);
    return out('scheduled', 'Scheduled', false);
  }

  // ------------------------------------- early finish: an offer, not a move --
  // Finishing a block early frees time. Using it for another task is an OPTIONAL improvement, so SIKAD
  // suggests it and waits: other tasks keep their slots until the student accepts (replan with `hold`).
  // What is REQUIRED to keep the plan valid (work that would otherwise have no slot, the next task after an
  // overrun, the rest of the same task) is still done at once and never waits on an unanswered offer.
  //
  // Which task is offered uses the rules that already exist, nothing new:
  //   · order: E.rank (overdue, then deadline, then difficulty);
  //   · worth it: the gap-closing thresholds (E.COMPACT_MIN or an earlier day, one sitting, ends no later);
  //   · allowed: checkStart (day window, deadline, fixed commitments and their buffer) and the engine keeping it;
  //   · safe: the whole plan it produces leaves no more work without a slot and no more tasks at risk,
  //     and moves no other task.
  /** Openings on `day` that are free of fixed commitments, buffers AND every planned session. */
  function emptyOn(state, day, from) {
    const buf = state.baseline.bufferMins * MIN;
    let free = E.freeSlots(state, Math.max(from, T.at(day, state.baseline.dayStart)), T.at(day, state.baseline.dayEnd));
    for (const p of state.plan.filter((x) => x.end > state.now)) {
      free = free.flatMap((f) => (p.end + buf <= f.start || p.start - buf >= f.end) ? [f] : [{ start: f.start, end: p.start - buf }, { start: p.end + buf, end: f.end }].filter((x) => x.end - x.start >= 15 * MIN));
    }
    return free;
  }
  /** The plan that results from moving one unit to `start` and nothing else. → draft | null */
  function offerDraft(state, u, task, start) {
    const draft = clone(state), t = draft.tasks.find((x) => x.id === task.id);
    draft.offer = null;
    t.pinnedStart = start;
    replan(draft, `Used freed time: ${u.title} → ${T.rel(start, state.now)} ${T.timeShort(start)}`, { silent: true, hold: true, noOffer: true });
    t.pinnedStart = null;   // it was a suggestion the student took, not a time they fixed
    return draft.plan.some((x) => x.unitId === u.id && x.start === start) ? draft : null;
  }
  /**
   * The one suggestion for time freed by an early finish, or null. `gap` is the freed block { start, end }.
   * Never changes `state`.
   */
  function earlyFinishOffer(state, gap, doneTitle, skipTaskId) {
    const now = state.now, buf = state.baseline.bufferMins * MIN;
    if (!gap || gap.end <= now || state.active) return null;
    // Earliest permissible start: the next quarter hour, and a buffer after the moment the work actually ended.
    const busy = state.busyUntil && state.busyUntil <= now && now - state.busyUntil < buf ? state.busyUntil : 0;
    const from = Math.max(T.ceilTo(now, 15), busy ? T.ceilTo(busy + buf, 5) : 0);
    const day = T.dayStart(gap.start);
    const openings = emptyOn(state, day, from).filter((f) => f.start < gap.end && f.end > gap.start);
    if (!openings.length) return null;
    const lost = (st) => (st.unscheduled || []).filter((x) => x.reason === 'no_time').length;
    const risk = (st) => E.completionConfidence(st, st.now).filter((r) => r.level === 'risk' || r.level === 'high').length;
    const rest = (st, unitId) => JSON.stringify(st.plan.filter((x) => x.end > now && x.unitId !== unitId).map((x) => [x.unitId, x.start, x.end]).sort());
    const held = new Set((state.checkins || []).map((c) => c.unitId));
    for (const u of E.rank(E.units(state).filter((x) => x.deadline != null), now)) {
      const task = state.tasks.find((t) => t.id === u.taskId);
      if (!task || u.taskId === skipTaskId || task.pinnedStart || u.pinnedStart || held.has(u.id)) continue;
      const prev = state.plan.filter((x) => x.unitId === u.id && x.end > now).sort((a, b) => a.start - b.start);
      if (prev.length !== 1 || prev[0].mins !== u.mins) continue;                    // one sitting stays one sitting
      const o = openings.find((f) => f.end - f.start >= u.mins * MIN);
      if (!o) continue;                                                              // it does not fit the freed time
      const start = o.start, end = start + u.mins * MIN;
      if ((u.notBefore || 0) > start) continue;                                      // the student put it on a later day or snoozed it: that stands
      if (!(T.dayStart(start) < T.dayStart(prev[0].start) || prev[0].start - start >= E.COMPACT_MIN * MIN) || end > prev[0].end) continue;   // not worth a move
      if (!checkStart(state, { mins: u.mins, deadline: task.deadline, lateOk: task.lateOk }, start).ok) continue;
      const draft = offerDraft(state, u, task, start);
      if (!draft || rest(draft, u.id) !== rest(state, u.id) || lost(draft) > lost(state) || risk(draft) > risk(state)) continue;
      const lateFix = task.lateOk && task.deadline > now && prev[0].end > task.deadline && end <= task.deadline;
      const why = task.deadline <= now ? 'It is past its deadline, so it is first in line.'
        : lateFix ? 'That would bring it back before its deadline.'
        : `It is the next task by deadline (due ${T.rel(task.deadline, now).toLowerCase()}, ${T.timeShort(task.deadline)}) that fits there${u.difficulty === 'hard' ? ', and it is marked hard' : ''}.`;
      return { status: 'pending', unitId: u.id, taskId: u.taskId, title: u.title, mins: u.mins, doneTitle: doneTitle || '',
        from: { start: prev[0].start, end: prev[0].end }, to: { start, end }, gap: { start: gap.start, end: gap.end },
        reason: `${doneTitle ? `You finished "${doneTitle}" early` : 'You finished early'}, so ${T.rel(start, now).toLowerCase()} ${T.range(start, end)} is open. ${why} No other task would move.` };
    }
    return null;
  }
  /**
   * The student accepts the pending suggestion. It is worked out again against the plan as it is NOW.
   *   still the same → { ok: true, draft }: the caller swaps the draft in (one step, like any proposal)
   *   the plan has changed → { ok: false, offer }: the up-to-date suggestion (or null), stored as the pending one; nothing is applied
   */
  function acceptOffer(state) {
    const o = state.offer;
    if (!o || o.status !== 'pending') return { ok: false, offer: null };
    const again = earlyFinishOffer(state, o.gap, o.doneTitle, null);
    if (!again || again.unitId !== o.unitId || again.to.start !== o.to.start) { state.offer = again; return { ok: false, offer: again }; }
    const u = E.units(state).find((x) => x.id === o.unitId), task = state.tasks.find((t) => t.id === o.taskId);
    const draft = u && task ? offerDraft(state, u, task, o.to.start) : null;
    if (!draft) { state.offer = null; return { ok: false, offer: null }; }
    draft.lastUpdate.notes = [`You chose to use the time freed by finishing "${o.doneTitle}" early. No other task moved.`];
    return { ok: true, draft };
  }
  /** "No": nothing moves, and the same suggestion is not made again until the plan changes for another reason. */
  function declineOffer(state) {
    if (state.offer && state.offer.status === 'pending') state.offer = Object.assign({}, state.offer, { status: 'declined' });
  }
  /**
   * Mark a whole task done (Task details). If that is before its planned time, the freed time is offered
   * in the same way as after Done on a block; other tasks are not moved.
   */
  function finishTask(state, taskId) {
    const task = state.tasks.find((t) => t.id === taskId);
    if (!task) return null;
    const mine = state.plan.filter((x) => x.taskId === taskId && x.end > state.now).sort((a, b) => a.start - b.start);
    completeTask(state, taskId);
    state.checkins = (state.checkins || []).filter((c) => c.taskId !== taskId);
    if (state.active && mine.some((x) => x.id === state.active.sessionId)) state.active = null;
    const first = mine[0];
    const early = first ? { gap: { start: Math.max(state.now, first.start), end: first.end }, title: task.title, taskId } : null;
    return replan(state, `Completed: ${task.title}`, { silent: true, hold: !!early, early });
  }

  // ------------------------------------------------ too much work: adjust --
  /**
   * When work does not fit before its deadlines, work out a plan that DOES run, for the student to
   * accept or reject. Nothing is shortened, no deadline is edited and no fixed commitment moves:
   * the only thing offered is to let the least important competing work finish after its deadline.
   *
   * Which tasks give way (ADJUST_ORDER): lowest priority first, then not marked "do first", then the
   * one that already did not fit, then the later deadline, then the larger task. One task at a time
   * until everything has a slot; then each choice is re-tested and dropped if it was not needed.
   *
   * opts.basePlan: the plan to list changes against (default: this state's). opts.because: what led here.
   * Works on a COPY. → null when nothing is unscheduled for lack of time, else
   *   { draft, late: [{ taskId, title, deadline, finish, lateMins, mins, priority }], stillUnfit: [{ title, mins }] }
   */
  function suggestAdjustment(state, opts = {}) {
    const stuckIn = (st) => (st.unscheduled || []).filter((u) => u.reason === 'no_time');
    if (!stuckIn(state).length) return null;
    const draft = clone(state);
    const run = () => {
      const res = E.schedule(draft, { prevPlan: draft.plan.filter((s) => s.end > draft.now) });
      draft.plan = res.plan;
      draft.unscheduled = res.unscheduled.map((x) => ({ unitId: x.unit.id, taskId: x.unit.taskId, title: x.unit.title, mins: x.unit.mins, deadline: x.unit.deadline, reason: x.reason, waitingOn: x.waitingOn || null }));
      return res;
    };
    const PRI = { low: 0, medium: 1, high: 2 };
    const chosen = [];
    for (let guard = 0; guard < draft.tasks.length + 1 && stuckIn(draft).length; guard++) {
      const stuck = stuckIn(draft), stuckIds = new Set(stuck.map((u) => u.taskId));
      const horizon = Math.max(...stuck.map((u) => u.deadline));
      // Everything that competes for the time before the last missed deadline.
      const competing = draft.tasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled' && !t.lateOk && t.deadline != null && t.deadline > draft.now &&
        (stuckIds.has(t.id) || draft.plan.some((s) => s.taskId === t.id && s.start < horizon)));
      if (!competing.length) break;
      competing.sort((a, b) => PRI[a.priority] - PRI[b.priority] || (a.doFirst ? 1 : 0) - (b.doFirst ? 1 : 0) || (stuckIds.has(b.id) ? 1 : 0) - (stuckIds.has(a.id) ? 1 : 0) ||
        b.deadline - a.deadline || taskRemaining(b) - taskRemaining(a) || a.id.localeCompare(b.id));
      competing[0].lateOk = true; chosen.push(competing[0]);
      run();
    }
    // Keep only the choices that were really needed, giving the most important work the first chance to stay on time.
    for (const t of chosen.slice().reverse().sort((a, b) => PRI[b.priority] - PRI[a.priority])) {
      if (chosen.length === 1) break;
      t.lateOk = false;
      run();
      if (stuckIn(draft).length) { t.lateOk = true; run(); } else chosen.splice(chosen.indexOf(t), 1);
    }
    draft.plan = (opts.basePlan || state.plan).map((s) => Object.assign({}, s));   // so the change list compares with the real plan
    const r = replan(draft, `${opts.because ? opts.because + ' · ' : ''}Adjusted plan: ${chosen.length} task${chosen.length === 1 ? '' : 's'} would finish late`, {
      notes: ['Nothing was shortened, no deadline was edited and no fixed commitment moved.'] });
    const late = (draft.late || []).map((l) => { const t = draft.tasks.find((x) => x.id === l.taskId); return Object.assign({}, l, { mins: taskRemaining(t), priority: t.priority }); });
    return { draft, late, stillUnfit: stuckIn(draft).map((u) => ({ title: u.title, mins: u.mins })), changes: r ? r.changes : [] };
  }

  // -------------------------------------------------------- task actions --
  /**
   * One edit to one saved task, as asked for in Ask SIKAD (or any other caller). It changes the task
   * only: the caller replans, so every time and move still comes from the engine. Nothing is
   * changed when the action is not valid. → { ok: true, trigger } | { ok: false, error }
   */
  function applyTaskAction(state, a) {
    const task = state.tasks.find((t) => t.id === a.taskId);
    if (!task || task.status === 'cancelled') return { ok: false, error: 'That task is no longer on your list.' };
    if (task.status === 'done') return { ok: false, error: `"${task.title}" is already done.` };
    const title = task.title;
    switch (a.type) {
      case 'move': {
        const clearHolds = () => { task.notBefore = null; (task.parts || []).forEach((p) => { p.notBefore = null; }); };
        if (a.start != null) {
          if (!isFinite(a.start) || a.start <= state.now) return { ok: false, error: 'That time has already passed.' };
          clearHolds(); task.pinnedStart = a.start;
          return { ok: true, trigger: `Move ${title} to ${T.short(a.start)} ${T.time(a.start)}` };
        }
        if (a.day != null) {
          if (T.dayStart(a.day) < T.dayStart(state.now)) return { ok: false, error: 'That day has already passed.' };
          clearHolds(); task.pinnedStart = null; task.notBefore = Math.max(state.now, T.at(T.dayStart(a.day), state.baseline.dayStart));
          return { ok: true, trigger: `Move ${title} to ${T.short(a.day)}` };
        }
        clearHolds(); task.pinnedStart = null;
        return { ok: true, trigger: `Find the next open slot for ${title}` };
      }
      case 'set_duration': {
        const mins = Math.round(Number(a.mins));
        if (!isFinite(mins) || mins < 5 || mins > 40 * 60) return { ok: false, error: 'Time needed must be between 5 minutes and 40 hours.' };
        setDuration(task, mins);
        return { ok: true, trigger: `Time needed for ${title} → ${T.dur(mins)}` };
      }
      case 'rename': {
        const name = String(a.newTitle || '').trim();
        if (name.length < 2) return { ok: false, error: 'A task needs a name.' };
        task.title = name;
        for (const s of state.plan) if (s.taskId === task.id) s.title = s.partId ? `${name} — ${(task.parts.find((p) => p.id === s.partId) || {}).title || ''}` : name;
        return { ok: true, trigger: `Renamed ${title} → ${name}` };
      }
      case 'set_difficulty':
        if (!DIFFICULTIES.includes(a.difficulty)) return { ok: false, error: 'Difficulty is easy, medium or hard.' };
        task.difficulty = a.difficulty;
        return { ok: true, trigger: `Difficulty of ${title} → ${a.difficulty}` };
      case 'set_priority':
        if (!['high', 'medium', 'low'].includes(a.priority)) return { ok: false, error: 'Priority is high, medium or low.' };
        task.priority = a.priority;
        return { ok: true, trigger: `Priority of ${title} → ${a.priority}` };
      case 'deadline_change':
        if (a.deadline == null || !isFinite(a.deadline)) return { ok: false, error: 'That deadline is not a date I can use.' };
        task.deadline = a.deadline; task.lateOk = false;
        return { ok: true, trigger: `Deadline for ${title} → ${T.short(a.deadline)}` };
      case 'cancel_task':
        task.status = 'cancelled';
        if (state.active && (findSession(state, state.active.sessionId) || {}).taskId === task.id) state.active = null;
        state.checkins = state.checkins.filter((c) => c.taskId !== task.id);
        return { ok: true, trigger: `Removed task: ${title}` };
      default: return { ok: false, error: 'That change is not supported.' };
    }
  }

  /**
   * Apply one parsed Ask SIKAD intent that targets an existing task. Shared by the review → proposal
   * flow and by "what if" previews (which run it on a copy). → { ok, trigger?, error? }
   */
  function applyIntent(state, it) {
    const task = state.tasks.find((t) => t.id === it.taskId);
    if (!task) return { ok: false, error: 'That task is no longer on your list.' };
    switch (it.type) {
      case 'complete':
        if (task.status === 'done') return { ok: false, error: `"${task.title}" is already done.` };
        completeTask(state, task.id); return { ok: true, trigger: `Completed: ${task.title}` };
      case 'extend': extendTask(state, task.id, it.addMins); return { ok: true, trigger: `More time for ${task.title} (+${T.dur(it.addMins)})` };
      case 'partial':
        if (it.remainingMins == null || !isFinite(it.remainingMins) || it.remainingMins <= 0) return { ok: false, error: 'How much time is still needed?' };
        setTaskRemaining(state, task.id, it.remainingMins); task.pinnedStart = null;
        return { ok: true, trigger: `Partly done: ${task.title} (${T.dur(taskRemaining(task))} left)` };
      default: return applyTaskAction(state, it);
    }
  }
  /** Run intents on a COPY and replan it. The given state is never touched. → { draft, applied, errors } */
  function previewIntents(state, intents) {
    const draft = clone(state);
    const applied = [], errors = [];
    for (const it of intents) { const r = applyIntent(draft, it); if (r.ok) applied.push(r.trigger); else errors.push(r.error); }
    if (applied.length) replan(draft, applied.join(' · '));
    return { draft, applied, errors };
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
    // Minutes waiting on a check-in are still this week's work: on hold, not gone.
    const leftMins = state.plan.filter((x) => x.end > now && x.start < weekEnd).reduce((a, x) => a + x.mins, 0) + (state.checkins || []).filter((c) => inWeek(c.start) || c.start < weekStart).reduce((a, c) => a + c.mins, 0);
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
    markBusy(state, s);
    state.history.push({ id: s.id + '@' + now, taskId: s.taskId, title: s.title,
      start: early ? now : s.start, end: early ? now : Math.min(Math.max(now, s.start + 15 * MIN), s.end), doneAt: now });
    const task = creditWork(state, s);
    state.checkins = state.checkins.filter((c) => c.id !== id);
    if (state.active && state.active.sessionId === id) state.active = null;
    const notes = [];
    if (task && task.status === 'done') notes.push(`"${task.title}" is complete.`);
    // Finished before the block's planned end: the time that frees is OFFERED (state.offer), and other tasks
    // stay where they are. The freed block runs from now (or its planned start, if that is still ahead) to its planned end.
    const freed = now < s.end ? { gap: { start: Math.max(now, s.start), end: s.end }, title: s.title, taskId: s.taskId } : null;
    return replan(state, `Marked done: ${s.title}`, { notes, silent: true, hold: !!freed, early: freed });
  }

  /** One-tap "Snooze / Didn't finish": push this piece of work to the next open block. */
  function snoozeSession(state, id) {
    const s = findSession(state, id);
    if (!s) return null;
    const task = state.tasks.find((t) => t.id === s.taskId);
    const target = s.partId ? task.parts.find((p) => p.id === s.partId) : task;
    target.notBefore = Math.max(s.end, state.now);
    task.pinnedStart = null;   // Snooze overrides a time the student pinned earlier, so the task really moves
    if (task.status === 'in_progress') task.status = 'pending';
    if (state.active && state.active.sessionId === id) state.active = null;
    state.checkins = state.checkins.filter((c) => c.id !== id);
    return replan(state, `Snoozed: ${s.title}`, { silent: true });
  }

  function dismissCheckin(state, id) {
    state.checkins = state.checkins.filter((c) => c.id !== id);
  }

  // ------------------------------------------------ missed blocks: check-ins --
  // Time passing never completes anything. When a planned block's end goes by without a report, the
  // block becomes a CHECK-IN (state.checkins): a question for the student, asked once per block.
  // While the question is open, that block's minutes are on hold: the engine does not place them
  // again (engine.js units()), so nothing is silently moved and nothing is credited. The student's
  // answer decides: completed (credit it), partly done (say what is left) or not finished. The last two
  // are worked out on a COPY by the app and shown as a proposal before the plan changes.
  const ckOf = (s) => s.ck || `${s.id}@${s.end}`;
  /** Turn every elapsed, unreported block into a check-in, once. → the new check-ins. Never replans. */
  function noteMissed(state) {
    const activeId = state.active ? state.active.sessionId : null;
    const fresh = [];
    for (const s of state.plan.filter((x) => x.end <= state.now && x.id !== activeId).sort((a, b) => a.start - b.start)) {
      const ck = ckOf(s);
      if (state.checkins.some((c) => ckOf(c) === ck)) continue;
      const task = state.tasks.find((t) => t.id === s.taskId);
      if (!task || task.status === 'done' || task.status === 'cancelled') continue;
      const c = Object.assign({}, s, { ck });
      state.checkins.push(c); fresh.push(c);
    }
    return fresh;
  }
  const findCheckin = (state, ck) => (state.checkins || []).find((c) => ckOf(c) === ck) || null;
  const unitLeft = (task, partId) => (partId ? ((task.parts || []).find((p) => p.id === partId) || {}).remainingMins || 0 : task.remainingMins);
  /**
   * Plain-language facts about where the unfinished work would go, for the proposal. Built from the plan
   * the engine just produced, so the words and the timeline cannot disagree.
   */
  function adjustNotes(state, c, task, left) {
    const now = state.now, notes = [];
    const mine = state.plan.filter((s) => s.unitId === c.unitId).sort((a, b) => a.start - b.start);
    const others = (state.lastUpdate ? state.lastUpdate.changes : []).filter((x) => x.title !== c.title && x.from && x.to);
    notes.push(`"${c.title}" still needs ${T.dur(left)}. It was planned ${T.rel(c.start, now).toLowerCase()}, ${T.range(c.start, c.end)}.`);
    if (!mine.length) {
      notes.push(task.deadline != null && task.deadline > now ? `It does not fit before its deadline (${T.short(task.deadline)} ${T.time(task.deadline)}). Nothing was shortened and the deadline was not changed.` : 'There is no open time for it in the next three weeks.');
      return notes;
    }
    const first = mine[0], lastS = mine[mine.length - 1], today = T.dayStart(now);
    const span = mine.length > 1 ? `, in ${mine.length} sittings, the last on ${T.rel(lastS.start, now)} at ${T.timeShort(lastS.start)}` : '';
    if (T.dayStart(first.start) > today) {
      const dayEnd = T.at(today, state.baseline.dayEnd);
      const freeToday = Math.round(E.freeSlots(state, T.ceilTo(now, 15), Math.max(dayEnd, now)).reduce((a, x) => a + (x.end - x.start) / MIN, 0));
      notes.push(`Today has ${freeToday >= 15 ? `about ${T.dur(freeToday)} of open time left before ${T.hmLabel(state.baseline.dayEnd)}, and work ahead of it uses that` : `no open time left before ${T.hmLabel(state.baseline.dayEnd)}`}, so the recommended time is ${T.rel(first.start, now)} at ${T.timeShort(first.start)}${span}. Your day is not made longer.`);
    } else notes.push(`The recommended time is ${T.rel(first.start, now).toLowerCase()} at ${T.timeShort(first.start)}${span}.`);
    if (task.deadline != null && task.deadline <= now) notes.push('It is past its deadline, so it goes ahead of work that can still be on time.');
    else if (task.deadline != null && lastS.end <= task.deadline) notes.push(`That is still before its deadline (${T.short(task.deadline)} ${T.time(task.deadline)}).`);
    if (others.length) {
      const days = new Set(others.map((x) => T.dayStart(x.to.start))).size;
      notes.push(`${others.length === 1 ? 'One other task moves' : `${others.length} other tasks move`} to make room${days > 1 ? `, across ${days} days` : ''}. Work due sooner stays ahead of work due later.`);
    }
    return notes;
  }
  /** After a check-in is answered: show the affected task as "was → now", not as a new addition. */
  function closeCheckin(state, c, trigger, left, opts = {}) {
    const task = state.tasks.find((t) => t.id === c.taskId);
    state.checkins = state.checkins.filter((x) => ckOf(x) !== ckOf(c));
    const r = replan(state, trigger, { silent: true, notes: opts.notes || [] });
    if (state.lastUpdate) {
      for (const ch of state.lastUpdate.changes) if (ch.title === c.title && !ch.from && ch.to) { ch.from = { start: c.start, end: c.end }; ch.action = 'RESCHEDULE'; }
      if (left > 0 && task) state.lastUpdate.notes = (opts.notes || []).concat(adjustNotes(state, c, task, left));
    }
    return r;
  }
  /** "Completed": the student confirms the block. Only now is it credited, and only that block. */
  function checkinDone(state, ck) {
    const c = findCheckin(state, ck), task = c && state.tasks.find((t) => t.id === c.taskId);
    if (!c || !task) return null;
    const n = state.workLog.length;
    creditWork(state, c);
    if (state.workLog.length > n) state.workLog[state.workLog.length - 1].at = c.end;   // counted on the day the work was planned
    state.history.push({ id: ckOf(c), taskId: c.taskId, title: c.title, start: c.start, end: c.end, doneAt: c.end });
    return closeCheckin(state, c, `Confirmed done: ${c.title}`, 0, { notes: task.status === 'done' ? [`"${task.title}" is complete.`] : [] });
  }
  /** "Partly done": the student says how much of this piece is still left (minutes). → null when the value is unusable. */
  function checkinPartial(state, ck, remainingMins) {
    const c = findCheckin(state, ck), task = c && state.tasks.find((t) => t.id === c.taskId);
    const left = Math.round(Number(remainingMins));
    if (!c || !task || !isFinite(left) || left < 5 || left > 40 * 60) return null;
    const before = unitLeft(task, c.partId);
    withWorkLog(state, task, () => setUnitRemaining(task, c.partId, left));
    state.history.push({ id: ckOf(c), taskId: c.taskId, title: c.title, start: c.start, end: c.end, doneAt: state.now, partial: true });
    task.status = 'pending';
    return closeCheckin(state, c, `Partly done: ${c.title} (${T.dur(left)} left)`, left, { notes: [left > before ? 'The estimate grew, so the plan holds more time for it.' : 'Your progress is saved.'] });
  }
  /** "Not finished": nothing is credited; the work that was on hold is planned again. */
  function checkinNotDone(state, ck) {
    const c = findCheckin(state, ck), task = c && state.tasks.find((t) => t.id === c.taskId);
    if (!c || !task) return null;
    if (task.status === 'in_progress') task.status = 'pending';
    return closeCheckin(state, c, `Not finished: ${c.title}`, unitLeft(task, c.partId));
  }

  // --------------------------------------- legacy automatic completions --
  // An earlier version marked a block done when its planned time passed and kept a record in
  // state.autoDone. Nothing adds to that list any more and the clock never reads it. The two functions
  // below stay only so a student with such a record can still say "I didn't finish".
  /**
   * Put one automatic completion back: the minutes return to the task, and its credit and history entry
   * go. Nothing else is touched. → false (and the record is kept) when the task has since been removed or
   * finished by the student, because a manual completion is never reversed.
   */
  function revertAuto(state, rec) {
    const task = state.tasks.find((t) => t.id === rec.taskId);
    if (!task || task.status === 'cancelled' || (task.status === 'done' && !rec.finishedTask)) return false;
    if (rec.partId) {
      const part = (task.parts || []).find((p) => p.id === rec.partId);
      if (!part) return false;
      part.remainingMins = Math.min(part.mins, part.remainingMins + rec.credited);
      part.done = false;
    } else {
      task.remainingMins = Math.min(task.durationMins, task.remainingMins + rec.credited);
    }
    if (task.status === 'done') task.status = 'pending';
    state.workLog = state.workLog.filter((w) => w.auto !== rec.id);
    state.history = state.history.filter((h) => h.id !== rec.id);
    state.autoDone = state.autoDone.filter((r) => r.id !== rec.id);
    return true;
  }
  function undoAutoDone(state, id) {
    const rec = (state.autoDone || []).find((r) => r.id === id);
    if (!rec) return null;
    if (!revertAuto(state, rec)) { rec.seen = true; return null; }
    return replan(state, `Not finished: ${rec.title}`, { silent: true, notes: ['Put back in your plan. Its credit was removed.'] });
  }
  function ackAutoDone(state, id) {
    for (const r of state.autoDone || []) if (id == null || r.id === id) r.seen = true;
  }

  /**
   * Bring the plan to a new "now" (the device clock, or the presenter's Demo clock). Time passing never
   * completes, credits or un-completes anything.
   * Forward: each block whose planned end has passed becomes a check-in (once) and its minutes go on hold.
   * Back: a check-in for a block that is ahead again is withdrawn, since it has not been missed after all.
   * → the replan result, with `missed`: the check-ins this call created.
   */
  function setClock(state, newNow) {
    const back = newNow < state.now;
    state.now = newNow;
    if (back) {
      state.checkins = (state.checkins || []).filter((c) => c.end <= newNow);
      state.offer = null;   // worked out for a moment that is no longer "now"
      // Moving the clock back is not a reason to reshuffle: the plan is kept and only repaired (work that was on hold is placed again).
      return Object.assign(replan(state, null), { missed: [] });
    }
    if (state.active) {
      const a = state.plan.find((s) => s.id === state.active.sessionId);
      if (!a || a.end <= newNow) state.active = null;
    }
    const missed = noteMissed(state);
    if (state.offer && (!state.offer.gap || state.offer.gap.end <= newNow)) state.offer = null;
    else if (state.offer && state.offer.status === 'pending' && state.offer.to.start < T.ceilTo(newNow, 15)) state.offer = earlyFinishOffer(state, state.offer.gap, state.offer.doneTitle, null);
    const ahead = () => JSON.stringify(state.plan.filter((s) => s.end > newNow).map((s) => [s.unitId, s.start]));
    const before = ahead();
    const r = replan(state, null);
    if (ahead() !== before) state.lastUpdate = { trigger: 'Time moved on', at: newNow, status: state.status, notes: [], silent: true, changes: r.changes.map(simpleChange) };
    return Object.assign(r, { missed });
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
      now: state.now, tasks: state.tasks, plan: state.plan, dayStartHm: state.baseline.dayStart,
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
    checkStart, nearestStart, previewMove, recommendAdjustment, taskStatus, earlyFinishOffer, acceptOffer, declineOffer, finishTask,
    completeSession, snoozeSession, dismissCheckin, setClock, noteMissed, checkinDone, checkinPartial, checkinNotDone, undoAutoDone, ackAutoDone,
    extendTask, completePart, completeTask, setTaskRemaining, KEY, applyTaskAction, applyIntent, previewIntents, suggestAdjustment, storageAvailable, DIFFICULTIES, weeklyProgress, sanitize, daySummary,
    addEvent, addRecurring, cancelOccurrence, classesFromPhase1, applyLifestyle, parseContext, loadDemo,
  };
})(typeof window !== 'undefined' ? window : globalThis);
