/*
 * SIKAD — input understanding (UNDERSTAND stage).
 *
 * A deterministic stand-in for the LLM described in prompt.md. It turns messy
 * brain-dump text into structured "intents" and emits the Phase 1 / Phase 2
 * JSON contracts. Rules it follows (user_story.md §9, §18):
 *   - never invent deadlines: a missing deadline becomes null + clarification
 *   - missing durations get a type-based estimate flagged is_ai_estimate
 *   - new commitments are temporary unless the text says they recur
 *   - contradictions and ambiguous dates are surfaced as questions
 */
(function (root) {
  'use strict';
  const T = root.TempoTime;
  const { DAY, HOUR } = T;

  // ---------------------------------------------------------------- vocab --
  const WD = { sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tues: 2, tue: 2, wednesday: 3, wed: 3,
    thursday: 4, thurs: 4, thur: 4, thu: 4, friday: 5, fri: 5, saturday: 6, sat: 6 };
  const WD_SRC = '(sunday|monday|tuesday|wednesday|thursday|friday|saturday|tues|thurs|thur|sun|mon|tue|wed|thu|fri|sat)';
  const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
  const NUMW = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    'a couple of': 2, 'a few': 3 };
  const numVal = (s) => (s in NUMW ? NUMW[s] : parseFloat(s));

  /** [type, pattern, default estimate in minutes] — first match wins. */
  const TYPE_RULES = [
    ['quiz', /\bquiz(zes)?\b/i, 90],
    ['exam', /\b(exam|test|midterms?|finals?|long test|prelims?)\b/i, 120],
    ['project', /\b(project|capstone|thesis|prototype)\b/i, 240],
    ['report', /\b(report|proposal|paper|essay|reflection|case study|documentation|research)\b/i, 180],
    ['presentation', /\b(presentation|slides|pitch|deck)\b/i, 120],
    ['homework', /\b(homework|hw|worksheet|exercises?|problem set|activity|seatwork|assignment|lab|module)\b/i, 45],
    ['reading', /\b(read|reading|chapters?)\b/i, 60],
    ['errand', /\b(buy|groceries|grocery|laundry|pay|bank|clean|pick up|errands?|shop|shopping|haircut|bills?|withdraw|print)\b/i, 60],
  ];
  const DEFAULT_EST = 60;

  const BREAKDOWNS = {
    report: [['Outline & research', 0.3], ['Draft', 0.5], ['Review & polish', 0.2]],
    project: [['Plan & set up', 0.2], ['Build', 0.6], ['Test & finalize', 0.2]],
    presentation: [['Content outline', 0.3], ['Build slides', 0.5], ['Rehearse', 0.2]],
  };

  const EVENT_RE = /\b(work|working|shift|duty|meeting|meet|session|practice|rehearsal|appointment|interview|seminar|orientation|training|event|game|consultation|defense|lecture|webinar|org|class)\b/i;
  const CANCEL_RE = /\b(cancel(?:l?ed|s)?|called off|suspended|is off|won'?t push through|no longer happening|postponed)\b/i;
  const CHANGE_RE = /\b(moved|changed|extended|pushed|rescheduled|resched|is now|now due|move)\b/i;
  const NEG_RE = /\b(didn'?t|did not|wasn'?t able|was not able|couldn'?t|could not|haven'?t|have not|unable|ran out of time|not able|failed to|forgot to|missed)\b/i;
  const DONE_RE = /\b(finished|completed|done with|done|submitted|turned in|passed)\b/i;
  const ACADEMIC_REQ_RE = /\b(?:(?:can|could|would|will) you\b.{0,40}\b(?:write|do|answer|solve|finish|complete|make|code|generate)|(?:write|do|answer|solve|finish|complete|code)\b.{0,50}\bfor me\b|^\s*(?:just|please)\s+(?:write|do|answer|solve))/i;
  const ACADEMIC_NOUN_RE = /\b(essay|paper|homework|assignment|report|thesis|problems?|worksheet|code|program|quiz|exam|test|reflection|proposal|lab|answers?)\b/i;
  const STRESS_RE = /\b(stress(ed|ful)?|overwhelm(ed|ing)?|anxious|anxiety|can'?t handle|cannot handle|burn(ed|t)? out|panick?(ing)?|too much|give up|exhausted)\b/i;
  const VAGUE_RE = /\b(mess|fix it|fix everything|help me|idk|whatever|everything)\b/i;
  const NEXT_RE = /\bwhat (should|do) i (do|work on)\b|\bwhat'?s next\b/i;
  const RECUR_RE = /\b(every|each|weekly|every week|regularly)\b/i;

  const STOP = new Set(('i me my we our you your a an the to for of on in at by and or but is are was were be been it this that ' +
    'these those have has had do did done with from just really need needs about due today tonight tomorrow week task able ' +
    'finish finished complete completed wasn t not didn couldn wasnt didnt also so get got some time deadline moved changed ' +
    'move now new cancel cancelled canceled anymore don dont won going still today\'s study studying will ll s').split(' '));
  const SYN = { test: 'exam', quiz: 'exam', exam: 'exam', midterm: 'exam', midterms: 'exam', finals: 'exam',
    groceries: 'grocery', grocery: 'grocery', db: 'database', slides: 'presentation', ppt: 'presentation' };

  function tokens(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/)
      .filter((w) => w && !STOP.has(w) && !(w in WD))
      .map((w) => SYN[w] || (w.length > 3 ? w.replace(/s$/, '') : w));
  }

  function classify(text) {
    for (const [type, re, est] of TYPE_RULES) if (re.test(text)) return { type, est };
    return { type: 'task', est: DEFAULT_EST };
  }

  const SMALL = new Set(['for', 'of', 'and', 'the', 'a', 'an', 'to', 'in', 'on', 'with', '&']);
  function titleCase(s) {
    return s.split(' ').filter(Boolean).map((w, i) => {
      if (/[A-Z0-9]/.test(w.slice(1)) || /^[A-Z]{2,}/.test(w)) return w; // codes like IT 306D, SIA
      if (i > 0 && SMALL.has(w.toLowerCase())) return w.toLowerCase();
      return w[0].toUpperCase() + w.slice(1);
    }).join(' ');
  }

  // ------------------------------------------------------------- duration --
  function parseDuration(s) {
    const lower = s.toLowerCase();
    let m = lower.match(/(?:\b(?:about|around|roughly|approximately|maybe|probably|like|at least)\s+)?\bhalf an? hour\b/);
    if (m) return { mins: 30, text: m[0] };
    m = lower.match(/(?:\b(?:about|around|roughly|approximately|approx|maybe|probably|like|at least)\s+|~\s*)?\b(\d+(?:\.\d+)?|an|a|one|two|three|four|five|six|seven|eight|nine|ten|a couple of|a few)(?:\s*(?:-|to)\s*(\d+(?:\.\d+)?))?\s*(hours?|hrs?|hr|minutes?|mins?|min)\b(\s+and\s+a\s+half)?(\s+total)?/);
    if (!m) return null;
    let n = numVal(m[2] || m[1]);
    if (m[4]) n += 0.5;
    const mins = Math.round(/^h/.test(m[3]) ? n * 60 : n);
    return mins > 0 ? { mins, text: m[0] } : null;
  }

  // ----------------------------------------------------------------- date --
  function parseDate(s, now, opts = {}) {
    const lower = s.toLowerCase();
    const today = T.dayStart(now);
    let m;
    if ((m = lower.match(/\bday after tomorrow\b/))) return { day: today + 2 * DAY, text: m[0] };
    if ((m = lower.match(/\b(today|tonight|this (?:morning|afternoon|evening))\b/)))
      return { day: today, text: m[0], evening: /tonight|evening|afternoon/.test(m[0]) };
    if ((m = lower.match(/\btomorrow(?: (?:morning|afternoon|evening|night))?\b/)))
      return { day: today + DAY, text: m[0], evening: /afternoon|evening|night/.test(m[0]) };
    if ((m = lower.match(/\bin (\d+|two|three|four|five|six|seven) days\b/)))
      return { day: today + numVal(m[1]) * DAY, text: m[0] };
    if ((m = lower.match(/\b(?:(?:sometime|some time|by(?: the)? end of|end of|by)\s+)?(this|next) week(?:end)?\b|\bby the weekend\b|\bend of (?:the )?week\b/))) {
      const eow = T.dayStart(T.endOfWeek(now));
      return { day: m[1] === 'next' ? eow + 7 * DAY : eow, text: m[0], weekEnd: true };
    }
    if ((m = lower.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/)) ||
        (m = lower.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\b/))) {
      const isMonthFirst = isNaN(+m[1]);
      const mo = MONTHS[(isMonthFirst ? m[1] : m[2]).slice(0, 4).replace(/t$/, '')] || MONTHS[(isMonthFirst ? m[1] : m[2]).slice(0, 3)];
      const d = +(isMonthFirst ? m[2] : m[1]);
      let day = T.make(T.parts(now).y, mo, d);
      if (day < today - DAY) day = T.make(T.parts(now).y + 1, mo, d);
      return { day, text: m[0] };
    }
    if ((m = lower.match(/\b(\d{1,2})\/(\d{1,2})\b/))) {
      let day = T.make(T.parts(now).y, +m[1], +m[2]);
      if (day < today - DAY) day = T.make(T.parts(now).y + 1, +m[1], +m[2]);
      return { day, text: m[0] };
    }
    const wdRe = new RegExp('\\b(next |this |coming )?' + WD_SRC + '\\b', 'i');
    if ((m = lower.match(wdRe))) {
      const wd = WD[m[2]];
      const nowDow = T.dow(now);
      const diff = (wd - nowDow + 7) % 7;
      let day = today + diff * DAY;
      const mod = (m[1] || '').trim();
      if (mod === 'next') {
        const daysToSunday = (7 - nowDow) % 7;
        if (diff === 0 || (nowDow !== 0 && diff <= daysToSunday)) day += 7 * DAY;
      }
      const out = { day, text: m[0], weekday: wd };
      // "Friday" said on a Thursday could mean tomorrow or next week (§18 Ambiguous Date).
      if (!mod && opts.flagAmbiguous && (diff === 0 || diff === 1)) {
        out.ambiguous = [
          { day, label: `${diff === 0 ? 'Today' : 'Tomorrow'} (${T.short(day)})` },
          { day: day + 7 * DAY, label: `Next ${T.DAY_NAMES[wd]} (${T.short(day + 7 * DAY)})` },
        ];
      }
      return out;
    }
    return null;
  }

  // ----------------------------------------------------------------- time --
  const TM = '(\\d{1,2})(?::(\\d{2}))?\\s*(a\\.?m\\.?|p\\.?m\\.?)?';
  const RANGE_RE = new RegExp('(\\bfrom\\s+)?\\b' + TM + '\\s*(?:to|-|–|—|until|till|til)\\s*' + TM +
    '(?!\\s*(?:hours?|hrs?|mins?|minutes?)\\b)(?![\\d:])', 'i');
  const SINGLE_RE = new RegExp('\\b(at|by|before|@)\\s*' + TM + '(?![\\d:])|\\b(\\d{1,2})(?::(\\d{2}))?\\s*(a\\.?m\\.?|p\\.?m\\.?)', 'i');

  const to24 = (h, mer) => (/^p/i.test(mer) ? (h % 12) + 12 : h % 12);

  function parseTimes(s, evening) {
    let m = s.match(RANGE_RE);
    if (m) {
      const [, from, h1s, m1s, mer1, h2s, m2s, mer2] = m;
      const h1 = +h1s, h2 = +h2s, m1 = +(m1s || 0), m2 = +(m2s || 0);
      if (h1 <= 24 && h2 <= 24 && (from || mer1 || mer2 || m1s || m2s || evening)) {
        let sH = mer1 ? to24(h1, mer1) : null;
        let eH = mer2 ? to24(h2, mer2) : null;
        if (sH == null && eH == null) {
          if (evening) { sH = (h1 % 12) + 12; eH = (h2 % 12) + 12; } else { sH = h1 >= 1 && h1 <= 6 ? h1 + 12 : h1; }
        }
        if (sH == null) {
          const pmCand = (h1 % 12) + (eH >= 12 ? 12 : 0);
          sH = pmCand * 60 + m1 < eH * 60 + m2 ? pmCand : h1 % 12;
        }
        if (eH == null) { eH = h2; while (eH * 60 + m2 <= sH * 60 + m1 && eH < 24) eH += 12; }
        let start = sH * 60 + m1, end = eH * 60 + m2;
        if (end <= start) end = Math.min(start + 12 * 60, 24 * 60);
        return { range: true, start, end: Math.min(end, 24 * 60), text: m[0] };
      }
    }
    m = s.match(SINGLE_RE);
    if (m) {
      const h = +(m[2] || m[5]), mi = +(m[3] || m[6] || 0), mer = m[4] || m[7];
      if (h > 24) return null;
      let H = mer ? to24(h, mer) : (evening || (h >= 1 && h <= 6) ? (h % 12) + 12 : h);
      return { range: false, start: H * 60 + mi, text: m[0], prefix: m[1] || null };
    }
    return null;
  }

  // ------------------------------------------------------------ splitting --
  const VERB_AHEAD = '(?=(?:i\\s+)?(?:also\\s+)?(?:need|have|got|must|should|gotta|study|buy|write|finish|prepare|do|read|review|submit|attend|go|pay|clean|call|meet|work|pick|get|make|complete|practice|send|email)\\b)';
  function splitClauses(text) {
    const out = [];
    const sentences = text.replace(/\s+/g, ' ').split(/(?<=[.!?;])\s+|\n+/);
    for (const sent of sentences) {
      const pieces = sent.split(/\s*,?\s*\b(?:and also|also|plus|another thing is|aside from that)\b\s*,?\s*/i);
      for (const piece of pieces) {
        for (const p of piece.split(new RegExp('\\s*,?\\s+and\\s+' + VERB_AHEAD, 'i'))) {
          const c = p.trim().replace(/^[,.;]+|[,.;!?]+$/g, '').trim();
          if (c.split(/\s+/).length >= 2 || /\w{4,}/.test(c)) out.push(c);
        }
      }
    }
    return out;
  }

  // ---------------------------------------------------------------- title --
  function buildTitle(clause, removeTexts, type) {
    let s = ' ' + clause + ' ';
    for (const t of removeTexts) if (t) s = s.replace(new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), ' ');
    s = s.replace(/\b(?:i think|i guess|it'?ll take|it will take|will take|should take|takes|should study|need to study|probably|maybe|really|actually|just|total|sometime|some time|in total)\b/gi, ' ');
    s = s.replace(/\b(for|of|on|in)\s+(?:my|our|the)\b/gi, '$1');
    s = s.replace(/[,;:]+/g, ' ').replace(/\s+/g, ' ').trim();
    const LEAD = [
      /^(?:and|so|but|then|also|plus|oh|ugh|ok|okay|hey|um|uh)\b\s*/i,
      /^(?:i|we)\s+(?:just\s+)?(?:found out|realized|learned|remembered|heard)\s+(?:that\s+)?/i,
      /^(?:i|we)(?:'ll|'ve|'m| will| also| still| really| just| now)*\s+(?:have|has|got|need|needs|must|should|gotta|want|wanna|going|have got)\s*(?:to\s+)?/i,
      /^(?:have|has|got|need|needs|must|should|gotta)\s+(?:to\s+)?/i,
      /^there(?:'s| is| are)\s+/i,
      /^(?:a|an|the|my|our|some|new|another|one more)\s+/i,
    ];
    for (let i = 0; i < 4; i++) for (const re of LEAD) s = s.replace(re, '');
    for (let i = 0; i < 3; i++) s = s.replace(/\s+(?:is|are|due|on|by|until|before|this|next|for|at|from|to|and|which|that)\s*$/i, '').trim();
    if (!s) return '';
    if ((type === 'exam' || type === 'quiz') && !/^(study|review|prepare|reviewing)/i.test(s)) s = 'Study for ' + s;
    return titleCase(s);
  }

  function extractContext(clause) {
    const m = clause.match(/\b(?:for|in)\s+(?:my\s+)?([A-Z]{2,}[A-Z0-9]*(?:\s\d{2,3}[A-Z]?)?)\b/);
    return m ? { code: m[1], text: m[0] } : null;
  }

  function extractParts(clause) {
    const m = clause.match(/\b(?:the\s+)?([a-z]+(?:\s[a-z]+)?)\s+and\s+(?:the\s+)?([a-z]+(?:\s[a-z]+)?)\s+(sections?|parts?|chapters?|portions?)\b/i);
    if (!m) return [];
    return [m[1], m[2]].map((p) => titleCase(p.replace(/^(?:do|write|finish|the)\s+/i, '')));
  }

  function defaultPriority(type, deadline, now, text) {
    if (/\b(urgent|asap|important|high priority|critical)\b/i.test(text)) return 'high';
    if (/\b(low priority|not urgent|whenever|no rush)\b/i.test(text)) return 'low';
    const hrs = deadline ? (deadline - now) / HOUR : Infinity;
    if (hrs <= 30) return 'high';
    if (type === 'project' || type === 'report') return 'high';
    if (type === 'exam' || type === 'quiz' || type === 'presentation') return 'medium';
    if (type === 'errand') return 'low';
    return hrs <= 72 ? 'medium' : 'low';
  }

  function deadlineFor(dayMs, time, type, ctx) {
    if (dayMs == null) return null;
    if (time && !time.range) return dayMs + time.start * T.MIN;
    // An exam must be studied for before the exam day starts.
    if (type === 'exam' || type === 'quiz') return T.at(dayMs, ctx.dayStartHm || '06:00');
    return T.at(dayMs, '23:59');
  }

  /** Suggest a breakdown into schedulable steps (BREAK DOWN stage). */
  function suggestParts(type, mins) {
    const plan = BREAKDOWNS[type];
    if (!plan || mins < 150) return [];
    let used = 0;
    return plan.map(([title, frac], i) => {
      const m = i === plan.length - 1 ? mins - used : Math.max(15, Math.round((mins * frac) / 15) * 15);
      used += m;
      return { title, mins: m, aiSuggested: true };
    });
  }

  // ------------------------------------------------------------- matching --
  function matchTask(clause, tasks, clauseType) {
    const ct = new Set(tokens(clause));
    let best = null, bestScore = 0;
    for (const t of tasks) {
      if (t.status === 'done' || t.status === 'cancelled') continue;
      if (clauseType && clauseType !== 'task' && t.type && t.type !== 'task' &&
          !(['exam', 'quiz'].includes(clauseType) && ['exam', 'quiz'].includes(t.type)) && clauseType !== t.type) continue;
      const tt = [...new Set(tokens(t.title + ' ' + (t.context || '')))];
      const shared = tt.filter((w) => ct.has(w)).length;
      const score = shared / Math.max(1, tt.length);
      if (shared >= 1 && (shared >= 2 || score >= 0.5) && score > bestScore) { best = t; bestScore = score; }
    }
    return best;
  }

  function matchOccurrences(clause, occs) {
    const lower = clause.toLowerCase();
    if (/\bclasses\b|\bno class\b/.test(lower)) return occs.filter((o) => o.kind === 'class');
    const ct = new Set(tokens(clause));
    const wantKind = /\b(work|shift|duty)\b/.test(lower) ? 'work' : /\b(org|organization|club)\b/.test(lower) ? 'org'
      : /\bclass\b/.test(lower) ? 'class' : null;
    const scored = occs.filter((o) => !o.soft).map((o) => {
      const shared = tokens(o.title).filter((w) => ct.has(w)).length + (wantKind && o.kind === wantKind ? 2 : 0);
      return { o, shared };
    }).filter((x) => x.shared > 0).sort((a, b) => b.shared - a.shared);
    if (!scored.length) return [];
    return scored.filter((x) => x.shared === scored[0].shared).map((x) => x.o);
  }

  // ------------------------------------------------- progress statements --
  /** "another hour", "30 more minutes", "an extra half hour" → minutes, else null. */
  function parseExtra(clause) {
    const lower = clause.toLowerCase();
    let m = lower.match(/\banother\s+(half(?:\s+an?)?\s+hour|hour|\d+(?:\.\d+)?\s*(?:hours?|hrs?|minutes?|mins?))/);
    if (m) {
      if (/half/.test(m[1])) return 30;
      if (m[1] === 'hour') return 60;
      const d = parseDuration(m[1]); return d ? d.mins : null;
    }
    m = lower.match(/\b(\d+(?:\.\d+)?|an?|one|two|three|four|five)\s+(?:more|extra|additional)\s+(hours?|hrs?|minutes?|mins?)\b/) ||
        lower.match(/\b(\d+(?:\.\d+)?|an?|one|two|three|four|five)\s+(hours?|hrs?|minutes?|mins?)\s+(?:more|longer|extra)\b/);
    if (m) { const n = numVal(m[1]); return Math.round(/^h/.test(m[2]) ? n * 60 : n); }
    m = lower.match(/\bhalf an? hour\s+(?:more|longer|extra)\b|\b(?:more|extra)\s+half an? hour\b/);
    return m ? 30 : null;
  }

  const ORDINALS = { first: 0, '1st': 0, second: 1, '2nd': 1, third: 2, '3rd': 2, fourth: 3, '4th': 3 };
  /** Which part of `task` does the clause say is finished? By name, by ordinal, else the next pending one. */
  function matchPart(clause, task) {
    const parts = task.parts || [];
    if (!parts.length) return null;
    const ct = new Set(tokens(clause));
    const byName = parts.find((p) => !p.done && tokens(p.title).some((w) => ct.has(w)));
    if (byName) return byName;
    const ord = clause.toLowerCase().match(/\b(first|1st|second|2nd|third|3rd|fourth|4th|last)\b/);
    if (ord) return ord[1] === 'last' ? parts[parts.length - 1] : parts[ORDINALS[ord[1]]] || null;
    return parts.find((p) => !p.done) || null;
  }
  const PART_RE = /\b(part|step|section|half|chunk|portion|milestone)\b/i;
  const currentTask = (ctx, tasks) => (ctx.currentTaskId ? tasks.find((t) => t.id === ctx.currentTaskId && t.status !== 'done' && t.status !== 'cancelled') : null) || null;

  // ------------------------------------------------------------ main parse --
  function eventTitle(clause) {
    const lower = clause.toLowerCase();
    if (/\b(work|working|shift|duty|boss|manager)\b/.test(lower)) return { title: 'Work shift', kind: 'work' };
    if (/\b(org|organization|club)\b/.test(lower)) return { title: 'Org meeting', kind: 'org' };
    const m = clause.match(/\b((?:[A-Za-z0-9]+\s+){0,2}?(?:meeting|session|practice|rehearsal|appointment|interview|seminar|orientation|training|event|game|consultation|defense|lecture|webinar|class))\b/i);
    if (m) {
      const t = m[1].replace(/^(?:(?:i|we|have|has|got|a|an|the|my|our|to|attend|go|a\s+)\s+)+/i, '');
      return { title: titleCase(t), kind: 'event' };
    }
    return { title: 'Commitment', kind: 'event' };
  }

  // ------------------------------------------- commands on existing tasks --
  // "Move X to 8 PM", "Change X to 2 hours", "Rename X to Y", "Remove X", "Mark X as done"…
  // Rule-based patterns, not a language model. Each command becomes a structured intent that names
  // one saved task by id; nothing here changes the task. An unknown or ambiguous title becomes a
  // question, never a new task and never a guess at the first match.
  const norm = (x) => String(x).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const isOpen = (t) => t.status !== 'done' && t.status !== 'cancelled';
  const AMBIGUITY_MARGIN = 0.15;   // two tasks this close in match score are treated as "could be either"

  /** → { task } | { ambiguous: [tasks] } | { closed: task } | { none: true } */
  function resolveTask(phrase, tasks) {
    const p = ` ${norm(phrase)} `;
    const scan = (pool) => {
      // 1. The full title appears in the text: the longest such title wins; two equal ones are ambiguous.
      const exact = pool.filter((t) => norm(t.title) && p.includes(` ${norm(t.title)} `));
      if (exact.length) {
        const longest = Math.max(...exact.map((t) => norm(t.title).length));
        return exact.filter((t) => norm(t.title).length === longest);
      }
      // 2. Shared title words, with the same threshold matchTask uses.
      const ct = new Set(tokens(phrase));
      const scored = pool.map((t) => {
        const tt = [...new Set(tokens(t.title + ' ' + (t.context || '')))];
        const shared = tt.filter((w) => ct.has(w)).length;
        return { t, shared, score: shared / Math.max(1, tt.length) };
      }).filter((x) => x.shared >= 1 && (x.shared >= 2 || x.score >= 0.5)).sort((a, b) => b.score - a.score);
      return scored.filter((x) => x.score >= scored[0].score - AMBIGUITY_MARGIN).map((x) => x.t);
    };
    const open = scan(tasks.filter(isOpen));
    if (open.length === 1) return { task: open[0] };
    if (open.length > 1) return { ambiguous: open };
    const closed = scan(tasks.filter((t) => !isOpen(t)));
    return closed.length ? { closed: closed[0] } : { none: true };
  }

  const describeTask = (t, ctx) => {
    const first = (ctx.plan || []).filter((x) => x.taskId === t.id).sort((a, b) => a.start - b.start)[0];
    return `"${t.title}" (${t.deadline != null ? 'due ' + T.short(t.deadline) : 'no deadline'}${first ? ', planned ' + T.short(first.start) + ' ' + T.time(first.start) : ''})`;
  };
  const openTitles = (tasks) => tasks.filter(isOpen).slice(0, 6).map((t) => `"${t.title}"`).join(', ');

  const LEAD_RE = /^(?:(?:hey|hi|ok|okay)[, ]+(?:sikad[,:]?\s*)?)?(?:please\s+|kindly\s+)?(?:(?:can|could|would|will)\s+you\s+(?:please\s+)?|i\s+(?:want|need|would like)\s+(?:you\s+)?to\s+|i'?d\s+like\s+(?:you\s+)?to\s+|let'?s\s+)?(?:please\s+)?/i;
  const CMD_VERBS = 'move|reschedule|resched|schedule|shift|push|put|set|change|update|make|rename|remove|delete|mark|edit|keep|don\'?t|give';
  const CMD_SPLIT = new RegExp('\\s*,?\\s+(?:and then|then|and|but)\\s+(?=(?:also\\s+)?(?:' + CMD_VERBS + ')\\b)', 'i');
  const PRONOUN_RE = /\b(it|its|it's|this task|that task|this one|that one)\b/i;
  const SRC_TIME_RE = /\b(?:my|the)\s+(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?))\s+(?:[a-z]+\s+){0,2}?(?:task|session|block|work)\b/i;
  const DIFF_WORDS = { hard: 'hard', difficult: 'hard', tough: 'hard', challenging: 'hard', easy: 'easy', simple: 'easy', light: 'easy', medium: 'medium', moderate: 'medium', normal: 'medium' };
  const PRIO_WORDS = { high: 'high', top: 'high', urgent: 'high', medium: 'medium', normal: 'medium', low: 'low' };
  const OVERRUN_RE = /\b(?:took|taking|takes|ran|running|went|going)\s+(?:way\s+|much\s+|a (?:bit|lot)\s+)?(?:longer|over|overtime)\b|\boverran\b|\bover ?ran\b/i;
  const QUESTION_LEAD_RE = /^(?:show|list|display|find|tell me|what|which|when|where|how|why|who)\b/i;
  const HELP_TEXT = 'Try one of these: "Move <task> to 8 PM tomorrow", "Change <task> to 2 hours", "Change the deadline for <task> to Friday 5 PM", "Rename <task> to …", "Remove <task>", "Mark <task> as done", or ask "What is due tomorrow?"';

  /**
   * One sentence part → intents, or null when it is not a command on an existing task
   * (the caller then reads it as a new task, a commitment or a progress report, as before).
   * `mem.ref` is the task the message has already named, so "it" has one clear meaning.
   */
  function taskCommand(seg, ctx, mem, hasMore) {
    const body = seg.trim().replace(/[.!?;,]+$/, '').replace(LEAD_RE, '');
    const lower = body.toLowerCase();
    const tasks = ctx.tasks || [], now = ctx.now;
    if (!body) return null;
    if (ACADEMIC_REQ_RE.test(seg) && ACADEMIC_NOUN_RE.test(seg)) return null;
    if (NEXT_RE.test(lower)) return null;

    // "…but keep the full duration": always true here, so there is nothing to change.
    if (/^(?:keep|don'?t\s+(?:shorten|cut|change|split))\b/.test(lower) && /\b(duration|length|time|it|session|full)\b/.test(lower)) return mem.ref ? [] : null;
    // A question that reached the command parser was not one Ask SIKAD can answer: never turn it into a task.
    if (QUESTION_LEAD_RE.test(lower)) return [{ type: 'unclear', code: 'QUESTION', question: `I don't have an answer for that yet. ${HELP_TEXT}` }];

    const srcM = body.match(SRC_TIME_RE);
    const resolve = (text) => {
      if (srcM) {
        const tm = parseTimes('at ' + srcM[1]);
        const hits = (ctx.plan || []).filter((x) => x.start > now - 60 * T.MIN && (x.start - T.dayStart(x.start)) / T.MIN === tm.start);
        const today = hits.filter((x) => T.dayStart(x.start) === T.dayStart(now));
        const ids = [...new Set((today.length ? today : hits).map((x) => x.taskId))];
        if (ids.length === 1) return { task: tasks.find((t) => t.id === ids[0]) };
        if (ids.length > 1) return { ambiguous: ids.map((id) => tasks.find((t) => t.id === id)) };
        return { none: true, phrase: srcM[0] };
      }
      const r = resolveTask(text, tasks);
      if (r.none && PRONOUN_RE.test(text)) {
        if (mem.ref && isOpen(mem.ref)) return { task: mem.ref };
        if (/\bthis task\b/i.test(text) && currentTask(ctx, tasks)) return { task: currentTask(ctx, tasks) };
        return { pronoun: true };
      }
      return r;
    };
    const phraseOf = (text) => text.replace(/^(?:\w+\s+)(?:the\s+(?:deadline|due date|duration|name|title|difficulty|priority)\s+(?:of|for)\s+)?/i, '').split(/\s+(?:to|at|for|from|as|by|if|on)\s+/i)[0].replace(/^(?:my|the)\s+/i, '').trim();
    const fail = (r, text, what) => {
      if (r.ambiguous) return [{ type: 'unclear', code: 'TASK_AMBIGUOUS', candidates: r.ambiguous.map((t) => t.id), question: `Which task do you mean: ${r.ambiguous.map((t) => describeTask(t, ctx)).join(' or ')}? Say its full name and I'll ${what}.` }];
      if (r.closed) return [{ type: 'unclear', code: 'TASK_CLOSED', taskId: r.closed.id, question: `"${r.closed.title}" is already ${r.closed.status === 'done' ? 'marked done' : 'removed'}, so there is nothing to ${what.split(' ')[0]}.` }];
      if (r.pronoun) return [{ type: 'unclear', code: 'TASK_UNNAMED', question: `Which task do you mean? Name it and I'll ${what}. ${openTitles(tasks) ? 'Your open tasks: ' + openTitles(tasks) + '.' : 'You have no open tasks.'}` }];
      const named = r.phrase || phraseOf(text);
      return [{ type: 'unclear', code: 'TASK_NOT_FOUND', question: `I couldn't find a task called "${named}", so nothing was changed and no new task was added. ${openTitles(tasks) ? 'Your open tasks: ' + openTitles(tasks) + '.' : 'You have no open tasks.'}` }];
    };
    const hit = (t) => { mem.ref = t; return t; };
    let m;

    // Rename.
    if ((m = body.match(/^(?:rename|retitle)\s+(.+?)\s+(?:to|as)\s+["“']?(.+?)["”']?$/i)) || (m = body.match(/^(?:change|set|update|edit)\s+the\s+(?:name|title)\s+(?:of|for)\s+(.+?)\s+(?:to|as)\s+["“']?(.+?)["”']?$/i))) {
      const r = resolve(m[1]);
      if (!r.task) return fail(r, body, 'rename it');
      const t = hit(r.task), newTitle = m[2].trim();
      if (newTitle.length < 2) return [{ type: 'unclear', question: `What should "${t.title}" be called?` }];
      return [{ type: 'rename', taskId: t.id, title: t.title, newTitle }];
    }
    // Remove.
    if ((m = body.match(/^(?:remove|delete|scrap|get rid of)\s+(.+?)(?:\s+(?:from|off|out of)\s+(?:my\s+|the\s+)?(?:tasks?|task list|plan|list|schedule|to-?dos?))?$/i)) || (m = body.match(/^take\s+(.+?)\s+(?:off|out of)\s+(?:my\s+|the\s+)?(?:tasks?|task list|plan|list|schedule)$/i))) {
      const r = resolve(m[1]);
      if (!r.task) return fail(r, body, 'remove it');
      const t = hit(r.task);
      return [{ type: 'cancel_task', taskId: t.id, title: t.title }];
    }
    // Difficulty and priority ("mark X as hard", "set X to high priority").
    if ((m = lower.match(/^(?:mark|set|make|change|flag)\s+(.+?)\s+(?:as|to)\s+(?:an?\s+)?(hard|difficult|tough|challenging|easy|simple|light|medium|moderate|normal)(?:\s+(?:task|difficulty|one))?$/)) ||
        (m = lower.match(/^(?:set|change|update)\s+the\s+difficulty\s+(?:of|for)\s+(.+?)\s+to\s+(\w+)$/))) {
      if (DIFF_WORDS[m[2]]) {
        const r = resolve(m[1]);
        if (!r.task) return fail(r, body, 'set its difficulty');
        const t = hit(r.task);
        return [{ type: 'set_difficulty', taskId: t.id, title: t.title, difficulty: DIFF_WORDS[m[2]], oldDifficulty: t.difficulty || 'medium' }];
      }
    }
    if ((m = lower.match(/^(?:mark|set|make|change|flag)\s+(.+?)\s+(?:as|to)\s+(high|top|urgent|medium|normal|low)(?:\s+priority)?$/)) ||
        (m = lower.match(/^(?:set|change|update)\s+the\s+priority\s+(?:of|for)\s+(.+?)\s+to\s+(\w+)$/))) {
      if (PRIO_WORDS[m[2]] && (/priority/.test(lower) || !DIFF_WORDS[m[2]])) {
        const r = resolve(m[1]);
        if (!r.task) return fail(r, body, 'set its priority');
        const t = hit(r.task);
        return [{ type: 'set_priority', taskId: t.id, title: t.title, priority: PRIO_WORDS[m[2]], oldPriority: t.priority }];
      }
    }
    // Mark done.
    if ((m = body.match(/^mark\s+(.+?)\s+(?:as\s+)?(?:done|complete|completed|finished)$/i))) {
      const r = resolve(m[1]);
      if (!r.task) return fail(r, body, 'mark it done');
      const t = hit(r.task);
      return [{ type: 'complete', taskId: t.id, title: t.title }];
    }

    const editVerb = /^(?:change|set|update|make|edit|move|push|extend|adjust)\b/.test(lower);
    // Deadline ("change the deadline for X to Friday at 5 PM"). Only the deadline changes, never the planned time.
    if (editVerb && /\b(deadline|due date|due)\b/.test(lower)) {
      const r = resolve(body);
      if (!r.task) return fail(r, body, 'change its deadline');
      const t = hit(r.task);
      const date = parseDate(body, now), time = parseTimes(body, date && date.evening);
      if (!date) return [{ type: 'unclear', code: 'DEADLINE_WHEN', taskId: t.id, question: `What is the new deadline for "${t.title}"? Give the day, and a time if it matters (for example "Friday at 5 PM").` }];
      return [{ type: 'deadline_change', taskId: t.id, title: t.title, deadline: deadlineFor(date.day, time, t.type, ctx), oldDeadline: t.deadline }];
    }
    // Ran over ("X took longer than expected"): the remaining time is the student's to say.
    if (OVERRUN_RE.test(lower)) {
      const r = resolve(body);
      if (!r.task) return r.none ? [{ type: 'unclear', code: 'TASK_UNNAMED', question: 'Which task ran over, and about how much time does it still need?' }] : fail(r, body, 'replan the rest');
      const t = hit(r.task);
      const left = /\b(still|left|remaining|to go|more)\b/.test(lower) ? parseDuration(body) : null;
      return [{ type: 'partial', taskId: t.id, title: t.title, remainingMins: left ? left.mins : null }];
    }
    // Duration ("change X to 2 hours", "set the estimate for X to 90 minutes").
    const dur = parseDuration(body);
    if (dur && !parseExtra(body) && !/\b(more|another|extra|additional|longer)\b/.test(lower) &&
        (editVerb || /^give\b/.test(lower) || /\b(?:takes|should take|will take)\b/.test(lower)) && !/\bdue\b/.test(lower) && !parseTimes(body.replace(dur.text, ''))) {
      const r = resolve(body.replace(dur.text, ''));
      if (!r.task) return editVerb ? fail(r, body, 'change its time needed') : null;
      const t = hit(r.task);
      return [{ type: 'set_duration', taskId: t.id, title: t.title, mins: dur.mins }];
    }
    // Schedule or reschedule ("move X to 8 PM if it fits", "schedule X for tomorrow", "next available slot").
    const strongMove = /^(?:move|reschedule|resched|shift|push)\b/.test(lower);
    const softMove = /^(?:schedule|put|do|start|plan|slot)\b/.test(lower) || /^(?:set|change|update|edit)\b.*\b(?:schedule|start time|time slot|slot)\b/.test(lower);
    if (strongMove || softMove) {
      const rest = srcM ? body.replace(srcM[0], ' ') : body;
      const date = parseDate(rest, now), time = parseTimes(rest, date && date.evening);
      if (time && time.range) return null;                                   // "from 6 to 10" is a commitment, not a task move
      const r = resolve(body);
      if (!r.task) {
        if (r.none && !srcM) {
          if (/\b(rest|remaining|everything|all my|today'?s (?:work|tasks|plan)|my (?:day|plan|schedule|tasks))\b/.test(lower)) return mem.ref ? [] : [{ type: 'replan' }];
          if (softMove || EVENT_RE.test(lower)) return null;
        }
        return fail(r, body, 'move it');
      }
      const t = hit(r.task);
      const base = { type: 'move', taskId: t.id, title: t.title, ifFits: /\bif (?:it|that) fits\b|\bif possible\b|\bif there'?s (?:room|time)\b/.test(lower), start: null, day: null, auto: false };
      if (/\b(next|first|earliest|soonest|best)\s+(?:available|open|free|possible)?\s*(?:slot|block|time|opening)\b|\bas soon as possible\b|\basap\b/.test(lower)) return [Object.assign(base, { auto: true })];
      if (time && date) return [Object.assign(base, { start: date.day + time.start * T.MIN })];
      if (date) return [Object.assign(base, { day: date.day })];
      if (time) {
        // A time with no day: use the task's planned day only when it has exactly one and the time is still ahead.
        const days = [...new Set((ctx.plan || []).filter((x) => x.taskId === t.id).map((x) => T.dayStart(x.start)))];
        const start = days.length === 1 ? days[0] + time.start * T.MIN : null;
        if (start != null && start > now) return [Object.assign(base, { start })];
        return [{ type: 'unclear', code: 'DAY_AMBIGUOUS', taskId: t.id, question: `Which day should "${t.title}" start at ${T.time(T.dayStart(now) + time.start * T.MIN)}? Say the day too, for example "today at ${T.time(T.dayStart(now) + time.start * T.MIN)}" or "tomorrow at ${T.time(T.dayStart(now) + time.start * T.MIN)}".` }];
      }
      return [{ type: 'unclear', code: 'MOVE_WHEN', taskId: t.id, question: `When should "${t.title}" move to? Give a day or a time, or say "the next available slot".` }];
    }
    // "Edit X" with nothing else: remember the task for "…and set its schedule to 8 PM".
    if ((m = body.match(/^(?:edit|update|change|modify|adjust)\s+(.+)$/i))) {
      const r = resolve(m[1]);
      if (r.task) { hit(r.task); return hasMore ? [] : [{ type: 'unclear', code: 'EDIT_WHAT', taskId: r.task.id, question: `What should change on "${r.task.title}"? I can change its time, deadline, time needed, name, difficulty or priority.` }]; }
      if (r.ambiguous || r.closed) return fail(r, body, 'edit it');
    }
    return null;
  }

  function parse(text, ctx) {
    const now = ctx.now;
    const tasks = ctx.tasks || [];
    const result = { input: text, intents: [] };
    if (!text || !text.trim()) return result;
    let lastTaskIntent = null;
    let stress = false;

    // Commands on existing tasks are read a sentence at a time; everything else is read clause by clause as before.
    const mem = { ref: null };
    for (const sent of text.replace(/\s+/g, ' ').split(/(?<=[.!?;])\s+|\n+/)) {
      const segs = sent.split(CMD_SPLIT).filter((x) => x && x.trim());
      segs.forEach((seg, i) => {
        const prev = result.intents[result.intents.length - 1];
        // "…; I still need about 45 minutes" completes the progress report before it.
        const left = /\b(still need|still have|left|remaining|to go)\b/i.test(seg) && !EVENT_RE.test(seg) ? parseDuration(seg) : null;
        if (left && prev && prev.type === 'partial' && prev.remainingMins == null && !resolveTask(seg, tasks).task) { prev.remainingMins = left.mins; return; }
        const cmd = taskCommand(seg, Object.assign({}, ctx, { tasks }), mem, i < segs.length - 1);
        if (cmd) { result.intents.push(...cmd); return; }
        const before = result.intents.length;
        for (const clause of splitClauses(seg)) readClause(clause);
        const named = result.intents.slice(before).map((x) => x.taskId && tasks.find((t) => t.id === x.taskId)).filter(Boolean);
        if (named.length === 1) mem.ref = named[0];
      });
    }
    finish();
    return result;

    function readClause(clause) {
      const lower = clause.toLowerCase();
      if (STRESS_RE.test(lower)) stress = true;

      // §19 Academic guardrail — refuse to produce graded work, offer a breakdown instead.
      if (ACADEMIC_REQ_RE.test(clause) && ACADEMIC_NOUN_RE.test(clause)) {
        const noun = clause.match(ACADEMIC_NOUN_RE)[1].toLowerCase();
        const subj = clause.match(/\b(?:my|the|this)\s+((?:[\w-]+\s+){0,3}?)(essay|paper|homework|assignment|report|thesis|worksheet|code|program|reflection|proposal|lab)\b/i);
        result.intents.push({ type: 'refuse', noun, subject: subj ? titleCase((subj[1] + subj[2]).trim()) : titleCase(noun), breakdown: academicBreakdown(noun) });
        return;
      }
      if (NEXT_RE.test(lower)) { result.intents.push({ type: 'next' }); return; }

      const flagAmbiguous = !EVENT_RE.test(lower) || /\bdue\b/.test(lower);
      const date = parseDate(clause, now, { flagAmbiguous });
      const time = parseTimes(clause, date && date.evening);
      const { type: ctype, est } = classify(clause);
      const recurring = RECUR_RE.test(lower);

      // Cancellations of commitments or tasks.
      if (CANCEL_RE.test(lower) || /\bdon'?t need to\b.*\banymore\b|\bno need to\b/.test(lower)) {
        const day = date ? date.day : T.dayStart(now);
        const occs = matchOccurrences(clause, ctx.occurrencesFor ? ctx.occurrencesFor(day) : []);
        if (occs.length) { result.intents.push({ type: 'cancel_occurrence', day, occurrences: occs }); return; }
        const t = matchTask(clause, tasks);
        if (t) { result.intents.push({ type: 'cancel_task', taskId: t.id, title: t.title }); return; }
        result.intents.push({ type: 'unclear', question: `Which commitment was cancelled${date ? ' on ' + T.short(day) : ''}? Tell me its name (e.g. "my IT 302 class" or "my org meeting").` });
        return;
      }

      // Deadline change ("the proposal deadline moved to Thursday").
      if (CHANGE_RE.test(lower) && /\b(deadline|due|moved to|pushed to|extended)\b/.test(lower) && !time?.range) {
        const t = matchTask(clause, tasks);
        if (t && date) {
          const dl = deadlineFor(date.day, time, t.type, ctx);
          result.intents.push({ type: 'deadline_change', taskId: t.id, title: t.title, deadline: dl, oldDeadline: t.deadline });
          return;
        }
      }

      // More time needed ("I need another hour to finish this task").
      const extra = !time ? parseExtra(clause) : null;
      if (extra && /\b(need|needs|take|takes|add|give|finish|complete|more time)\b/.test(lower)) {
        const t = matchTask(clause, tasks) || currentTask(ctx, tasks);
        if (t) result.intents.push({ type: 'extend', taskId: t.id, title: t.title, addMins: extra });
        else result.intents.push({ type: 'unclear', question: `Which task needs ${T.dur(extra)} more? Name it, e.g. "The database proposal needs another hour."` });
        return;
      }
      // Part of a task finished ("I finished the first part of my project").
      if (DONE_RE.test(lower) && !NEG_RE.test(lower) && PART_RE.test(lower)) {
        const candidates = tasks.filter((x) => x.status !== 'done' && x.status !== 'cancelled' && (x.parts || []).some((pp) => !pp.done));
        const ct = new Set(tokens(clause));
        const byPartName = candidates.filter((x) => x.parts.some((pp) => !pp.done && tokens(pp.title).some((w) => ct.has(w))));
        const cur = currentTask(ctx, tasks);
        const t = matchTask(clause, tasks) || (byPartName.length === 1 ? byPartName[0] : null) ||
          (cur && candidates.includes(cur) ? cur : null) || (candidates.length === 1 ? candidates[0] : null) || (candidates.length === 0 ? cur : null);
        if (t) {
          const part = matchPart(clause, t);
          if (part && !part.done) result.intents.push({ type: 'complete_part', taskId: t.id, title: t.title, partId: part.id, partTitle: part.title });
          else result.intents.push({ type: 'partial', taskId: t.id, title: t.title, remainingMins: null });
        } else {
          result.intents.push({ type: 'unclear', question: 'Which task did you finish part of? Name it, e.g. "I finished the first part of the database proposal."' });
        }
        return;
      }
      // Missed / unfinished work.
      if (NEG_RE.test(lower) && /\b(finish|complete|do|start|get to|study|work on|make it)\b/.test(lower)) {
        const t = matchTask(clause, tasks);
        if (t) { result.intents.push({ type: 'missed', taskId: t.id, title: t.title }); return; }
      }
      // Completion.
      if (DONE_RE.test(lower) && !NEG_RE.test(lower)) {
        const t = matchTask(clause, tasks);
        if (t) { result.intents.push({ type: 'complete', taskId: t.id, title: t.title }); return; }
      }

      // Time-bound commitments (temporary by default, recurring only if stated — §14).
      if (time && (time.range || (EVENT_RE.test(lower) && time.prefix === 'at')) && !/\bdue\b/.test(lower)) {
        const dur = parseDuration(clause);
        const startM = time.start;
        const endM = time.range ? time.end : startM + (dur ? dur.mins : 60);
        const { title, kind } = eventTitle(clause);
        if (recurring) {
          const days = [...lower.matchAll(new RegExp('\\b' + WD_SRC + 's?\\b', 'gi'))].map((x) => WD[x[1]]);
          if (/\bweekdays\b/.test(lower)) days.push(1, 2, 3, 4, 5);
          const uniq = [...new Set(days.length ? days : [T.dow(date ? date.day : now)])];
          result.intents.push({ type: 'event', recurring: true, event: { title, kind, days: uniq, start: T.minsToHm(startM), end: T.minsToHm(Math.min(endM, 1439)) } });
        } else {
          let day = date ? date.day : T.dayStart(now);
          if (!date && day + endM * T.MIN <= now) day += DAY; // "work 6-10" said at 11 PM means tomorrow
          result.intents.push({ type: 'event', recurring: false, durationEstimated: !time.range && !dur,
            event: { title, kind, start: day + startM * T.MIN, end: day + endM * T.MIN } });
        }
        return;
      }

      // Task capture.
      const dur = parseDuration(clause);
      const context = extractContext(clause);
      const parts = extractParts(clause);
      // Dependency ("…after the database proposal"): only when the phrase names a known or just-captured task.
      let dependsOn = null;
      const depM = clause.match(/[,;]?\s*\b(?:after|once)\s+(?:i\s+(?:finish|complete|am done with|'m done with)\s+|finishing\s+|completing\s+)?(?:the\s+|my\s+)?([^,.;]+?)(?:\s+is\s+(?:done|finished|complete))?\s*$/i);
      if (depM && !/^\d|\b(class|lunch|dinner|school|work)\b/i.test(depM[1])) {
        const pool = tasks.concat(result.intents.filter((i) => i.type === 'task').map((i, n) => ({ id: `new:${n}`, title: i.task.title, context: i.task.context, status: 'pending' })));
        const target = matchTask(depM[1], pool);
        if (target) dependsOn = { id: target.id, title: target.title, text: depM[0] };
      }
      const removeTexts = [dependsOn && dependsOn.text, date && date.text, dur && dur.text, time && time.text, context && context.text];
      let title = buildTitle(clause, removeTexts, ctype);
      if (context && title && !/\s/.test(title)) title = `${context.code} ${title}`;
      const looksLikeTask = ctype !== 'task' || dur || /\b(due|need to|have to|must|should|gotta|deadline)\b/i.test(lower);

      // Continuation of the previous task ("I need to do the methodology and results sections, ~3 hours").
      const isContinuation = lastTaskIntent && !date && (
        /^(?:and\s+)?(?:it|that|this|which)\b/i.test(clause) || /^(?:it'?ll|probably|about|around|should take|takes)\b/i.test(clause) ||
        (parts.length && ctype === 'task') ||
        (ctype !== 'task' && ctype === lastTaskIntent.task.type && !matchTask(clause, tasks, ctype)));
      if (isContinuation) {
        const lt = lastTaskIntent.task;
        if (parts.length) lt.parts = parts.map((p) => ({ title: p, mins: 0 }));
        if (dur) { lt.durationMins = dur.mins; lt.isAiEstimate = false; }
        if (lt.parts.length) splitPartMins(lt);
        return;
      }

      // Existing task mentioned again → answer, duplicate, or contradiction (§18).
      const ownText = dependsOn ? clause.replace(dependsOn.text, '') : clause; // don't match the task it depends on
      const existing = looksLikeTask || date ? matchTask(ownText, tasks, ctype) : null;
      if (existing && !parts.length) {
        if (date && !date.ambiguous) {
          const dl = deadlineFor(date.day, time, existing.type, ctx);
          if (existing.deadline == null) {
            result.intents.push({ type: 'deadline_change', taskId: existing.id, title: existing.title, deadline: dl, oldDeadline: null });
          } else if (T.dayStart(dl) !== T.dayStart(existing.deadline)) {
            result.intents.push({ type: 'contradiction', taskId: existing.id, title: existing.title, deadline: dl, oldDeadline: existing.deadline,
              question: `You previously said "${existing.title}" was due ${T.short(existing.deadline)}. Has the date changed to ${T.short(dl)}, or did I misunderstand?` });
          } else {
            result.intents.push({ type: 'duplicate', taskId: existing.id, title: existing.title });
          }
        } else {
          result.intents.push({ type: 'duplicate', taskId: existing.id, title: existing.title });
        }
        return;
      }

      if (!looksLikeTask || !title || title.length < 3) {
        if (!STRESS_RE.test(lower)) result.intents.push({ type: 'unclear' });
        return;
      }

      const deadline = date && !date.ambiguous ? deadlineFor(date.day, time, ctype, ctx) : null;
      const durationMins = dur ? dur.mins : est;
      const task = {
        title, type: ctype, context: context ? context.code : null,
        deadline, deadlineIsWeekEnd: !!(date && date.weekEnd),
        durationMins, isAiEstimate: !dur,
        priority: defaultPriority(ctype, deadline, now, clause),
        difficulty: /\b(hard|difficult|tough|challenging|tricky)\b/i.test(clause) ? 'hard' : /\b(easy|simple|quick|short)\b/i.test(clause) ? 'easy' : 'medium',
        parts: parts.map((p) => ({ title: p, mins: 0 })),
        dependencies: dependsOn && !dependsOn.id.startsWith('new:') ? [dependsOn.id] : [],
        dependsOnTitle: dependsOn ? dependsOn.title : null,
      };
      if (task.parts.length) splitPartMins(task);
      else task.parts = suggestParts(ctype, durationMins);

      let clarification = null, ambiguous = null;
      if (date && date.ambiguous) {
        ambiguous = date.ambiguous.map((o) => ({ label: o.label, deadline: deadlineFor(o.day, time, ctype, ctx) }));
        const [a, b] = date.ambiguous;
        clarification = `By "${date.text.trim()}", do you mean ${a.label.replace(/^\w+/, (w) => w.toLowerCase())} or ${b.label.replace(/^Next/, 'next')}?`;
      } else if (!date) {
        const noun = ctype === 'exam' || ctype === 'quiz' ? title.replace(/^Study for\s+/i, '') : title;
        clarification = `When is ${/^the\b/i.test(noun) ? noun : 'the ' + noun.toLowerCase()} due? I need the date to schedule it.`;
        if (ctype === 'exam' || ctype === 'quiz') clarification = `When is the ${noun.toLowerCase()}? I need the date to schedule study time.`;
      }
      const intent = { type: 'task', task, clarification, ambiguous };
      result.intents.push(intent);
      lastTaskIntent = intent;
    }

    function finish() {
    const actionable = result.intents.filter((i) => !['unclear', 'duplicate'].includes(i.type));
    if (stress && !result.intents.some((i) => i.type === 'refuse')) {
      result.intents = result.intents.filter((i) => i.type !== 'unclear');
      result.intents.unshift({ type: 'stress' });
    } else if (!actionable.length && VAGUE_RE.test(text) && !result.intents.some((i) => i.type === 'duplicate')) {
      result.intents = [{ type: 'unclear' }];
    } else if (!result.intents.length) {
      result.intents.push({ type: 'unclear' });
    }
    // Collapse repeated "unclear" entries.
    let seenUnclear = false;
    result.intents = result.intents.filter((i) => (i.type === 'unclear' ? (seenUnclear ? false : (seenUnclear = true)) : true));
    if (result.intents.length > 1) result.intents = result.intents.filter((i) => i.type !== 'unclear' || i.question);
    }
  }

  function splitPartMins(task) {
    const n = task.parts.length;
    let used = 0;
    task.parts.forEach((p, i) => {
      p.mins = i === n - 1 ? task.durationMins - used : Math.round(task.durationMins / n / 15) * 15;
      used += p.mins;
    });
  }

  function academicBreakdown(noun) {
    if (/essay|paper|reflection/.test(noun)) return [['Write the outline', 20], ['Draft the body paragraphs', 45], ['Write intro + conclusion', 30], ['Review and polish', 15]];
    if (/report|proposal|thesis/.test(noun)) return [['Research & gather sources', 45], ['Outline', 30], ['Draft', 90], ['Review and polish', 30]];
    if (/code|program|lab/.test(noun)) return [['Plan the solution', 30], ['Implement', 90], ['Test & debug', 30]];
    if (/quiz|exam|test/.test(noun)) return [['Review notes', 45], ['Practice problems', 45], ['Self-check', 20]];
    return [['Review the instructions & notes', 20], ['Work through the problems', 40], ['Check your answers', 15]];
  }

  // ----------------------------------------------------- Phase 1 contract --
  const DAY_TOKEN_RE = /\b(MON(?:DAY)?|TUE(?:S(?:DAY)?)?|WED(?:NESDAY)?|THU(?:R(?:S(?:DAY)?)?)?|FRI(?:DAY)?|SAT(?:URDAY)?|SUN(?:DAY)?|MWF|TTH|MW|TF|WF)\b/gi;
  const COMBO = { MWF: [1, 3, 5], TTH: [2, 4], MW: [1, 3], TF: [2, 5], WF: [3, 5] };

  function parseSchedule(text) {
    const rows = [];
    for (const line of String(text).split(/\n+/)) {
      const tm = line.match(/(\d{1,2})[:.](\d{2})\s*(am|pm)?\s*(?:-|–|to)\s*(\d{1,2})[:.](\d{2})\s*(am|pm)?/i);
      const dayMatches = [...line.matchAll(DAY_TOKEN_RE)];
      if (!tm || !dayMatches.length) continue;
      const days = [];
      for (const d of dayMatches) {
        const tok = d[1].toUpperCase();
        if (COMBO[tok]) days.push(...COMBO[tok]); else days.push(WD[tok.slice(0, 3).toLowerCase()]);
      }
      const fix = (h, mer) => (mer ? to24(+h, mer) : (+h < 7 ? +h + 12 : +h));
      const start = T.minsToHm(fix(tm[1], tm[3]) * 60 + +tm[2]);
      const end = T.minsToHm(fix(tm[4], tm[6]) * 60 + +tm[5]);
      const modeM = line.match(/\b(FTF|F2F|FACE[- ]TO[- ]FACE|IN[- ]PERSON|ONSITE|ON-SITE|ONLINE|SYNC|ASYNC|VIRTUAL|REMOTE)\b/i);
      const mode = !modeM ? null : /ONLINE|SYNC|ASYNC|VIRTUAL|REMOTE/i.test(modeM[1]) ? 'Online' : 'In person';
      let title = line.replace(tm[0], ' ').replace(DAY_TOKEN_RE, ' ');
      if (modeM) title = title.slice(0, title.indexOf(modeM[1]) >= 0 ? title.indexOf(modeM[1]) : undefined);
      title = title.replace(/\b(?:RM|ROOM|CL|LAB|BLDG)[-\s]?[\w-]*\s*$/i, '').replace(/[|,;]+/g, ' ').replace(/\s+/g, ' ').trim();
      if (!title || title.length < 2) continue;
      for (const day of [...new Set(days)]) {
        rows.push({ title, day_of_week: T.DAY_NAMES[day], start_time: start, end_time: end, type: 'fixed', mode });
      }
    }
    return {
      extracted_commitments: rows,
      clarification_needed: rows.length ? null
        : "I couldn't find any class blocks in that. Each line needs a subject, a day (e.g. MON) and a time range (e.g. 07:00-10:00).",
    };
  }

  // ----------------------------------------------------- Phase 2 contract --
  function toPhase2(parsed, idFor) {
    const tasks = parsed.intents.filter((i) => i.type === 'task');
    const clar = tasks.map((i) => i.clarification).filter(Boolean);
    const unclear = parsed.intents.find((i) => i.type === 'unclear');
    return {
      extracted_tasks: tasks.map((i, n) => ({
        task_id: idFor ? idFor(i, n) : `temp_${String(n + 1).padStart(3, '0')}`,
        title: i.task.title,
        deadline: i.task.deadline != null ? T.toISO(i.task.deadline) : null,
        duration_mins: i.task.durationMins,
        is_ai_estimate: i.task.isAiEstimate,
        priority: i.task.priority,
        dependencies: i.task.dependencies,
      })),
      clarification_needed: clar.length ? clar.join(' ') : unclear ? unclearQuestion(unclear) : null,
    };
  }

  function unclearQuestion(i) {
    return i.question || 'I want to help! Can you tell me specifically what changed? For example: Did you miss a task? Get a new assignment? Have a schedule change?';
  }

  root.TempoParser = { resolveTask, parse, parseSchedule, toPhase2, parseDuration, parseDate, parseTimes, parseExtra, splitClauses, classify, suggestParts, unclearQuestion, titleCase, tokens, matchTask };
})(typeof window !== 'undefined' ? window : globalThis);
