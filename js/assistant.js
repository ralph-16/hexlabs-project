/*
 * SIKAD — Ask SIKAD: answers to questions about the current plan.
 *
 * Deterministic rules over the live application state. No language model is connected:
 * a question is recognised by its wording, then answered by reading the same tasks, plan
 * and fixed commitments every other view uses. When the state cannot answer, the reply
 * says what is missing instead of guessing. Changes ("I have a shift…") are not handled
 * here; they go through parser.js → preview → confirm → replan.
 *
 * answer(state, text) → null (not a question) | { kind, title, lines: [string], facts: [[label, value]], missing?: true }
 */
(function (root) {
  'use strict';
  const T = root.TempoTime, E = root.TempoEngine, P = root.TempoParser;
  const { MIN, DAY, HOUR } = T;

  const Q = {
    feasible: /\b(?:can|could|will) i (?:realistically |really |still |actually )?(?:finish|complete|fit|do|make|get)\b|\b(?:will|does|do) (?:everything|it all|all of (?:it|this)) fit\b|\bis (?:it|everything|this) (?:doable|feasible|possible|realistic)\b|\b(?:do i have|is there) enough time\b/i,
    usable: /\bhow (?:much|many) (?:usable |free |open |available |spare )?(?:time|hours?)\b|\b(?:am i|when am i) free\b|\bdo i have (?:any )?(?:free |open )?time\b/i,
    why: /\bwhy\b/i,
    // "What if I move X to 8 PM?" — a preview. Checked first so it is never read as a command.
    whatif: /\bwhat (?:happens|would happen|will happen|changes|would change)\b.*\bif\b|\bwhat if\b|^\s*(?:preview|simulate)\b/i,
    list: /\b(?:show|list|what|which|display)\b.*\b(?:tasks?|assignments?|deadlines?|due|on my plan|planned|scheduled)\b|\bwhat(?:'s| is| are)\b.*\bdue\b/i,
    inspect: /\b(?:when|where)(?:'s| is| am| do| did| will)\b|\b(?:show|find|look up|tell me about|status of|details? (?:of|for|on))\b|\bhow (?:much|long)\b.*\b(?:left|remaining|take)\b/i,
    next: /\bwhat (?:should|do|can|must) i (?:do|work on|start|focus on|tackle)\b|\bwhat'?s (?:next|first)\b|\bwhere (?:should|do) i start\b|\bwhat (?:is|comes) next\b/i,
  };

  const sum = (arr, f) => arr.reduce((a, x) => a + f(x), 0);
  const openTasks = (state) => state.tasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled');
  const remaining = (t) => (t.parts && t.parts.length ? sum(t.parts.filter((p) => !p.done), (p) => p.remainingMins) : t.remainingMins);
  const usableBetween = (state, from, to) => Math.round(sum(E.freeSlots(state, T.ceilTo(from, 15), to), (s) => (s.end - s.start) / MIN));
  /** Big totals read better rounded: "35 hrs", not "35 hr 15 min". */
  const span = (mins) => (mins >= 600 ? `${Math.round(mins / 60)} hrs` : T.dur(mins));
  // Words that point at "whatever is recommended" rather than naming a specific task.
  const GENERIC = new Set(('why assignment task one thing priority highest high first top recommended recommend next important most start begin ' +
    'before ahead number main biggest urgent what should work again right').split(' '));
  const dueWords = (dl, now) => {
    const days = Math.round((T.dayStart(dl) - T.dayStart(now)) / DAY);
    if (dl <= now) return 'is past its deadline';
    return `is due ${days === 0 ? 'today' : days === 1 ? 'tomorrow' : days < 7 ? T.DAY_NAMES[T.dow(dl)] : T.short(dl)} (${T.short(dl)}, ${T.time(dl)})`;
  };

  function classify(text) {
    if (Q.whatif.test(text)) return 'whatif';
    for (const kind of ['feasible', 'usable', 'why', 'next', 'list', 'inspect']) if (Q[kind].test(text)) return kind;
    return null;
  }

  // ------------------------------------------------- Scope: checked before any question rule or task-title match
  // SIKAD plans time. It does not do graded work, answer unrelated questions or counsel. These rules run first so a
  // matching task title can never turn "solve my Logic exercises for me" into a task update.
  const SCOPE = {
    safety: /\b(?:kill(?:ing)? myself|suicid\w*|end(?:ing)? my life|end it all|(?:want|wanna|going) to die|don'?t want to (?:live|be alive|be here|wake up)|hurt(?:ing)? myself|self[- ]?harm\w*|cut(?:ting)? myself|no reason to live|better off dead|overdos\w*|(?:i'?m|i am) (?:in danger|not safe)|(?:i )?don'?t feel safe|someone (?:is )?(?:hurting|threatening|following) me)\b/i,
    gradedAsk: /\b(?:can|could|would|will) you\b|\bfor me\b|^\s*(?:please\s+)?(?:solve|answer)\b/i,
    gradedVerb: /\b(?:solve|answer|write|do|complete|finish|draft|code|translate|paraphrase)\b/i,
    gradedWork: /\b(?:essays?|papers?|reports?|homework|assignments?|exercises?|questions?|problems?|thesis|lab|worksheets?|quiz(?:zes)?|exams?|tests?|answers?|solutions?|pdf|project|code|program|reflection)\b/i,
    gradedDirect: /\b(?:give|send|show|tell|get) me (?:the |all (?:the )?)?(?:answers?|solutions?)\b|\banswer key\b|\banswers?\b.*\b(?:to submit|for submission|to hand in|to turn in|to pass)\b|\b(?:to submit|for submission|to hand in|to turn in)\b.*\banswers?\b/i,
    planning: /\b(?:schedule|plan|move|fit|block|reschedule|remind|time (?:to|for)|break (?:it|this|them)|split|when should|deadline|due)\b/i,
    stress: /\b(?:overwhelm\w*|stress(?:ed|ing)?|anxious|anxiety|panick?(?:ing|ed)?|burn(?:ed|t)? ?out|burnout|break ?down|breaking down|can'?t (?:cope|handle (?:this|it))|exhausted|drowning|freaking out|depressed|hopeless|falling apart)\b/i,
    deadlines: /\b(?:assignments?|deadlines?|due|tasks?|exams?|quiz(?:zes)?|projects?|homework|tests?|papers?|essays?)\b/i,
    question: /\?\s*$|^\s*(?:who|what|whats|what's|where|when|why|how|which|is|are|can|could|do|does|did|tell me|explain|define|teach)\b/i,
    chat: /^\s*(?:hi|hello|hey|yo|good (?:morning|afternoon|evening)|thanks?|thank you|how are you|who are you|what are you|tell me (?:a joke|something)|let'?s (?:talk|chat))\b/i,
    onTopic: /\b(?:task|plan|schedul\w*|deadline|due|time|free|busy|class|classes|shift|work|study|session|exam|quiz|assignment|homework|project|today|tonight|tomorrow|week|weekend|monday|tuesday|wednesday|thursday|friday|saturday|sunday|hours?|minutes?|mins?|hrs?|focus|snooze|done|finish\w*|priority|commitment|calendar|busy|late|early|move|add|remove|delete|rename|mark|change|cancel)\b/i,
  };
  const scopeReply = (kind, title, lines, facts) => ({ kind, scope: true, title, lines, facts: facts || [] });

  function scopeCheck(state, text) {
    if (SCOPE.safety.test(text)) {
      return scopeReply('safety', 'Please reach out to someone now', [
        'This sounds serious, and it matters more than any plan. SIKAD is a planner and can\'t help with this, but people can.',
        'If you might be in danger, call your local emergency number now. Talk to someone you trust today: a family member, a friend, or your school\'s guidance office.',
        'Your plan will keep. Nothing was changed.']);
    }
    if (SCOPE.stress.test(text) && !SCOPE.deadlines.test(text) && !SCOPE.onTopic.test(text)) {
      // Distress with no deadline or command in it. Stress about deadlines goes to the parser's stress card instead.
      const next = answerNext(state);
      const lines = ['Sorry it\'s a hard stretch. SIKAD only plans time; for how you\'re feeling, someone you trust or your school\'s guidance office can help more than I can.'];
      if (next.missing) lines.push(...next.lines);
      else lines.push(`If it helps to keep today small: your next step is "${next.title}". You can Snooze anything that can wait and SIKAD will find it a later slot.`);
      lines.push('Nothing was changed.');
      return scopeReply('stress', 'Let\'s keep today manageable', lines, next.missing ? [] : next.facts);
    }
    return null;
  }

  /** A request to do graded work for the student, whatever task title it names. */
  function isGraded(text) {
    return SCOPE.gradedDirect.test(text) ||
      (SCOPE.gradedAsk.test(text) && SCOPE.gradedVerb.test(text) && SCOPE.gradedWork.test(text) && !SCOPE.planning.test(text));
  }

  /**
   * The parser's own academic-guardrail intent (refusal + step breakdown) for a graded-work request, built from a
   * plain request for the same kind of work so the parser's rules stay the only source of the breakdown.
   * A named task is kept on the intent so the card does not offer to add it a second time.
   */
  function gradedIntent(state, ctx, text) {
    const kinds = text.match(/\b(essay|paper|homework|assignment|report|thesis|worksheet|code|program|quiz|exam|test|reflection|proposal|lab)\b/i);
    const own = text.match(SCOPE.gradedWork);
    const noun = kinds ? kinds[1].toLowerCase() : own ? own[0].toLowerCase() : 'work';
    const ref = P.parse(`Can you do my ${kinds ? noun : 'problems'} for me`, Object.assign({}, ctx, { tasks: [] })).intents.find((i) => i.type === 'refuse');
    const r = P.resolveTask(text, state.tasks);
    return Object.assign({}, ref, { noun, subject: r.task ? r.task.title : ref.subject, taskId: r.task ? r.task.id : null });
  }

  /** After the planning rules: a question or chat with nothing about time, tasks or the plan in it is out of scope. */
  function offTopic(state, text) {
    if (!SCOPE.chat.test(text) && !SCOPE.question.test(text)) return null;
    if (SCOPE.onTopic.test(text) || !P.resolveTask(text, state.tasks).none) return null;
    return scopeReply('offtopic', 'SIKAD only helps with your time', [
      'I can\'t answer that. I plan your tasks, deadlines and free time.',
      'Try "What should I work on next?", "How much free time do I have tomorrow?", or tell me about a new task.'], []);
  }

  function answer(state, text) {
    const scoped = scopeCheck(state, text || '');
    if (scoped) return scoped;
    if (isGraded(text || '')) return null;                    // the caller shows the academic-guardrail card
    const kind = classify(text || '');
    if (!kind) return offTopic(state, text || '');
    return { next: answerNext, why: answerWhy, usable: answerUsable, feasible: answerFeasible, list: answerList, inspect: answerInspect, whatif: answerWhatIf }[kind](state, text);
  }

  // ------------------------------------------------- "What should I work on next?"
  function answerNext(state) {
    const now = state.now;
    const next = E.nextSession(state.plan, now);
    if (!next) {
      const open = openTasks(state);
      if (!open.length) return { kind: 'next', title: 'Nothing is waiting', lines: ['You have no open tasks. Add one whenever something comes up.'], facts: [], missing: true };
      const noDl = open.filter((t) => t.deadline == null);
      return { kind: 'next', title: 'Nothing is scheduled yet', missing: true, facts: [],
        lines: [noDl.length ? `I can't schedule ${noDl.map((t) => `"${t.title}"`).join(', ')} without a deadline. Add the date and it gets a time slot.`
          : 'Your open tasks do not fit before their deadlines. See "Not enough time" on Home for options.'] };
    }
    const task = state.tasks.find((t) => t.id === next.taskId);
    return { kind: 'next', title: next.title,
      lines: [E.explain(state, state.plan, next, now) || 'It is the first item in your current plan.'],
      facts: [['When', `${T.rel(next.start, now)}, ${T.range(next.start, next.end)}`], ['Planned time', T.dur(next.mins) + (task && task.isAiEstimate ? ' (AI estimate)' : '')],
        ...(task && task.deadline != null ? [['Due', `${T.short(task.deadline)}, ${T.time(task.deadline)}`]] : [])] };
  }

  // ------------------------------------------------- "Why is this my highest priority?"
  function answerWhy(state, text) {
    const now = state.now;
    const open = openTasks(state);
    if (!open.length) return { kind: 'why', title: 'No open tasks', lines: ['There is nothing to prioritise yet. Add a task and I can explain where it sits.'], facts: [], missing: true };
    const next = E.nextSession(state.plan, now);
    const named = P.matchTask(text, open);
    const asked = P.tokens(text).filter((w) => !GENERIC.has(w));
    if (!named && asked.length) {
      const words = text.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w && asked.includes(P.tokens(w)[0]));
      return { kind: 'why', title: `No task matches "${words.join(' ')}"`, missing: true, facts: [],
        lines: [`I don't have an open task by that name, so I can't explain its priority. Your open tasks are: ${open.map((t) => `"${t.title}"`).join(', ')}.`] };
    }
    const task = named || (next && state.tasks.find((t) => t.id === next.taskId));
    if (!task) return { kind: 'why', title: 'Nothing is scheduled yet', lines: ['No task has a time slot yet, so there is no recommendation to explain. Check that your tasks have deadlines.'], facts: [], missing: true };
    if (task.deadline == null) return { kind: 'why', title: task.title, lines: [`"${task.title}" has no deadline yet, so I can't rank it. Add the date and I'll place it.`], facts: [], missing: true };

    // Priority order as the scheduler sees it (one entry per task, in rank order).
    const ranked = [];
    for (const u of E.rank(E.units(state).filter((x) => x.deadline != null), now)) if (!ranked.includes(u.taskId)) ranked.push(u.taskId);
    const pos = ranked.indexOf(task.id) + 1;
    const left = remaining(task);
    const usable = task.deadline > now ? usableBetween(state, now, task.deadline) : 0;
    const dueBy = sum(open.filter((t) => t.deadline != null && t.deadline <= task.deadline), remaining);
    const lines = [];
    const isNext = next && next.taskId === task.id;
    if (pos === 1) lines.push(`"${task.title}" ranks first of your ${ranked.length} scheduled task${ranked.length === 1 ? '' : 's'}.`);
    else lines.push(`"${task.title}" ranks ${pos} of ${ranked.length}. "${(state.tasks.find((t) => t.id === ranked[0]) || {}).title}" is ahead of it.`);
    if (pos > 1 && isNext) lines.push('It is still your next step, because the next open block is the first place it fits.');
    if (pos === 1 && next && !isNext) lines.push(`Your next scheduled step is "${next.title}", because that is what fits the next open block.`);
    lines.push(`It ${dueWords(task.deadline, now)} and has ${T.dur(left)} of work left.`);
    if (task.deadline > now) lines.push(`You have about ${span(usable)} of usable time before then, and ${T.dur(dueBy)} of work due by that point${dueBy > usable ? ', which is more than fits' : ''}.`);
    if (task.doFirst) lines.push('You marked it "do first", which puts it ahead of everything that is not overdue.');
    const blocks = open.filter((t) => (t.dependencies || []).includes(task.id));
    if (blocks.length) lines.push(`${blocks.map((t) => `"${t.title}"`).join(', ')} can't start until this is done.`);
    const waits = (task.dependencies || []).map((id) => state.tasks.find((t) => t.id === id)).filter((t) => t && t.status !== 'done');
    if (waits.length) lines.push(`It has to wait for ${waits.map((t) => `"${t.title}"`).join(', ')}.`);
    if (task.isAiEstimate) lines.push('Its duration is an AI estimate. If it is off, edit it and the ranking updates.');
    return { kind: 'why', title: `Why ${task.title}`, lines,
      facts: [['Rank', `${pos} of ${ranked.length}`], ['Importance you set', task.priority], ['Work left', T.dur(left)], ['Due', `${T.short(task.deadline)}, ${T.time(task.deadline)}`]] };
  }

  // ------------------------------------------------- "How much usable time do I have tomorrow?"
  function answerUsable(state, text) {
    const now = state.now;
    const parsed = P.parseDate(text, now);
    const day = parsed ? parsed.day : T.dayStart(now);
    const b = state.baseline;
    const from = Math.max(now, T.at(day, b.dayStart)), to = T.at(day, b.dayEnd);
    const label = `${T.rel(day, now)}${['Today', 'Tomorrow'].includes(T.rel(day, now)) ? ` (${T.short(day)})` : ''}`;
    if (to <= now) return { kind: 'usable', title: `${label}: no usable time left`, lines: [`Your planning day ends at ${T.hmLabel(b.dayEnd)}, and that has passed.`], facts: [] };
    const usable = usableBetween(state, from, to);
    const planned = sum(state.plan.filter((s) => s.end > now && T.dayStart(s.start) === day), (s) => s.mins);
    const fixed = E.occurrences(state, day).filter((o) => !o.soft && o.end > now);
    const lines = [`${label} you have ${T.dur(usable)} of usable time${day === T.dayStart(now) ? ' left' : ''}.`];
    lines.push(planned ? `${T.dur(planned)} of that is already planned for tasks, which leaves about ${T.dur(Math.max(0, usable - planned))} open.` : 'None of it is planned for tasks yet.');
    lines.push(`That counts only ${T.hmLabel(b.dayStart)}–${T.hmLabel(b.dayEnd)}, and leaves out your fixed commitments${b.commuteMins && fixed.some((o) => o.mode === 'FTF') ? ', commute' : ''} and a ${b.bufferMins}-minute buffer around them.`);
    return { kind: 'usable', title: `Usable time ${T.rel(day, now).toLowerCase()}`, lines,
      facts: [['Usable', T.dur(usable)], ['Planned for tasks', T.dur(planned)], ['Fixed commitments', fixed.length ? fixed.map((o) => `${o.title} ${T.timeShort(o.start)}–${T.timeShort(o.end)}`).join(' · ') : 'None']] };
  }

  // ------------------------------------------------- "Can I realistically finish everything before Friday?"
  function answerFeasible(state, text) {
    const now = state.now;
    const open = openTasks(state);
    if (!open.length) return { kind: 'feasible', title: 'Nothing is due', lines: ['You have no open tasks, so there is nothing to fit.'], facts: [], missing: true };
    const parsed = P.parseDate(text, now);
    const until = parsed ? T.at(parsed.day, '23:59') : T.endOfWeek(now);
    const label = parsed ? T.short(until) : `the end of this week (${T.short(until)})`;
    const due = open.filter((t) => t.deadline != null && t.deadline <= until);
    const noDl = open.filter((t) => t.deadline == null);
    if (!due.length) {
      return { kind: 'feasible', title: `Nothing is due by ${label}`, facts: [],
        lines: [`None of your ${open.length} open task${open.length === 1 ? '' : 's'} is due by then.`].concat(noDl.length ? [`I can't judge ${noDl.map((t) => `"${t.title}"`).join(', ')}: no deadline yet.`] : []) };
    }
    const need = sum(due, remaining);
    const usable = usableBetween(state, now, until);
    const stuck = (state.unscheduled || []).filter((u) => due.some((t) => t.id === u.taskId));
    const lastEnd = Math.max(0, ...state.plan.filter((s) => due.some((t) => t.id === s.taskId)).map((s) => s.end));
    const estimates = due.filter((t) => t.isAiEstimate);
    const lines = [];
    let title;
    if (stuck.length) {
      title = `No, not everything fits by ${label}`;
      lines.push(`${stuck.length === 1 ? 'One piece of work has' : `${stuck.length} pieces of work have`} no open block before the deadline: ${[...new Set(stuck.map((u) => `"${u.title}"`))].join(', ')} (${T.dur(sum(stuck, (u) => u.mins))} in total).`);
      lines.push('I have not moved any deadline or shortened any task to hide that. Options are on Home under "Not enough time".');
    } else {
      title = `Yes, as currently planned`;
      lines.push(`${due.length} task${due.length === 1 ? '' : 's'} due by ${label} need${due.length === 1 ? 's' : ''} ${T.dur(need)}. You have about ${span(usable)} of usable time before then.`);
      if (lastEnd) lines.push(`The plan finishes the last of them on ${T.short(lastEnd)} at ${T.time(lastEnd)}.`);
    }
    if (estimates.length) lines.push(`This relies on ${estimates.length} AI-estimated duration${estimates.length === 1 ? '' : 's'} (${estimates.map((t) => `"${t.title}"`).join(', ')}). If those run long, the answer can change.`);
    if (noDl.length) lines.push(`Not counted: ${noDl.map((t) => `"${t.title}"`).join(', ')} (no deadline yet).`);
    return { kind: 'feasible', title, lines,
      facts: [['Work due by then', T.dur(need)], ['Usable time', span(usable)], ['Tasks', due.map((t) => t.title).join(' · ')]] };
  }

  // ------------------------------------------------- "Show me the tasks due tomorrow"
  const plannedFor = (state, t) => state.plan.filter((s) => s.taskId === t.id).sort((a, b) => a.start - b.start);
  const taskLine = (state, t) => {
    const first = plannedFor(state, t)[0];
    const stuck = (state.unscheduled || []).some((u) => u.taskId === t.id);
    return `"${t.title}": ${t.deadline != null ? 'due ' + T.short(t.deadline) + ' ' + T.time(t.deadline) : 'no deadline yet'} · ${T.dur(remaining(t))} left · ${first ? 'planned ' + T.short(first.start) + ' ' + T.time(first.start) : stuck ? 'does not fit before its deadline' : 'not scheduled'}`;
  };
  function answerList(state, text) {
    const now = state.now, open = openTasks(state);
    const date = P.parseDate(text, now);
    const week = /\bthis week\b/i.test(text);
    const byPlan = /\b(planned|scheduled|on my plan|doing|working on)\b/i.test(text);
    let picked, label;
    if (date && byPlan) { picked = open.filter((t) => plannedFor(state, t).some((s) => T.dayStart(s.start) === date.day)); label = `planned for ${T.short(date.day)}`; }
    else if (date) { picked = open.filter((t) => t.deadline != null && T.dayStart(t.deadline) === date.day); label = `due ${T.short(date.day)}`; }
    else if (week) { const end = T.endOfWeek(now); picked = open.filter((t) => t.deadline != null && t.deadline <= end); label = 'due this week'; }
    else if (/\boverdue|late|past (?:its |their )?deadline\b/i.test(text)) { picked = open.filter((t) => t.deadline != null && t.deadline <= now); label = 'past their deadline'; }
    else { picked = open; label = 'open'; }
    picked = picked.slice().sort((a, b) => (a.deadline == null) - (b.deadline == null) || a.deadline - b.deadline);
    if (!picked.length) return { kind: 'list', title: `No tasks ${label}`, lines: [open.length ? `You have ${open.length} open task${open.length === 1 ? '' : 's'}, but none ${label}.` : 'You have no open tasks.'], facts: [], missing: !open.length };
    const next = E.nextSession(state.plan, now);
    const lines = picked.map((t) => taskLine(state, t));
    if (next) lines.push(`Recommended next: "${next.title}", ${T.short(next.start)} at ${T.time(next.start)}.`);
    return { kind: 'list', title: `${picked.length} task${picked.length === 1 ? '' : 's'} ${label}`, lines, facts: [['Tasks', String(picked.length)], ['Time left', T.dur(sum(picked, remaining))]] };
  }

  // ------------------------------------------------- "When is the class diagram exercise?"
  function answerInspect(state, text) {
    const r = P.resolveTask(text, state.tasks);
    if (r.none) return null;                                   // not about a task we know: let the caller ask what was meant
    if (r.ambiguous) return { kind: 'inspect', title: 'Which task?', lines: ['More than one task matches:'].concat(r.ambiguous.map((t) => taskLine(state, t))), facts: [], missing: true };
    if (r.closed) return { kind: 'inspect', title: r.closed.title, lines: [`"${r.closed.title}" is ${r.closed.status === 'done' ? 'marked done' : 'no longer on your list'}.`], facts: [['Status', r.closed.status === 'done' ? 'Done' : 'Removed']] };
    const t = r.task, sessions = plannedFor(state, t);
    const stuck = (state.unscheduled || []).some((u) => u.taskId === t.id);
    const lines = [t.deadline != null ? `"${t.title}" ${dueWords(t.deadline, state.now)}.` : `"${t.title}" has no deadline yet, so it is not scheduled.`];
    if (sessions.length) lines.push(`Planned: ${sessions.map((s) => `${T.short(s.start)} ${T.time(s.start)}–${T.time(s.end)}`).join(', ')}.`);
    else if (stuck) lines.push('It does not fit before its deadline. Options are on Home under "Not enough time".');
    return { kind: 'inspect', title: t.title, lines,
      facts: [['Status', t.status === 'in_progress' ? 'In progress' : 'Not done'], ['Time left', `${t.isAiEstimate ? '≈ ' : ''}${T.dur(remaining(t))}${t.isAiEstimate ? ' (AI estimate)' : ''}`], ['Difficulty', t.difficulty || 'medium'], ['Priority', t.priority]] };
  }

  // ------------------------------------------------- "What happens if I move X to 8 PM?"
  /** A preview: the change is run on a copy through the same engine. The real plan is not touched. */
  function answerWhatIf(state, text) {
    const S = root.TempoStore;
    const cmd = text.replace(/^.*?\b(?:what if|if)\s+(?:i|we|you)\s+/i, '').replace(/^\s*(?:preview|simulate)\s+/i, '').replace(/[?.!]+\s*$/, '');
    const parsed = P.parse(cmd, S.parseContext(state));
    const ask = parsed.intents.find((i) => i.type === 'unclear');
    const doable = parsed.intents.filter((i) => i.taskId && i.type !== 'unclear' && i.type !== 'duplicate');
    if (ask || !doable.length) return { kind: 'whatif', title: 'I need a bit more to preview that', lines: [ask && ask.question ? ask.question : 'Name the task and the change, for example "What if I move Class Diagram Exercise to 8 PM tomorrow?"', 'Nothing was changed.'], facts: [], missing: true };
    const { draft, applied, errors } = S.previewIntents(state, doable);
    if (!applied.length) return { kind: 'whatif', title: 'That change is not possible', lines: errors.concat('Nothing was changed.'), facts: [], missing: true };
    const u = draft.lastUpdate || { changes: [] };
    const when = (x) => `${T.short(x.start)} ${T.time(x.start)}`;
    const lines = [`If you did this (${applied.join('; ')}):`];
    for (const c of u.changes || []) {
      if (c.action === 'RESCHEDULE') lines.push(`"${c.title}": ${when(c.from)} → ${when(c.to)}`);
      else if (c.action === 'SCHEDULE') lines.push(`"${c.title}": newly planned ${when(c.to)}`);
      else if (c.action === 'UNSCHEDULED') lines.push(`"${c.title}": would no longer fit before its deadline`);
      else if (c.action === 'CANCEL' || c.action === 'COMPLETE') lines.push(`"${c.title}": leaves the plan`);
    }
    if (!(u.changes || []).length) lines.push('No planned session would move.');
    for (const a of draft.alerts || []) if (a.code === 'PIN_FAILED' || a.level === 'CRITICAL') lines.push(a.message);
    lines.push('This is only a preview. Nothing was changed. Say it as an instruction to get a proposal you can accept or reject.');
    return { kind: 'whatif', title: draft.status === 'INFEASIBLE' ? 'Preview: not everything would fit' : 'Preview of that change', lines,
      facts: [['Sessions that move', String((u.changes || []).filter((c) => c.action === 'RESCHEDULE').length)], ['Fits', draft.status === 'INFEASIBLE' ? 'No' : 'Yes']] };
  }

  root.TempoAssistant = { answer, classify, isGraded, gradedIntent };
})(typeof window !== 'undefined' ? window : globalThis);
