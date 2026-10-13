/*
 * SIKAD — adaptive scheduling engine.
 *
 * PRIORITIZE → BREAK DOWN → SCHEDULE → NEXT ACTION → REPLAN (user_story.md §5).
 * Deterministic and stateless: every call receives the full state and returns
 * a new plan. Rules enforced here (prompt.md §3–§4):
 *   - fixed commitments are never moved; tasks are placed around them
 *   - 15-minute buffer between a flexible task and anything else
 *   - tasks never land after their deadline; what doesn't fit is reported
 *     as unscheduled (status INFEASIBLE) instead of being squeezed in
 *   - overdue tasks are kept and scheduled first
 *   - dependencies and part order are respected
 *   - on replan, still-valid sessions stay where they are (minimal disruption)
 */
(function (root) {
  'use strict';
  const T = root.TempoTime;
  const { MIN, HOUR, DAY } = T;

  const MIN_SESSION = 30;   // shortest session worth scheduling when splitting
  const MAX_SESSION = 120;  // longer work is split into focused sessions
  const FRAGMENT_MIN = 15;  // free fragments shorter than this are discarded
  const PRIORITY_LEAD = { high: 36 * HOUR, medium: 12 * HOUR, low: 0 };
  const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };
  const DIFFICULTY_RANK = { hard: 0, medium: 1, easy: 2 };   // unknown difficulty counts as medium (the documented default)
  const diffOf = (x) => (DIFFICULTY_RANK[x && x.difficulty] != null ? x.difficulty : 'medium');

  const sum = (arr, f) => arr.reduce((a, x) => a + f(x), 0);
  const last = (arr) => arr[arr.length - 1];

  // ------------------------------------------------------------ baseline --
  /** Everything that blocks time on a given day: fixed commitments plus soft buffers. */
  function occurrences(state, dayMs) {
    const b = state.baseline;
    const dow = T.dow(dayMs), key = T.key(dayMs);
    const cancelled = new Set(state.cancellations || []);
    const items = [];
    for (const c of b.classes) {
      if (c.day !== dow) continue;
      const id = `cls:${c.id}@${key}`;
      if (cancelled.has(id)) continue;
      items.push({ id, refId: c.id, kind: 'class', title: c.title, mode: c.mode,
        start: T.at(dayMs, c.start), end: T.at(dayMs, c.end), fixed: true, source: 'baseline' });
    }
    for (const r of b.recurring) {
      if (r.day !== dow) continue;
      const id = `rec:${r.id}@${key}`;
      if (cancelled.has(id)) continue;
      items.push({ id, refId: r.id, kind: r.kind, title: r.title,
        start: T.at(dayMs, r.start), end: T.at(dayMs, r.end), fixed: true, source: 'baseline' });
    }
    for (const e of state.events) {
      if (T.dayStart(e.start) !== dayMs) continue;
      items.push({ id: e.id, refId: e.id, kind: e.kind, title: e.title, start: e.start, end: e.end, fixed: true, source: 'temporary' });
    }
    const ftf = items.filter((i) => i.kind === 'class' && i.mode === 'FTF').sort((a, c) => a.start - c.start);
    if (ftf.length && b.commuteMins > 0) {
      const first = ftf[0];
      const lastClass = ftf.reduce((a, x) => (x.end > a.end ? x : a));
      items.push({ id: `commute-to@${key}`, kind: 'commute', title: 'Commute to campus', start: first.start - b.commuteMins * MIN, end: first.start, soft: true });
      items.push({ id: `commute-home@${key}`, kind: 'commute', title: 'Commute home', start: lastClass.end, end: lastClass.end + b.commuteMins * MIN, soft: true });
    }
    const overlaps = (s, e) => items.some((i) => i.start < e && i.end > s);
    const ds = T.at(dayMs, b.dayStart);
    if (b.routineMins > 0 && !overlaps(ds, ds + b.routineMins * MIN)) {
      items.push({ id: `routine@${key}`, kind: 'routine', title: 'Morning routine', start: ds, end: ds + b.routineMins * MIN, soft: true });
    }
    if (b.protectLunch) {
      const ls = T.at(dayMs, '12:00'), le = T.at(dayMs, '13:00');
      if (!overlaps(ls, le)) items.push({ id: `lunch@${key}`, kind: 'lunch', title: 'Lunch', start: ls, end: le, soft: true });
    }
    return items.sort((a, c) => a.start - c.start || a.end - c.end);
  }

  function mergeIntervals(list) {
    const sorted = list.slice().sort((a, b) => a[0] - b[0]);
    const out = [];
    for (const iv of sorted) {
      if (out.length && iv[0] <= last(out)[1]) last(out)[1] = Math.max(last(out)[1], iv[1]);
      else out.push([iv[0], iv[1]]);
    }
    return out;
  }

  /** Usable free windows between `from` and `to`, already shrunk by the transition buffer. */
  function freeSlots(state, from, to) {
    const b = state.baseline, buf = b.bufferMins * MIN;
    const slots = [];
    for (let day = T.dayStart(from); day < to; day += DAY) {
      const ds = T.at(day, b.dayStart), de = T.at(day, b.dayEnd);
      const winS = Math.max(ds, from), winE = Math.min(de, to);
      if (winE - winS < FRAGMENT_MIN * MIN) continue;
      const busy = mergeIntervals(occurrences(state, day).map((o) => [o.start, o.end]));
      const pushGap = (gs, ge, prevBusy, nextBusy) => {
        let s = Math.max(gs + (prevBusy ? buf : 0), winS);
        const e = Math.min(ge - (nextBusy ? buf : 0), winE);
        s = T.ceilTo(s, 5);
        if (e - s >= FRAGMENT_MIN * MIN) slots.push({ start: s, end: e });
      };
      let cursor = ds, prevBusy = false;
      for (const [bs, be] of busy) {
        if (be <= ds || bs >= de) continue;
        pushGap(cursor, bs, prevBusy, true);
        cursor = Math.max(cursor, be);
        prevBusy = true;
      }
      pushGap(cursor, de, prevBusy, false);
    }
    return slots;
  }

  function reserve(slots, s, e, buf) {
    const out = [];
    for (const sl of slots) {
      if (e + buf <= sl.start || s - buf >= sl.end) { out.push(sl); continue; }
      if (s - buf - sl.start >= FRAGMENT_MIN * MIN) out.push({ start: sl.start, end: s - buf });
      if (sl.end - (e + buf) >= FRAGMENT_MIN * MIN) out.push({ start: e + buf, end: sl.end });
    }
    return out;
  }
  const containedIn = (slots, s, e) => slots.some((sl) => sl.start <= s && e <= sl.end);

  // ----------------------------------------------------------- work units --
  /** A task (or each pending part of it) becomes a schedulable unit. */
  function units(state) {
    const out = [];
    for (const t of state.tasks) {
      if (t.status === 'done' || t.status === 'cancelled') continue;
      const mk = (p, seq) => ({
        id: p ? `${t.id}:${p.id}` : t.id, taskId: t.id, partId: p ? p.id : null,
        title: p ? `${t.title} — ${p.title}` : t.title, taskTitle: t.title, partTitle: p ? p.title : null,
        mins: p ? p.remainingMins : t.remainingMins, deadline: t.deadline, priority: t.priority,
        difficulty: diffOf(t), lateOk: !!t.lateOk && t.deadline != null, doFirst: !!t.doFirst, notBefore: Math.max(t.notBefore || 0, (p && p.notBefore) || 0),
        pinnedStart: seq === 0 ? t.pinnedStart || null : null, seq, deps: t.dependencies || [],
      });
      if (t.parts && t.parts.length) {
        t.parts.filter((p) => !p.done && p.remainingMins > 0).forEach((p, i) => out.push(mk(p, i)));
      } else if (t.remainingMins > 0) {
        out.push(mk(null, 0));
      }
    }
    return out;
  }

  /**
   * PRIORITIZE. One policy for every entry point (first plan, replans, snooze, edits, Ask SIKAD):
   *   1. overdue work, 2. the student's own "do first",
   *   3. deadline urgency: the due date pulled earlier by the priority lead (PRIORITY_LEAD), compared BY DAY,
   *   4. difficulty: among work that is urgent on the same day, harder work goes first so it gets the
   *      earlier, longer blocks. Difficulty never jumps a task ahead of one that is urgent on an earlier day.
   *   5. exact deadline, then priority, then id (stable).
   * Parts of one task always stay in their own order.
   * Work the student has agreed may finish late (task.lateOk, set only by an accepted "adjusted plan")
   * is allowed past its deadline. It keeps its place by deadline day but goes after the on-time work of
   * that day, so it ends up as little late as possible; in a rescue it goes last of all.
   * opts.rescue: plain earliest-deadline order with overdue work last. schedule() tries it only when the
   * normal order leaves work that could still meet its deadline unscheduled.
   */
  function rank(list, now, opts = {}) {
    const urgency = (u) => u.deadline - PRIORITY_LEAD[u.priority];
    return list.slice().sort((a, b) => {
      // A task with no deadline is never treated as overdue: it waits, last, until the student gives a date.
      if ((a.deadline == null) !== (b.deadline == null)) return a.deadline == null ? 1 : -1;
      if (a.deadline == null) return a.taskId === b.taskId ? a.seq - b.seq : a.taskId.localeCompare(b.taskId);
      // Groups: overdue (first; after on-time work in a rescue) · on time · agreed-late (last, in a rescue only).
      const grp = (u) => (u.deadline <= now ? (opts.rescue ? 2 : 0) : u.lateOk && opts.rescue ? 3 : 1);
      if (grp(a) !== grp(b)) return grp(a) - grp(b);
      if (a.doFirst !== b.doFirst) return a.doFirst ? -1 : 1;
      if (a.taskId === b.taskId) return a.seq - b.seq;
      if (opts.rescue) return a.deadline - b.deadline || a.taskId.localeCompare(b.taskId);
      const ka = urgency(a), kb = urgency(b);
      const da = T.dayStart(ka), db = T.dayStart(kb);
      if (da !== db) return da - db;
      if (a.lateOk !== b.lateOk) return a.lateOk ? 1 : -1;
      const fa = DIFFICULTY_RANK[diffOf(a)], fb = DIFFICULTY_RANK[diffOf(b)];
      if (fa !== fb) return fa - fb;
      if (ka !== kb) return ka - kb;
      return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.taskId.localeCompare(b.taskId);
    });
  }

  function contiguousPlace(slots, mins, earliest, latest) {
    if (mins > MAX_SESSION) return null;
    for (const sl of slots) {
      const s = Math.max(sl.start, earliest);
      if (s + mins * MIN <= sl.end) {
        if (latest != null && s + mins * MIN > latest) return null;
        return [{ start: s, end: s + mins * MIN }];
      }
    }
    return null;
  }

  function splitPlace(slots, mins, earliest, latest, buf, minChunk) {
    let remaining = mins;
    const chunks = [];
    for (const sl of slots) {
      let s = Math.max(sl.start, earliest);
      if (chunks.length) s = Math.max(s, last(chunks).end + buf);
      while (remaining > 0) {
        const room = Math.floor((sl.end - s) / MIN);
        if (room < Math.min(minChunk, remaining)) break;
        let take = Math.min(remaining, MAX_SESSION, room);
        if (take < remaining) take = Math.floor(take / 5) * 5;
        const tail = remaining - take;
        // Never leave a leftover shorter than a useful session.
        if (tail > 0 && tail < minChunk) {
          const adjusted = take - (minChunk - tail);
          if (adjusted >= minChunk) take = adjusted;
          else break;
        }
        const e = s + take * MIN;
        if (latest != null && e > latest) return null;
        chunks.push({ start: s, end: e });
        remaining -= take;
        s = e + buf;
      }
      if (remaining <= 0) return chunks;
    }
    return null;
  }

  /** SCHEDULE one unit: one sitting if it fits soon enough, otherwise split across blocks. */
  function findPlacement(slots, mins, earliest, latest, buf, hard) {
    const whole = contiguousPlace(slots, mins, earliest, latest);
    // Hard work gets one uninterrupted sitting whenever one exists before the deadline.
    if (hard && whole) return whole;
    // Prefer hour-long sittings; fall back to 30-minute pieces only if that finishes much sooner.
    const big = mins >= 120 || (hard && mins > 60) ? splitPlace(slots, mins, earliest, latest, buf, 60) : null;
    const small = splitPlace(slots, mins, earliest, latest, buf, MIN_SESSION);
    const split = big && (!small || last(big).end <= last(small).end + DAY) ? big : small;
    if (whole && (!split || whole[0].end <= last(split).end + DAY)) return whole;
    return split;
  }

  // ------------------------------------------------------------- schedule --
  function scheduleOnce(state, now, prevPlan, opts = {}) {
    const buf = state.baseline.bufferMins * MIN;
    // Work that was just reported (Done, partly done, session ended) ran until `busyUntil`: the next
    // task starts a buffer after that, and a session that was meant to start before then is re-placed
    // with its full duration instead of being kept in a slot that is already partly gone.
    const busy = state.busyUntil && state.busyUntil <= now && now - state.busyUntil < buf ? state.busyUntil : 0;
    const from = Math.max(T.ceilTo(now, 15), busy ? T.ceilTo(busy + buf, 5) : 0);
    const activeId = state.active ? state.active.sessionId : null;
    const all = units(state);
    const schedulable = all.filter((u) => u.deadline != null);
    const ordered = rank(schedulable, now, opts);
    const horizonEnd = T.dayStart(Math.min(Math.max(from + 7 * DAY, ...schedulable.map((u) => u.deadline + DAY)), from + 21 * DAY)) + DAY;
    let slots = freeSlots(state, from, horizonEnd);
    const placed = new Map();
    const failed = new Set();
    const alerts = [];

    const predecessorEnd = (u) => {
      let end = 0;
      if (u.seq > 0) {
        const pred = all.find((x) => x.taskId === u.taskId && x.seq === u.seq - 1);
        if (pred) {
          const ps = placed.get(pred.id);
          if (!ps) return { ok: false, waitingOn: pred.title };
          end = Math.max(end, last(ps).end);
        }
      }
      for (const depId of u.deps) {
        for (const x of all.filter((y) => y.taskId === depId)) {
          const ps = placed.get(x.id);
          if (!ps) return { ok: false, waitingOn: x.taskTitle };
          end = Math.max(end, last(ps).end);
        }
      }
      return { ok: true, end };
    };

    // 1. Student-pinned times come first: a pin may displace flexible work, never a fixed commitment,
    //    and never runs past the task's deadline or the end of the day.
    for (const u of ordered) {
      if (!u.pinnedStart) continue;
      const e = u.pinnedStart + u.mins * MIN;
      const pred = predecessorEnd(u);
      if (u.pinnedStart >= from && containedIn(slots, u.pinnedStart, e) && !(u.deadline > now && !u.lateOk && e > u.deadline) && pred.ok && (!pred.end || u.pinnedStart >= pred.end + buf)) {
        slots = reserve(slots, u.pinnedStart, e, buf);
        placed.set(u.id, [{ start: u.pinnedStart, end: e }]);
      } else {
        const why = u.pinnedStart < from ? 'that time has passed' : u.deadline > now && e > u.deadline ? 'it would end after the deadline' : 'that time is taken by a fixed commitment, another pinned task, or the end of your day';
        alerts.push({ level: 'WARNING', code: 'PIN_FAILED', taskId: u.taskId, message: `Couldn't keep "${u.title}" at ${T.short(u.pinnedStart)} ${T.time(u.pinnedStart)} — ${why}. I placed it in the next open block instead.` });
      }
    }

    // 2. Keep still-valid sessions from the previous plan where they are.
    if (prevPlan && prevPlan.length) {
      const prevBy = new Map();
      for (const s of prevPlan) {
        if (!prevBy.has(s.unitId)) prevBy.set(s.unitId, []);
        prevBy.get(s.unitId).push(s);
      }
      for (const u of ordered) {
        if (placed.has(u.id) || u.lateOk) continue;   // agreed-late work is always re-placed, to be as little late as possible
        const prev = (prevBy.get(u.id) || []).slice().sort((a, b) => a.start - b.start);
        if (!prev.length || sum(prev, (s) => s.mins) !== u.mins) continue;
        if (prev.some((s) => s.end <= now)) continue;
        if (busy && prev[0].start < from && !prev.some((s) => s.id === activeId)) continue;
        if (u.notBefore && prev[0].start < u.notBefore) continue;
        if (u.deadline > now && !u.lateOk && last(prev).end > u.deadline) continue;
        if (u.pinnedStart && prev[0].start !== u.pinnedStart) continue;
        const pred = predecessorEnd(u);
        if (!pred.ok || (pred.end && prev[0].start < pred.end)) continue;
        let trial = slots, ok = true;
        for (const s of prev) {
          const fs = Math.max(s.start, from);
          if (fs >= s.end) continue;
          if (!containedIn(trial, fs, s.end)) { ok = false; break; }
          trial = reserve(trial, fs, s.end, buf);
        }
        if (!ok) continue;
        slots = trial;
        placed.set(u.id, prev.map((s) => ({ start: s.start, end: s.end })));
      }
    }

    // 3. Everything else, in priority order (dependencies may defer a unit to a later pass).
    let pending = ordered.filter((u) => !placed.has(u.id));
    const unscheduled = [];
    let progress = true;
    while (pending.length && progress) {
      progress = false;
      const next = [];
      for (const u of pending) {
        const pred = predecessorEnd(u);
        if (!pred.ok) { next.push(u); continue; }
        const earliest = Math.max(from, u.notBefore || 0, pred.end ? pred.end + buf : 0);
        const latest = u.deadline > now && !u.lateOk ? u.deadline : null;
        const chunks = findPlacement(slots, u.mins, earliest, latest, buf, u.difficulty === 'hard');
        progress = true;
        if (!chunks) { failed.add(u.id); unscheduled.push({ unit: u, reason: 'no_time' }); continue; }
        for (const c of chunks) slots = reserve(slots, c.start, c.end, buf);
        placed.set(u.id, chunks);
      }
      pending = next;
    }
    for (const u of pending) {
      const pred = predecessorEnd(u);
      unscheduled.push({ unit: u, reason: 'blocked', waitingOn: pred.waitingOn });
    }

    const plan = [];
    for (const u of schedulable) {
      const chunks = placed.get(u.id);
      if (!chunks) continue;
      chunks.forEach((c, i) => plan.push({
        id: `${u.id}#${i}`, unitId: u.id, taskId: u.taskId, partId: u.partId, title: u.title, priority: u.priority,
        start: c.start, end: c.end, mins: Math.round((c.end - c.start) / MIN), session: i + 1, sessions: chunks.length,
      }));
    }
    plan.sort((a, b) => a.start - b.start);
    const needsDeadline = [...new Set(all.filter((u) => u.deadline == null).map((u) => u.taskId))];
    return { plan, unscheduled, needsDeadline, alerts, slotsLeft: slots };
  }

  /** Lower is better: priority-weighted hours until each unit finishes, plus a penalty per extra session. */
  function planCost(plan, now) {
    const ends = new Map();
    for (const p of plan) ends.set(p.unitId, Math.max(ends.get(p.unitId) || 0, p.end));
    const weights = { high: 3, medium: 2, low: 1 };
    let cost = 0;
    for (const p of plan) if (p.session === p.sessions) cost += ((ends.get(p.unitId) - now) / HOUR) * (weights[p.priority] || 1);
    cost += Math.max(0, plan.length - ends.size) * 4;
    return cost;
  }

  /**
   * Build a plan. With a previous plan, try to keep it stable; fall back to a
   * fresh plan if stability would leave more work unscheduled.
   */
  function schedule(state, opts = {}) {
    const now = opts.now != null ? opts.now : state.now;
    const fresh = scheduleOnce(state, now, null);
    let result = fresh;
    if (opts.prevPlan && opts.prevPlan.length) {
      // Keep the student's plan stable unless a fresh plan is clearly better
      // (fits more work, or finishes important work much earlier with fewer pieces).
      const stable = scheduleOnce(state, now, opts.prevPlan);
      if (stable.unscheduled.length < fresh.unscheduled.length ||
          (stable.unscheduled.length === fresh.unscheduled.length && planCost(stable.plan, now) <= planCost(fresh.plan, now) * 1.25 + 2)) {
        result = stable;
      }
    }
    // Deadline rescue: if work that can still meet its deadline was left out, try plain earliest-deadline
    // order with already-overdue work last. Used only when it fits strictly more work.
    let rescued = false;
    const lost = (r) => sum(r.unscheduled.filter((x) => x.reason === 'no_time'), (x) => x.unit.mins);
    if (lost(result) > 0) {
      const rescue = scheduleOnce(state, now, null, { rescue: true });
      if (lost(rescue) < lost(result) && rescue.unscheduled.length <= result.unscheduled.length) { result = rescue; rescued = true; }
    }
    const alerts = result.alerts.slice();
    const tasksById = new Map(state.tasks.map((t) => [t.id, t]));

    const overdue = [...new Set(units(state).filter((u) => u.deadline != null && u.deadline <= now).map((u) => u.taskId))];
    for (const id of overdue) alerts.push({ level: 'WARNING', message: rescued
      ? `"${tasksById.get(id).title}" is past its deadline — I've kept it, after the work that can still meet its deadline.`
      : `"${tasksById.get(id).title}" is past its deadline — I've kept it and moved it to the front of your plan.` });
    for (const id of result.needsDeadline) alerts.push({ level: 'WARNING', message: `"${tasksById.get(id).title}" needs a deadline before I can schedule it.` });

    // Work that the student agreed may run late: say exactly how late the plan makes it.
    const lateSpan = (m) => (m < 90 ? T.dur(Math.max(5, m)) : m < 36 * 60 ? `about ${Math.round(m / 60)} hrs` : `about ${Math.round(m / 1440)} days`);
    const late = [];
    for (const t of state.tasks) {
      if (!t.lateOk || t.deadline == null || t.deadline <= now || t.status === 'done' || t.status === 'cancelled') continue;
      const end = Math.max(0, ...result.plan.filter((p) => p.taskId === t.id).map((p) => p.end));
      if (end > t.deadline) {
        late.push({ taskId: t.id, title: t.title, deadline: t.deadline, finish: end, lateMins: Math.round((end - t.deadline) / MIN) });
        alerts.push({ level: 'WARNING', code: 'PLANNED_LATE', taskId: t.id, message: `"${t.title}" is planned to finish ${T.short(end)} ${T.time(end)}, ${lateSpan(Math.round((end - t.deadline) / MIN))} after its deadline. You agreed to this; the deadline itself has not been changed.` });
      }
    }

    let status = 'SUCCESS';
    const noTime = result.unscheduled.filter((x) => x.reason === 'no_time');
    if (result.unscheduled.length) {
      status = 'INFEASIBLE';
      const needMins = sum(noTime, (x) => x.unit.mins);
      if (noTime.length) {
        // Measured to the first deadline that is missed, counting everything that competes for that time:
        // work due by then, plus work due later (or already overdue) that the plan holds before then.
        const firstDl = Math.min(...noTime.map((x) => (x.unit.deadline > now ? x.unit.deadline : Infinity)));
        const dl = isFinite(firstDl) ? firstDl : Math.max(...noTime.map((x) => x.unit.deadline));
        const free = sum(freeSlots(state, T.ceilTo(now, 15), Math.max(dl, now)), (s) => (s.end - s.start) / MIN);
        const dueByThen = sum(units(state).filter((u) => u.deadline != null && u.deadline > now && u.deadline <= dl), (u) => u.mins);
        const held = sum(result.plan.filter((p) => p.start < dl && !(tasksById.get(p.taskId).deadline > now && tasksById.get(p.taskId).deadline <= dl)), (p) => Math.round((Math.min(p.end, dl) - p.start) / MIN));
        alerts.push({ level: 'CRITICAL', code: 'TIME_SHORTAGE', freeMins: Math.round(free), dueMins: dueByThen, otherMins: held, shortMins: needMins, deadline: dl,
          message: `Time shortage: you have about ${T.dur(free)} of usable time before ${T.short(dl)} ${T.time(dl)}. Work due by then needs about ${T.dur(dueByThen)}${held ? `, and overdue or earlier-planned work takes about ${T.dur(held)} of that time` : ''}; the 15-minute gaps between tasks use more. ${T.dur(needMins)} of work doesn't fit — see the unscheduled tasks below.` });
      }
      for (const x of result.unscheduled.filter((y) => y.reason === 'blocked' && !y.waitingOn.startsWith(y.unit.taskTitle))) {
        alerts.push({ level: 'WARNING', message: `"${x.unit.title}" is waiting on "${x.waitingOn}", which isn't scheduled yet.` });
      }
    }
    return Object.assign({}, result, { status, alerts, rescued, late });
  }

  // ------------------------------------------------------------ analysis --
  function capacity(state, now, untilMs) {
    const until = untilMs || T.endOfWeek(now);
    const from = T.ceilTo(now, 15);
    const free = sum(freeSlots(state, from, until), (s) => (s.end - s.start) / MIN);
    const required = sum(units(state).filter((u) => u.deadline != null && u.deadline <= until), (u) => u.mins);
    const planned = sum((state.plan || []).filter((s) => s.end > now && s.start < until), (s) => (Math.min(s.end, until) - Math.max(s.start, now)) / MIN);
    return { free: Math.round(free), required: Math.round(required), planned: Math.round(planned), until };
  }

  // ------------------------------------------------ completion confidence --
  /**
   * Completion confidence for TODAY: a rule-based estimate of how likely each task planned for today
   * is to get finished today. It is a heuristic over the current plan, not a measured probability
   * and not a model prediction. All weights and thresholds live in CONFIDENCE.
   *
   * For a task planned today, in the order the plan runs them:
   *   room   = usable minutes left today (open time after fixed commitments, from now to the end of day)
   *            minus the planned minutes and 15-minute gaps of the tasks that come before it
   *   ratio  = room / the task's minutes planned for today        (1.0 = it fits with nothing to spare)
   *   score  = 0 at ratio ≤ FLOOR_RATIO, 100 at ratio ≥ FULL_RATIO, linear in between
   *   then   − penalties: hard task, AI-estimated duration, each task queued before it, a planned start
   *            that has already passed; + a small bonus for an easy task. Clamped to 0–100.
   * level:  'ok' (score ≥ SHOW_BELOW, nothing is shown) · 'risk' (shown as "At risk") · 'high' (score < HIGH_BELOW)
   * Separate states that are never expressed as a percentage:
   *   'wont_fit'   the last replan moved the task off today (or it is due today but planned later)
   *   'infeasible' the task has no slot before its deadline at all
   */
  const CONFIDENCE = {
    FLOOR_RATIO: 0.5, FULL_RATIO: 2.0,
    SHOW_BELOW: 70, HIGH_BELOW: 45,
    HARD_PENALTY: 10, EASY_BONUS: 5, ESTIMATE_PENALTY: 5, QUEUE_PENALTY: 4, QUEUE_PENALTY_MAX: 12, LATE_START_PENALTY: 10,
  };
  const clampPct = (n) => (isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0);

  function completionConfidence(state, nowMs) {
    const now = nowMs != null ? nowMs : state.now;
    const C = CONFIDENCE, buf = (state.baseline.bufferMins || 0);
    const today = T.dayStart(now), dayEnd = T.at(today, state.baseline.dayEnd);
    const tasksById = new Map(state.tasks.map((t) => [t.id, t]));
    const usable = Math.max(0, Math.round(sum(freeSlots(state, T.ceilTo(now, 5), Math.max(dayEnd, now)), (x) => (x.end - x.start) / MIN)));
    const out = [];

    // Tasks with work planned today, in plan order.
    const byTask = new Map();
    for (const p of (state.plan || []).filter((x) => T.dayStart(x.start) === today && x.end > now).sort((a, b) => a.start - b.start)) {
      if (!byTask.has(p.taskId)) byTask.set(p.taskId, { taskId: p.taskId, mins: 0, start: p.start, end: p.end });
      const g = byTask.get(p.taskId);
      g.mins += Math.max(0, Number(p.mins) || 0); g.end = Math.max(g.end, p.end);
    }
    let ahead = 0, queued = 0;
    for (const g of byTask.values()) {
      const t = tasksById.get(g.taskId);
      if (!t || !(g.mins > 0)) continue;
      const room = Math.max(0, usable - ahead);
      const ratio = room / g.mins;
      let score = ((ratio - C.FLOOR_RATIO) / (C.FULL_RATIO - C.FLOOR_RATIO)) * 100;
      const active = state.active && (state.plan.find((x) => x.id === state.active.sessionId) || {}).taskId === t.id;
      const late = g.start < now && !active;
      if (diffOf(t) === 'hard') score -= C.HARD_PENALTY;
      if (diffOf(t) === 'easy') score += C.EASY_BONUS;
      if (t.isAiEstimate) score -= C.ESTIMATE_PENALTY;
      score -= Math.min(C.QUEUE_PENALTY_MAX, queued * C.QUEUE_PENALTY);
      if (late) score -= C.LATE_START_PENALTY;
      const percent = clampPct(score);
      const level = percent >= C.SHOW_BELOW ? 'ok' : percent >= C.HIGH_BELOW ? 'risk' : 'high';
      // The main reason, in the student's terms.
      let reason = `${T.dur(room)} of usable time left today for about ${T.dur(g.mins)} of work${queued ? `, after ${queued} other task${queued === 1 ? '' : 's'}` : ''}.`;
      if (late && room >= g.mins * 1.5) reason = `Its planned start (${T.time(g.start)}) has passed and it is not started yet.`;
      else if (diffOf(t) === 'hard' && ratio >= 1.5) reason = `It is marked hard and has ${T.dur(room)} of usable time for about ${T.dur(g.mins)} of work.`;
      out.push({ taskId: t.id, title: t.title, level, percent, show: level !== 'ok', label: level === 'ok' ? null : 'At risk', reason,
        usableMins: room, neededMins: g.mins, dueToday: t.deadline != null && T.dayStart(t.deadline) === today });
      ahead += g.mins + buf; queued += 1;
    }

    // Work that left today in the last replan, or is due today but only planned later.
    const moved = new Map();
    const lu = state.lastUpdate;
    if (lu && T.dayStart(lu.at) === today) {
      for (const c of lu.changes || []) if (c.action === 'RESCHEDULE' && c.from && c.to && T.dayStart(c.from.start) === today && T.dayStart(c.to.start) > today) moved.set(c.title, c.to.start);
    }
    const firstByTask = new Map();
    for (const p of (state.plan || []).slice().sort((a, b) => a.start - b.start)) if (!firstByTask.has(p.taskId)) firstByTask.set(p.taskId, p);
    for (const [taskId, p] of firstByTask) {
      const t = tasksById.get(taskId);
      if (!t || byTask.has(taskId) || T.dayStart(p.start) <= today) continue;
      const wasToday = [...moved.keys()].some((title) => title === p.title || title === t.title);
      const dueNow = t.deadline != null && T.dayStart(t.deadline) <= today;
      if (!wasToday && !dueNow) continue;
      const mins = sum((state.plan || []).filter((x) => x.taskId === taskId), (x) => x.mins);
      out.push({ taskId, title: t.title, level: 'wont_fit', percent: null, show: true, label: "Won't fit today",
        reason: `About ${T.dur(mins)} of work is left and today has ${T.dur(Math.max(0, usable - ahead))} of usable time${queued ? ' after the tasks ahead of it' : ' left'}. It is planned for ${T.short(p.start)} at ${T.time(p.start)}${t.deadline != null && t.deadline > now ? ', before its deadline' : ''}.`,
        usableMins: Math.max(0, usable - ahead), neededMins: mins, movedTo: p.start, dueToday: dueNow });
    }
    // No valid slot before the deadline: this always wins over any percentage.
    for (const u of state.unscheduled || []) {
      if (u.reason !== 'no_time' || out.some((x) => x.taskId === u.taskId && x.level === 'infeasible')) continue;
      const i = out.findIndex((x) => x.taskId === u.taskId);
      const entry = { taskId: u.taskId, title: u.title, level: 'infeasible', percent: null, show: true, label: 'Not enough time before the deadline',
        reason: `About ${T.dur(u.mins)} of work has no open block before ${u.deadline != null ? T.short(u.deadline) + ' ' + T.time(u.deadline) : 'its deadline'}.`,
        usableMins: 0, neededMins: u.mins, dueToday: u.deadline != null && T.dayStart(u.deadline) === today };
      if (i >= 0) out[i] = entry; else out.push(entry);
    }
    return out;
  }

  /** Compare two plans per unit → structured change list (Phase 3 proposed_schedule_changes). */
  function diff(prevPlan, nextPlan, state, unscheduled) {
    const group = (plan) => {
      const m = new Map();
      for (const s of plan) {
        if (!m.has(s.unitId)) m.set(s.unitId, { unitId: s.unitId, taskId: s.taskId, partId: s.partId, title: s.title, start: s.start, end: s.end, mins: 0, n: 0 });
        const g = m.get(s.unitId);
        g.start = Math.min(g.start, s.start); g.end = Math.max(g.end, s.end); g.mins += s.mins; g.n += 1;
      }
      return m;
    };
    const P = group(prevPlan || []), N = group(nextPlan || []);
    const unsched = new Set((unscheduled || []).map((x) => x.unit.id));
    const changes = [];
    for (const [id, n] of N) {
      const p = P.get(id);
      if (!p) changes.push({ action: 'SCHEDULE', unitId: id, taskId: n.taskId, title: n.title, to: n });
      else if (p.start !== n.start || p.mins !== n.mins || p.n !== n.n) changes.push({ action: 'RESCHEDULE', unitId: id, taskId: n.taskId, title: n.title, from: p, to: n });
    }
    for (const [id, p] of P) {
      if (N.has(id)) continue;
      const task = state.tasks.find((t) => t.id === p.taskId);
      const part = task && p.partId ? (task.parts || []).find((x) => x.id === p.partId) : null;
      let action = 'UNSCHEDULED';
      if (!task || task.status === 'cancelled') action = 'CANCEL';
      else if (task.status === 'done' || (part && part.done)) action = 'COMPLETE';
      else if (!unsched.has(id) && task.deadline == null) action = 'UNSCHEDULED';
      changes.push({ action, unitId: id, taskId: p.taskId, title: p.title, from: p });
    }
    const order = { CANCEL: 0, COMPLETE: 1, UNSCHEDULED: 2, RESCHEDULE: 3, SCHEDULE: 4 };
    return changes.sort((a, b) => order[a.action] - order[b.action] || ((a.to || a.from).start - (b.to || b.from).start));
  }

  function nextSession(plan, now) {
    return (plan || []).filter((s) => s.end > now).sort((a, b) => a.start - b.start)[0] || null;
  }

  function currentFixed(state, now) {
    return occurrences(state, T.dayStart(now)).find((o) => o.start <= now && now < o.end && o.kind !== 'routine') || null;
  }

  const gapLabel = (m) => (m % 30 === 0 ? `${m / 60}-hour` : T.dur(m));

  /** "Why this?" — a short, factual explanation built from the plan (§10 Transparency). */
  function explain(state, plan, s, now) {
    const task = state.tasks.find((t) => t.id === s.taskId);
    if (!task) return '';
    const out = [];
    const isExam = task.type === 'exam' || task.type === 'quiz';
    const dl = task.deadline;
    const examName = (task.context ? task.context + ' ' : '') + task.title.replace(/^Study for\s+/i, '').toLowerCase();

    if (task.doFirst) out.push('You marked this as do-first, so it leads your plan.');
    if (dl != null && dl <= now) {
      out.push('This is past its deadline, so I moved it to the front.');
    } else if (dl != null) {
      const daysLeft = Math.round((T.dayStart(dl) - T.dayStart(now)) / DAY);
      const when = daysLeft === 0 ? 'today' : daysLeft === 1 ? 'tomorrow' : daysLeft < 7 ? T.DAY_NAMES[T.dow(dl)] : T.short(dl);
      const total = task.parts && task.parts.length ? sum(task.parts, (p) => p.mins) : task.durationMins;
      out.push(isExam ? `Your ${examName} is ${when}, and you planned about ${T.dur(total)} of study for it.` : `${task.title} is due ${when} and needs about ${T.dur(total)} in total.`);
    }

    // The gap this session sits in.
    const day = T.dayStart(s.start);
    const fixed = occurrences(state, day).filter((o) => !o.soft);
    const nextFixed = fixed.find((o) => o.start >= s.end);
    const prevFixed = fixed.filter((o) => o.end <= s.start).pop();
    const gapStart = prevFixed ? prevFixed.end : T.at(day, state.baseline.dayStart);
    const gapEnd = nextFixed ? nextFixed.start : T.at(day, state.baseline.dayEnd);
    const gap = Math.round((gapEnd - Math.max(gapStart, Math.min(now, s.start))) / MIN);
    if (nextFixed && gap >= 45) out.push(`You have a ${gapLabel(gap)} gap before your ${T.timeShort(nextFixed.start)} ${nextFixed.title}${nextFixed.mode === 'FTF' ? ' (FTF)' : ''}.`);
    else if (!nextFixed && prevFixed && gap >= 45) out.push(`Your ${T.minsOfDay(s.start) >= 17 * 60 ? 'evening' : 'afternoon'} is open after ${prevFixed.title}.`);

    // What doing it now unlocks.
    const later = plan.filter((x) => x.taskId === s.taskId && x.start > s.start).sort((a, b) => a.start - b.start);
    const relLower = (ms) => { const r = T.rel(ms, now); return r === 'Today' ? 'later today' : r === 'Tomorrow' ? 'tomorrow' : r; };
    const approx = (m) => (m >= 120 ? `${Math.round(m / 60)} hrs` : T.dur(m));
    if (s.sessions > 1) {
      out.push(`It's session ${s.session} of ${s.sessions} — splitting it keeps each sitting manageable within your open blocks.`);
    } else if (s.partId && later.length && later[0].partId !== s.partId) {
      const nxt = later[0];
      const nxtPart = (task.parts || []).find((p) => p.id === nxt.partId);
      out.push(`Finishing ${s.title.split(' — ').pop()} now leaves ${nxtPart ? nxtPart.title : 'the rest'} (${T.dur(nxt.mins)}) for ${relLower(nxt.start)} at ${T.timeShort(nxt.start)}.`);
    } else if (dl != null && dl > now) {
      let left = freeSlots(state, T.ceilTo(now, 15), dl);
      for (const p of plan) left = reserve(left, p.start, p.end, state.baseline.bufferMins * MIN);
      const spare = sum(left.filter((x) => x.start >= s.end && x.end <= dl), (x) => (x.end - x.start) / MIN);
      if (spare < s.mins) out.push(isExam ? 'This is your last open block long enough to study before then.' : "This is your last open block long enough for it before it's due.");
      else if (!isExam) out.push(`Doing it now still leaves about ${approx(spare)} of open time before the deadline.`);
    }
    return out.slice(0, 3).join(' ');
  }

  function eventConflicts(state, ev) {
    const occs = occurrences(state, T.dayStart(ev.start)).filter((o) => o.start < ev.end && o.end > ev.start && o.id !== ev.id);
    return { hard: occs.filter((o) => !o.soft), soft: occs.filter((o) => o.soft) };
  }

  function recurringConflicts(state, rec) {
    const hard = [];
    for (const day of rec.days) {
      const s = T.hmToMins(rec.start), e = T.hmToMins(rec.end);
      for (const c of state.baseline.classes.concat(state.baseline.recurring)) {
        if (c.day === day && T.hmToMins(c.start) < e && T.hmToMins(c.end) > s) hard.push({ ...c, dayName: T.DAY_NAMES[day] });
      }
    }
    return hard;
  }

  /** Phase 1 follow-up: the human-readable "AI Analysis" of an extracted class schedule. */
  function analyzeBaseline(classes) {
    if (!classes.length) return '';
    const days = [1, 2, 3, 4, 5, 6, 0];
    const ftf = days.filter((d) => classes.some((c) => c.day === d && c.mode === 'FTF'));
    const online = days.filter((d) => !ftf.includes(d) && classes.some((c) => c.day === d));
    const fmtDays = (ds) => {
      if (ds.length >= 3 && ds.every((d, i) => i === 0 || days.indexOf(d) === days.indexOf(ds[i - 1]) + 1)) return `${T.DAY_NAMES[ds[0]]} through ${T.DAY_NAMES[last(ds)]}`;
      const names = ds.map((d) => T.DAY_NAMES[d]);
      return names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + last(names) : names[0];
    };
    let best = null;
    for (const d of days) {
      const cs = classes.filter((c) => c.day === d).sort((a, b) => T.hmToMins(a.start) - T.hmToMins(b.start));
      for (let i = 1; i < cs.length; i++) {
        const g = T.hmToMins(cs[i].start) - T.hmToMins(cs[i - 1].end);
        if (g >= 120 && (!best || g > best.g)) best = { g, d, s: cs[i - 1].end, e: cs[i].start };
      }
    }
    const parts = [];
    if (ftf.length) parts.push(`Face-to-Face classes on ${fmtDays(ftf)}`);
    if (online.length) parts.push(`Online classes on ${fmtDays(online)}`);
    let msg = `I see you have ${parts.join(', and ')}.`;
    if (best) msg += ` You also have large gaps, like ${T.DAY_NAMES[best.d]} ${T.hmLabel(best.s)} – ${T.hmLabel(best.e)}. Let's figure out how to use those.`;
    return msg;
  }

  // ----------------------------------------------------- Phase 3 contract --
  function phase3({ status, alerts, clarification, next, changes, unscheduled }) {
    return {
      status,
      alerts: (alerts || []).map((a) => ({ level: a.level, message: a.message })),
      clarification_needed: clarification || null,
      next_action: next ? { task_id: next.unitId, title: next.title, recommended_start: T.toISO(next.start), duration_mins: next.mins } : null,
      proposed_schedule_changes: (changes || []).filter((c) => c.action !== 'UNSCHEDULED').map((c) => ({
        task_id: c.unitId,
        action: c.action,
        new_start: c.to ? T.toISO(c.to.start) : null,
        new_duration_mins: c.to ? c.to.mins : null,
      })),
      unscheduled_tasks: (unscheduled || []).map((x) => x.unit.id),
    };
  }

  root.TempoEngine = {
    MIN_SESSION, MAX_SESSION, occurrences, freeSlots, units, rank, schedule, capacity, diff,
    completionConfidence, CONFIDENCE, nextSession, currentFixed, explain, eventConflicts, recurringConflicts, analyzeBaseline, phase3,
  };
})(typeof window !== 'undefined' ? window : globalThis);
