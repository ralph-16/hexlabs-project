/*
 * SIKAD — UI layer. Renders the onboarding wizard, dashboard, week view,
 * task list, settings and bottom sheets, and wires user actions to the store.
 */
(function () {
  'use strict';
  const T = window.TempoTime, E = window.TempoEngine, P = window.TempoParser, S = window.TempoStore, D = window.TempoData;
  const F = window.TempoFocus, Assistant = window.TempoAssistant, M = window.TempoMotion;

  let state = S.load();
  let undoSnap = null;
  const ui = {
    tab: 'home', dayView: 'today', weekDay: null, sheet: null, toast: null, focusOnly: false,
    weekStart: null,    // Monday of the week shown in Overview; null = the current week
    offline: typeof navigator !== 'undefined' && navigator.onLine === false,
    askThread: [],      // answered questions shown in the Ask SIKAD panel (this visit only)
    dict: null,         // dictaphone state: { path, state, final, interim, note, error }
    focusPick: null,    // session id while the student is choosing a working method
    spotlightOff: false, // the student un-dimmed the screen during Focus Mode; the session keeps running
    dock: false,        // judge-tools panel open (judge mode only)
    sub: null,          // Profile sub-view: null (landing) | 'classes' | 'commitments'
    accOpen: {},        // weekday → true while its Class schedule section is expanded
    accJust: null,      // weekday whose section was just opened (plays the reveal once)
    integrationState: {}, // id → { status: idle|connecting|connected|error, account, lastSync, imported, error } (this visit only)
    ob: state.obDraft || freshOnboarding(),
  };
  ui.ob.extracting = false;   // a saved draft never resumes mid-read

  const $app = document.getElementById('app');
  const $sheet = document.getElementById('sheet-root');
  const $toast = document.getElementById('toast-root');

  function freshOnboarding() {
    return {
      step: 0, name: '', corText: '', classes: [], analysis: '', extracted: false, uploadNote: '',
      ls: { dayStart: '06:00', dayEnd: '22:00', commuteMins: 60, working: null, workDays: [6], workStart: '09:00', workEnd: '14:00',
        commuteCustom: false, org: null, orgs: [] },
      dumpText: '', review: null, genStep: 0,
    };
  }

  // -------------------------------------------------------------- helpers --
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const taskById = (id) => state.tasks.find((t) => t.id === id);
  const now = () => state.now;
  const PRI_LABEL = { high: 'High', medium: 'Medium', low: 'Low' };
  // Priority is a ranking, not a status: neutral chip + bar glyph (design.md §5.4).
  const PRI_BARS = { high: 3, medium: 2, low: 1 };
  const priChip = (p) => `<span class="chip pri" aria-label="${PRI_LABEL[p] || p} priority"><span class="pri-bars" aria-hidden="true">${[1, 2, 3].map((i) => `<i class="${i <= (PRI_BARS[p] || 0) ? '' : 'off'}"></i>`).join('')}</span>${PRI_LABEL[p] || p}</span>`;
  const estChip = () => '<span class="chip est" title="SIKAD guessed this from the task type. Tap the task to adjust.">AI estimate</span>';
  const approx = (mins) => (mins >= 600 ? `${Math.round(mins / 60)} hrs` : T.dur(mins));
  const hrs = (mins) => Math.round((mins / 60) * 100) / 100;
  const ICON = {
    home: '<svg viewBox="0 0 24 24"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 9.5V20h13V9.5"/></svg>',
    week: '<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
    tasks: '<svg viewBox="0 0 24 24"><path d="M9 6h11M9 12h11M9 18h11"/><path d="m3.5 6 1.2 1.2L7 5M3.5 12l1.2 1.2L7 11M3.5 18l1.2 1.2L7 17"/></svg>',
    user: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c1.2-4 4.2-5.6 7.5-5.6s6.3 1.6 7.5 5.6"/></svg>',
    lock: '<svg viewBox="0 0 24 24" class="i-lock"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    mic: '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>',
    // design.md §10 icon set (24px grid, 1.75 stroke, currentColor) — replaces emoji in system UI
    doc: '<svg viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>',
    info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.5"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
    question: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.6 9.5a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.2 1-1.2 1.8v.5M12 17v.5"/></svg>',
    alert: '<svg viewBox="0 0 24 24"><path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.5M12 17v.4"/></svg>',
    hourglass: '<svg viewBox="0 0 24 24"><path d="M7 3h10M7 21h10M8 3v3.5a4 4 0 0 0 1.6 3.2L12 12l2.4-2.3A4 4 0 0 0 16 6.5V3M8 21v-3.5a4 4 0 0 1 1.6-3.2L12 12l2.4 2.3a4 4 0 0 1 1.6 3.2V21"/></svg>',
    overlap: '<svg viewBox="0 0 24 24"><rect x="3.5" y="4" width="11" height="11" rx="2"/><rect x="9.5" y="9" width="11" height="11" rx="2"/></svg>',
    undo: '<svg viewBox="0 0 24 24"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>',
    step: '<svg viewBox="92 80 330 330"><path d="M149 366C250 345 345 285 268 241S290 150 366 123" stroke-width="26"/><circle cx="149" cy="366" r="37" fill="currentColor" stroke="none"/><circle cx="366" cy="123" r="37" fill="currentColor" stroke="none"/></svg>',   // one-colour route mark, geometry from icons/sikad.svg
    clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    bus: '<svg viewBox="0 0 24 24"><rect x="5" y="3.5" width="14" height="14" rx="2.5"/><path d="M5 11h14M8 17.5V20M16 17.5V20M8.5 14.5h.01M15.5 14.5h.01"/></svg>',
    meal: '<svg viewBox="0 0 24 24"><path d="M7 3v8M5 3v4a2 2 0 0 0 4 0V3M7 11v10M16 21V3c-2 1.5-3 4-3 7h3"/></svg>',
    sunrise: '<svg viewBox="0 0 24 24"><path d="M5 18a7 7 0 0 1 14 0M3 18h18M12 4v4M5.5 9.5 7 11M18.5 9.5 17 11"/></svg>',
    task: '<svg viewBox="0 0 24 24"><rect x="4" y="3.5" width="16" height="17" rx="2.5"/><path d="M8 9h8M8 13h8M8 17h5"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M8 5.5v13l10-6.5z"/></svg>',
    snooze: '<svg viewBox="0 0 24 24"><path d="M5 12h12M13 7l5 5-5 5"/></svg>',
    braindump: '<svg viewBox="0 0 24 24"><path d="M5 5h14a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 16h-8l-4.5 4v-4H5a1.5 1.5 0 0 1-1.5-1.5v-8A1.5 1.5 0 0 1 5 5z"/><path d="M8 9h8M8 12.5h5"/></svg>',
    chevron: '<svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="m15 6-6 6 6 6"/></svg>',
    // SIKAD route mark (geometry from icons/sikad.svg) for the Ask SIKAD button: takes the button's icon colour, Butter destination dot.
    mark: '<svg class="mark-icon" viewBox="92 80 330 330"><path d="M149 366C250 345 345 285 268 241S290 150 366 123" stroke-width="24"/><circle cx="149" cy="366" r="37" fill="currentColor" stroke="none"/><circle class="mark-next" cx="366" cy="123" r="29" stroke-width="16"/></svg>',
    more: '<svg viewBox="0 0 24 24"><path d="M12 5.5v.01M12 12v.01M12 18.5v.01" stroke-width="2.5"/></svg>',
    sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/></svg>',
    moon: '<svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
  };
  // SIKAD mark: a short path with the next step ahead of it (design.md §10).
  // Full logo (route mark + IKAD), same geometry as icons/sikad-whole.svg; colours come from the tokens.
  const LOCKUP = '<svg class="lockup" viewBox="45 66 552 242" aria-hidden="true"><path class="lk-route" pathLength="1" d="M80.765 272.938c75.791-15.359 147.08-59.242 89.299-91.424-57.782-32.181 16.509-66.556 73.54-86.304"/><circle class="lk-start" cx="80.765" cy="272.938" r="27.4"/><circle class="lk-next" cx="243.604" cy="95.21" r="21.5"/><path class="lk-letter" style="--i:0" d="M225.8 267V155.25h20.4V267z"/><path class="lk-letter" style="--i:1" d="M267.695 267V155.25h20.4v58.2l-5.55-1.95 47.55-56.25h25.65l-44.55 52.8 1.2-14.4 44.7 73.35h-24l-30-49.2-15 17.85V267z"/><path class="lk-letter" style="--i:2" d="M360.351 267l38.55-111.75h26.4L463.851 267h-22.2l-7.95-24h-43.2l-8.1 24zm36-42h31.5l-18.6-55.65h5.7z"/><path class="lk-letter" style="--i:3" d="M476.288 267V155.25h36.45q17.7 0 30.75 7.2 13.2 7.05 20.4 19.65 7.2 12.45 7.2 28.95 0 16.35-7.2 29.1-7.2 12.6-20.4 19.8-13.05 7.05-30.75 7.05zm20.4-18h16.5q11.4 0 19.65-4.65 8.4-4.8 13.05-13.2 4.65-8.55 4.65-20.1 0-11.7-4.65-20.1t-13.05-13.05q-8.25-4.65-19.65-4.65h-16.5z"/></svg>';
  const LOGO = '<svg class="logo" viewBox="0 0 48 48" aria-hidden="true"><path class="logo-path" d="M13.97 34.31C23.44 32.34 32.34 26.72 25.13 22.59S27.19 14.06 34.31 11.53"/><circle class="logo-step" cx="13.97" cy="34.31" r="3.6"/><circle class="logo-next" cx="34.31" cy="11.53" r="2.8"/></svg>';

  // ------------------------------------------------------------- theme --
  // Light/dark toggle. The choice is a per-device convenience kept in localStorage;
  // with no saved choice the app follows the OS setting (design.md §5.2).
  const THEME_KEY = 'sikad-theme';
  let themeFade = 0;
  const darkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const currentTheme = () => document.documentElement.dataset.theme || (darkQuery && darkQuery.matches ? 'dark' : 'light');
  const themeSetting = () => document.documentElement.dataset.theme || 'system';
  /** theme: 'light' | 'dark' | 'system'. "System" clears the saved choice and follows the OS again. */
  function applyTheme(theme) {
    const html = document.documentElement;
    if (theme === 'system') delete html.dataset.theme; else html.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', currentTheme() === 'dark' ? '#131917' : '#294B3A');
    try { if (theme === 'system') localStorage.removeItem(THEME_KEY); else localStorage.setItem(THEME_KEY, theme); } catch (e) { /* storage unavailable: still applies for this session */ }
  }
  function switchTheme(theme) {
    const html = document.documentElement;
    html.classList.add('theme-fade');                       // colours cross-fade once (motion-spec §5.4)
    clearTimeout(themeFade);
    themeFade = setTimeout(() => html.classList.remove('theme-fade'), M.DUR.enter + 40);
    applyTheme(theme);
    render();
  }
  function themeToggle() {
    const dark = currentTheme() === 'dark';
    return `<button class="theme-toggle" data-action="toggleTheme" aria-pressed="${dark}" aria-label="Dark mode" title="${dark ? 'Switch to light mode' : 'Switch to dark mode'}">
      ${dark ? ICON.sun : ICON.moon}<span>${dark ? 'Light' : 'Dark'}</span></button>`;
  }

  // ------------------------------------------------------------ judge mode --
  // Presenter tools (clock, sample week, engine output) stay out of the product UI. They appear
  // with ?demo=1 or after five taps on the version text, for this browser tab only.
  const JUDGE_KEY = 'sikad-judge';
  const VERSION = 'SIKAD prototype 0.3';
  let judge = (() => {
    try {
      const q = new URLSearchParams(location.search).get('demo');
      if (q === '1') sessionStorage.setItem(JUDGE_KEY, '1');
      if (q === '0') sessionStorage.removeItem(JUDGE_KEY);
      return sessionStorage.getItem(JUDGE_KEY) === '1';
    } catch (e) { return /[?&]demo=1\b/.test(location.search); }
  })();
  let versionTaps = 0, versionTimer = 0;
  const versionText = () => `<button class="version" data-action="versionTap">${VERSION}</button>`;
  const FTF_LABEL = '<span class="nowrap">Face-to-face</span>';   // never split at the hyphens
  const sampleNote = (text) => `<p class="sample-note">${ICON.info}<span>${esc(text)}</span></p>`;

  function judgeDock() {
    if (!judge) return '';
    const on = state.onboarded;
    const running = on && state.active && state.active.status === 'running';
    return `
      <aside class="judge-dock ${on ? '' : 'in-setup'}" aria-label="Judge tools">
        <button class="judge-pill" data-action="dockToggle" aria-expanded="${!!ui.dock}">${ICON.clock}<span>Judge tools</span></button>
        ${ui.dock ? `<div class="judge-panel">
          ${running ? `<div class="jd-row"><button class="jd-btn" data-action="focusSkip" data-mins="5">Skip session ahead 5 min</button></div>` : ''}
          <p class="jd-label">Sample week</p>
          <div class="jd-row">
            <button class="jd-btn" data-action="${on ? 'loadDemoConfirm' : 'loadDemo'}">${on ? "Reset to Alex's week" : "Load Alex's week"}</button>
            <button class="jd-btn" data-action="openEngine">Engine JSON</button>
          </div>
          ${on ? `<details class="jd-scen"><summary>Scenarios</summary>
            <div class="chips">${D.SCENARIOS.map((sc, i) => `<button class="chip-btn" data-action="scenario" data-i="${i}">${esc(sc.label)}</button>`).join('')}</div></details>` : ''}
        </div>` : ''}
      </aside>`;
  }

  function setPath(obj, path, value) {
    const keys = path.split('.');
    let o = obj;
    for (let i = 0; i < keys.length - 1; i++) { o = o[keys[i]]; if (o == null) return; } // e.g. a late change event after its sheet closed
    o[keys[keys.length - 1]] = value;
  }
  function convert(el) {
    const type = el.dataset.type;
    if (el.type === 'checkbox') return el.checked;
    if (type === 'num') return el.value === '' ? null : Number(el.value);
    if (type === 'hrs') return el.value === '' ? null : Math.round(Number(el.value) * 60);
    if (type === 'dt') return T.fromInput(el.value);
    if (type === 'int') return parseInt(el.value, 10);
    return el.value;
  }

  /** After a step change, put keyboard/screen-reader focus on the new step's heading. */
  function focusHeading() {
    const h = document.querySelector('.ob-title, main h1');
    if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  }

  /** Move focus to the first question that needs the student's answer (design.md §12.6). */
  function focusFirstQuestion() {
    const q = document.querySelector('[data-question]');
    if (q) q.focus({ preventScroll: false });
  }

  function snapshot(label) {
    const copy = S.clone(state);
    delete copy.obDraft;
    undoSnap = { label, json: JSON.stringify(copy) };
  }
  /** Toast: ≥ 5 s, paused while hovered or focused (design.md §7.11). */
  function toast(msg, opts = {}) {
    ui.toast = { msg, undo: !!opts.undo, id: Date.now() };
    renderToast();
    const id = ui.toast.id;
    const expire = () => {
      if (!ui.toast || ui.toast.id !== id) return;
      if ($toast.matches(':hover') || $toast.contains(document.activeElement)) { setTimeout(expire, 1000); return; }
      ui.toast = null; renderToast();
    };
    setTimeout(expire, Math.max(5200, opts.ms || 0));
  }

  // --------------------------------------------------------------- render --
  // Sheet focus management (design.md §7.11): focus moves in on open, Tab is trapped, focus returns on close.
  let sheetWasOpen = false, sheetOpener = null;
  const describe = (el) => {
    const b = el && el.closest && el.closest('[data-action]');
    if (!b) return null;
    return `[data-action="${b.dataset.action}"]` + (b.dataset.id ? `[data-id="${b.dataset.id}"]` : '') + (b.dataset.tab ? `[data-tab="${b.dataset.tab}"]` : '');
  };
  /** Selector that finds "the same" control after innerHTML is rebuilt, so keyboard focus isn't dropped to <body>. */
  const FOCUS_KEYS = ['action', 'id', 'tab', 'n', 'v', 'i', 'k', 'path', 'value', 'day', 'scope', 'bind', 'setting', 'mins', 'ms'];
  const focusKey = (el) => {
    if (!el || el === document.body || !el.closest) return null;
    if (el.id) return `#${CSS.escape(el.id)}`;
    const parts = FOCUS_KEYS.filter((k) => el.dataset && el.dataset[k] !== undefined).map((k) => `[data-${k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}="${CSS.escape(el.dataset[k])}"]`);
    return parts.length ? el.tagName.toLowerCase() + parts.join('') : null;
  };

  // ---------------------------------------------------------- history --
  // Browser/phone Back works like a native app: it closes an open sheet, then steps
  // back through tabs. Each tab has a URL (#home, #week, #tasks, #profile).
  const TABS = ['home', 'week', 'tasks', 'profile'];
  const SUBS = ['classes', 'commitments'];               // Profile management views (#profile/classes)
  const route = () => (ui.tab === 'profile' && ui.sub ? `profile/${ui.sub}` : ui.tab);
  function readRoute() {
    const [t, sub] = location.hash.slice(1).split('/');
    ui.tab = TABS.includes(t) ? t : 'home';
    ui.sub = ui.tab === 'profile' && SUBS.includes(sub) ? sub : null;
  }
  let lastTab = null, fromPop = false, popsToIgnore = 0;
  function syncHistory(opening, closing) {
    if (!state.onboarded) { lastTab = null; return; }
    const tabChanged = lastTab !== null && lastTab !== route();
    lastTab = route();
    if (fromPop) return;                                   // the browser already moved; nothing to record
    const onSheetEntry = history.state && history.state.sikad === 'sheet';
    try {
      if (opening) history.pushState({ sikad: 'sheet' }, '');
      else if (closing && onSheetEntry && tabChanged) history.replaceState({ sikad: 'tab' }, '', '#' + route());
      else if (closing && onSheetEntry) { popsToIgnore++; history.back(); }
      else if (tabChanged) history.pushState({ sikad: 'tab' }, '', '#' + route());
    } catch (e) { /* history unavailable (sandboxed frame): navigation still works without it */ }
  }
  window.addEventListener('popstate', () => {
    if (popsToIgnore > 0) { popsToIgnore--; return; }
    fromPop = true;
    if (ui.sheet) { stopVoice(); keepDraft(); ui.sheet = null; }
    ui.askMenu = false;
    readRoute();
    ui.focusOnly = false;
    render();
    fromPop = false;
    const h = document.querySelector('main h1');           // focus-on-route-change
    if (h && state.onboarded) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  });

  // ---------------------------------------------------------- motion --
  // motion-spec.md: state changes first, then the view animates from where it was to where it is.
  let lastViewKey = null, lastSheetKey = null;
  const updateSig = () => { const u = state.lastUpdate; return u ? `${u.trigger}|${u.at}|${JSON.stringify(u.changes)}` : ''; };
  let lastWashSig = updateSig();          // a plan update restored from storage is not news: no wash on load

  /** Play an element's CSS exit, then remove it. */
  function leave(el, cls, ms) {
    if (M.reduced()) { el.remove(); return; }
    el.classList.add(cls);
    el.inert = true;
    el.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
    const gone = () => el.remove();
    el.addEventListener('animationend', (e) => { if (e.target === el) gone(); }, { once: true });
    setTimeout(gone, ms + 80);
  }

  /**
   * The Satisfaction (motion-spec §5.2). Call after the store has changed: the old view strikes
   * the finished title, then the real state renders. Any other render in between wins.
   */
  let pending = null;
  function settle(sessionId, after) {
    const sel = `[data-sid="${CSS.escape(sessionId)}"]`;
    const card = document.querySelector(`.focus${sel}`), row = document.querySelector(`.tl-item${sel}`);
    const wait = M.strike([...(card ? card.querySelectorAll('.strike') : []), row && row.querySelector('.tl-name')]);
    if (!wait) { render(); if (after) after(); return; }
    S.save(state);
    if (card) card.classList.add('is-completing');
    if (row) row.classList.add('is-completing');
    pending = { after, timer: setTimeout(render, wait) };
  }

  /** Focus Mode dims the rest of Home while a method is being picked or a session is open. */
  function spotlightOn() {
    if (!state.onboarded || ui.tab !== 'home' || ui.sheet || ui.spotlightOff) return false;
    if (state.active) return state.plan.some((x) => x.id === state.active.sessionId);
    const next = ui.focusPick && E.nextSession(state.plan, now());
    return !!next && next.id === ui.focusPick;
  }

  /**
   * Nav pill and Ask menu (motion-spec §5.6). The HTML is rebuilt on every render, so the new nav is
   * first put back in its previous state, then released: CSS transitions carry the active item across.
   */
  let navTab = null, menuWasOpen = false;
  function navMotion(oldMenu) {
    const nav = $app.querySelector('.bottom-nav'), tab = nav ? ui.tab : null, open = !!(nav && ui.askMenu);
    if (nav && !M.reduced()) {
      const was = navTab && navTab !== tab && nav.querySelector(`.nav-btn[data-tab="${navTab}"]`), is = nav.querySelector('.nav-btn.on');
      if (was && is) {
        nav.classList.add('no-anim'); is.classList.remove('on'); was.classList.add('on');
        void nav.offsetWidth;
        nav.classList.remove('no-anim'); was.classList.remove('on'); is.classList.add('on');
      }
      const menu = nav.querySelector('.ask-menu'), fab = nav.querySelector('.fab');
      if (menu) menu.style.setProperty('--ask-x', `${fab.offsetLeft + fab.offsetWidth / 2 - menu.offsetLeft}px`);
      if (open !== menuWasOpen) {
        nav.classList.add('menu-toggled');
        // Same replay for the Ask state: start from the previous layout so the items slide and shrink instead of jumping.
        nav.classList.add('no-anim'); nav.classList.toggle('ask-on', menuWasOpen);
        void nav.offsetWidth;
        nav.classList.remove('no-anim'); nav.classList.toggle('ask-on', open);
      }
      if (open && !menuWasOpen) nav.parentNode.querySelectorAll('.ask-scrim, .ask-menu').forEach((el) => el.classList.add('is-opening'));
      if (!open && !ui.sheet) for (const el of oldMenu) { if (el.classList.contains('ask-menu')) nav.appendChild(el); else nav.before(el); leave(el, 'is-closing', 160); }
    }
    navTab = tab; menuWasOpen = open;
  }

  function render() {
    const after = pending && pending.after;
    if (pending) { clearTimeout(pending.timer); pending = null; }
    clockDirty = false;
    state.obDraft = state.onboarded ? null : ui.ob;
    S.save(state);
    const opening = !!ui.sheet && !sheetWasOpen, closing = !ui.sheet && sheetWasOpen;
    syncHistory(opening, closing);
    if (opening) sheetOpener = describe(document.activeElement);
    const keep = !opening && !closing ? focusKey(document.activeElement) : null;
    const viewKey = state.onboarded ? `app:${route()}:${ui.focusOnly ? 'one' : 'all'}` : `ob:${ui.ob.step}`;
    const sheetKey = ui.sheet ? `${ui.sheet.type}:${ui.sheet.mode || ''}` : null;
    const snap = M.capture($app);
    const oldMenu = menuWasOpen && !ui.askMenu ? [...$app.querySelectorAll('.ask-scrim, .ask-menu')] : [];
    const oldSheet = $sheet.querySelector('.sheet-backdrop:not(.is-closing)');
    const sheetScroll = oldSheet && sheetKey === lastSheetKey ? oldSheet.firstElementChild.scrollTop : 0;
    $app.innerHTML = (state.onboarded ? shell() : onboarding()) + judgeDock();
    if (closing && oldSheet && !M.reduced()) leave(oldSheet, 'is-closing', 160);
    else $sheet.innerHTML = ui.sheet ? sheet() : '';
    if (ui.sheet) {
      if (opening) $sheet.firstElementChild.classList.add('is-opening');
      else if (sheetScroll) $sheet.firstElementChild.firstElementChild.scrollTop = sheetScroll;   // re-rendering a sheet keeps your place
    }
    lastSheetKey = sheetKey;
    navMotion(oldMenu);
    document.body.classList.toggle('ask-open', !!ui.askMenu);
    document.body.classList.toggle('sheet-open', !!ui.sheet);
    document.body.classList.toggle('spotlight', spotlightOn());
    $app.toggleAttribute('inert', !!ui.sheet);
    if (opening) {
      const target = $sheet.querySelector('#dump-text') || $sheet.querySelector('#sheet-title');
      if (target) target.focus({ preventScroll: true });
    } else if (!ui.sheet && sheetWasOpen) {
      const back = sheetOpener && $app.querySelector(sheetOpener);
      if (back) back.focus({ preventScroll: true });
      sheetOpener = null;
    } else if (keep) {
      // Same control if it still exists; otherwise the Focus Card title or the view heading.
      const again = document.querySelector(keep) || document.querySelector(ui.sheet ? '#sheet-title' : '#focus-title, main h1, .ob-title');
      if (again && again !== document.activeElement) again.focus({ preventScroll: true });
    }
    sheetWasOpen = !!ui.sheet;
    const sig = updateSig();
    M.play($app, snap, { sameView: viewKey === lastViewKey, viewEl: $app.querySelector('main, .onboarding'), washNew: !!sig && sig !== lastWashSig });
    lastViewKey = viewKey; lastWashSig = sig;
    if (sig !== dismissSig) { clearTimeout(dismissTimer); dismissSig = sig; if (sig) dismissTimer = setTimeout(autoDismissUpdate, 12000); }
    if (state.onboarded) { ui.prevPct = S.weeklyProgress(state).percent; ui.prevDayPct = todayStats().percent; }
    ui.celebrate = false;
    renderToast();
    tickTimer();
    if (after) after();
  }
  /** The Plan-updated card clears itself. Undo lives in the toast, so there is one Undo at a time. */
  let dismissSig = null, dismissTimer = 0;
  function autoDismissUpdate() {
    if (!state.lastUpdate || updateSig() !== dismissSig) return;
    const el = document.activeElement;
    const busy = ui.sheet || pending || (el && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) || document.querySelector('.update:hover, .update:focus-within, details.add[open]');
    if (busy) { dismissTimer = setTimeout(autoDismissUpdate, 3000); return; }
    state.lastUpdate = null;
    render();
  }
  /** The toast is one node for its whole life, so unrelated renders don't replay its entrance. */
  function renderToast() {
    const cur = $toast.querySelector('.toast:not(.is-leaving)');
    if (!ui.toast) { if (cur) leave(cur, 'is-leaving', M.DUR.micro); return; }
    const undo = !!(ui.toast.undo && undoSnap);
    if (cur && cur.dataset.id === String(ui.toast.id) && !!cur.querySelector('button') === undo) return;
    $toast.innerHTML = `<div class="toast" role="status" data-id="${ui.toast.id}"><span>${esc(ui.toast.msg)}</span>${undo ? ` <button data-action="undo">${ICON.undo}Undo</button>` : ''}</div>`;
  }
  function tickDictation() {
    const el = document.getElementById('dict-time');
    if (!el || !ui.dict || ui.dict.state !== 'recording') return;
    const secs = Math.floor((Date.now() - ui.dict.startedReal) / 1000);
    el.textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  }
  setInterval(tickDictation, 500);

  /** Once a second: refresh the session timer in place. A phase change or the timer ending triggers a re-render. */
  let lastPhase = null;
  function tickTimer() {
    const a = state.active;
    const el = document.getElementById('focus-timer');
    if (!a || a.status !== 'running') { lastPhase = null; return; }
    const t = F.timer(a, S.focusElapsedMs(a));
    if (t.finished) {                      // timer ran out: ask the student; never complete or count anything automatically
      S.pauseSession(state); a.status = 'awaiting'; lastPhase = null;
      render();
      const q = document.getElementById('outcome-title');
      if (q) q.focus({ preventScroll: true });
      return;
    }
    if (lastPhase !== null && lastPhase !== t.phase + t.round) { lastPhase = t.phase + t.round; render(); return; }
    lastPhase = t.phase + (t.round || '');
    if (el) el.textContent = F.clock(t.remainingMs == null ? t.elapsedMs : t.remainingMs);
  }
  setInterval(tickTimer, 1000);

  // ============================================================ ONBOARDING ==
  function onboarding() {
    const ob = ui.ob;
    const steps = ['Welcome', 'Baseline', 'Lifestyle', 'Sync', 'Brain dump', 'Plan'];
    const progress = ob.step > 0 && ob.step < 5
      ? `<div class="ob-progress"><div class="ob-bars" aria-hidden="true">${[1, 2, 3, 4].map((i) => `<span class="${i <= ob.step ? 'on' : ''}"></span>`).join('')}</div><span class="ob-step">Step ${ob.step} of 4</span></div>` : '';
    const body = [obWelcome, obBaseline, obLifestyle, obSync, obDump, obGenerating][ob.step]();
    return `<div class="screen onboarding" data-step="${esc(steps[ob.step])}"><div class="ob-top">${themeToggle()}</div>${progress}${body}</div>`;
  }

  function obWelcome() {
    return `
      <div class="ob-welcome">
        <h1 class="brand">${LOCKUP}<span class="sr-only">SIKAD</span></h1>
        <p class="tagline">Find your next move.</p>
        <p class="lead">See what you can realistically get done with the time you actually have.</p>
        <label class="field">
          <span>What should we call you?</span>
          <input type="text" placeholder="Your name" data-bind="ob.name" value="${esc(ui.ob.name)}" autocomplete="given-name">
        </label>
        <button class="btn primary block" data-action="obNext">Get started</button>
        ${versionText()}
      </div>`;
  }

  function obBaseline() {
    const ob = ui.ob;
    const rows = ob.classes.map((c, i) => `
      <div class="class-row">
        <span class="cr-lock" aria-hidden="true">${ICON.lock}</span>
        <input class="cr-title" aria-label="Subject" placeholder="Subject" value="${esc(c.title)}" data-bind="ob.classes.${i}.title">
        <select class="cr-mode" aria-label="Mode" data-bind="ob.classes.${i}.mode"><option ${c.mode === 'FTF' ? 'selected' : ''}>FTF</option><option ${c.mode === 'Online' ? 'selected' : ''}>Online</option></select>
        <button class="icon-btn" aria-label="Remove ${esc(c.title || 'class')}" data-action="obRemoveClass" data-i="${i}">${ICON.close}</button>
        <select class="cr-day" aria-label="Day" data-bind="ob.classes.${i}.day" data-type="int">${T.DAY_SHORT.map((d, n) => `<option value="${n}" ${n === c.day ? 'selected' : ''}>${d}</option>`).join('')}</select>
        <span class="cr-time"><input type="time" aria-label="Start" value="${c.start}" data-bind="ob.classes.${i}.start"><span>–</span><input type="time" aria-label="End" value="${c.end}" data-bind="ob.classes.${i}.end"></span>
      </div>`).join('');
    const fixedTag = `<span class="fixed-tag">${ICON.lock}Fixed</span>`;
    return `
      <h1 class="ob-title">Set your baseline</h1>
      <p class="ob-sub">Upload your COR or a photo of your class schedule. SIKAD will pull out your weekly class blocks.</p>
      <label class="upload">
        <input type="file" accept="image/*,application/pdf" data-change="obUpload" hidden>
        <span class="upload-icon">${ICON.doc}</span>
        <span><b>Upload COR or schedule photo</b><br><small>PDF or image</small></span>
      </label>
      <button class="text-link" data-action="obSampleCor" ${ob.extracting ? 'disabled' : ''}>${ICON.doc}Try a sample schedule</button>
      ${ob.uploadNote ? sampleNote(ob.uploadNote) : ob.corText === D.SAMPLE_COR_TEXT ? sampleNote('Sample data. Edit anything.') : ''}
      <details class="paste" ${ob.corText ? 'open' : ''}>
        <summary>Or paste or type it (one class per line)</summary>
        <textarea rows="6" data-bind="ob.corText" aria-label="Class schedule text" placeholder="IT 203   MON   07:00-10:00   FTF">${esc(ob.corText)}</textarea>
        <div class="row">
          <button class="btn small" data-action="obExtract" ${ob.extracting ? 'disabled aria-busy="true"' : ''}>${ob.extracting ? '<span class="spinner" aria-hidden="true"></span>Reading…' : 'Extract classes'}</button>
        </div>
      </details>
      ${ob.analysis ? (ob.analysisError
        ? `<div class="status-panel s-clarify" role="status">${ICON.question}<div><b>I couldn't read that schedule</b><p>${esc(ob.analysis)}</p></div></div>`
        : `<div class="status-panel s-info">${ICON.info}<div><b>Schedule analysis</b><p>${esc(ob.analysis)}</p></div></div>`) : ''}
      ${ob.extracted || ob.classes.length ? `
        <div class="list-head"><h2 class="list-h">Weekly classes (${ob.classes.length})</h2>${fixedTag}</div>
        <p class="small muted">Classes are fixed: SIKAD plans around them and never moves them.</p>
        <div class="class-list">${rows || '<p class="muted">No classes yet.</p>'}</div>
        <button class="btn small ghost" data-action="obAddClass">${ICON.plus} Add a class</button>
        <p class="small muted">Check the extraction and fix anything that's off before continuing.</p>` : ''}
      <div class="ob-nav">
        ${ob.classes.length ? '' : '<p class="nav-reason">Add at least one class to continue.</p>'}
        <button class="btn ghost" data-action="obBack">Back</button>
        <button class="btn primary" data-action="obNext" ${ob.classes.length ? '' : 'disabled'}>Continue</button>
      </div>`;
  }

  /** Radio-style choice chips (design.md §7.2): selected = Harbor fill + check icon. */
  function chips(path, current, options, labelId) {
    return `<div class="chips" role="radiogroup" aria-labelledby="${labelId}">${options.map(([v, label]) => {
      const on = String(current) === String(v);
      return `<button class="chip-btn ${on ? 'on' : ''}" role="radio" aria-checked="${on}" data-action="obSet" data-path="${path}" data-value="${esc(v)}">${on ? ICON.check : ''}${esc(label)}</button>`;
    }).join('')}</div>`;
  }

  const COMMUTE_PRESETS = [30, 60, 90, 120];
  const newOrg = () => ({ id: `o${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`, name: '', day: 4, start: '17:00', end: '19:00' });
  function obLifestyle() {
    const ls = ui.ob.ls;
    if (!Array.isArray(ls.orgs)) ls.orgs = [];             // a draft saved by an older build
    if (ls.org === 'yes' && !ls.orgs.length) ls.orgs.push(newOrg());
    const customCommute = ls.commuteCustom || !COMMUTE_PRESETS.includes(Number(ls.commuteMins));
    const orgClash = (o) => ls.orgs.find((x) => x !== o && x.day === o.day && x.start < o.end && o.start < x.end);
    const ftfDays = [...new Set(ui.ob.classes.filter((c) => c.mode === 'FTF').map((c) => c.day))].sort().map((d) => T.DAY_NAMES[d]);
    const ftfText = ftfDays.length ? `I see you have FTF classes on ${ftfDays.join(' & ')}. ` : '';
    const dayChecks = (path, sel, labelId) => `<div class="chips" role="group" aria-labelledby="${labelId}">${[1, 2, 3, 4, 5, 6, 0].map((d) => {
      const on = sel.includes(d);
      return `<button class="chip-btn ${on ? 'on' : ''}" aria-pressed="${on}" data-action="obToggleDay" data-path="${path}" data-day="${d}">${on ? ICON.check : ''}${T.DAY_SHORT[d]}</button>`;
    }).join('')}</div>`;
    const missing = [!ls.working && 'work', !ls.org && 'org'].filter(Boolean);
    return `
      <div class="mascot-row"><div class="mascot" aria-hidden="true">${ICON.mark}</div><div><h1 class="ob-title">A few quick questions</h1><p class="ob-sub">So the plan fits your real day.</p></div></div>
      <div class="q">
        <h2 id="q-start">What time does your day usually start?</h2>
        ${chips('ls.dayStart', ls.dayStart, [['05:00', '5:00 AM'], ['06:00', '6:00 AM'], ['07:00', '7:00 AM'], ['08:00', '8:00 AM']], 'q-start')}
        <label class="inline">Custom time <input type="time" value="${ls.dayStart}" data-bind="ob.ls.dayStart" data-rerender></label>
      </div>
      <div class="q">
        <h2 id="q-commute">${esc(ftfText)}How long is your commute to campus during rush hour?</h2>
        ${chips('ls.commuteMins', customCommute ? 'custom' : ls.commuteMins, [[30, '30 min'], [60, '1 hour'], [90, '1.5 hours'], [120, '2 hours'], ['custom', 'Custom']], 'q-commute')}
        ${customCommute ? `<label class="inline">Minutes each way <input type="number" inputmode="numeric" min="5" max="240" step="5" value="${ls.commuteMins == null ? '' : esc(ls.commuteMins)}" data-bind="ob.ls.commuteMins" data-type="num" id="commute-custom"></label>` : ''}
      </div>
      <div class="q">
        <h2 id="q-work">Are you a working student?</h2>
        ${chips('ls.working', ls.working, [['yes', 'Yes, part-time'], ['no', 'No']], 'q-work')}
        ${ls.working === 'yes' ? `<div class="follow"><p class="small" id="q-workdays">What days and times do you usually work?</p>${dayChecks('workDays', ls.workDays, 'q-workdays')}
          <div class="row time-range"><input type="time" value="${ls.workStart}" data-bind="ob.ls.workStart" aria-label="Work start"><span>to</span><input type="time" value="${ls.workEnd}" data-bind="ob.ls.workEnd" aria-label="Work end"></div></div>` : ''}
      </div>
      <div class="q">
        <h2 id="q-org">Are you in a school organization?</h2>
        ${chips('ls.org', ls.org, [['yes', 'Yes'], ['no', 'No']], 'q-org')}
        ${ls.org === 'yes' ? `<div class="follow"><p class="small">Which ones, and when do they usually meet?</p>
          ${ls.orgs.map((o, i) => {
            const clash = orgClash(o);
            const label = `Org ${i + 1}`;
            return `<div class="org-row">
              <input placeholder="e.g. Junior Programmers Guild" value="${esc(o.name)}" data-bind="ob.ls.orgs.${i}.name" aria-label="${label} name">
              <div class="row time-range"><select data-bind="ob.ls.orgs.${i}.day" data-type="int" data-rerender aria-label="${label} day">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<option value="${d}" ${d === o.day ? 'selected' : ''}>${T.DAY_NAMES[d]}</option>`).join('')}</select>
              <input type="time" value="${o.start}" data-bind="ob.ls.orgs.${i}.start" data-rerender aria-label="${label} start"><span>to</span><input type="time" value="${o.end}" data-bind="ob.ls.orgs.${i}.end" data-rerender aria-label="${label} end"></div>
              ${clash ? `<p class="field-error">${ICON.alert}<span>Same time as ${esc(clash.name.trim() || 'another org')}. Check the day or time.</span></p>` : ''}
              ${ls.orgs.length > 1 ? `<button class="btn small ghost" data-action="obRemoveOrg" data-i="${i}" aria-label="Remove ${esc(o.name.trim() || label)}">Remove</button>` : ''}
            </div>`;
          }).join('')}
          <button class="btn small ghost" data-action="obAddOrg">${ICON.plus} Add another org</button></div>` : ''}
      </div>
      <div class="q">
        <h2 id="q-end">Stop scheduling after…</h2>
        <p class="small muted" id="q-end-help">SIKAD won't plan tasks after this time.</p>
        ${chips('ls.dayEnd', ls.dayEnd, [['21:00', '9:00 PM'], ['22:00', '10:00 PM'], ['23:00', '11:00 PM']], 'q-end')}
      </div>
      <div class="ob-nav">
        ${missing.length ? `<p class="nav-reason">Answer the ${missing.join(' and ')} question${missing.length > 1 ? 's' : ''} to continue.</p>` : ''}
        <button class="btn ghost" data-action="obBack">Back</button>
        <button class="btn primary" data-action="obNext" ${missing.length ? 'disabled' : ''}>Continue</button>
      </div>`;
  }

  function obSync() {
    return `
      <h1 class="ob-title">Bring in your due dates</h1>
      <p class="ob-sub">Connect a calendar or class platform to import deadlines. Skip it if you prefer.</p>
      <div class="integrations">${D.INTEGRATIONS.map((i) => integrationRow(i)).join('')}</div>
      ${sampleNote('Prototype: connections use sample data.')}
      <p class="small muted">You can always connect more platforms later in Profile.</p>
      <div class="ob-nav">
        <button class="btn ghost" data-action="obBack">Back</button>
        <button class="btn primary" data-action="obNext">Continue</button>
      </div>`;
  }
  // Connection seam. Each platform has an adapter: connect() → Promise<{ account, items: [{ title, due, source, course?, mins? }] }>.
  // The default adapters return sample items from js/data.js. A real adapter can replace one later
  // (window.SikadIntegrations.gcal = { connect }) with no change to the UI below.
  const Adapters = window.SikadIntegrations = window.SikadIntegrations || {};
  for (const i of D.INTEGRATIONS) {
    if (Adapters[i.id]) continue;
    Adapters[i.id] = {
      connect: () => new Promise((resolve) => setTimeout(() => resolve({
        account: sampleAccount(),
        // Work that is already a task (any status) is not offered again.
        items: (D.SAMPLE_ASSIGNMENTS[i.id] || []).filter((x) => !state.tasks.some((t) => t.title.toLowerCase() === x.title.toLowerCase()))
          .map((x) => ({ title: x.title, course: x.course, mins: x.mins, due: T.at(T.addDays(T.dayStart(now()), x.due[0]), x.due[1] * 60 + x.due[2]), source: i.id })),
      }), 1200)),
    };
  }
  const sampleAccount = () => (state.user.name === 'Alex' ? 'alex.s@up.edu.ph' : 'Sample account');
  /** A task's source is a platform id; show the platform's name. */
  const sourceName = (src) => (D.INTEGRATIONS.find((x) => x.id === src) || { name: src }).name;
  /** What a row shows. The saved boolean is the source of truth for "connected"; the rest is this visit's detail. */
  function integrationStatus(id) {
    const st = ui.integrationState[id];
    if (st && (st.status === 'connecting' || st.status === 'error')) return st;
    if (state.integrations[id]) return st && st.status === 'connected' ? st : { status: 'connected', account: sampleAccount(), lastSync: null, imported: null };
    return { status: 'idle' };
  }
  const syncedAgo = (ms) => { const m = Math.floor((Date.now() - ms) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : 'earlier today'; };
  function integrationRow(i) {
    const st = integrationStatus(i.id);
    const name = esc(i.name);
    let detail = esc(i.desc), button = `<button class="btn small" aria-label="Connect ${name}" data-action="toggleIntegration" data-id="${i.id}">Connect</button>`;
    if (st.status === 'connecting') {
      detail = '<span role="status"><span class="spinner" aria-hidden="true"></span>Connecting…</span>';
      button = `<button class="btn small ghost" aria-label="Cancel connecting ${name}" data-action="cancelIntegration" data-id="${i.id}">Cancel</button>`;
    } else if (st.status === 'error') {
      detail = `<span class="int-error" role="alert">${ICON.alert}${esc(st.error)}</span>`;
      button = `<button class="btn small" aria-label="Try connecting ${name} again" data-action="toggleIntegration" data-id="${i.id}">Try again</button>`;
    } else if (st.status === 'connected') {
      detail = `<span class="int-ok num">${ICON.check}${esc(st.account)}${st.lastSync ? ` · Synced ${syncedAgo(st.lastSync)} · ${st.imported} item${st.imported === 1 ? '' : 's'}` : ' · Connected'}</span>`;
      button = `<button class="btn small ghost" aria-label="Disconnect ${name}" data-action="toggleIntegration" data-id="${i.id}">Disconnect</button>`;
    }
    return `<div class="integration is-${st.status}"><span class="int-icon" aria-hidden="true">${ICON[i.icon] || ICON.doc}</span><div><b>${name}</b><br><small>${detail}</small></div>${button}</div>`;
  }
  /** After a connection: what came in, for the student to pick from. Nothing is added until they say so. */
  function importSheet() {
    const sh = ui.sheet;
    const n = sh.items.filter((it) => it.include && it.title.trim()).length;
    return `
      <h2 id="sheet-title" tabindex="-1">Review what came in</h2>
      <p class="sheet-sub">${sh.items.length} item${sh.items.length === 1 ? '' : 's'} from ${esc(sh.name)}. Nothing is added until you choose it.</p>
      <div class="import-list">${sh.items.map((it, k) => `
        <article class="import-row ${it.include ? '' : 'excluded'}">
          <label class="toggle"><input type="checkbox" ${it.include ? 'checked' : ''} data-bind="sheet.items.${k}.include" data-rerender aria-label="Add ${esc(it.title)} to plan"></label>
          <div class="ir-body">
            <input value="${esc(it.title)}" data-bind="sheet.items.${k}.title" aria-label="Title">
            <label class="ir-due">Due<input type="datetime-local" value="${it.due != null ? T.toInput(it.due) : ''}" data-bind="sheet.items.${k}.due" data-type="dt"></label>
            <div class="ir-chips">${it.course ? `<span class="chip">${esc(it.course)}</span>` : ''}<span class="chip src">${esc(sourceName(it.source))}</span></div>
          </div>
        </article>`).join('') || '<p class="muted">Nothing new to import.</p>'}</div>
      <p class="small muted">You can change the time needed on each task after adding it.</p>
      <div class="sheet-actions">
        <button class="btn" data-action="closeSheet">Not now</button>
        <button class="btn primary" data-action="importAdd" ${n ? '' : 'disabled'}>Add ${n || ''} to plan</button>
      </div>`;
  }

  function obDump() {
    const ob = ui.ob;
    if (ob.review) return obReview();
    return `
      <h1 class="ob-title">Brain dump</h1>
      <p class="ob-sub">What's on your plate right now? Don't worry about formatting. Just dump it.</p>
      ${dictaphone('ob.dumpText')}
      <label class="divider" for="dump-ob"><span>or type it out</span></label>
      <textarea id="dump-ob" rows="5" data-bind="ob.dumpText" placeholder="e.g. Class diagram exercise due Friday, about 1 hour. Study for my GE 103 quiz on Wednesday…">${esc(ob.dumpText)}</textarea>
      <button class="text-link" data-action="obSampleDump">${ICON.doc}Try an example</button>
      ${ob.dumpText === D.SAMPLE_BRAIN_DUMP ? sampleNote('Sample data. Edit anything.') : ''}
      <div class="ob-nav">
        <button class="btn ghost" data-action="obBack">Back</button>
        <button class="btn primary" data-action="obParseDump">Extract tasks</button>
      </div>`;
  }

  /** Items that still need the student's answer are listed first (design.md §12.6). */
  const needsAnswer = (it) => (it.kind === 'task' && (it.ambiguous || it.task.deadline == null)) || it.kind === 'contradiction' || it.kind === 'unclear' ||
    (it.kind === 'event' && it.conflicts.hard.length && !it.resolution) || (it.kind === 'recurring' && it.conflicts.length && !it.resolution);
  // Order is fixed when the review opens, so answering a question doesn't make cards jump.
  const answerFirst = (items) => items.map((it, n) => {
    if (it.askFirst === undefined) it.askFirst = !!needsAnswer(it);
    return [it, n];
  }).sort((x, y) => (y[0].askFirst ? 1 : 0) - (x[0].askFirst ? 1 : 0) || x[1] - y[1]);
  const estLegend = () => `<p class="legend small"><span class="est-dur">≈ 2 hrs</span> <span class="chip est">AI estimate</span> means SIKAD guessed the time from the task type. Change it if you know better.</p>`;

  /** The confirmed baseline, shown again before the first plan so it can be corrected (brief Stage 3). */
  function baselineSummary() {
    const b = state.baseline;
    const ftf = [...new Set(b.classes.filter((c) => c.mode === 'FTF').map((c) => c.day))].sort().map((d) => T.DAY_SHORT[d]);
    const orgCount = b.recurring.filter((r) => r.kind === 'org').length;
    return `
      <section class="card baseline-sum" aria-labelledby="bs-title">
        <h2 id="bs-title">Your baseline</h2>
        <ul class="plain">
          <li><span>${ICON.lock}<b>${b.classes.length} weekly class${b.classes.length === 1 ? '' : 'es'}</b> (fixed)${ftf.length ? ` · face-to-face on ${ftf.join(', ')}` : ''}</span><button class="btn small" data-action="obGoto" data-step="1" aria-label="Edit classes">Edit</button></li>
          <li><span class="num"><b>Planning day</b> ${T.hmLabel(b.dayStart)}–${T.hmLabel(b.dayEnd)} · commute ${b.commuteMins ? T.dur(b.commuteMins) : 'none'} · 15 min buffer around tasks${orgCount ? ` · ${orgCount} org${orgCount === 1 ? '' : 's'}` : ''}</span><button class="btn small" data-action="obGoto" data-step="2" aria-label="Edit routine">Edit</button></li>
          <li><span class="num">${b.recurring.length ? b.recurring.map((r) => `${ICON.lock}<b>${esc(r.title)}</b> every ${T.DAY_SHORT[r.day]} ${T.hmLabel(r.start)}–${T.hmLabel(r.end)}`).join('<br>') : 'No other weekly commitments'}</span><button class="btn small" data-action="obGoto" data-step="2" aria-label="Edit weekly commitments">Edit</button></li>
        </ul>
      </section>`;
  }

  function obReview() {
    const items = ui.ob.review;
    const tasks = items.filter((it) => it.kind === 'task');
    const skipped = items.filter((it) => it.kind !== 'task' && !['stress', 'unclear', 'duplicate'].includes(it.kind)).length;
    const unclear = items.find((it) => it.kind === 'unclear');
    return `
      <h1 class="ob-title">Review before planning</h1>
      <p class="ob-sub">Check your baseline and each task. Nothing is scheduled until you generate the plan.</p>
      ${baselineSummary()}
      <h2 class="list-h">Tasks I caught (${tasks.length})</h2>
      ${tasks.some((t) => t.task.isAiEstimate) ? estLegend() : ''}
      <div class="review-list">${answerFirst(items).map(([it, n]) => it.kind === 'task' ? taskReviewCard(it, `ob.review.${n}`, n, 'ob') : '').join('')}</div>
      ${!tasks.length ? (unclear
        ? `<div class="status-panel s-clarify">${ICON.question}<div><b>Can you be more specific?</b><p>${esc(P.unclearQuestion(unclear))}</p></div></div>`
        : `<div class="status-panel s-neutral">${ICON.info}<div><b>No tasks found</b><p>Try listing what's due and when.</p></div></div>`) : ''}
      ${skipped ? `<p class="small muted">${skipped} other item(s), like schedule changes, can be added from the dashboard after setup.</p>` : ''}
      <div class="ob-nav">
        ${tasks.some((t) => t.include) ? '' : '<p class="nav-reason">Include at least one task to continue.</p>'}
        <button class="btn ghost" data-action="obEditDump">Edit text</button>
        <button class="btn primary" data-action="obGenerate" ${tasks.some((t) => t.include) ? '' : 'disabled'}>Generate my schedule</button>
      </div>`;
  }

  function obGenerating() {
    const steps = ['Analyzing your class schedule…', 'Calculating commute buffers…', 'Finding your best time gaps…', 'Prioritizing tasks by deadline & difficulty…', 'Building your plan…'];
    const cur = Math.min(ui.ob.genStep, steps.length - 1);
    return `
      <div class="generating">
        ${LOGO}
        <h1 class="ob-title">Building your plan</h1>
        <ol class="gen-steps">${steps.map((st, i) => `<li class="${i < ui.ob.genStep ? 'done' : i === ui.ob.genStep ? 'doing' : ''}">
          <span class="gen-mark" aria-hidden="true">${i < ui.ob.genStep ? ICON.check : i === ui.ob.genStep ? '<span class="gen-dot"></span>' : ''}</span>
          <span>${st}</span><span class="sr-only">${i < ui.ob.genStep ? '(done)' : i === ui.ob.genStep ? '(in progress)' : ''}</span></li>`).join('')}</ol>
        <p class="sr-only" aria-live="polite">${esc(steps[cur])}</p>
      </div>`;
  }

  // ------------------------------------------------------------ dictaphone --
  // Voice capture (brief §7): ready → recording (Stop / Cancel) → transcript lands in the
  // editable text field → the same review/confirm workflow as typed input. It only
  // captures and transcribes; interpreting and replanning happen elsewhere. No audio is
  // stored or uploaded by SIKAD: the browser's own speech recognition does the work.
  const speechSupported = () => !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  const VOICE_ERRORS = {
    'not-allowed': 'Microphone access was blocked. Allow it in your browser\'s site settings, or type instead.',
    'service-not-allowed': 'Microphone access was blocked. Allow it in your browser\'s site settings, or type instead.',
    network: 'The browser\'s speech service could not be reached. It needs an internet connection. You can type instead.',
    'no-speech': 'No speech was heard. Try again a little closer to the microphone, or type instead.',
    'audio-capture': 'No microphone was found. Connect one, or type instead.',
  };
  function dictaphone(path) {
    const d = ui.dict && ui.dict.path === path ? ui.dict : null;
    // Setup has its own "Try an example" link under the text box, so the two are one control there.
    const sample = path === 'ob.dumpText' ? '' : `<button class="text-link" data-action="dictDemo" data-path="${path}">${ICON.doc}Try an example</button>`;
    if (d && d.state === 'recording') {
      return `<div class="dict recording">
        <div class="dict-status" role="status"><span class="rec-dot" aria-hidden="true"></span><b>Recording</b><span id="dict-time" class="num">0:00</span></div>
        <p id="dict-interim" class="dict-interim" aria-live="polite">${esc(d.final + d.interim) || 'Listening…'}</p>
        <div class="row dict-controls"><button class="btn" data-action="dictStop">Stop and use text</button><button class="btn ghost" data-action="dictCancel">Cancel</button></div>
      </div>`;
    }
    const note = d && d.note === 'transcribed' ? `<p class="voice-note">${ICON.check}<span>Transcribed by your browser. Check the text below before sending.</span></p>`
      : d && d.note === 'demo' ? `<p class="voice-note">${ICON.info}<span>Sample data. Edit anything.</span></p>`
      : d && d.note === 'cancelled' ? `<p class="voice-note">${ICON.info}<span>Recording cancelled. Nothing was added.</span></p>`
      : d && d.error ? `<p class="voice-note is-error" role="alert">${ICON.alert}<span>${esc(d.error)}</span></p>` : '';
    if (!speechSupported()) {
      return `<div class="dict unsupported">
        <p class="voice-note">${ICON.info}<span>Voice capture needs a browser with speech recognition (Chrome or Edge). This browser does not have it, so type below instead.</span></p>
        ${sample}
        ${note}
      </div>`;
    }
    return `<div class="dict ready">
      <button class="mic" data-action="dictStart" data-path="${path}" aria-label="Start recording">${ICON.mic}</button>
      <div class="mic-label">Start recording</div>
      ${note}
      ${d && d.error ? sample : ''}
    </div>`;
  }
  /**
   * Show a validation error directly under its field, link it with aria-describedby,
   * mark the field invalid and focus it. Cleared when the student edits the field.
   */
  function flagField(input, message) {
    if (!input) return;
    clearFieldError(input);
    const id = `err-${input.id || input.name || input.dataset.bind || 'field'}`.replace(/[^\w-]/g, '-');
    const p = document.createElement('p');
    p.className = 'field-error'; p.id = id; p.setAttribute('role', 'alert');
    p.innerHTML = `${ICON.alert}<span>${esc(message)}</span>`;
    (input.closest('label') || input).insertAdjacentElement('afterend', p);
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', id);
    input.focus();
  }
  function clearFieldError(input) {
    const id = input.getAttribute && input.getAttribute('aria-describedby');
    if (!input.hasAttribute || !input.hasAttribute('aria-invalid')) return;
    const p = id && document.getElementById(id);
    if (p) p.remove();
    input.removeAttribute('aria-invalid'); input.removeAttribute('aria-describedby');
  }

  /** Editable card for an extracted task (used in onboarding + brain dump review). */
  function taskReviewCard(it, path, n, scope) {
    const t = it.task;
    const needsDate = t.deadline == null;
    const qid = `q-${scope}-${n}`;
    return `
      <article class="review-card ${it.include ? '' : 'excluded'}">
        <div class="rc-head">
          <input class="rc-title" value="${esc(t.title)}" data-bind="${path}.task.title" aria-label="Task name">
          <label class="toggle"><input type="checkbox" ${it.include ? 'checked' : ''} data-bind="${path}.include" data-rerender> Add to plan</label>
        </div>
        ${t.context ? `<div class="rc-context">${esc(t.context)}</div>` : ''}
        ${t.dependsOnTitle ? `<p class="small rc-note">${ICON.chevron}Starts after: <b>${esc(t.dependsOnTitle)}</b> is finished.</p>` : ''}
        ${it.ambiguous ? `<div class="clarify" tabindex="-1" data-question>${ICON.question}<div><p id="${qid}"><b>${esc(it.clarification)}</b></p>
          <div class="chips" role="radiogroup" aria-labelledby="${qid}">${it.ambiguous.map((o, k) =>
            `<button class="chip-btn" role="radio" aria-checked="false" data-action="pickAmbiguous" data-scope="${scope}" data-n="${n}" data-k="${k}">${esc(o.label)}</button>`).join('')}</div></div></div>`
          : needsDate ? `<div class="clarify" tabindex="-1" data-question>${ICON.question}<div><p id="${qid}"><b>${esc(it.clarification || 'When is this due? I need the date to schedule it.')}</b></p>
            <p class="small">SIKAD won't guess a deadline. Without one, this is saved but not scheduled. Set the due date below.</p></div></div>` : ''}
        <div class="rc-grid">
          <label class="${needsDate && !it.ambiguous ? 'needs-answer' : ''}">Due
            <input type="datetime-local" value="${t.deadline != null ? T.toInput(t.deadline) : ''}" data-bind="${path}.task.deadline" data-type="dt" data-rerender ${needsDate ? `aria-describedby="${qid}"` : ''}>
          </label>
          <label>Time needed ${t.isAiEstimate ? estChip() : ''}
            <span class="hrs-input ${t.isAiEstimate ? 'is-est' : ''}">${t.isAiEstimate ? '<span aria-hidden="true">≈</span>' : ''}<input type="number" min="0.25" step="0.25" value="${hrs(t.durationMins)}" data-bind="${path}.task.durationMins" data-type="hrs" data-est="${path}.task.isAiEstimate"> hrs</span>
          </label>
          <label>Priority
            <select data-bind="${path}.task.priority">${['high', 'medium', 'low'].map((p) => `<option value="${p}" ${p === t.priority ? 'selected' : ''}>${PRI_LABEL[p]}</option>`).join('')}</select>
          </label>
        </div>
        ${t.parts && t.parts.length ? `<div class="rc-parts"><span class="small">${t.parts.some((p) => p.aiSuggested) ? 'Suggested steps' : 'Parts'}:</span> ${t.parts.map((p) => `<span class="chip">${esc(p.title)} · ${T.dur(p.mins)}</span>`).join(' ')}</div>` : ''}
      </article>`;
  }


  // ============================================================== APP SHELL ==
  function shell() {
    const views = { home: homeView, week: weekView, tasks: tasksView, profile: profileView };
    return `
      <div class="screen app">
        <button class="skip-link" data-action="skipToMain">Skip to main content</button>
        <main class="view view-${ui.tab}" id="main" tabindex="-1" ${ui.askMenu ? 'inert' : ''}>
          ${ui.offline ? `<p class="offline-banner" role="status">${ICON.info}<span>You're offline. Your plan still works. Syncing resumes when you're back.</span></p>` : ''}
          ${views[ui.tab]()}</main>
        ${ui.askMenu ? '<div class="ask-scrim" data-action="askMenuClose" aria-hidden="true"></div>' : ''}
        <nav class="bottom-nav ${ui.askMenu ? 'ask-on' : ''}" aria-label="Main">
          <div class="rail-brand" aria-hidden="true">${LOCKUP}</div>
          ${navBtn('home', 'Home', ICON.home)}
          ${navBtn('week', 'Overview', ICON.week)}
          <button class="fab" data-action="askMenu" aria-haspopup="dialog" aria-expanded="${!!ui.askMenu}" aria-label="Ask SIKAD: ask about your plan, add a task or report a change"><span class="fab-circle">${ui.askMenu ? ICON.close : ICON.mark}</span><span class="fab-label">Ask SIKAD</span></button>
          ${navBtn('tasks', 'Tasks', ICON.tasks)}
          ${navBtn('profile', 'Profile', ICON.user)}
          ${ui.askMenu ? askMenu() : ''}
        </nav>
      </div>`;
  }
  const navBtn = (tab, label, icon) => `<button class="nav-btn ${ui.tab === tab ? 'on' : ''}" data-action="tab" data-tab="${tab}" ${ui.tab === tab ? 'aria-current="page"' : ''}>${icon}<span class="nav-label"><span>${label}</span></span></button>`;
  /** Ask SIKAD opens from its nav item into two ways in. Both end in the same review and replan. */
  function askMenu() {
    const opt = (v, icon, title, desc, draft) => `<button class="ask-opt" data-action="askMode" data-v="${v}">
      <span class="ask-opt-icon">${icon}</span><span class="ask-opt-text"><b>${title}</b><span>${desc}</span>${draft ? '<span class="ask-opt-note">Your draft is saved here.</span>' : ''}</span></button>`;
    return `<div class="ask-menu" id="ask-menu" role="dialog" aria-labelledby="ask-menu-title">
      <div class="ask-menu-head"><h2 id="ask-menu-title">Ask SIKAD</h2><button class="icon-btn" data-action="askMenuClose" aria-label="Close">${ICON.close}</button></div>
      ${opt('text', ICON.mic, 'Speak or type', 'Ask a question or say what changed, in your own words.', ui.dumpDraft)}
      ${opt('form', ICON.tasks, 'Form', 'Add a task with a name, deadline and time needed.', ui.formDraft)}
    </div>`;
  }

  // ------------------------------------------------------------------ HOME --
  function homeView() {
    if (ui.focusOnly) {
      return `<header class="home-head has-toggle">${themeToggle()}<div class="eyebrow">${T.date(now())}</div><h1>One thing at a time</h1></header>
        ${focusCard()}
        <button class="btn ghost block" data-action="showFullPlan" data-flip="full-plan">Show my full plan</button>`;
    }
    return `
      <header class="home-head has-toggle">${themeToggle()}
        <div class="eyebrow">${T.date(now())}</div>
        <h1>Hey, ${esc(state.user.name || 'there')}</h1>
      </header>
      <div class="cols">
      <div class="col-a">
      ${updateCard()}
      ${checkinCards()}
      ${focusCard()}
      <div id="attention" tabindex="-1">${attentionBlock()}</div>
      ${todayCard()}
      ${weekCard()}
      </div>
      <div class="col-b">
      <section class="section" id="schedule">
        <div class="section-head" data-flip="tl-head">
          <h2 id="schedule-title" tabindex="-1">${ui.dayView === 'today' ? "Today's timeline" : "Tomorrow's preview"}</h2>
          <div class="seg" role="tablist" aria-label="Day to show">
            <button role="tab" aria-selected="${ui.dayView === 'today'}" class="${ui.dayView === 'today' ? 'on' : ''}" data-action="dayView" data-v="today">Today</button>
            <button role="tab" aria-selected="${ui.dayView === 'tomorrow'}" class="${ui.dayView === 'tomorrow' ? 'on' : ''}" data-action="dayView" data-v="tomorrow">Tomorrow</button>
          </div>
        </div>
        ${timeline(T.dayStart(now()) + (ui.dayView === 'tomorrow' ? T.DAY : 0))}
      </section>
      </div>
      </div>`;
  }

  const ACTION_WORD = { RESCHEDULE: 'Moved', SCHEDULE: 'Added', COMPLETE: 'Completed', CANCEL: 'Removed', UNSCHEDULED: "Couldn't fit" };
  /** One before → after row of the replan summary (design.md §7.8). */
  function changeLine(c) {
    const n = now();
    const when = (x) => `${T.rel(x.start, n)} ${T.timeShort(x.start)}`;
    let detail = '';
    const resized = c.action === 'RESCHEDULE' && c.from.start === c.to.start;
    if (resized) detail = `<b>${when(c.to)}</b> · now ${T.dur(c.to.mins)}`;
    else if (c.action === 'RESCHEDULE') detail = `<s><span class="sr-only">was </span>${when(c.from)}</s> <span aria-hidden="true">→</span><span class="sr-only">now</span> <b>${when(c.to)}</b>`;
    else if (c.action === 'SCHEDULE') detail = `<b>${when(c.to)}</b>`;
    else if (c.action === 'UNSCHEDULED') detail = 'see "Not enough time" below';
    return `<span class="ch-title">${esc(c.title)}</span><span class="ch-detail num">${detail}</span><span class="chip ch-${c.action.toLowerCase()}">${resized ? 'Resized' : ACTION_WORD[c.action] || c.action}</span>`;
  }

  function updateCard() {
    const u = state.lastUpdate;
    if (!u) return '';
    const next = E.nextSession(state.plan, now());
    const shown = u.changes.slice(0, 6);
    const short = u.status === 'INFEASIBLE';
    const skipped = /cancel|skip/i.test(u.trigger + ' ' + u.notes.join(' '));
    return `
      <section class="status-card ${short ? 's-neutral' : 's-success'} update" role="status" aria-labelledby="upd-title" data-flip="upd" data-flip-exit>
        <div class="sc-head">${ICON.check}<h2 id="upd-title">Plan updated</h2><button class="icon-btn" data-action="dismissUpdate" aria-label="Dismiss plan update">${ICON.close}</button></div>
        <p class="small">Because: ${esc(u.trigger)}</p>
        ${u.notes.map((x) => `<p class="small">${esc(x)}</p>`).join('')}
        ${shown.length ? `<ul class="changes">${shown.map((c) => `<li>${changeLine(c)}</li>`).join('')}</ul>${u.changes.length > shown.length ? `<p class="small">+${u.changes.length - shown.length} more</p>` : ''}`
          : '<p class="small">Nothing else needed to move.</p>'}
        ${short ? `<p class="small upd-warn">${ICON.hourglass}<span>Some work doesn't fit. See "Not enough time" below.</span></p>` : ''}
        <p class="small upd-fixed">${ICON.lock}<span>Fixed commitments unchanged${skipped ? ', except the one you chose to cancel or skip' : ''}.</span></p>
        ${next ? `<p class="small upd-next">${ICON.step}<span>Next: <b>${esc(next.title)}</b> · <span class="num">${T.rel(next.start, now())} ${T.timeShort(next.start)}</span></span></p>` : ''}
      </section>`;
  }

  function checkinCards() {
    return state.checkins.slice(-2).map((c) => {
      const moved = state.plan.find((x) => x.unitId === c.unitId);
      return `
        <section class="status-card s-clarify checkin" aria-labelledby="ci-${esc(c.id)}" data-flip="ci:${esc(c.id)}" data-flip-exit>
          <div class="sc-head">${ICON.undo}<h2 id="ci-${esc(c.id)}">Did you finish ${esc(c.title)}?</h2></div>
          <p class="num">It was planned for ${T.rel(c.start, now()).toLowerCase()}, ${T.range(c.start, c.end)}.</p>
          <p>${moved ? `In case you didn't, it's already moved to <b class="num">${T.rel(moved.start, now())} ${T.timeShort(moved.start)}</b>.` : "In case you didn't, it's back in your queue."}</p>
          <div class="row"><button class="btn small" data-action="checkinDone" data-id="${c.id}">${ICON.check} Yes, done</button><button class="btn small ghost" data-action="checkinNo" data-id="${c.id}">Not yet</button></div>
        </section>`;
    }).join('');
  }

  // "Start Class Diagram Exercise" reads well; "Start Study for…" doesn't (copy only).
  const STARTS_WITH_VERB = /^(study|buy|review|write|read|prepare|finish|do|practice|submit|pay|clean|pick|call|email|send|make|work|plan|draft|build|test|rehearse|outline)\b/i;

  function focusCard() {
    const n = now();
    const active = state.active ? state.plan.find((x) => x.id === state.active.sessionId) : null;
    const next = active || E.nextSession(state.plan, n);
    const pendingTasks = state.tasks.filter((t) => t.status === 'pending' || t.status === 'in_progress');
    if (!next) {
      const stuck = pendingTasks.length > 0;
      return `<section class="focus empty" aria-labelledby="focus-title" data-flip="focus"><div class="focus-label">${ICON.step}<span>What to do next</span></div>
        <h2 id="focus-title" tabindex="-1">${stuck ? 'Nothing fits right now' : "You're all clear."}</h2>
        <p>${stuck ? 'Some tasks need a deadline or more time. <button class="link on-dark-link" data-action="scrollAttention">See what needs attention</button>.' : 'No pending tasks. Open Ask SIKAD when something new comes up.'}</p></section>`;
    }
    const task = taskById(next.taskId);
    const [main, part] = next.title.split(' — ');
    const nowFixed = E.currentFixed(state, n);
    const beforeNext = E.occurrences(state, T.dayStart(n)).find((o) => !o.soft && o.start > n && o.start < next.start);
    const startsNow = next.start <= n + 15 * T.MIN;
    const why = E.explain(state, state.plan, next, n);
    const extra = [next.sessions > 1 ? `Session ${next.session} of ${next.sessions}` : '', next.mins >= 90 ? 'Long session' : ''].filter(Boolean)
      .map((x) => ` · <span class="nowrap">${x}</span>`).join('');
    const durLabel = task && task.isAiEstimate ? `<span class="est-dur">≈ ${T.dur(next.mins)}</span>` : T.dur(next.mins);
    return `
      <section class="focus ${active ? 'active' : ''}" aria-labelledby="focus-title" data-flip="focus" data-sid="${esc(next.id)}">
        <div class="focus-head" data-enter="fh:${esc(next.id)}">
        <div class="focus-label">${active ? `<span class="live-dot ${state.active.status === 'running' ? '' : 'is-still'}" aria-hidden="true"></span><span>${state.active.status === 'paused' ? 'Paused' : state.active.status === 'awaiting' ? 'Session ended' : 'In progress'}</span>` : `${ICON.step}<span>What to do next</span>`}</div>
        ${nowFixed && !active ? `<div class="focus-now">${ICON.lock}<span>Right now: ${esc(nowFixed.title)} until <span class="num">${T.timeShort(nowFixed.end)}</span></span></div>` : ''}
        <h2 id="focus-title" tabindex="-1"><span class="strike">${!active && startsNow && !STARTS_WITH_VERB.test(main) ? 'Start ' : ''}${esc(main)}</span></h2>
        ${part ? `<div class="focus-part"><span class="strike">— ${esc(part)}</span></div>` : ''}
        <div class="focus-time num">${ICON.clock}<span><span class="nowrap">${T.rel(next.start, n)} · ${T.range(next.start, next.end)}</span> · <span class="nowrap">${durLabel}</span>${extra}</span></div>
        <div class="focus-tags">${task && task.context ? `<span class="chip">${esc(task.context)}</span>` : ''}${task ? priChip(task.priority) : ''}${task && task.isAiEstimate ? estChip() : ''}</div>
        ${beforeNext && !active ? `<div class="focus-before">${ICON.lock}<span>Before that: ${esc(beforeNext.title)} · <span class="num">${T.range(beforeNext.start, beforeNext.end)}</span></span></div>` : ''}
        </div>
        ${active ? (ui.focusPick === next.id && state.active.status !== 'awaiting' ? focusPicker(next, task) : focusActive(next, task)) : `<div data-enter="fm:idle:${esc(next.id)}">
          ${why ? `<div class="why"><b>Why this?</b> ${esc(why)}</div>` : ''}
          <div class="focus-actions">
            <button class="btn primary" data-action="start" data-id="${next.id}">${ICON.play} Start task</button>
            <button class="btn on-dark" data-action="done" data-id="${next.id}" aria-label="Done: mark ${esc(next.title)} complete">${ICON.check} Done</button>
            <button class="btn on-dark" data-action="snooze" data-id="${next.id}" aria-label="Snooze: move to your next open block">Snooze</button>
          </div></div>`}
      </section>`;
  }

  // ------------------------------------------------------------ Focus Mode --
  /** Facts the working-method suggestion is based on (all read from the current plan). */
  function focusContext(session, task) {
    const n = now();
    const ref = Math.max(n, session.start);
    const day = T.dayStart(ref);
    const busy = E.occurrences(state, day).filter((o) => o.start > ref).sort((x, y) => x.start - y.start)[0];
    const dayEnd = T.at(day, state.baseline.dayEnd);
    const windowEnd = busy ? busy.start - state.baseline.bufferMins * T.MIN : dayEnd;
    const nextFixed = E.occurrences(state, day).filter((o) => !o.soft && o.start >= session.end).sort((x, y) => x.start - y.start)[0] || null;
    return {
      sessionMins: session.mins, windowMins: Math.max(0, Math.round((windowEnd - ref) / T.MIN)),
      remainingTaskMins: task ? S.taskRemaining(task) : session.mins, taskType: task ? task.type : 'task', nextFixed,
      pendingSteps: task ? task.parts.filter((p) => !p.done).map((p) => ({ title: p.title, mins: p.remainingMins })) : [],
    };
  }

  /** Opened with "Change" during a session: the suggested working method, why, and the other options. */
  function focusPicker(session, task) {
    const rec = F.recommend(focusContext(session, task));
    const chosen = ui.focusMethod || state.active.method;
    const last = state.prefs.focusMethod;
    return `
      <div class="method" role="group" aria-labelledby="method-title" data-enter="fm:picker">
        <div class="method-rec">
          <div class="method-eyebrow">Suggested way to work</div>
          <h3 id="method-title">${esc(rec.name)}</h3>
          <p>${esc(rec.reason)}</p>
          <p class="num method-structure">${esc(rec.structure)}</p>
        </div>
        <div class="method-options" role="radiogroup" aria-label="Working method">
          ${rec.options.map((o) => `<button class="method-opt ${chosen === o.method ? 'on' : ''}" role="radio" aria-checked="${chosen === o.method}" data-action="focusMethod" data-v="${o.method}">
            <span class="mo-name">${chosen === o.method ? ICON.check : ''}${esc(o.name)}${o.recommended ? ' <span class="mo-tag">Suggested</span>' : ''}${last === o.method && !o.recommended ? ' <span class="mo-tag">Last used</span>' : ''}</span>
            <span class="mo-desc num">${esc(o.structure)}</span></button>`).join('')}
        </div>
        <p class="method-note">A suggestion from this session's length and your schedule. Pick whatever suits you.</p>
        <div class="focus-actions">
          <button class="btn primary" data-action="focusBegin" data-id="${session.id}">Use this method</button>
          <button class="btn on-dark" data-action="focusCancel">Back to timer</button>
        </div>
      </div>`;
  }

  /** The running session (timer, Pause/Resume, End), then the "is it complete?" question. */
  function focusActive(session, task) {
    const a = state.active;
    const t = F.timer(a, S.focusElapsedMs(a));
    const m = F.METHODS[a.method] || F.METHODS.none;
    if (a.status === 'awaiting') {
      const partial = ui.focusPartial;
      const guess = Math.max(15, Math.round(Math.max(0, session.mins - t.focusedMins) / 15) * 15);
      return `
        <div class="outcome" role="group" aria-labelledby="outcome-title" data-enter="fm:outcome">
          <h3 id="outcome-title" tabindex="-1">Is this piece of work complete?</h3>
          <p>${t.finished ? 'The timer finished. ' : ''}You focused for <b class="num">${T.dur(Math.max(1, t.focusedMins))}</b> using ${esc(m.name.toLowerCase())}. A finished timer does not mark the task done. You decide.</p>
          ${partial ? `
            <label class="on-dark-label" for="focus-left">Time still needed for ${esc(session.title.split(' — ').pop())}</label>
            <span class="hrs-input"><input id="focus-left" type="number" min="0.25" step="0.25" value="${hrs(guess)}"> hrs</span>
            <div class="focus-actions">
              <button class="btn primary" data-action="focusSavePartial">Save and replan</button>
              <button class="btn on-dark" data-action="focusPartialBack">Back</button>
            </div>` : `
            <div class="focus-actions outcome-actions">
              <button class="btn primary" data-action="focusOutcome" data-v="complete">${ICON.check} Yes, it's complete</button>
              <button class="btn on-dark" data-action="focusOutcome" data-v="partial">Partly done</button>
              <button class="btn on-dark" data-action="focusOutcome" data-v="unfinished">Not yet</button>
            </div>
            <button class="link on-dark-link" data-action="focusKeepWorking">Keep working instead</button>`}
        </div>`;
    }
    const steps = a.method === 'chunking' && a.steps ? a.steps : null;
    const paused = a.status === 'paused';
    return `
      <div class="session" data-enter="fm:session">
        <div class="session-method"><div class="sm-name"><b>Method: ${esc(m.name)}</b> · <button class="link on-dark-link" data-action="focusChange" aria-label="Change working method">Change</button></div><span id="focus-phase">${esc(paused ? 'Paused' : t.label)}</span></div>
        ${ui.focusWhy && ui.focusWhy.id === session.id && ui.focusWhy.method === a.method ? `<p class="session-why">${esc(ui.focusWhy.text)}</p>` : ''}
        <div class="timer-row"><span id="focus-timer" class="num" role="timer" aria-label="${t.remainingMs == null ? 'Time focused' : 'Time left'}">${F.clock(t.remainingMs == null ? t.elapsedMs : t.remainingMs)}</span>
          <span class="timer-note">${t.remainingMs == null ? 'focused so far' : t.phase === 'break' ? 'of break left' : 'left'}</span></div>
        ${steps ? `<ol class="session-steps">${steps.map((st) => `<li>${esc(st.title)} <span class="num">${T.dur(st.mins)}</span></li>`).join('')}</ol>` : ''}
        <div class="focus-actions">
          ${paused ? `<button class="btn primary" data-action="focusResume">${ICON.play} Resume</button>` : ''}
          <button class="btn ${paused ? 'on-dark' : 'primary'}" data-action="focusOutcome" data-v="complete" aria-label="Mark done: ${esc(session.title)} is complete">${ICON.check} Mark done</button>
          ${paused ? '' : '<button class="btn on-dark" data-action="focusPause">Pause</button>'}
          <button class="btn on-dark" data-action="focusEnd" aria-label="Stop early: end this session and say how it went">Stop early</button>
        </div>
        <button class="link on-dark-link spot-toggle" data-action="spotlightToggle" aria-pressed="${!ui.spotlightOff}">${ui.spotlightOff ? 'Dim everything else' : 'Show my plan'}</button>
      </div>`;
  }

  /** Engine statuses that need the student (design.md §8): ERROR, needs-deadline, INFEASIBLE, warnings, info. */
  function attentionBlock() {
    const out = [];
    if (ui.error) {
      out.push(`
        <section class="status-card s-critical" role="alert" aria-labelledby="err-title" data-flip="err" data-flip-exit>
          <div class="sc-head">${ICON.alert}<h2 id="err-title">Couldn't update your plan</h2></div>
          <p>Your plan hasn't changed. ${esc(ui.error.detail || '')}</p>
          <div class="row">${ui.error.retrySheet ? '<button class="btn small" data-action="retryError">Try again</button>' : ''}<button class="btn small ghost" data-action="dismissError">Dismiss</button></div>
        </section>`);
    }
    for (const id of state.needsDeadline || []) {
      const t = taskById(id);
      if (!t) continue;
      out.push(`
        <section class="status-card s-clarify" aria-labelledby="nd-${t.id}" data-flip="nd:${t.id}" data-flip-exit>
          <div class="sc-head">${ICON.question}<h2 id="nd-${t.id}">When is "${esc(t.title)}" due?</h2></div>
          <p>SIKAD won't guess a deadline. Add the date and it gets scheduled.</p>
          <div class="row"><label class="sr-only" for="dl-${t.id}">Deadline for ${esc(t.title)}</label><input type="datetime-local" id="dl-${t.id}"><button class="btn small" data-action="setDeadline" data-id="${t.id}">Schedule it</button></div>
        </section>`);
    }
    const unsched = state.unscheduled || [];
    if (unsched.length) {
      const crit = (state.alerts || []).find((a) => a.level === 'CRITICAL');
      const lows = unsched.filter((u) => (taskById(u.taskId) || {}).priority === 'low');
      out.push(`
        <section class="status-card s-critical infeasible" aria-labelledby="inf-title" data-flip="inf" data-flip-exit>
          <div class="sc-head">${ICON.hourglass}<h2 id="inf-title">Not enough time</h2></div>
          ${crit ? `<p class="num">${esc(crit.message)}</p>` : ''}
          <ul class="unsched">${unsched.map((u) => `<li>
            <div><b>${esc(u.title)}</b><span class="num"> · ${T.dur(u.mins)}${u.deadline ? ` · due ${T.short(u.deadline)}` : ''}</span>
            <div class="small">${u.reason === 'blocked' ? `Waiting on: ${esc(u.waitingOn || 'an earlier step')}` : 'No open block before the deadline'}</div></div>
            <button class="btn small" data-action="openTask" data-id="${u.taskId}" aria-label="Adjust ${esc(u.title)}">Adjust</button></li>`).join('')}</ul>
          <details class="triage"><summary>${ICON.chevron}Review options</summary>
            <ul class="options">
              <li>Shorten a task's scope (Adjust → Time needed)</li>
              <li>Check if a deadline can move, then update it</li>
              ${lows.length ? `<li>Defer low-priority work like "${esc(lows[0].title)}"</li>` : ''}
              <li>Free up time by cancelling or moving a commitment you control</li>
            </ul>
          </details>
          <p class="small">SIKAD won't squeeze work into time you don't have, or push it past a deadline.</p>
        </section>`);
    }
    const warns = (state.alerts || []).filter((a) => a.level === 'WARNING' && !/needs a deadline|waiting on/.test(a.message));
    if (warns.length) out.push(`<section class="status-card s-clarify alerts" data-flip="warn" data-flip-exit>${warns.map((w) => `<p class="alert-line">${ICON.alert}<span>${esc(w.message)}</span></p>`).join('')}</section>`);
    const infos = (state.alerts || []).filter((a) => a.level === 'INFO');
    if (infos.length) out.push(`<section class="status-panel s-info" data-flip="info" data-flip-exit>${ICON.info}<div>${infos.map((w) => `<p>${esc(w.message)}</p>`).join('')}</div></section>`);
    return out.join('');
  }

  /**
   * Today at a glance. Remaining = the unfinished task sessions planned for today (classes, commutes and
   * other commitments are never counted). A task counts as completed once none of it is left on today's plan.
   */
  function todayStats() {
    const today = T.dayStart(now());
    const left = state.plan.filter((x) => T.dayStart(x.start) === today);
    const leftIds = new Set(left.map((x) => x.taskId));
    const doneIds = new Set(state.history.filter((h) => !h.partial && h.doneAt != null && T.dayStart(h.doneAt) === today && !leftIds.has(h.taskId)).map((h) => h.taskId));
    const total = leftIds.size + doneIds.size;
    return { leftMins: left.reduce((a, x) => a + x.mins, 0), left: leftIds.size, done: doneIds.size, total, percent: total ? Math.round((doneIds.size / total) * 100) : 0 };
  }

  function todayCard() {
    const d = todayStats();
    const from = ui.prevDayPct == null ? d.percent : ui.prevDayPct;
    const count = `${d.done} of ${d.total} task${d.total === 1 ? '' : 's'} completed`;
    return `
      <section class="card today" aria-labelledby="today-title" data-flip="today">
        <h2 id="today-title">Today</h2>
        <p class="metric-value num">${d.left ? `${T.dur(d.leftMins)} <span>remaining</span>` : d.total ? 'All tasks completed for today!' : 'No tasks planned for today'}</p>
        ${d.left ? '<p class="small metric-sub">Time needed for your remaining tasks today.</p>' : ''}
        ${d.total ? `<div class="bar week-bar" role="img" aria-label="${count} today"><span style="--from:${from}%;width:${d.percent}%"></span></div>` : ''}
        <div class="card-foot">${d.total ? `<span class="small num">${count}</span>` : '<span></span>'}<button class="text-link" data-action="viewSchedule">View schedule <span aria-hidden="true">→</span></button></div>
      </section>`;
  }

  /**
   * Weekly progress (brief §10). Metric, from S.weeklyProgress: work credited this week
   * against work credited + still planned this week (Mon–Sun). Rescheduling changes the
   * plan side only. No streaks, points or badges.
   */
  function weekCard() {
    const w = S.weeklyProgress(state);
    const outcomeWord = { complete: 'Completed', partial: 'Partly done', unfinished: 'Not finished yet' };
    const from = ui.prevPct == null ? w.percent : ui.prevPct;
    const sessions = state.focusLog.slice(-5).reverse();
    const win = ui.celebrate;
    // "Does it all fit?" in one word. Weekly totals can fit while a single deadline doesn't; never say "Fits" when work is unscheduled.
    const cap = E.capacity(state, now());
    const short = cap.required > cap.free, unsched = (state.unscheduled || []).length > 0;
    const verdict = short ? `${ICON.alert}${T.dur(cap.required - cap.free)} short` : unsched ? `${ICON.hourglass}Not all of it fits` : `${ICON.check}Fits`;
    const done = w.totalMins ? `<b>${T.dur(w.doneMins)}</b> completed of <b>${T.dur(w.totalMins)}</b> planned` : 'Nothing left to do this week';
    const sessionsLine = `<b>${w.focusSessions}</b> session${w.focusSessions === 1 ? '' : 's'}`;
    return `
      <section class="card week ${win ? 'win' : ''}" aria-labelledby="week-title" data-flip="week">
        <div class="fit-head"><h2 id="week-title">Weekly task progress</h2>${w.totalMins ? `<span class="week-pct num">${win ? ICON.check : ''}${w.percent}%</span>` : ''}</div>
        ${w.totalMins ? `<div class="bar week-bar" role="img" aria-label="${T.dur(w.doneMins)} done of ${T.dur(w.totalMins)} planned this week"><span style="--from:${from}%;width:${w.percent}%"></span></div>` : ''}
        <p class="small num week-line">${done}</p>
        <p class="small num week-line">${w.leftMins ? `<b>${T.dur(w.leftMins)}</b> of planned task time left · ` : ''}${sessionsLine}</p>
        <div class="card-foot"><span class="fit-verdict ${short || unsched ? 'bad' : 'good'}" title="${T.dur(cap.required)} of work due by ${T.DAY_SHORT[T.dow(cap.until)]}, ${approx(cap.free)} open">${verdict}</span><button class="text-link" data-action="viewWeek">View weekly overview <span aria-hidden="true">→</span></button></div>
        ${sessions.length ? `<details class="session-log"><summary>${ICON.chevron}Recent focus sessions (${state.focusLog.length})</summary>
          <ul class="plain small num">${sessions.map((f) => `<li><span><b>${esc(f.title)}</b><br>${T.short(f.at)} · ${esc((F.METHODS[f.method] || F.METHODS.none).name)} · ${T.dur(Math.max(1, f.focusedMins))} focused · ${outcomeWord[f.outcome] || f.outcome}</span></li>`).join('')}</ul></details>` : ''}
      </section>`;
  }

  // -------------------------------------------------------------- timeline --
  function timeline(dayMs) {
    const n = now();
    const b = state.baseline;
    const items = [];
    for (const o of E.occurrences(state, dayMs)) items.push({ kind: o.kind, fixed: !o.soft, soft: o.soft, title: o.title, start: o.start, end: o.end, mode: o.mode, occ: o });
    for (const s of state.plan.filter((x) => T.dayStart(x.start) === dayMs)) items.push({ kind: 'task', title: s.title, start: s.start, end: s.end, session: s });
    for (const h of state.history.filter((x) => T.dayStart(x.start) === dayMs)) items.push({ kind: 'done', title: h.title, start: h.start, end: h.end, taskId: h.taskId, id: h.id, partial: !!h.partial });
    for (const c of state.checkins.filter((x) => T.dayStart(x.start) === dayMs)) items.push({ kind: 'missed', title: c.title, start: c.start, end: c.end, unitId: c.unitId, id: c.id });
    // Open gaps worth knowing about.
    let free = E.freeSlots(state, Math.max(n, T.at(dayMs, b.dayStart)), T.at(dayMs, b.dayEnd));
    for (const s of state.plan) free = free.flatMap((f) => (s.end + 15 * T.MIN <= f.start || s.start - 15 * T.MIN >= f.end) ? [f]
      : [{ start: f.start, end: s.start - 15 * T.MIN }, { start: s.end + 15 * T.MIN, end: f.end }].filter((x) => x.end - x.start >= 45 * T.MIN));
    for (const f of free) if (f.end - f.start >= 45 * T.MIN) items.push({ kind: 'free', title: 'Open time', start: f.start, end: f.end });
    items.sort((a, c) => a.start - c.start || (a.kind === 'done' ? -1 : 0));
    if (!items.length) return '<p class="muted empty-tl">Nothing on this day.</p>';

    const nextId = (state.active && state.active.sessionId) || (E.nextSession(state.plan, n) || {}).id;
    const isToday = dayMs === T.dayStart(n);
    let nowPlaced = !isToday;
    const nowLine = `<li class="tl-now" data-flip="now"><span class="num">Now · ${T.time(n)}</span></li>`;
    const rows = [];
    for (const it of items) {
      if (!nowPlaced && it.start > n) { rows.push(nowLine); nowPlaced = true; }
      rows.push(tlRow(it, n, nextId));
    }
    if (!nowPlaced) rows.push(nowLine);
    return `<ol class="timeline" aria-label="Schedule for ${T.date(dayMs)}">${rows.join('')}</ol>`;
  }

  /** The latest replan's RESCHEDULE entry for this session, if any (marks it "Moved" until dismissed). */
  function movedInfo(session) {
    const u = state.lastUpdate;
    if (!u) return null;
    return u.changes.find((c) => c.action === 'RESCHEDULE' && c.to && c.title === session.title && c.to.start === session.start) || null;
  }

  /**
   * Stable identity for a timeline row across renders, so a replan can slide the same card to its new
   * slot (motion-spec §4). A completed session keeps its session's key: the row turns into its Done row.
   */
  function flipKey(it) {
    if (it.kind === 'task') return `s:${it.session.id}`;
    if (it.kind === 'done') return it.partial || !it.id ? `h:${it.id || it.start}` : `s:${String(it.id).split('@')[0]}`;
    if (it.kind === 'missed') return `m:${it.id}`;
    if (it.occ) return `f:${it.occ.id}:${it.start}`;
    return `o:${it.kind}:${it.start}`;
  }

  /** One step on the day's path (design.md §7.4): square node = fixed, round = flexible, Butter ring = next. */
  function tlRow(it, n, nextId) {
    const past = it.end <= n && !['done', 'missed'].includes(it.kind);
    const current = it.start <= n && n < it.end;
    const range = T.range(it.start, it.end);
    let title = esc(it.title), meta = range, action = '', icon = '', node = 'n-soft', label = '', chips = '';
    if (it.fixed) {
      icon = ICON.lock; node = 'n-fixed';
      const type = it.kind === 'class' ? `Class · ${it.mode === 'FTF' ? 'Face-to-face' : 'Online'}` : it.occ.source === 'temporary' ? 'One-time' : 'Weekly';
      meta += ` · ${type.replace('Face-to-face', FTF_LABEL)}`;
      action = `data-action="openFixed" data-id="${esc(it.occ.id)}" data-day="${T.dayStart(it.start)}"`;
      label = `${it.title}, ${type}, fixed, ${range}`;
    } else if (it.kind === 'task') {
      const t = taskById(it.session.taskId);
      const isNext = it.session.id === nextId;
      node = isNext ? 'n-next' : 'n-flex';
      icon = ICON.task;
      action = `data-action="openTask" data-id="${it.session.taskId}"`;
      const est = t && t.isAiEstimate;
      meta += ` · ${est ? `<span class="est-dur">≈ ${T.dur(it.session.mins)}</span>` : T.dur(it.session.mins)}`;
      if (it.session.sessions > 1) meta += ` · part ${it.session.session}/${it.session.sessions}`;
      const moved = movedInfo(it.session);
      if (moved) meta = `<s><span class="sr-only">was </span>${T.rel(moved.from.start, n)} ${T.timeShort(moved.from.start)}</s> → ${meta}`;
      if (state.active && state.active.sessionId === it.session.id) chips += '<span class="chip live">In progress</span>';
      else if (isNext) chips += '<span class="chip now">Next</span>';
      if (moved) chips += '<span class="chip moved">Moved</span>';
      if (t) chips += priChip(t.priority);
      // Three chips at most (state, state, priority). The ≈ and this text still mark the estimate.
      if (est && (chips.match(/class="chip/g) || []).length < 3) chips += estChip();
      else if (est) meta += ' · AI estimate';
      label = `${it.title}, task${est ? ', AI estimate' : ''}, ${range}`;
    } else if (it.kind === 'done') {
      icon = ICON.check; node = 'n-done';
      meta = it.start === it.end ? `Completed · ${T.time(it.start)}` : `${range} · Done`;
    } else if (it.kind === 'missed') {
      icon = ICON.undo; node = 'n-missed';
      const moved = state.plan.find((x) => x.unitId === it.unitId);
      meta += ` · Not marked done${moved ? ` — moved to ${T.rel(moved.start, n)} ${T.timeShort(moved.start)}` : ''}`;
    } else if (it.kind === 'free') {
      node = 'n-free';
      meta = `${range} · ${T.dur((it.end - it.start) / T.MIN)} free`;
    } else {
      icon = { commute: ICON.bus, lunch: ICON.meal, routine: ICON.sunrise }[it.kind] || '';
    }
    const cls = ['tl-item', `k-${it.kind}`, it.fixed ? 'fixed' : '', past ? 'past' : '', current ? 'current' : '', it.session && movedInfo(it.session) ? 'just-moved' : ''].join(' ');
    const tag = action ? 'button' : 'div';
    const leaves = it.kind === 'task' || it.kind === 'missed';
    return `<li class="${cls}" data-flip="${esc(flipKey(it))}" ${leaves ? 'data-flip-exit' : ''} ${it.session ? `data-sid="${esc(it.session.id)}"` : ''}><div class="tl-time num">${T.timeShort(it.start)}</div><div class="tl-rail" aria-hidden="true"><span class="tl-node ${node}"></span></div>
      <${tag} class="tl-card" ${action} ${label ? `aria-label="${esc(label)}${current ? ', happening now' : ''}"` : ''}>
        <div class="tl-title">${icon ? `<span class="tl-icon" aria-hidden="true">${icon}</span>` : ''}<span class="tl-name">${title}</span>${current ? '<span class="chip now">Now</span>' : ''}</div>
        <div class="tl-meta num">${meta}</div>${chips ? `<div class="tl-chips">${chips}</div>` : ''}</${tag}></li>`;
  }

  // ------------------------------------------------------------------ WEEK --
  const WEEK = 7 * T.DAY;
  const weekStartOf = (ms) => T.dayStart(ms) - ((T.dow(ms) + 6) % 7) * T.DAY;   // weeks run Monday to Sunday
  const monthDay = (ms) => { const x = T.parts(ms); return `${T.MONTHS[x.mo - 1].slice(0, 3)} ${x.d}`; };
  /** "Oct 5–11", or "Sep 28 – Oct 4" when the week crosses a month. */
  const weekLabel = (ws) => (T.parts(ws).mo === T.parts(ws + 6 * T.DAY).mo ? `${monthDay(ws)}–${T.parts(ws + 6 * T.DAY).d}` : `${monthDay(ws)} – ${monthDay(ws + 6 * T.DAY)}`);
  /** Which week and day Overview shows. Back to the earliest saved day (8 weeks at most), forward two weeks. */
  function weekState() {
    const today = T.dayStart(now()), cur = weekStartOf(today);
    let earliest = cur;
    for (const k of Object.keys(state.daySnapshots || {})) if (state.daySnapshots[k].blocks.length) earliest = Math.min(earliest, T.fromISO(k + 'T00:00'));
    for (const h of state.history) earliest = Math.min(earliest, T.dayStart(h.start));
    const min = Math.max(cur - 8 * WEEK, weekStartOf(earliest)), max = cur + 2 * WEEK;
    const start = Math.min(max, Math.max(min, ui.weekStart == null ? cur : ui.weekStart));
    const inWeek = (d) => d != null && d >= start && d < start + WEEK;
    const sel = inWeek(ui.weekDay) ? ui.weekDay : inWeek(today) ? today : start;
    return { today, cur, min, max, start, sel };
  }

  function weekView() {
    const n = now();
    const w = weekState();
    const { today, sel } = w;
    const b = state.baseline;
    const isPast = w.start < w.cur, isCurrent = w.start === w.cur;
    const days = Array.from({ length: 7 }, (_, i) => w.start + i * T.DAY);
    const stats = days.map((d) => {
      if (d < today) {                                       // a finished day: what was planned, and how much of it got done
        const sum = S.daySummary(state, T.key(d));
        return { d, past: true, sum, planned: sum.plannedMins, load: sum.plannedMins ? Math.round((sum.doneMins / sum.plannedMins) * 100) : 0 };
      }
      const planned = state.plan.filter((x) => T.dayStart(x.start) === d).reduce((a, x) => a + x.mins, 0);
      const free = E.freeSlots(state, Math.max(n, T.at(d, b.dayStart)), T.at(d, b.dayEnd)).reduce((a, x) => a + (x.end - x.start) / T.MIN, 0);
      return { d, planned, free, load: planned + free ? Math.round((planned / (planned + free)) * 100) : 0 };
    });
    const compact = (m) => (m ? `${Math.round((m / 60) * 10) / 10}h` : '—');
    const weeksAway = Math.round((w.start - w.cur) / WEEK);
    const relWeek = weeksAway === 0 ? 'This week' : weeksAway === -1 ? 'Last week' : weeksAway === 1 ? 'Next week' : weeksAway < 0 ? `${-weeksAway} weeks ago` : `In ${weeksAway} weeks`;

    let progress;
    if (isPast) {
      const sums = stats.map((st) => st.sum);
      const planned = sums.reduce((a, x) => a + x.plannedMins, 0), doneMins = sums.reduce((a, x) => a + x.doneMins, 0);
      const missed = sums.reduce((a, x) => a + x.missed.length, 0), moved = sums.reduce((a, x) => a + x.moved.length, 0);
      const anyHistory = state.history.some((h) => h.start >= w.start && h.start < w.start + WEEK);
      const pct = planned ? Math.round((doneMins / planned) * 100) : 0;
      progress = planned || anyHistory ? `
        <section class="card fit" aria-labelledby="cap-title" data-flip="cap">
          <div class="fit-head"><h2 id="cap-title">Done vs. planned</h2><span class="week-pct num">${pct}%</span></div>
          <div class="bar" role="img" aria-label="${T.dur(doneMins)} done of ${T.dur(planned)} planned that week"><span style="width:${pct}%"></span></div>
          <p class="small num">Done <b>${T.dur(doneMins)}</b> of <b>${T.dur(planned)}</b> planned · ${missed} missed · ${moved} moved</p>
        </section>` : `
        <section class="card fit" data-flip="cap"><p class="muted empty-week">Nothing saved for this week.</p></section>`;
    } else {
      // Same scope as the day chips below: this Monday–Sunday, from now on. Usable time is what the fixed
      // commitments leave open, whether or not a task is already planned into it.
      const end = w.start + WEEK, from = Math.max(n, w.start);
      const inWeek = (ms) => ms >= w.start && ms < end;
      const budget = Math.round(E.freeSlots(state, T.ceilTo(from, 15), end).reduce((a, x) => a + (x.end - x.start) / T.MIN, 0));
      const planned = state.plan.filter((x) => x.end > n && inWeek(x.start));
      const unfit = (state.unscheduled || []).filter((u) => u.deadline != null && u.deadline < end && (isCurrent || u.deadline >= w.start));
      const openIds = new Set(planned.concat(unfit).map((x) => x.taskId));
      const doneIds = new Set(state.workLog.filter((x) => inWeek(x.at) && !openIds.has(x.taskId) && (taskById(x.taskId) || {}).status === 'done').map((x) => x.taskId));
      const needed = planned.reduce((a, x) => a + x.mins, 0) + unfit.reduce((a, x) => a + x.mins, 0);
      const total = openIds.size + doneIds.size;
      const metric = (icon, label, value, sub) => `<li>${icon}<div><span class="metric-label">${label}</span><b class="metric-value num">${value}</b><span class="small metric-sub">${sub}</span></div></li>`;
      progress = `
        <section class="card fit summary" aria-labelledby="cap-title" data-flip="cap">
          <h2 id="cap-title">Weekly summary</h2>
          <ul class="metrics">
            ${metric(ICON.week, 'Your time budget', approx(budget), 'Total usable time for tasks this week.')}
            ${metric(ICON.tasks, 'Tasks remaining', `${openIds.size} of ${total}`, `${doneIds.size} task${doneIds.size === 1 ? '' : 's'} completed this week.`)}
            ${metric(ICON.clock, 'Time needed', needed ? T.dur(needed) : '0 min', 'Estimated time to finish remaining tasks.')}
          </ul>
        </section>`;
    }
    return `
      <header class="home-head week-head">
        <h1>Overview</h1>
        <div class="week-nav" role="group" aria-label="Week shown">
          <button class="icon-btn" data-action="weekNav" data-v="-1" aria-label="Previous week" ${w.start <= w.min ? 'disabled' : ''}>${ICON.back}</button>
          <div class="week-label" aria-live="polite"><b class="num">${weekLabel(w.start)}</b><span>${relWeek}</span></div>
          <button class="icon-btn" data-action="weekNav" data-v="1" aria-label="Next week" ${w.start >= w.max ? 'disabled' : ''}>${ICON.chevron}</button>
          ${isCurrent ? '' : '<button class="btn small" data-action="weekNav" data-v="0">This week</button>'}
        </div>
      </header>
      <div class="cols week-body">
      <div class="col-a">
      ${progress}
      <div class="daystrip" role="tablist" aria-label="Pick a day">
        ${stats.map((st) => {
          const name = st.d === today ? 'Today' : T.DAY_SHORT[T.dow(st.d)];
          const detail = st.past ? `${st.planned ? T.dur(st.planned) + ' planned' : 'nothing planned'}, ${T.dur(st.sum.doneMins)} done`
            : `${st.planned ? T.dur(st.planned) + ' planned' : 'nothing planned'}, ${approx(st.free)} open`;
          return `<button class="daychip ${st.d === sel ? 'on' : ''} ${st.past ? 'is-past' : ''}" data-action="pickDay" data-day="${st.d}" role="tab" aria-selected="${st.d === sel}"
            aria-label="${T.date(st.d)}: ${detail}">
            <span>${name}</span><b class="num">${T.parts(st.d).d}</b>
            <i class="load" style="--load:${st.load}%"></i><small class="num">${compact(st.planned)}</small></button>`;
        }).join('')}
      </div>
      <p class="small muted strip-legend">${isPast ? 'Hours = time planned that day. Bar = how much of it got done.' : 'Bars show the time needed for your remaining tasks each day.'}</p>
      </div>
      <div class="col-b">
      <section class="section"><div class="section-head"><h2>${T.date(sel)}</h2></div>${sel < today ? pastTimeline(sel) : timeline(sel)}</section>
      </div>
      </div>`;
  }

  /** A finished day: fixed commitments, what was planned (Done / Missed / Moved), and work done that wasn't planned. */
  function pastTimeline(dayMs) {
    const sum = S.daySummary(state, T.key(dayMs));
    const items = [];
    for (const o of E.occurrences(state, dayMs)) if (!o.soft) items.push({ kind: o.kind, fixed: true, title: o.title, start: o.start, end: o.end, mode: o.mode, occ: o });
    for (const blk of sum.blocks) items.push({ kind: 'planned', title: blk.title, start: blk.start, end: blk.end, block: blk });
    const blockIds = new Set(sum.blocks.map((x) => x.id)), doneTasks = new Set(sum.done.map((x) => x.taskId));
    for (const h of state.history.filter((x) => x.doneAt != null && T.dayStart(x.doneAt) === dayMs)) {
      if (blockIds.has(String(h.id).split('@')[0]) || doneTasks.has(h.taskId)) continue;
      items.push({ kind: 'unplanned', title: h.title, start: h.start, end: h.end });
    }
    items.sort((a, c) => a.start - c.start);
    if (!items.length) return '<p class="muted empty-tl">Nothing saved for this day.</p>';
    return `<ol class="timeline" aria-label="What happened on ${T.date(dayMs)}">${items.map(pastRow).join('')}</ol>`;
  }
  function pastRow(it) {
    const range = T.range(it.start, it.end);
    let icon = ICON.lock, node = 'n-fixed', meta = range, chip = '', cls = `k-${it.kind} fixed`;
    if (it.fixed) {
      meta += ` · ${it.kind === 'class' ? `Class · ${it.mode === 'FTF' ? FTF_LABEL : 'Online'}` : it.occ.source === 'temporary' ? 'One-time' : 'Weekly'}`;
    } else if (it.kind === 'unplanned') {
      icon = ICON.check; node = 'n-done'; cls = 'k-done';
      meta = it.start === it.end ? `Completed · ${T.time(it.start)}` : range;
      chip = `<span class="chip st-done">${ICON.check}Done (unplanned)</span>`;
    } else {
      const blk = it.block, mins = T.dur((it.end - it.start) / T.MIN);
      if (blk.done) { icon = ICON.check; node = 'n-done'; cls = 'k-done'; meta += ` · ${mins}`; chip = `<span class="chip st-done">${ICON.check}Done</span>`; }
      else if (blk.moved) { icon = ICON.snooze; node = 'n-flex'; cls = 'k-moved'; meta += ` · ${mins} · moved to another time`; chip = '<span class="chip moved">Moved</span>'; }
      else { icon = ICON.undo; node = 'n-missed'; cls = 'k-missed'; meta += ` · ${mins} · not marked done`; chip = `<span class="chip st-missed">${ICON.undo}Missed</span>`; }
    }
    return `<li class="tl-item is-history ${cls}"><div class="tl-time num">${T.timeShort(it.start)}</div><div class="tl-rail" aria-hidden="true"><span class="tl-node ${node}"></span></div>
      <div class="tl-card"><div class="tl-title"><span class="tl-icon" aria-hidden="true">${icon}</span><span class="tl-name">${esc(it.title)}</span></div>
        <div class="tl-meta num">${meta}</div>${chip ? `<div class="tl-chips">${chip}</div>` : ''}</div></li>`;
  }

  // ----------------------------------------------------------------- TASKS --
  function tasksView() {
    const n = now();
    const open = state.tasks.filter((t) => t.status === 'pending' || t.status === 'in_progress');
    const unschedIds = new Set((state.unscheduled || []).map((u) => u.taskId));
    const attention = open.filter((t) => t.deadline == null || unschedIds.has(t.id) || t.deadline <= n);
    const upcoming = open.filter((t) => !attention.includes(t)).sort((a, b) => a.deadline - b.deadline);
    const done = state.tasks.filter((t) => t.status === 'done');
    return `
      <header class="home-head"><h1>Tasks</h1><p class="head-sub num">${open.length} open · ${done.length} done</p></header>
      <button class="btn block" data-action="newTask">${ICON.plus} Add a task manually</button>
      ${attention.length ? `<h2 class="list-h" data-flip="lh:attention">Needs attention</h2>${attention.map(taskCard).join('')}` : ''}
      ${upcoming.length ? `<h2 class="list-h" data-flip="lh:next">Up next</h2>${upcoming.map(taskCard).join('')}` : ''}
      ${!open.length ? '<p class="muted empty-tl">No open tasks. Open Ask SIKAD to add one.</p>' : ''}
      ${done.length ? `<details class="done-list" data-flip="done-list"><summary>Completed (${done.length})</summary>${done.map(taskCard).join('')}</details>` : ''}`;
  }

  function taskCard(t) {
    const n = now();
    const total = S.taskTotal(t), rem = S.taskRemaining(t);
    const next = state.plan.filter((s) => s.taskId === t.id).sort((a, b) => a.start - b.start)[0];
    const unsched = (state.unscheduled || []).some((u) => u.taskId === t.id);
    const isExam = t.type === 'exam' || t.type === 'quiz';
    const overdue = t.deadline != null && t.deadline <= n && t.status !== 'done';
    const status = t.status === 'done' ? 'Done' : t.status === 'in_progress' ? 'In progress' : t.deadline == null ? 'Needs a deadline' : unsched ? "Doesn't fit yet" : 'Scheduled';
    const statusCls = t.status === 'done' ? 'st-done' : t.deadline == null ? 'st-clarify' : unsched ? 'st-critical' : '';
    const est = t.isAiEstimate ? `<span class="est-dur">≈ ${T.dur(total)}</span> ${estChip()}` : T.dur(total);
    return `
      <button class="task-card ${t.status}" data-action="openTask" data-id="${t.id}" data-flip="t:${t.id}">
        <div class="tc-head"><h3><span class="tc-icon" aria-hidden="true">${t.status === 'done' ? ICON.check : ICON.task}</span>${esc(t.title)}</h3>${t.status === 'done' ? '' : priChip(t.priority)}</div>
        ${t.context || t.source ? `<div class="tc-context">${esc(t.context || '')}${t.source ? `<span class="chip src">${esc(sourceName(t.source))}</span>` : ''}</div>` : ''}
        <dl class="tc-meta num">
          <div><dt>${isExam ? 'Exam' : 'Due'}</dt><dd class="${overdue ? 'overdue' : ''}">${overdue ? `${ICON.alert}<b>Overdue</b> · ` : ''}${t.deadline != null ? (isExam ? T.short(t.deadline) : `${T.short(t.deadline)}, ${T.time(t.deadline)}`) : 'Not set'}</dd></div>
          <div><dt>Est</dt><dd>${est}${rem < total && t.status !== 'done' ? ` <span class="muted">(${T.dur(rem)} left)</span>` : ''}</dd></div>
          <div><dt>Status</dt><dd class="${statusCls}">${status}${t.doFirst ? ' · Do first (your choice)' : ''}</dd></div>
          ${next ? `<div><dt>Next</dt><dd>${T.rel(next.start, n)}, ${T.timeShort(next.start)}</dd></div>` : ''}
        </dl>
        ${t.parts && t.parts.length ? `<ul class="subtasks">${t.parts.map((p) => `<li class="${p.done ? 'is-done' : ''}"><span class="st-box" aria-hidden="true">${p.done ? ICON.check : ''}</span>${esc(p.title)} <span class="muted num">${T.dur(p.mins)}</span><span class="sr-only">${p.done ? '(done)' : ''}</span></li>`).join('')}</ul>` : ''}
      </button>`;
  }

  // --------------------------------------------------------------- PROFILE --
  function profileView() {
    const b = state.baseline;
    const timeOpts = (sel, from, to) => {
      let o = '';
      for (let m = from; m <= to; m += 30) { const hm = T.minsToHm(m); o += `<option value="${hm}" ${hm === sel ? 'selected' : ''}>${T.hmLabel(hm)}</option>`; }
      return o;
    };
    if (ui.sub === 'classes') return classEditor();
    if (ui.sub === 'commitments') return commitManager();
    const subjects = new Set(b.classes.map((c) => c.title)).size;
    const classSum = b.classes.length ? `${plural(subjects, 'class', 'classes')} · ${plural(b.classes.length, 'session')} · ${daySpan(b.classes.map((c) => c.day))}` : 'No classes yet.';
    const groups = commitGroups();
    const nOf = (cat) => groups.filter((g) => g.cat === cat).length;
    const commitSum = groups.length ? [[nOf('work'), 'work schedule'], [nOf('org'), 'organization'], [nOf('other'), 'other']].filter(([n]) => n).map(([n, w]) => (w === 'other' ? `${n} other` : plural(n, w))).join(' · ') : 'None yet.';
    const clashes = clashPairs(b.classes.concat(b.recurring));
    const theme = themeSetting();
    const COMMUTE_STEPS = [15, 30, 45, 60, 75, 90, 120, 150, 180];
    const commuteOpts = COMMUTE_STEPS.includes(b.commuteMins) ? COMMUTE_STEPS : COMMUTE_STEPS.concat(b.commuteMins).sort((x, y) => x - y);
    return `
      <header class="home-head"><h1>${esc(state.user.name || 'You')}</h1><p class="head-sub">Profile and settings</p></header>
      <div class="cols profile">
      <div class="col-a">
      <section class="card settings manage-card p-classes">
        <div class="mc-text"><h2>Class schedule</h2><p class="mc-sum num">${classSum}</p></div>
        <button class="btn small" data-action="profileOpen" data-sub="classes" aria-label="Manage class schedule">Manage${ICON.chevron}</button>
      </section>
      <section class="card settings manage-card p-commit">
        <div class="mc-text"><h2>Recurring commitments</h2><p class="mc-desc">Work, organizations, and other regular activities</p><p class="mc-sum num">${commitSum}</p></div>
        <button class="btn small" data-action="profileOpen" data-sub="commitments" aria-label="Manage recurring commitments">Manage${ICON.chevron}</button>
      </section>
      ${clashes ? `<p class="mc-clash">${ICON.overlap}<span>${plural(clashes, 'weekly overlap')} to review. Open the schedule to see ${clashes === 1 ? 'it' : 'them'}.</span></p>` : ''}
      <section class="card settings limits" aria-labelledby="limits-title">
        <h2 id="limits-title">How SIKAD plans & its limits</h2>
        <ul class="limits-list">
          <li>SIKAD plans your time. It doesn't do your schoolwork or write graded work for you.</li>
          <li>It isn't a counselor or a health tool, and it doesn't judge your stress. If things feel like too much, talk to someone you trust or your school's guidance office.</li>
          <li>Times marked <span class="est-dur">≈</span> are guesses. Change them anytime.</li>
          <li>A plan isn't a promise. SIKAD can't guarantee grades or that everything fits. It shows you when it doesn't.</li>
          <li>Your classes and fixed commitments never move unless you change them. You decide.</li>
          <li>In this prototype, reading photos/PDFs, voice input, and calendar or class-platform connections use sample data. Planning, rescheduling and Undo work on what you type.</li>
          <li>Your data stays on this device.</li>
        </ul>
      </section>
      </div>
      <div class="col-b">
      <section class="card settings p-day">
        <h2>Your day</h2>
        <div class="grid2">
          <label>Day starts<select data-setting="dayStart">${timeOpts(b.dayStart, 240, 600)}</select></label>
          <label>Stop scheduling after<select data-setting="dayEnd">${timeOpts(b.dayEnd, 1140, 1410)}</select></label>
          <label>Commute (FTF days)<select data-setting="commuteMins" data-type="int">${commuteOpts.map((m) => `<option value="${m}" ${m === b.commuteMins ? 'selected' : ''}>${COMMUTE_STEPS.includes(m) ? T.dur(m) : `Custom (${m ? T.dur(m) : 'none'})`}</option>`).join('')}</select></label>
          <label>Morning routine<select data-setting="routineMins" data-type="int">${[0, 15, 30, 45, 60].map((m) => `<option value="${m}" ${m === b.routineMins ? 'selected' : ''}>${m ? T.dur(m) : 'None'}</option>`).join('')}</select></label>
        </div>
        <label class="toggle"><input type="checkbox" data-setting="protectLunch" ${b.protectLunch ? 'checked' : ''}> Protect a lunch hour (12–1 PM) when free</label>
        <p class="small muted">SIKAD keeps a ${b.bufferMins}-minute transition buffer around every task. Changes here recalculate your plan, and you can undo them.</p>
      </section>

      <section class="card settings">
        <h2 id="appearance-title">Appearance</h2>
        <div class="seg" role="radiogroup" aria-labelledby="appearance-title">
          ${[['light', 'Light'], ['dark', 'Dark'], ['system', 'System']].map(([v, label]) => `<button role="radio" aria-checked="${theme === v}" class="${theme === v ? 'on' : ''}" data-action="setTheme" data-v="${v}">${label}</button>`).join('')}
        </div>
      </section>

      <section class="card settings">
        <h2>Connected platforms</h2>
        <div class="integrations">${D.INTEGRATIONS.map(integrationRow).join('')}</div>
        ${sampleNote('Prototype: connections use sample data.')}
      </section>

      <section class="card settings p-reset">
        <h2>Reset</h2>
        <p class="small">Erases everything on this device and restarts setup.</p>
        <button class="btn small danger" data-action="resetAll">Reset & restart setup</button>
      </section>
      </div>
      </div>
      ${versionText()}`;
  }

  // ---------- Profile management views: the weekly baseline (classes + recurring commitments) ----------
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + 's'}`;
  const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
  const dayRank = (d) => (d + 6) % 7;
  const byDayTime = (a, c) => dayRank(a.day) - dayRank(c.day) || T.hmToMins(a.start) - T.hmToMins(c.start);
  /** "Mon–Fri" when the days run together, otherwise "Mon, Wed, Fri". */
  function daySpan(days) {
    const u = [...new Set(days)].sort((a, c) => dayRank(a) - dayRank(c));
    if (!u.length) return '';
    const run = u.every((d, i) => i === 0 || dayRank(d) === dayRank(u[i - 1]) + 1);
    return run && u.length > 2 ? `${T.DAY_SHORT[u[0]]}–${T.DAY_SHORT[u[u.length - 1]]}` : u.map((d) => T.DAY_SHORT[d]).join(', ');
  }
  const commitCat = (r) => (r.kind === 'work' ? 'work' : r.kind === 'org' ? 'org' : 'other');
  /** Weekly rows that are the same commitment on different days are shown and edited as one entry. */
  function commitGroups() {
    const map = new Map();
    for (const r of state.baseline.recurring) {
      const key = [r.kind, r.title, r.start, r.end, r.notes || '', r.place || ''].join('|');
      if (!map.has(key)) map.set(key, { ids: [], days: [], title: r.title, kind: r.kind, cat: commitCat(r), start: r.start, end: r.end, notes: r.notes || '', place: r.place || '', rows: [] });
      const g = map.get(key); g.ids.push(r.id); g.days.push(r.day); g.rows.push(r);
    }
    return [...map.values()].sort((a, c) => byDayTime(a.rows.slice().sort(byDayTime)[0], c.rows.slice().sort(byDayTime)[0]));
  }
  /** Other fixed weekly items on the same day that overlap this one. Read-only: nothing is moved or replaced. */
  function baselineClashes(rec) {
    const s = T.hmToMins(rec.start), e = T.hmToMins(rec.end);
    return state.baseline.classes.concat(state.baseline.recurring).filter((c) => c.id !== rec.id && c.day === rec.day && T.hmToMins(c.start) < e && T.hmToMins(c.end) > s);
  }
  /** How many overlapping pairs involve these rows (each pair counted once). */
  function clashPairs(rows) {
    const pairs = new Set();
    for (const r of rows) for (const c of baselineClashes(r)) pairs.add([r.id, c.id].sort().join('|'));
    return pairs.size;
  }
  const clashNote = (list) => (list.length ? `<span class="crow-clash">${ICON.overlap}Overlaps ${[...new Set(list.map((c) => esc(c.title)))].join(', ')}</span>` : '');
  const subHead = (title, sub) => `
      <header class="home-head sub-head">
        <button class="back-link" data-action="profileBack">${ICON.back}Profile</button>
        <h1>${title}</h1><p class="head-sub">${sub}</p>
      </header>`;
  const rowMenu = (label, edit, remove) => `
        <details class="row-menu"><summary class="icon-btn" aria-label="Actions for ${esc(label)}">${ICON.more}</summary>
          <div class="row-menu-list"><button ${edit}>Edit</button><button class="danger" ${remove}>Remove</button></div></details>`;
  const clashPanel = (n) => (n ? `<div class="status-panel s-conflict" role="status">${ICON.overlap}<div><b>${plural(n, 'overlap')} to review</b><p>These are both fixed, so SIKAD keeps both and moves neither. Edit or remove one to resolve it.</p></div></div>` : '');

  function classEditor() {
    const b = state.baseline;
    const days = WEEK_ORDER.filter((d) => (d >= 1 && d <= 5) || b.classes.some((c) => c.day === d));
    const total = b.classes.reduce((a, c) => a + T.hmToMins(c.end) - T.hmToMins(c.start), 0);
    const clashes = clashPairs(b.classes);
    return `
      <div class="subview">
      ${subHead('Class schedule', b.classes.length ? `${plural(b.classes.length, 'session')} a week · ${T.dur(total)}. Fixed: SIKAD plans around them.` : 'Add your classes so SIKAD can plan around them.')}
      <button class="btn primary block" data-action="classAdd">${ICON.plus}Add a class</button>
      ${clashPanel(clashes)}
      <section class="card acc" aria-label="Classes by weekday">
        ${days.map((d) => {
          const list = b.classes.filter((c) => c.day === d).sort(byDayTime), open = !!ui.accOpen[d];
          const mins = list.reduce((a, c) => a + T.hmToMins(c.end) - T.hmToMins(c.start), 0);
          return `<div class="acc-item ${open ? 'open' : ''}">
            <h2 class="acc-h"><button class="acc-btn" data-action="accToggle" data-d="${d}" aria-expanded="${open}" aria-controls="acc-${d}">
              <span class="acc-name">${T.DAY_NAMES[d]}</span><span class="acc-meta num">${list.length ? `${plural(list.length, 'class', 'classes')} · ${T.dur(mins)}` : 'No classes'}</span>${ICON.chevron}</button></h2>
            ${open ? `<div class="acc-body ${ui.accJust === d ? 'is-opening' : ''}" id="acc-${d}">
              ${list.length ? `<ul class="crows">${list.map((c) => `<li class="crow">
                <div class="crow-main"><b>${esc(c.title)}</b>
                  <span class="crow-meta num">${T.hmLabel(c.start)}–${T.hmLabel(c.end)} · ${c.mode === 'FTF' ? FTF_LABEL : 'Online'}${c.room ? ` · ${esc(c.room)}` : ''}</span>${clashNote(baselineClashes(c))}</div>
                ${rowMenu(`${c.title} on ${T.DAY_NAMES[d]}`, `data-action="classEdit" data-id="${c.id}"`, `data-action="classRemove" data-id="${c.id}"`)}</li>`).join('')}</ul>`
                : `<p class="acc-empty">No classes on ${T.DAY_NAMES[d]}.</p>`}
              <button class="link acc-add" data-action="classAdd" data-d="${d}">Add a class on ${T.DAY_NAMES[d]}</button>
            </div>` : ''}
          </div>`;
        }).join('')}
      </section>
      </div>`;
  }

  const COMMIT_CATS = [
    { cat: 'work', title: 'Work schedule', add: 'Add work schedule', empty: 'No work schedule. Add one only if you have a job with regular hours.' },
    { cat: 'org', title: 'Organizations', add: 'Add organization', empty: 'No organizations yet. Add one to keep its meetings free of tasks.' },
    { cat: 'other', title: 'Other commitments', add: 'Add a commitment', empty: 'Nothing else repeats weekly. Add regular appointments or family time here.' },
  ];
  function commitManager() {
    const groups = commitGroups();
    const clashOf = (g) => g.rows.flatMap(baselineClashes).filter((c) => !g.ids.includes(c.id));
    const upcomingEvents = state.events.filter((e) => e.end > now()).sort((a, c) => a.start - c.start);
    return `
      <div class="subview">
      ${subHead('Recurring commitments', 'These repeat every week. SIKAD plans around them and never moves them.')}
      ${clashPanel(clashPairs(state.baseline.recurring))}
      ${COMMIT_CATS.map((k) => {
        const list = groups.filter((g) => g.cat === k.cat);
        return `<section class="card settings commit-cat" aria-labelledby="cat-${k.cat}">
          <div class="list-head"><h2 id="cat-${k.cat}">${k.title}</h2>${list.length ? `<span class="small muted num">${list.length}</span>` : ''}</div>
          ${list.length ? `<ul class="crows">${list.map((g) => `<li class="crow">
            <div class="crow-main"><b>${esc(g.title)}</b>
              <span class="crow-meta num">${daySpan(g.days)} · ${T.hmLabel(g.start)}–${T.hmLabel(g.end)}${g.place ? ` · ${esc(g.place)}` : ''}</span>
              ${g.notes ? `<span class="crow-notes">${esc(g.notes)}</span>` : ''}${clashNote(clashOf(g))}</div>
            ${rowMenu(g.title, `data-action="commitEdit" data-ids="${g.ids.join(',')}"`, `data-action="commitRemove" data-ids="${g.ids.join(',')}"`)}</li>`).join('')}</ul>`
            : `<p class="acc-empty">${k.empty}</p>`}
          <button class="btn small" data-action="commitAdd" data-kind="${k.cat}">${ICON.plus}${k.add}</button>
        </section>`;
      }).join('')}
      ${upcomingEvents.length || state.cancellations.length ? `<section class="card settings">
        <h2>One-time changes</h2>
        <p class="small muted">Single dates only. These are not part of your weekly baseline and never become recurring on their own.</p>
        ${upcomingEvents.length ? `<h3>One-time commitments</h3><ul class="plain fixed-list">${upcomingEvents.map((e) => `<li><span class="num">${ICON.lock}<b>${esc(e.title)}</b> · ${T.short(e.start)} ${T.range(e.start, e.end)}</span><button class="btn small ghost" aria-label="Remove ${esc(e.title)}" data-action="removeEvent" data-id="${e.id}">Remove</button></li>`).join('')}</ul>` : ''}
        ${state.cancellations.length ? `<h3>Cancelled sessions</h3><ul class="plain">${state.cancellations.map((c) => `<li><span>${esc(cancellationLabel(c))}</span><button class="btn small" data-action="restoreOcc" data-id="${esc(c)}" aria-label="Restore ${esc(cancellationLabel(c))}">Restore</button></li>`).join('')}</ul>` : ''}
      </section>` : ''}
      </div>`;
  }

  // ---------- Add / edit forms for the weekly baseline (bottom sheets) ----------
  const dayPicker = (f, err) => `
        <fieldset class="day-pick"><legend>Days <span class="req">(one or more)</span></legend>
          <div class="chips">${WEEK_ORDER.map((d) => `<button type="button" class="chip-btn ${f.days.includes(d) ? 'on' : ''}" aria-pressed="${f.days.includes(d)}" aria-label="${T.DAY_NAMES[d]}" data-action="formDay" data-d="${d}">${T.DAY_SHORT[d]}</button>`).join('')}</div>
          ${err ? `<p class="field-error" role="alert">${ICON.alert}<span>Pick at least one day.</span></p>` : ''}
        </fieldset>`;
  const timePair = (f) => `
        <div class="grid2">
          <label>Start<input type="time" value="${esc(f.start)}" data-bind="sheet.form.start"></label>
          <label>End<input type="time" value="${esc(f.end)}" data-bind="sheet.form.end"></label>
        </div>`;
  const segPick = (label, key, cur, opts) => `
        <div class="seg-field"><span class="seg-label" id="seg-${key}">${label}</span>
          <div class="seg" role="radiogroup" aria-labelledby="seg-${key}">${opts.map(([v, text]) => `<button type="button" role="radio" aria-checked="${cur === v}" class="${cur === v ? 'on' : ''}" data-action="formSet" data-k="${key}" data-v="${v}">${text}</button>`).join('')}</div></div>`;
  const formClash = (sh) => (sh.conflicts && sh.conflicts.length ? `
      <div class="status-panel s-conflict" role="alert">${ICON.overlap}<div><b>This overlaps a fixed commitment</b>
        <p class="num">${sh.conflicts.map((c) => `${esc(c.title)} on ${c.dayName} (${T.hmLabel(c.start)}–${T.hmLabel(c.end)})`).join('; ')}.</p>
        <p>Nothing is replaced. Change the day or time, or save anyway and both stay on your schedule marked as an overlap.</p></div></div>` : '');
  const formActions = (sh, action, label) => `
      <div class="sheet-actions">
        <button class="btn" data-action="closeSheet">Cancel</button>
        <button class="btn primary" data-action="${action}">${sh.conflicts && sh.conflicts.length ? 'Save anyway' : label}</button>
      </div>`;

  function classFormSheet() {
    const sh = ui.sheet, f = sh.form;
    return `
      <h2 id="sheet-title" tabindex="-1">${sh.groupIds.length ? 'Edit class' : 'Add a class'}</h2>
      <p class="sheet-sub">${sh.groupIds.length > 1 ? 'Changes apply to every day this class meets.' : 'Classes are fixed. SIKAD plans around them.'}</p>
      <div class="form baseline-form">
        <label>Subject or class name <span class="req">(required)</span><input value="${esc(f.title)}" data-bind="sheet.form.title" placeholder="e.g. IT 203" autocomplete="off"></label>
        ${dayPicker(f, sh.dayError)}
        ${timePair(f)}
        ${segPick('Mode', 'mode', f.mode, [['FTF', 'Face-to-face'], ['Online', 'Online']])}
        <label>Room or location <span class="req">(optional)</span><input value="${esc(f.room)}" data-bind="sheet.form.room" placeholder="e.g. Room 204" autocomplete="off"></label>
      </div>
      ${formClash(sh)}
      ${formActions(sh, 'classSave', sh.groupIds.length ? 'Save changes' : 'Add class')}`;
  }

  const COMMIT_FIELDS = {
    work: { name: 'Work role or schedule name', ph: 'e.g. Library assistant', missing: 'Name is missing. Type the role or job, e.g. "Library assistant".' },
    org: { name: 'Organization name', ph: 'e.g. Junior Programmers Guild', missing: 'Name is missing. Type the organization, e.g. "Junior Programmers Guild".' },
    other: { name: 'Commitment name', ph: 'e.g. Family dinner', missing: 'Name is missing. Type what the commitment is, e.g. "Family dinner".' },
  };
  function commitFormSheet() {
    const sh = ui.sheet, f = sh.form, k = COMMIT_FIELDS[f.cat];
    const savedOrgs = [...new Set(state.baseline.recurring.filter((r) => r.kind === 'org').map((r) => r.title))].filter((n) => n !== f.title.trim());
    return `
      <h2 id="sheet-title" tabindex="-1">${sh.groupIds.length ? 'Edit commitment' : 'Add a commitment'}</h2>
      <p class="sheet-sub">Repeats every week on the days you pick. SIKAD plans around it.</p>
      <div class="form baseline-form">
        ${segPick('Category', 'cat', f.cat, [['work', 'Work'], ['org', 'Organization'], ['other', 'Other']])}
        <label>${k.name} <span class="req">(required)</span><input value="${esc(f.title)}" data-bind="sheet.form.title" placeholder="${k.ph}" autocomplete="off"></label>
        ${f.cat === 'org' && !sh.groupIds.length && savedOrgs.length ? `<div class="saved-orgs"><span class="seg-label">Your organizations</span><div class="chips">${savedOrgs.map((n) => `<button type="button" class="chip-btn" data-action="formSet" data-k="title" data-v="${esc(n)}">${esc(n)}</button>`).join('')}</div></div>` : ''}
        ${f.cat === 'work' ? `<label>Workplace <span class="req">(optional)</span><input value="${esc(f.place)}" data-bind="sheet.form.place" placeholder="e.g. Campus library" autocomplete="off"></label>` : ''}
        ${dayPicker(f, sh.dayError)}
        ${timePair(f)}
        <label>Notes <span class="req">(optional)</span><input value="${esc(f.notes)}" data-bind="sheet.form.notes" placeholder="e.g. Bring laptop" autocomplete="off"></label>
      </div>
      ${formClash(sh)}
      ${formActions(sh, 'commitSave', sh.groupIds.length ? 'Save changes' : 'Add commitment')}`;
  }

  /** Shared checks for both baseline forms. Returns true when the form may be saved. */
  function baselineFormOk(missingMsg) {
    const sh = ui.sheet, f = sh.form, b = state.baseline;
    if (!f.title.trim()) { flagField(document.querySelector('[data-bind="sheet.form.title"]'), missingMsg); return false; }
    if (!f.days.length) { sh.dayError = true; render(); const c = document.querySelector('.day-pick .chip-btn'); if (c) c.focus(); return false; }
    if (!f.start) { flagField(document.querySelector('[data-bind="sheet.form.start"]'), 'Start time is missing.'); return false; }
    if (!f.end || f.end <= f.start) { flagField(document.querySelector('[data-bind="sheet.form.end"]'), 'End time must be later than the start time.'); return false; }
    // Overlaps with other fixed weekly items are shown first; the student decides. Nothing is overwritten.
    const others = { baseline: { classes: b.classes.filter((c) => !sh.groupIds.includes(c.id)), recurring: b.recurring.filter((r) => !sh.groupIds.includes(r.id)) } };
    const hits = E.recurringConflicts(others, { days: f.days, start: f.start, end: f.end });
    const key = `${f.days.join(',')}|${f.start}|${f.end}`;
    if (hits.length && sh.conflictKey !== key) {
      sh.conflicts = hits; sh.conflictKey = key; render();
      const p = document.querySelector('.sheet .s-conflict'); if (p) p.scrollIntoView({ block: 'nearest' });
      return false;
    }
    sh.conflicts = hits;
    return true;
  }
  /** Write the form back to a weekly list: rows on kept days keep their id, new days are added, dropped days removed. */
  function writeBaselineRows(listKey, prefix, groupIds, days, fields) {
    const list = state.baseline[listKey];
    const group = list.filter((r) => groupIds.includes(r.id));
    for (const d of days) {
      const row = group.find((r) => r.day === d) || { id: S.uid(state, prefix), day: d };
      Object.assign(row, fields);
      for (const k of Object.keys(row)) if (row[k] === '') delete row[k];
      if (!list.includes(row)) list.push(row);
    }
    state.baseline[listKey] = list.filter((r) => !groupIds.includes(r.id) || days.includes(r.day));
  }
  /** Move focus to the page title after an in-app view change (same rule as browser Back). */
  function focusHeading() { const h = document.querySelector('main h1'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); } }
  function cancellationLabel(id) {
    const [ref, date] = id.split('@');
    const [kind, refId] = ref.split(':');
    const src = kind === 'cls' ? state.baseline.classes.find((c) => c.id === refId) : state.baseline.recurring.find((r) => r.id === refId);
    return `${src ? src.title : 'Commitment'} on ${T.short(T.fromISO(date + 'T00:00'))}`;
  }

  // ================================================================ SHEETS ==
  function sheet() {
    const sh = ui.sheet;
    const inner = { dump: dumpSheet, proposal: proposalSheet, task: taskSheet, fixed: fixedSheet, engine: engineSheet, confirm: confirmSheet, import: importSheet, classForm: classFormSheet, commitForm: commitFormSheet }[sh.type]();
    return `<div class="sheet-backdrop" data-action="backdrop"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
      <div class="sheet-grip" aria-hidden="true"></div><button class="icon-btn sheet-close" data-action="closeSheet" aria-label="Close">${ICON.close}</button>${inner}</div></div>`;
  }

  // ---------- Confirm (destructive actions only) ----------
  /** One shared bottom sheet asks before anything is removed or erased. Cancel returns to where the student was. */
  function confirmSheet() {
    const sh = ui.sheet;
    return `
      <h2 id="sheet-title" tabindex="-1">${esc(sh.title)}</h2>
      <p class="sheet-sub">${esc(sh.body)}</p>
      <div class="sheet-actions confirm-actions">
        <button class="btn" data-action="confirmNo">Cancel</button>
        <button class="btn danger" data-action="confirmYes">${esc(sh.label)}</button>
      </div>`;
  }
  function askConfirm(c) {
    ui.sheet = Object.assign({ type: 'confirm', back: ui.sheet && ui.sheet.type !== 'confirm' ? ui.sheet : null }, c);
    ui.dock = false;
    render();
  }

  // ---------- Brain dump (capture + review) ----------
  /** One answered question in the Ask SIKAD thread. The answer text comes from js/assistant.js. */
  function askEntry(e, i, lastIdx) {
    const a = e.a;
    return `<div class="ask-item">
      <p class="ask-q"><span class="sr-only">You asked: </span>${esc(e.q)}</p>
      <div class="ask-a ${a.missing ? 'is-missing' : ''}" ${i === lastIdx ? 'id="ask-latest" tabindex="-1"' : ''}>
        <h3>${esc(a.title)}</h3>
        ${a.lines.map((l) => `<p>${esc(l)}</p>`).join('')}
        ${a.facts.length ? `<dl class="ask-facts num">${a.facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : ''}
      </div>
    </div>`;
  }

  /** Ask SIKAD (brief §8): a supporting panel for questions and updates, not a full-screen chat. */
  function dumpSheet() {
    const sh = ui.sheet;
    if (sh.mode === 'review') return dumpReview();
    const form = sh.input === 'form';
    const thread = ui.askThread.slice(-2);
    return `
      <h2 id="sheet-title"><span class="title-icon">${form ? ICON.tasks : ICON.braindump}</span>${form ? 'Add a task' : 'Ask SIKAD'}</h2>
      <p class="sheet-sub">${form ? 'Fill in what you know. SIKAD fits it into your plan, and you can undo it right after.' : 'Ask about your plan, add a task, or say what changed. Nothing in your plan changes until you confirm it.'}</p>
      ${thread.length && !form ? `<div class="ask-thread" aria-label="Recent answers">${thread.map((e, i) => askEntry(e, i, thread.length - 1)).join('')}</div>` : ''}
      <div class="tabs" role="tablist" aria-label="Input method">
        <button role="tab" aria-selected="${!form}" class="${!form ? 'on' : ''}" data-action="dumpInput" data-v="text">Speak or type</button>
        <button role="tab" aria-selected="${form}" class="${form ? 'on' : ''}" data-action="dumpInput" data-v="form">Form</button>
      </div>
      ${form ? manualForm() : `
        ${dictaphone('sheet.text')}
        <label class="divider" for="dump-text"><span>or type it</span></label>
        <textarea id="dump-text" rows="3" data-bind="sheet.text" placeholder="e.g. How much usable time do I have tomorrow?">${esc(sh.text || '')}</textarea>
        ${sh.restored ? '<p class="small muted">Picked up the text you left here.</p>' : ''}
        <button class="btn primary block" data-action="processDump">Send</button>
        <div class="ask-examples"><p class="small" id="ask-ex">Try asking</p>
          <div class="chips" aria-labelledby="ask-ex">${D.QUESTIONS.map((q, i) => `<button class="chip-btn" data-action="askExample" data-i="${i}">${esc(q)}</button>`).join('')}</div></div>
        <p class="small muted">Answers are worked out from your current plan using fixed rules. No AI model is connected in this prototype.</p>`}`;
  }

  function manualForm() {
    const f = ui.sheet.form || (ui.sheet.form = { title: '', deadline: null, durationMins: 60, priority: 'medium', notes: '' });
    return `
      <div class="form">
        <label>Task name <span class="req">(required)</span><input value="${esc(f.title)}" data-bind="sheet.form.title" placeholder="e.g. IT 208 report" required aria-required="true"></label>
        <label>Deadline<input type="datetime-local" value="${f.deadline != null ? T.toInput(f.deadline) : ''}" data-bind="sheet.form.deadline" data-type="dt"></label>
        <label>Estimated duration (hours)<input type="number" min="0.25" step="0.25" value="${hrs(f.durationMins)}" data-bind="sheet.form.durationMins" data-type="hrs"></label>
        <label>Priority (optional)<select data-bind="sheet.form.priority">${['high', 'medium', 'low'].map((p) => `<option value="${p}" ${p === f.priority ? 'selected' : ''}>${PRI_LABEL[p]}</option>`).join('')}</select></label>
        <label>Notes (optional)<textarea rows="2" data-bind="sheet.form.notes">${esc(f.notes)}</textarea></label>
        <button class="btn primary block" data-action="saveManual">Add to plan</button>
      </div>`;
  }

  function dumpReview() {
    const sh = ui.sheet;
    const blocking = dumpBlocking();
    const actionable = sh.items.some((it) => it.include && !['stress', 'unclear', 'duplicate', 'next', 'refuse'].includes(it.kind)) ||
      sh.items.some((it) => it.kind === 'refuse' && it.addAsTask);
    return `
      <h2 id="sheet-title">Here's what changed</h2>
      <blockquote class="quote">“${esc(sh.text)}”</blockquote>
      ${sh.items.some((it) => it.kind === 'task' && it.task.isAiEstimate) ? estLegend() : ''}
      <div class="review-list">${answerFirst(sh.items).map(([it, n]) => reviewItem(it, n)).join('')}</div>
      <div class="sheet-actions">
        ${blocking ? `<p class="nav-reason" id="apply-reason">${esc(blocking)}</p>` : ''}
        <button class="btn ghost" data-action="dumpEdit">Edit text</button>
        ${actionable ? `<button class="btn primary" data-action="applyDump" ${blocking ? 'disabled aria-describedby="apply-reason"' : ''}>See plan changes</button>` : '<button class="btn primary" data-action="closeSheet">Done</button>'}
      </div>`;
  }

  function dumpBlocking() {
    for (const it of ui.sheet.items) {
      if (!it.include) continue;
      if (it.kind === 'event' && it.conflicts.hard.length && !it.resolution) return 'Choose how to handle the conflict first.';
      if (it.kind === 'recurring' && it.conflicts.length && !it.resolution) return 'Choose how to handle the conflict first.';
      if (it.kind === 'contradiction' && !it.answer) return 'Answer the question above first.';
      if (it.kind === 'refuse' && it.addAsTask && it.deadline == null) return 'Add a due date so I can schedule the steps.';
      if (it.kind === 'partial' && !(it.remainingMins > 0)) return 'Enter how much time is still needed.';
    }
    return '';
  }

  const rcKind = (icon, text, cls = '') => `<div class="rc-kind ${cls}">${icon}<span>${text}</span></div>`;
  const choice = (n, action, current, v, label) =>
    `<button class="chip-btn ${current === v ? 'on' : ''}" role="radio" aria-checked="${current === v}" data-action="${action}" data-n="${n}" data-v="${v}">${current === v ? ICON.check : ''}${label}</button>`;

  /** CONFLICT (design.md §8): "Decision needed" — both commitments shown with locks; the student chooses. */
  function decisionBlock(n, it, body, options) {
    const qid = `decide-${n}`;
    return `<div class="decision" tabindex="-1" data-question>
      <div class="decision-head">${ICON.overlap}<b id="${qid}">Decision needed</b></div>
      <p>${body}</p>
      <div class="chips" role="radiogroup" aria-labelledby="${qid}">${options.map(([v, label]) => choice(n, 'resolve', it.resolution, v, label)).join('')}</div>
      <p class="small">SIKAD never skips a class or shift on its own. It only does that if you choose it here.</p></div>`;
  }

  function reviewItem(it, n) {
    const p = `sheet.items.${n}`;
    const n0 = now();
    switch (it.kind) {
      case 'task': return taskReviewCard(it, p, n, 'sheet');
      case 'extend': {
        const t = taskById(it.taskId); const left = t ? S.taskRemaining(t) : 0;
        return `<article class="review-card">${rcKind(ICON.clock, 'More time needed')}<p class="num"><b>${esc(it.title)}</b>: ${T.dur(left)} left → <b>${T.dur(left + it.addMins)} left</b> (+${T.dur(it.addMins)})</p>
          <p class="small rc-note">The plan will be recalculated around your fixed commitments. If it no longer fits before the deadline, SIKAD will say so.</p></article>`;
      }
      case 'complete_part':
        return `<article class="review-card">${rcKind(ICON.check, 'Part finished', 'k-success')}<p><b>${esc(it.title)} — ${esc(it.partTitle)}</b> will be marked done. The rest of the task stays on your plan.</p></article>`;
      case 'partial': {
        const t = taskById(it.taskId); const left = t ? S.taskRemaining(t) : 0;
        return `<article class="review-card">${rcKind(ICON.check, 'Part finished', 'k-success')}<p><b>${esc(it.title)}</b> has no named steps, so tell me what is left. It currently shows ${T.dur(left)}.</p>
          <label class="${it.remainingMins > 0 ? '' : 'needs-answer'}">Time still needed<span class="hrs-input"><input type="number" min="0.25" step="0.25" value="${it.remainingMins > 0 ? hrs(it.remainingMins) : ''}" data-bind="${p}.remainingMins" data-type="hrs" data-rerender> hrs</span></label></article>`;
      }
      case 'event': {
        const e = it.event;
        const hard = it.conflicts.hard;
        const range = `${T.short(e.start)}, ${T.range(e.start, e.end)}`;
        return `
          <article class="review-card fixed">
            ${rcKind(ICON.lock, 'New fixed commitment', 'k-fixed')}
            <div class="rc-head"><input class="rc-title" value="${esc(e.title)}" data-bind="${p}.event.title" aria-label="Commitment name"></div>
            <p class="small num"><b>${range}</b>${it.durationEstimated ? ' <span class="chip est">≈ 1 hr assumed</span>' : ''}</p>
            <p class="small rc-note"><b>${it.makeRecurring ? 'Weekly' : 'One-time'}</b>: ${it.makeRecurring ? `every ${T.DAY_NAMES[T.dow(e.start)]} from now on.` : `only affects ${T.short(e.start)}. Your regular schedule stays the same.`}
              <button class="link" data-action="toggleRecurring" data-n="${n}">${it.makeRecurring ? 'Make it one-time' : 'This happens every week'}</button></p>
            ${hard.length ? decisionBlock(n, it,
              `You already have ${hard.map((o) => `${ICON.lock}<b>${esc(o.title)}</b> (${T.range(o.start, o.end)})`).join(', ')}. ${esc(e.title)} overlaps it. Which one takes priority?`,
              [['keep', `Keep ${esc(hard[0].title)}`], ['prioritize', `Go to ${esc(e.title)} instead`], ['both', "Keep both (I'll sort it out)"]]) : ''}
            ${it.conflicts.soft.length ? `<p class="small rc-note">Note: overlaps your ${it.conflicts.soft.map((o) => o.title.toLowerCase()).join(' and ')}.</p>` : ''}
          </article>`;
      }
      case 'recurring': {
        const e = it.event;
        return `
          <article class="review-card fixed">
            ${rcKind(ICON.lock, 'New weekly commitment', 'k-fixed')}
            <p class="num"><b>${esc(e.title)}</b> · every ${e.days.map((d) => T.DAY_NAMES[d]).join(' & ')}, ${T.hmLabel(e.start)}–${T.hmLabel(e.end)}</p>
            <p class="small rc-note">Added to your baseline, so all future weeks plan around it.</p>
            ${it.conflicts.length ? decisionBlock(n, it,
              `It overlaps ${it.conflicts.map((c) => `${ICON.lock}<b>${esc(c.title)}</b> on ${c.dayName}s (${T.hmLabel(c.start)}–${T.hmLabel(c.end)})`).join(', ')}.`,
              [['both', 'Add anyway'], ['keep', "Don't add"]]) : ''}
          </article>`;
      }
      case 'cancel_occurrence':
        return `<article class="review-card">${rcKind(ICON.close, 'Cancelled (you said so)')}${it.occurrences.map((o) => `<p class="num">${ICON.lock}<b>${esc(o.title)}</b> · ${T.short(o.start)}, ${T.range(o.start, o.end)}</p>`).join('')}
          <p class="small rc-note">That frees ${T.dur(it.occurrences.reduce((a, o) => a + (o.end - o.start) / T.MIN, 0))}. Only this date changes; your weekly schedule stays the same.</p></article>`;
      case 'cancel_task': return `<article class="review-card">${rcKind(ICON.close, 'Remove task')}<p><b>${esc(it.title)}</b> will be removed from your plan.</p></article>`;
      case 'complete': return `<article class="review-card">${rcKind(ICON.check, 'Completed', 'k-success')}<p><b>${esc(it.title)}</b> will be marked done.</p></article>`;
      case 'missed': return `<article class="review-card">${rcKind(ICON.undo, "Didn't finish")}<p>No problem. The remaining work on <b>${esc(it.title)}</b> moves to your next open block.</p></article>`;
      case 'deadline_change': return `<article class="review-card">${rcKind(ICON.clock, `Deadline ${it.oldDeadline == null ? 'set' : 'changed'}`)}<p class="num"><b>${esc(it.title)}</b>: ${it.oldDeadline != null ? `<s><span class="sr-only">was </span>${T.short(it.oldDeadline)}</s> → ` : ''}<b>${T.short(it.deadline)}</b></p></article>`;
      case 'contradiction': {
        const qid = `contra-${n}`;
        return `<article class="review-card"><div class="clarify" tabindex="-1" data-question>${ICON.question}<div><p id="${qid}"><b>${esc(it.question)}</b></p>
          <div class="chips" role="radiogroup" aria-labelledby="${qid}">${choice(n, 'answer', it.answer, 'update', `It changed to ${T.short(it.deadline)}`)}${choice(n, 'answer', it.answer, 'keep', `Keep ${T.short(it.oldDeadline)}`)}</div></div></div></article>`;
      }
      case 'duplicate': {
        const t = taskById(it.taskId);
        return `<article class="review-card neutral">${rcKind(ICON.info, 'Already planned')}<p>“${esc(it.title)}” is already in your plan${t && t.deadline ? ` (due ${T.short(t.deadline)})` : ''}. Nothing to change.</p></article>`;
      }
      case 'refuse':
        return `<article class="review-card neutral">
          <p>I can't write your ${esc(it.noun)}, since that's your work to own. But I can help you get it done without the overwhelm. Here's how I'd break it down:</p>
          <ol class="steps">${it.breakdown.map(([st, m]) => `<li>${esc(st)} <span class="muted num">(${m} min)</span></li>`).join('')}</ol>
          <label class="toggle"><input type="checkbox" ${it.addAsTask ? 'checked' : ''} data-bind="${p}.addAsTask" data-rerender> Schedule these steps into my free time</label>
          ${it.addAsTask ? `<label class="${it.deadline == null ? 'needs-answer' : ''}">When is it due?<input type="datetime-local" value="${it.deadline != null ? T.toInput(it.deadline) : ''}" data-bind="${p}.deadline" data-type="dt" data-rerender></label>` : ''}
        </article>`;
      case 'stress': {
        const cap = E.capacity(state, n0);
        const due = state.tasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled' && t.deadline != null && t.deadline <= cap.until).length;
        return `<article class="review-card neutral"><p>Let's look at your schedule and see what we can do. You have <b>${due} task${due === 1 ? '' : 's'}</b> due this week: about ${T.dur(cap.required)} of work, with ${approx(cap.free)} of open time.</p>
          <p>Want me to show you just the most urgent thing first?</p><button class="btn small" data-action="focusOnly">Show me just my next step</button></article>`;
      }
      case 'next': return `<article class="review-card neutral"><p>Your next step is always on the Focus Card at the top of Home.</p><button class="btn small" data-action="focusOnly">Show me</button></article>`;
      default:
        return `<article class="review-card"><div class="clarify" tabindex="-1" data-question>${ICON.question}<div><p><b>${esc(P.unclearQuestion(it))}</b></p>
          <div class="chips"><button class="chip-btn" data-action="template" data-v="I wasn't able to finish ">I missed a task</button>
          <button class="chip-btn" data-action="template" data-v="New assignment: ">New assignment</button>
          <button class="chip-btn" data-action="template" data-v="I have to ">Schedule change</button>
          <button class="chip-btn" data-action="template" data-v="Cancelled: ">Something got cancelled</button></div></div></div></article>`;
    }
  }

  function intentToItem(i) {
    switch (i.type) {
      case 'task': return { kind: 'task', include: true, task: Object.assign({}, i.task), clarification: i.clarification, ambiguous: i.ambiguous };
      case 'event':
        if (i.recurring) return { kind: 'recurring', include: true, event: i.event, conflicts: E.recurringConflicts(state, i.event), resolution: null };
        return { kind: 'event', include: true, event: Object.assign({}, i.event), conflicts: E.eventConflicts(state, i.event), resolution: null, makeRecurring: false, durationEstimated: i.durationEstimated };
      case 'cancel_occurrence': return { kind: 'cancel_occurrence', include: true, occurrences: i.occurrences };
      case 'refuse': return { kind: 'refuse', include: true, noun: i.noun, subject: i.subject, breakdown: i.breakdown, addAsTask: false, deadline: null };
      default: return Object.assign({ kind: i.type, include: true }, i);
    }
  }

  function processDump(text) {
    const parsed = P.parse(text, S.parseContext(state));
    S.log(state, 'Phase 2 · Brain dump', text, P.toPhase2(parsed));
    const items = parsed.intents.map(intentToItem);
    // Record the clarification/conflict outcome as a Phase 3 response, as the LLM contract would.
    const conflict = items.find((it) => it.kind === 'event' && it.conflicts.hard.length);
    const question = items.map((it) => it.kind === 'contradiction' ? it.question : it.kind === 'task' && it.clarification ? it.clarification
      : it.kind === 'unclear' ? P.unclearQuestion(it) : null).filter(Boolean);
    if (conflict || question.length) {
      const status = conflict ? 'CONFLICT' : 'CLARIFICATION_NEEDED';
      const clar = conflict ? `"${conflict.event.title}" overlaps ${conflict.conflicts.hard.map((o) => o.title).join(', ')}. Which one takes priority?` : question.join(' ');
      S.log(state, 'Phase 3 · Dashboard & replanning', text, E.phase3({ status, alerts: [], clarification: clar, next: E.nextSession(state.plan, now()), changes: [], unscheduled: [] }));
    }
    ui.sheet = { type: 'dump', mode: 'review', text, items };
  }

  /** Apply the confirmed items to the CURRENT `state` and replan. Returns false when there is nothing to do. */
  function applyItems(items) {
    const triggers = [], notes = [];
    for (const it of items) {
      if (!it.include) continue;
      const t = it.taskId ? taskById(it.taskId) : null;
      switch (it.kind) {
        case 'task': {
          const task = S.makeTask(state, it.task);
          if (it.task.dependsOnTitle && !task.dependencies.length) {
            const dep = state.tasks.find((x) => x.title === it.task.dependsOnTitle && x.status !== 'done' && x.status !== 'cancelled');
            if (dep) task.dependencies = [dep.id];
            else notes.push(`I could not link "${task.title}" to "${it.task.dependsOnTitle}". You can set that in the task's details.`);
          }
          state.tasks.push(task);
          triggers.push(`New task: ${task.title}`);
          if (task.deadline == null) notes.push(`"${task.title}" is saved but won't be scheduled until it has a deadline.`);
          break;
        }
        case 'event': {
          const e = it.event;
          if (it.resolution === 'keep') { notes.push(`Kept ${it.conflicts.hard.map((o) => o.title).join(', ')}; didn't add ${e.title}.`); break; }
          if (it.makeRecurring) S.addRecurring(state, { title: e.title, kind: e.kind, days: [T.dow(e.start)], start: T.minsToHm(T.minsOfDay(e.start)), end: T.minsToHm(T.minsOfDay(e.end)) });
          else S.addEvent(state, e);
          if (it.resolution === 'prioritize') {
            for (const o of it.conflicts.hard) S.cancelOccurrence(state, o);
            notes.push(`As you chose, ${it.conflicts.hard.map((o) => o.title).join(', ')} is marked as skipped on ${T.short(e.start)} only.`);
          }
          triggers.push(`${it.makeRecurring ? 'Weekly' : 'Added'} ${e.title} (${T.DAY_SHORT[T.dow(e.start)]} ${T.timeShort(e.start)}–${T.timeShort(e.end)})${it.makeRecurring ? '' : ' — one-time'}`);
          break;
        }
        case 'recurring': {
          if (it.resolution === 'keep') break;
          S.addRecurring(state, it.event);
          triggers.push(`Weekly ${it.event.title} (${it.event.days.map((d) => T.DAY_SHORT[d]).join('/')} ${T.hmLabel(it.event.start)}–${T.hmLabel(it.event.end)})`);
          break;
        }
        case 'cancel_occurrence':
          for (const o of it.occurrences) S.cancelOccurrence(state, o);
          triggers.push(`Cancelled ${it.occurrences.map((o) => o.title).join(', ')} (${T.short(it.occurrences[0].start)})`);
          break;
        case 'cancel_task': if (t) { t.status = 'cancelled'; triggers.push(`Removed task: ${t.title}`); } break;
        case 'complete': if (t) { S.completeTask(state, t.id); triggers.push(`Completed: ${t.title}`); } break;
        case 'complete_part': if (t) { S.completePart(state, t.id, it.partId); triggers.push(`Finished: ${t.title} — ${it.partTitle}`); } break;
        case 'partial': if (t) { S.setTaskRemaining(state, t.id, it.remainingMins); triggers.push(`Partly done: ${t.title} (${T.dur(S.taskRemaining(t))} left)`); } break;
        case 'extend': if (t) { S.extendTask(state, t.id, it.addMins); triggers.push(`More time for ${t.title} (+${T.dur(it.addMins)})`); } break;
        case 'missed':
          if (t) {
            t.notBefore = now();
            state.checkins = state.checkins.filter((c) => c.taskId !== t.id);
            triggers.push(`Didn't finish: ${t.title}`);
          }
          break;
        case 'deadline_change': if (t) { t.deadline = it.deadline; triggers.push(`Deadline for ${t.title} → ${T.short(it.deadline)}`); } break;
        case 'contradiction':
          if (t && it.answer === 'update') { t.deadline = it.deadline; triggers.push(`Deadline for ${t.title} → ${T.short(it.deadline)}`); }
          break;
        case 'refuse':
          if (it.addAsTask && it.deadline != null) {
            const total = it.breakdown.reduce((a, [, m]) => a + m, 0);
            const task = S.makeTask(state, { title: it.subject, type: 'report', deadline: it.deadline, durationMins: total, priority: 'medium',
              parts: it.breakdown.map(([title, mins]) => ({ title, mins })) });
            state.tasks.push(task);
            triggers.push(`New task: ${task.title} (${it.breakdown.length} steps)`);
          }
          break;
        default: break;
      }
    }
    if (!triggers.length && !notes.length) return false;
    S.replan(state, triggers.join(' · ') || 'Brain dump', { notes });
    return true;
  }

  /**
   * Student control (brief §3D, Stage 6): the confirmed input is applied to a COPY of the
   * state and replanned there. The student then sees the proposed plan changes and accepts
   * or rejects them. The real state (and what is saved) only changes on Accept.
   */
  function applyDump() {
    const sh = ui.sheet;
    const committed = state;
    let draft = null, changed = false;
    state = S.clone(committed);
    try { changed = applyItems(sh.items); draft = state; } finally { state = committed; }
    if (!changed) { ui.sheet = null; render(); return; }
    committed.engineLog = draft.engineLog.slice(); // the engine produced this output; keep it inspectable even if rejected
    ui.sheet = { type: 'proposal', draft, review: sh };
    render();
  }

  function proposalSheet() {
    const d = ui.sheet.draft, u = d.lastUpdate, n = d.now;
    const next = E.nextSession(d.plan, n);
    const short = d.status === 'INFEASIBLE';
    const crit = (d.alerts || []).find((x) => x.level === 'CRITICAL');
    const skipped = /cancel|skip/i.test(u.trigger + ' ' + u.notes.join(' '));
    return `
      <h2 id="sheet-title" tabindex="-1">Review the updated plan</h2>
      <p class="sheet-sub">This is a proposal. Nothing is saved until you accept it.</p>
      <p class="small">Because: ${esc(u.trigger)}</p>
      ${u.notes.map((x) => `<p class="small">${esc(x)}</p>`).join('')}
      <h3 class="list-h">What would change</h3>
      ${u.changes.length ? `<ul class="changes on-sheet">${u.changes.map((c) => `<li>${changeLine(c)}</li>`).join('')}</ul>` : '<p class="small">No other task needs to move.</p>'}
      ${short ? `<div class="status-panel s-critical" role="status">${ICON.hourglass}<div><b>Not enough time</b><p>${esc(crit ? crit.message : 'Some work would not fit before its deadline.')}</p>
        <p>Not fitting: ${(d.unscheduled || []).map((x) => `${esc(x.title)} (${T.dur(x.mins)})`).join(', ')}. No deadline or duration was changed to hide this.</p></div></div>` : ''}
      <p class="small upd-fixed">${ICON.lock}<span>Fixed commitments unchanged${skipped ? ', except the one you chose to cancel or skip' : ''}.</span></p>
      ${next ? `<p class="small upd-next">${ICON.step}<span>Next would be: <b>${esc(next.title)}</b> · <span class="num">${T.rel(next.start, n)} ${T.timeShort(next.start)}</span></span></p>` : ''}
      <div class="sheet-actions">
        <button class="btn" data-action="rejectProposal">Reject</button>
        <button class="btn ghost" data-action="editProposal">Edit</button>
        <button class="btn primary" data-action="acceptProposal">Accept changes</button>
      </div>`;
  }

  // ---------- Task details / edit ----------
  function openTask(id) {
    const t = taskById(id);
    if (!t) return;
    ui.sheet = { type: 'task', id, d: {
      title: t.title, context: t.context, deadline: t.deadline, total: S.taskTotal(t), priority: t.priority, doFirst: !!t.doFirst,
      pinnedStart: t.pinnedStart, notes: t.notes || '', parts: t.parts.map((p) => Object.assign({}, p)), dependencies: (t.dependencies || []).slice(),
      isAiEstimate: t.isAiEstimate,
    } };
    render();
  }

  function taskSheet() {
    const sh = ui.sheet, d = sh.d, t = taskById(sh.id);
    if (!t) return '<p>Task not found.</p>';
    const sessions = state.plan.filter((s) => s.taskId === t.id);
    const others = state.tasks.filter((x) => x.id !== t.id && x.status !== 'done' && x.status !== 'cancelled');
    const p = 'sheet.d';
    return `
      <h2 id="sheet-title" tabindex="-1">Task details</h2>
      <p class="sheet-sub">Everything here is your call. Saving recalculates the plan.</p>
      <div class="form">
        <label>Task name<input value="${esc(d.title)}" data-bind="${p}.title"></label>
        <div class="grid2">
          <label>Deadline<input type="datetime-local" value="${d.deadline != null ? T.toInput(d.deadline) : ''}" data-bind="${p}.deadline" data-type="dt"></label>
          <label>Time needed ${d.isAiEstimate ? estChip() : ''}<span class="hrs-input ${d.isAiEstimate ? 'is-est' : ''}">${d.isAiEstimate ? '<span aria-hidden="true">≈</span>' : ''}<input type="number" min="0.25" step="0.25" value="${hrs(d.total)}" data-bind="${p}.total" data-type="hrs"> hrs</span></label>
          <label>Priority<select data-bind="${p}.priority">${['high', 'medium', 'low'].map((x) => `<option value="${x}" ${x === d.priority ? 'selected' : ''}>${PRI_LABEL[x]}</option>`).join('')}</select></label>
          <label>Schedule at (optional)<input type="datetime-local" value="${d.pinnedStart ? T.toInput(d.pinnedStart) : ''}" data-bind="${p}.pinnedStart" data-type="dt"></label>
        </div>
        <label class="toggle"><input type="checkbox" ${d.doFirst ? 'checked' : ''} data-bind="${p}.doFirst"> Do this first (overrides SIKAD's priority)</label>
        ${d.parts.length ? `<fieldset><legend>Steps</legend>${d.parts.map((x, i) => `
          <div class="part-row"><label class="toggle"><input type="checkbox" ${x.done ? 'checked' : ''} data-bind="${p}.parts.${i}.done" aria-label="Mark ${esc(x.title)} done"></label>
          <input value="${esc(x.title)}" data-bind="${p}.parts.${i}.title" aria-label="Step name"><span class="muted small nowrap">${T.dur(x.mins)}</span></div>`).join('')}</fieldset>` : ''}
        ${others.length ? `<label>Can only start after…<select data-bind="${p}.depSingle"><option value="">(no dependency)</option>${others.map((o) => `<option value="${o.id}" ${d.dependencies.includes(o.id) ? 'selected' : ''}>${esc(o.title)}</option>`).join('')}</select></label>` : ''}
        <label>Notes<textarea rows="2" data-bind="${p}.notes">${esc(d.notes)}</textarea></label>
      </div>
      ${sessions.length ? `<div class="sessions"><b class="small">Scheduled</b><ul class="plain small num">${sessions.map((s) => `<li>${T.short(s.start)}, ${T.range(s.start, s.end)}${s.partId ? ' · ' + esc(s.title.split(' — ').pop()) : ''}</li>`).join('')}</ul></div>` : ''}
      <div class="sheet-actions">
        ${t.status !== 'done' ? '<button class="btn danger" data-action="deleteTask">Remove task</button><button class="btn" data-action="completeTask">Mark whole task done</button>' : ''}
        <button class="btn primary" data-action="saveTask">Save & replan</button>
      </div>`;
  }

  function saveTask() {
    const sh = ui.sheet, d = sh.d, t = taskById(sh.id);
    snapshot('Edit task');
    const changes = [];
    if (d.title.trim() && d.title !== t.title) { t.title = d.title.trim(); changes.push('renamed'); }
    if (d.deadline !== t.deadline) { t.deadline = d.deadline; changes.push('deadline'); }
    if (d.priority !== t.priority) { t.priority = d.priority; changes.push('priority'); }
    if (d.doFirst !== !!t.doFirst) { t.doFirst = d.doFirst; changes.push(d.doFirst ? 'do first' : 'normal priority'); }
    if ((d.pinnedStart || null) !== (t.pinnedStart || null)) { t.pinnedStart = d.pinnedStart || null; changes.push('time pinned'); }
    t.notes = d.notes;
    d.parts.forEach((p, i) => {
      const tp = t.parts[i];
      tp.title = p.title;
      if (p.done && !tp.done) { S.completePart(state, t.id, tp.id); changes.push(`${tp.title} done`); }
      if (!p.done && tp.done) { tp.done = false; tp.remainingMins = tp.mins; }
    });
    if (d.total && d.total !== S.taskTotal(t)) { S.setDuration(t, d.total); changes.push('duration'); }
    if (d.depSingle !== undefined) t.dependencies = d.depSingle ? [d.depSingle] : [];
    if (S.taskRemaining(t) === 0) t.status = 'done';
    ui.sheet = null;
    S.replan(state, `Edited ${t.title}${changes.length ? ' (' + changes.join(', ') + ')' : ''}`);
    render();
    toast('Changes saved.', { undo: true });
  }

  // ---------- Fixed commitment ----------
  function fixedSheet() {
    const sh = ui.sheet;
    const o = E.occurrences(state, sh.day).find((x) => x.id === sh.id);
    if (!o) return '<p>This commitment is no longer on the schedule.</p>';
    return `
      <h2 id="sheet-title" tabindex="-1">${ICON.lock}${esc(o.title)}</h2>
      <p class="num"><b>${T.date(o.start)}</b><br>${T.range(o.start, o.end)}${o.mode ? ` · ${o.mode === 'FTF' ? FTF_LABEL : 'Online'}` : ''}</p>
      <p><span class="fixed-tag">${ICON.lock}Fixed · ${o.source === 'temporary' ? 'One-time' : 'Weekly'}</span></p>
      <div class="status-panel s-info">${ICON.info}<div><p>Fixed commitments are protected. SIKAD plans your tasks around them and never moves, shortens or skips them on its own. Only you can mark one as cancelled.</p></div></div>
      <div class="sheet-actions">
        ${o.source === 'temporary' ? `<button class="btn danger" data-action="cancelFixed">Remove this event</button>`
          : `<button class="btn" data-action="cancelFixed">It's cancelled on ${T.short(o.start)}</button>`}
      </div>`;
  }

  // ---------- Engine output ----------
  function engineSheet() {
    const log = state.engineLog;
    return `
      <h2 id="sheet-title" tabindex="-1">Engine output</h2>
      <p class="sheet-sub">The structured JSON the engine returns for each request, following the contracts in prompt.md. Newest first.</p>
      ${log.map((e, i) => `
        <details class="log" ${i === 0 ? 'open' : ''}>
          <summary><b>${esc(e.phase)}</b> <span class="muted small">· ${T.short(e.at)} ${T.time(e.at)}</span>${e.output.status ? ` <span class="chip status-${e.output.status}">${e.output.status}</span>` : ''}</summary>
          <p class="small muted">Input: ${esc(String(e.input).slice(0, 220))}</p>
          <pre tabindex="0" aria-label="${esc(e.phase)} JSON output">${esc(JSON.stringify(e.output, null, 2))}</pre>
        </details>`).join('') || '<p class="muted">Nothing yet.</p>'}`;
  }

  // =============================================================== ACTIONS ==
  const A = {
    // --- onboarding
    obNext() {
      const ob = ui.ob;
      if (ob.step === 0) state.user.name = (ob.name || '').trim();
      if (ob.step === 1) {
        state.baseline.classes = ob.classes.filter((c) => c.title.trim()).map((c) => ({ id: S.uid(state, 'c'), title: c.title.trim(), day: c.day, start: c.start, end: c.end, mode: c.mode }));
        const p1 = { extracted_commitments: state.baseline.classes.map((c) => ({ title: c.title, day_of_week: T.DAY_NAMES[c.day], start_time: c.start, end_time: c.end, type: 'fixed', mode: c.mode === 'FTF' ? 'In person' : 'Online' })), clarification_needed: null };
        S.log(state, 'Phase 1 · Schedule extraction (confirmed)', 'Student-confirmed class table', p1);
      }
      if (ob.step === 2) {
        const ls = ob.ls;
        const mins = Math.round(Number(ls.commuteMins));
        if (!(mins >= 5 && mins <= 240)) { flagField(document.getElementById('commute-custom'), 'Enter your commute in minutes, from 5 to 240.'); return; }
        ls.commuteMins = mins;
        S.applyLifestyle(state, {
          dayStart: ls.dayStart, dayEnd: ls.dayEnd, commuteMins: ls.commuteMins,
          work: ls.working === 'yes' ? ls.workDays.map((d) => ({ day: d, start: ls.workStart, end: ls.workEnd })) : [],
          org: ls.org === 'yes' ? (ls.orgs || []).map((o) => ({ day: o.day, start: o.start, end: o.end, name: (o.name || '').trim() })) : [],
        });
      }
      ob.step++;
      render();
      window.scrollTo(0, 0);
      focusHeading();
    },
    obBack() { ui.ob.step = Math.max(0, ui.ob.step - 1); render(); focusHeading(); },
    obGoto(ds) { ui.ob.step = Number(ds.step); render(); window.scrollTo(0, 0); focusHeading(); },
    obSet(ds) {
      const v = ds.value;
      const [obj, key] = ds.path.split('.');
      if (key === 'commuteMins') {                            // "Custom" keeps the current minutes and reveals the input
        ui.ob.ls.commuteCustom = v === 'custom';
        if (v !== 'custom') ui.ob.ls.commuteMins = Number(v);
        render();
        if (v === 'custom') { const el = document.getElementById('commute-custom'); if (el) el.focus(); }
        return;
      }
      ui.ob[obj][key] = v;
      render();
    },
    obAddOrg() { ui.ob.ls.orgs.push(newOrg()); render(); const rows = document.querySelectorAll('.org-row input:not([type])'); if (rows.length) rows[rows.length - 1].focus(); },
    obRemoveOrg(ds) { ui.ob.ls.orgs.splice(Number(ds.i), 1); render(); },
    obToggleDay(ds) {
      const arr = ui.ob.ls[ds.path];
      const d = Number(ds.day);
      const i = arr.indexOf(d);
      if (i >= 0) arr.splice(i, 1); else arr.push(d);
      render();
    },
    obSampleCor() { if (ui.ob.extracting) return; ui.ob.corText = D.SAMPLE_COR_TEXT; ui.ob.uploadNote = ''; A.obExtract(); },
    // Shows "Reading…" while it runs. A second tap during that time does nothing.
    obExtract() {
      const ob = ui.ob;
      if (ob.extracting) return;
      ob.extracting = true;
      render();
      setTimeout(() => {
        if (ui.ob !== ob) return;                              // setup was reset meanwhile
        ob.extracting = false;
        const p1 = P.parseSchedule(ob.corText);
        S.log(state, 'Phase 1 · Schedule extraction', ob.corText.slice(0, 200), p1);
        if (p1.clarification_needed) { ob.analysis = p1.clarification_needed; ob.analysisError = true; ob.extracted = true; render(); return; }
        ob.analysisError = false;
        ob.classes = p1.extracted_commitments.map((c) => ({ title: c.title, day: T.DAY_NAMES.indexOf(c.day_of_week), start: c.start_time, end: c.end_time, mode: c.mode === 'Online' ? 'Online' : 'FTF' }));
        ob.analysis = E.analyzeBaseline(ob.classes);
        ob.extracted = true;
        render();
      }, 450);
    },
    obAddClass() { ui.ob.classes.push({ title: '', day: 1, start: '08:00', end: '10:00', mode: 'FTF' }); ui.ob.extracted = true; render(); },
    obRemoveClass(ds) { ui.ob.classes.splice(Number(ds.i), 1); ui.ob.analysis = E.analyzeBaseline(ui.ob.classes); render(); },
    obSampleDump() { ui.ob.dumpText = D.SAMPLE_BRAIN_DUMP; render(); },
    obParseDump() {
      const text = (ui.ob.dumpText || '').trim();
      if (!text) { flagField(document.getElementById('dump-ob'), 'Nothing to extract yet. Type or say what is on your plate, e.g. "Math homework due tomorrow".'); return; }
      const parsed = P.parse(text, S.parseContext(state));
      S.log(state, 'Phase 2 · Brain dump', text, P.toPhase2(parsed));
      ui.ob.review = parsed.intents.map(intentToItem);
      render();
      focusFirstQuestion();
    },
    obEditDump() { ui.ob.review = null; render(); },
    obGenerate() {
      for (const it of ui.ob.review) if (it.kind === 'task' && it.include) state.tasks.push(S.makeTask(state, it.task));
      ui.ob.step = 5; ui.ob.genStep = 0;
      render();
      const tick = () => {
        ui.ob.genStep++;
        if (ui.ob.genStep >= 5) {
          state.onboarded = true;
          S.replan(state, null, { fresh: true });
          ui.ob = freshOnboarding();
          ui.tab = 'home';
          render();
          toast('Your plan is ready.');
          return;
        }
        render();
        setTimeout(tick, 520);
      };
      setTimeout(tick, 520);
    },
    loadDemo() {
      state = S.loadDemo(S.reset());
      ui.ob = freshOnboarding(); ui.tab = 'home'; undoSnap = null;
      ui.sheet = null; ui.askThread = []; ui.dict = null; ui.dumpDraft = null; ui.formDraft = null; ui.focusPick = null; ui.focusPartial = false; ui.prevPct = null; ui.prevDayPct = null; ui.error = null; ui.dock = false;
      render();
      toast("Loaded Alex's week, starting from today. Try Ask SIKAD.", { ms: 6000 });
    },
    loadDemoConfirm() { askConfirm({ run: 'loadDemo', title: "Replace your data with Alex's week?", body: 'Your classes, tasks and plan on this device are replaced with the sample week. This cannot be undone.', label: 'Replace my data' }); },
    dockToggle() { ui.dock = !ui.dock; render(); },
    versionTap() {
      clearTimeout(versionTimer);
      versionTimer = setTimeout(() => { versionTaps = 0; }, 1500);
      if (++versionTaps < 5) return;
      versionTaps = 0; judge = !judge; ui.dock = judge;
      try { if (judge) sessionStorage.setItem(JUDGE_KEY, '1'); else sessionStorage.removeItem(JUDGE_KEY); } catch (e) { /* storage unavailable: lasts until reload */ }
      render();
      toast(judge ? 'Judge tools are on.' : 'Judge tools are off.');
    },
    resetAll() { askConfirm({ run: 'resetAll', title: 'Erase everything and start over?', body: 'Your classes, tasks, plan and history are erased from this device, and setup starts again. This cannot be undone.', label: 'Erase everything' }); },
    confirmYes() { const sh = ui.sheet; if (!sh || sh.type !== 'confirm') return; ui.sheet = sh.back; CONFIRMED[sh.run](sh); },
    confirmNo() { if (!ui.sheet || ui.sheet.type !== 'confirm') return; ui.sheet = ui.sheet.back; render(); },
    askMenu() {
      ui.askMenu = !ui.askMenu; render();
      const el = document.querySelector(ui.askMenu ? '.ask-opt' : '.fab');
      if (el) el.focus({ preventScroll: true });
    },
    askMenuClose() { if (ui.askMenu) A.askMenu(); },
    askMode(ds) {
      ui.askMenu = false;
      const fab = document.querySelector('.fab');
      if (fab) fab.focus({ preventScroll: true });          // closing the sheet later returns focus to Ask SIKAD
      if (ds.v === 'form') A.newTask(); else A.openDump();
    },
  };
  /** What runs after the student confirms in the confirm sheet. */
  const CONFIRMED = {
    removeClass(sh) { A.removeClass({ id: sh.id }); },
    removeCommit(sh) { baselineChange(`Removed weekly ${sh.name}`, () => { state.baseline.recurring = state.baseline.recurring.filter((r) => !sh.ids.includes(r.id)); }, `Removed ${sh.name}. Plan recalculated.`); },
    loadDemo() { A.loadDemo(); },
    resetAll() {
      state = S.reset(); ui.ob = freshOnboarding(); ui.sheet = null; undoSnap = null;
      ui.askThread = []; ui.dict = null; ui.dumpDraft = null; ui.formDraft = null; ui.focusPick = null; ui.prevPct = null; ui.prevDayPct = null; ui.error = null; render();
      toast('Everything was erased. Setup starts fresh.');
    },
    deleteTask() {
      const t = taskById(ui.sheet.id);
      snapshot('Remove task');
      t.status = 'cancelled';
      ui.sheet = null;
      S.replan(state, `Removed task: ${t.title}`);
      render();
      toast('Task removed.', { undo: true });
    },
  };
  Object.assign(A, {
    toggleIntegration(ds) {
      const id = ds.id, info = D.INTEGRATIONS.find((i) => i.id === id);
      if (!info) return;
      if (state.integrations[id]) {                           // Disconnect. Tasks already added stay in the plan.
        state.integrations[id] = false; delete ui.integrationState[id];
        render();
        toast(`Disconnected ${info.name}.`);
        return;
      }
      const attempt = ui.integrationState[id] = { status: 'connecting' };
      render();
      const stale = () => ui.integrationState[id] !== attempt;   // cancelled, or a newer attempt started
      Promise.resolve().then(() => Adapters[id].connect()).then((res) => {
        if (stale()) return;
        const items = (res && res.items) || [];
        state.integrations[id] = true;
        ui.integrationState[id] = { status: 'connected', account: (res && res.account) || 'Connected', lastSync: Date.now(), imported: items.length };
        if (!ui.sheet && items.length) ui.sheet = { type: 'import', id, name: info.name, items: items.map((x) => ({ include: true, title: x.title, due: x.due, course: x.course || null, mins: x.mins || null, source: x.source || id })) };
        render();
      }).catch((err) => {
        if (stale()) return;
        ui.integrationState[id] = { status: 'error', error: (err && err.message) || `Couldn't reach ${info.name}. Check your connection.` };
        render();
      });
    },
    cancelIntegration(ds) { delete ui.integrationState[ds.id]; render(); },
    // Imported items become ordinary tasks through the same path as "Add a task manually".
    importAdd() {
      const sh = ui.sheet;
      const picked = sh.items.filter((it) => it.include && it.title.trim());
      if (!picked.length) return;
      if (state.onboarded) snapshot('Import');
      for (const it of picked) {
        const { type, est } = P.classify(it.title);
        const mins = it.mins || est;                             // the platform's own time when it gives one, else an estimate
        const task = S.makeTask(state, { title: it.title.trim(), type, context: it.course, deadline: it.due, durationMins: mins, isAiEstimate: !it.mins, priority: 'medium', parts: P.suggestParts(type, mins) });
        task.source = it.source;
        state.tasks.push(task);
      }
      const n = picked.length, what = `${n} task${n === 1 ? '' : 's'}`;
      ui.sheet = null;
      if (!state.onboarded) { render(); toast(`${what} added. They get scheduled with your first plan.`); return; }
      S.replan(state, `Imported ${what} from ${sh.name}`);
      render();
      toast(`Added ${what} from ${sh.name}.`, { undo: true });
    },

    // --- navigation
    tab(ds) { if (ui.tab === ds.tab && !ui.askMenu && !ui.sub) { window.scrollTo(0, 0); return; } ui.tab = ds.tab; ui.sub = null; ui.focusOnly = false; ui.askMenu = false; render(); window.scrollTo(0, 0); },
    dayView(ds) { ui.dayView = ds.v; render(); },
    pickDay(ds) { ui.weekDay = Number(ds.day); render(); },
    // data-v: -1 previous week, 1 next week, 0 back to this week. The arrows keep the same weekday selected.
    weekNav(ds) {
      const w = weekState(), dir = Number(ds.v);
      const to = dir === 0 ? w.cur : Math.min(w.max, Math.max(w.min, w.start + dir * 7 * T.DAY));
      if (to === w.start) return;
      ui.weekStart = to === w.cur ? null : to;
      ui.weekDay = dir === 0 ? null : w.sel + (to - w.start);
      render();
      const body = document.querySelector('.week-body');
      if (body && !M.reduced()) body.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'ease-out' });
    },
    showFullPlan() { ui.focusOnly = false; render(); },
    // Home's own timeline, on today. No separate schedule page.
    viewSchedule() {
      ui.tab = 'home'; ui.sub = null; ui.focusOnly = false; ui.askMenu = false; ui.dayView = 'today'; render();
      const el = document.getElementById('schedule'), h = document.getElementById('schedule-title');
      if (el) el.scrollIntoView({ block: 'start', behavior: M.reduced() ? 'auto' : 'smooth' });
      if (h) h.focus({ preventScroll: true });
    },
    viewWeek() {
      if (ui.weekStart != null) { ui.weekStart = null; ui.weekDay = null; }
      A.tab({ tab: 'week' });
    },
    focusOnly() { ui.sheet = null; ui.tab = 'home'; ui.focusOnly = true; render(); window.scrollTo(0, 0); },
    dismissUpdate() { state.lastUpdate = null; render(); },
    skipToMain() { const m = document.getElementById('main'); if (m) m.focus(); },
    // One tap flips whatever is showing now (also from "System") and stores it as an explicit choice.
    toggleTheme() {
      switchTheme(currentTheme() === 'dark' ? 'light' : 'dark');
      const btn = document.querySelector('.theme-toggle');
      if (btn) btn.focus({ preventScroll: true });
    },
    setTheme(ds) { switchTheme(ds.v); },
    dismissError() { ui.error = null; render(); },
    retryError() { const sh = ui.error && ui.error.retrySheet; ui.error = null; ui.sheet = sh; render(); },
    undo() {
      if (!undoSnap) return;
      const log = state.engineLog;
      state = Object.assign(S.initialState(), JSON.parse(undoSnap.json));
      state.engineLog = log;
      syncClock(true);                                     // the snapshot's clock may be a few minutes old
      state.lastUpdate = null;
      undoSnap = null; ui.toast = null;
      render();
      toast('Change undone.');
    },

    // --- focus card
    // Start begins the session straight away with the suggested working method. "Change" swaps it later.
    start(ds) {
      const s = S.findSession(state, ds.id);
      if (!s) return;
      const rec = F.recommend(focusContext(s, taskById(s.taskId)));
      snapshot('Start session');
      S.startSession(state, ds.id, rec.setup);
      ui.focusWhy = { id: ds.id, method: rec.method, text: rec.reason };
      ui.focusPick = null; ui.focusMethod = null; ui.focusPartial = false; ui.spotlightOff = false;
      render();
      const h = document.getElementById('focus-title');
      if (h) h.focus({ preventScroll: true });
      // The spotlit card should be fully in view: bring its top up if the expanded card runs off screen.
      const card = document.querySelector('.focus');
      if (card) { const r = card.getBoundingClientRect(); if (r.top < 64 || r.bottom > window.innerHeight - 96) card.scrollIntoView({ block: 'start' }); }
    },
    focusMethod(ds) { ui.focusMethod = ds.v; render(); },
    focusCancel() { ui.focusPick = null; ui.focusMethod = null; render(); },
    focusChange() {
      if (!state.active) return;
      ui.focusPick = state.active.sessionId; ui.focusMethod = null;
      render();
      const h = document.getElementById('method-title');
      if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    },
    // Confirms the picker. The session keeps running and its focused time is kept; only the method changes.
    focusBegin(ds) {
      const s = S.findSession(state, ds.id);
      const a = state.active;
      if (!s || !a || a.sessionId !== ds.id) return;
      const rec = F.recommend(focusContext(s, taskById(s.taskId)));
      const opt = rec.options.find((o) => o.method === (ui.focusMethod || a.method));
      if (opt && opt.method !== a.method) {
        Object.assign(a, opt.setup);
        state.prefs.focusMethod = opt.method;
        lastPhase = null;
      }
      ui.focusPick = null; ui.focusMethod = null;
      render();
    },
    // Leaving the spotlight only un-dims the screen. The session and its timer are untouched.
    spotlightOff() { ui.spotlightOff = true; render(); },
    spotlightToggle() { ui.spotlightOff = !ui.spotlightOff; render(); },
    focusPause() { S.pauseSession(state); render(); },
    focusResume() { S.resumeSession(state); render(); },
    focusSkip(ds) { S.skipSession(state, Number(ds.mins)); render(); tickTimer(); },
    focusEnd() {
      if (!state.active) return;
      S.pauseSession(state); state.active.status = 'awaiting'; ui.focusPartial = false;
      render();
      const q = document.getElementById('outcome-title');
      if (q) q.focus({ preventScroll: true });
    },
    focusKeepWorking() {
      const a = state.active;
      if (!a) return;
      if (F.timer(a, S.focusElapsedMs(a)).finished) a.method = 'none';   // the set structure is used up; carry on with a plain timer
      a.status = 'paused'; S.resumeSession(state); ui.focusPartial = false;
      render();
    },
    focusPartialBack() { ui.focusPartial = false; render(); },
    focusOutcome(ds) {
      if (ds.v === 'partial') { ui.focusPartial = true; render(); const i = document.getElementById('focus-left'); if (i) i.focus({ preventScroll: true }); return; }
      endFocusSession(ds.v);
    },
    focusSavePartial() {
      const input = document.getElementById('focus-left');
      const mins = Math.round(Number(input.value) * 60);
      if (!(mins > 0)) { flagField(input, 'Enter how much time is still needed, e.g. 0.5 for half an hour.'); return; }
      endFocusSession('partial', mins);
    },
    done(ds) {
      snapshot('Done');
      const s = S.findSession(state, ds.id);
      S.completeSession(state, ds.id);
      ui.celebrate = true;
      settle(ds.id, () => toast(`"${s.title}" is done. Your plan has been updated.`, { undo: true }));
    },
    snooze(ds) {
      snapshot('Snooze');
      const s = S.findSession(state, ds.id);
      S.snoozeSession(state, ds.id);
      const moved = state.plan.find((x) => x.unitId === s.unitId);
      render();
      toast(moved ? `Moved "${s.title}" to ${T.rel(moved.start, now())} ${T.timeShort(moved.start)}.` : `"${s.title}" no longer fits before its deadline — see the alert.`, { undo: true });
    },
    checkinDone(ds) {
      snapshot('Check-in');
      S.completeSession(state, ds.id);
      render();
      toast('Logged as done. Plan adjusted.', { undo: true });
    },
    checkinNo(ds) { S.dismissCheckin(state, ds.id); render(); },
    setDeadline(ds) {
      const el = document.getElementById('dl-' + ds.id);
      const v = el && T.fromInput(el.value);
      if (!v) { flagField(el, 'No date picked yet. Choose the due date and time, then tap Schedule it.'); return; }
      snapshot('Deadline');
      const t = taskById(ds.id);
      t.deadline = v;
      S.replan(state, `Deadline set: ${t.title} → ${T.short(v)}`);
      render();
      planToast();
    },

    // --- clock
    // The app follows the device clock; the old presenter clock actions now just re-read it.
    openClock() { syncClock(); }, advance() { syncClock(); }, nextMorning() { syncClock(); }, jump() { syncClock(); }, setClock() { syncClock(); },

    // --- brain dump
    openDump() { ui.sheet = { type: 'dump', mode: 'input', text: ui.dumpDraft || '', input: 'text', restored: !!ui.dumpDraft, form: ui.formDraft || null }; render(); setTimeout(() => { const el = document.getElementById('dump-text'); if (el) el.focus(); }, 60); },
    dumpInput(ds) { ui.sheet.input = ds.v; render(); },
    scenario(ds) { ui.dock = false; ui.sheet = { type: 'dump', mode: 'input', input: 'text', text: D.SCENARIOS[Number(ds.i)].text }; render(); },
    processDump() {
      const text = (ui.sheet.text || '').trim();
      if (!text) { flagField(document.getElementById('dump-text'), 'Nothing to send yet. Ask a question or say what changed, e.g. "I have to work tonight 6 to 10".'); return; }
      stopVoice();
      // A question is answered from the current plan; anything else goes to interpret → review → confirm.
      const ans = Assistant.answer(state, text);
      if (ans) {
        ui.askThread.push({ q: text, a: ans });
        S.log(state, 'Ask SIKAD · answer (rule-based, not a model)', text, { kind: ans.kind, title: ans.title, lines: ans.lines, facts: ans.facts });
        ui.sheet.text = ''; ui.sheet.restored = false; ui.dumpDraft = null; ui.dict = null;
        render();
        const latest = document.getElementById('ask-latest');
        if (latest) { latest.focus({ preventScroll: true }); latest.scrollIntoView({ block: 'nearest' }); }
        return;
      }
      processDump(text);
      render();
      focusFirstQuestion();
    },
    askExample(ds) { ui.sheet.text = D.QUESTIONS[Number(ds.i)]; A.processDump(); },
    acceptProposal() {
      const draft = ui.sheet.draft;
      snapshot('Ask SIKAD');
      draft.engineLog = state.engineLog;
      state = draft;
      ui.dumpDraft = null; ui.dict = null;
      ui.sheet = null; ui.tab = 'home'; ui.focusOnly = false;
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      planToast();
    },
    rejectProposal() { ui.sheet = null; ui.dumpDraft = null; render(); toast('No changes were made. Your plan is as it was.'); },
    editProposal() { ui.sheet = ui.sheet.review; render(); },
    scrollAttention() { const el = document.getElementById('attention'); if (el) { el.scrollIntoView({ block: 'start' }); el.focus({ preventScroll: true }); } },
    dumpEdit() { ui.sheet.mode = 'input'; render(); },
    template(ds) { ui.sheet = { type: 'dump', mode: 'input', input: 'text', text: ds.v }; render(); setTimeout(() => { const el = document.getElementById('dump-text'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, 60); },
    resolve(ds) { ui.sheet.items[Number(ds.n)].resolution = ds.v; render(); },
    answer(ds) { ui.sheet.items[Number(ds.n)].answer = ds.v; render(); },
    toggleRecurring(ds) { const it = ui.sheet.items[Number(ds.n)]; it.makeRecurring = !it.makeRecurring; render(); },
    pickAmbiguous(ds) {
      const list = ds.scope === 'ob' ? ui.ob.review : ui.sheet.items;
      const it = list[Number(ds.n)];
      it.task.deadline = it.ambiguous[Number(ds.k)].deadline;
      it.ambiguous = null; it.clarification = null;
      render();
    },
    applyDump() { applyDump(); },
    saveManual() {
      const f = ui.sheet.form;
      if (!f.title.trim()) { flagField(document.querySelector('[data-bind="sheet.form.title"]'), 'Task name is missing. Type a short name, e.g. "IT 208 report".'); return; }
      snapshot('Manual task');
      const { type, est } = P.classify(f.title);
      const task = S.makeTask(state, { title: P.titleCase(f.title.trim()), type, deadline: f.deadline, durationMins: f.durationMins || est,
        isAiEstimate: !f.durationMins, priority: f.priority, notes: f.notes, parts: P.suggestParts(type, f.durationMins || est) });
      state.tasks.push(task);
      ui.sheet = null; ui.formDraft = null;
      S.replan(state, `New task: ${task.title}`, { notes: task.deadline == null ? [`"${task.title}" needs a deadline before it can be scheduled.`] : [] });
      render();
      toast(task.deadline == null ? 'Task added. It needs a deadline before it can be scheduled.' : 'Task added.', { undo: true });
    },
    dictStart(ds) { dictStart(ds.path); },
    dictStop() { if (recog) { try { recog.stop(); } catch (e) { finishDictation(); } } },
    dictCancel() { if (ui.dict) ui.dict.cancelled = true; if (recog) { try { recog.abort(); } catch (e) { /* already stopped */ } } finishDictation(); },
    dictDemo(ds) {
      const text = ds.path === 'ob.dumpText' ? D.SAMPLE_BRAIN_DUMP : D.SAMPLE_TRANSCRIPT;
      setPath(ui, ds.path, text);
      ui.dict = { path: ds.path, state: 'ready', final: '', interim: '', note: 'demo' };
      render();
    },

    // --- tasks
    openTask(ds) { openTask(ds.id); },
    newTask() { ui.sheet = { type: 'dump', mode: 'input', input: 'form', text: ui.dumpDraft || '', form: ui.formDraft || null }; render(); },
    saveTask() { saveTask(); },
    completeTask() {
      const t = taskById(ui.sheet.id);
      snapshot('Complete task');
      S.completeTask(state, t.id);
      ui.sheet = null;
      S.replan(state, `Completed: ${t.title}`);
      ui.celebrate = true;
      render();
      toast('Task marked done.', { undo: true });
    },
    deleteTask() {
      const t = taskById(ui.sheet.id);
      askConfirm({ run: 'deleteTask', title: 'Remove this task?', body: `"${t.title}" will be removed from your plan. You can undo this right after.`, label: 'Remove task' });
    },

    // --- fixed commitments & settings
    openFixed(ds) { ui.sheet = { type: 'fixed', id: ds.id, day: Number(ds.day) }; render(); },
    cancelFixed() {
      const sh = ui.sheet;
      const o = E.occurrences(state, sh.day).find((x) => x.id === sh.id);
      if (!o) return;
      snapshot('Cancel commitment');
      S.cancelOccurrence(state, o);
      ui.sheet = null;
      S.replan(state, `Cancelled ${o.title} (${T.short(o.start)}) — by you`, { notes: [`That frees up ${T.dur((o.end - o.start) / T.MIN)} on ${T.short(o.start)}.`] });
      render();
      planToast();
    },
    removeClass(ds) {
      const c = state.baseline.classes.find((x) => x.id === ds.id);
      if (!c) return;
      baselineChange(`Removed class ${c.title}`, () => { state.baseline.classes = state.baseline.classes.filter((x) => x.id !== ds.id); }, `Removed ${c.title}`);
    },
    removeRecurring(ds) { baselineChange('Removed weekly commitment', () => { state.baseline.recurring = state.baseline.recurring.filter((r) => r.id !== ds.id); }); },
    removeEvent(ds) { baselineChange('Removed one-time commitment', () => { state.events = state.events.filter((e) => e.id !== ds.id); }); },
    restoreOcc(ds) { baselineChange('Restored a cancelled session', () => { state.cancellations = state.cancellations.filter((c) => c !== ds.id); }); },
    addClass() {
      const f = formValues('add-class');
      if (!f.title.trim()) { flagField(document.querySelector('#add-class [name="title"]'), 'Subject is missing. Type the class name or code, e.g. "IT 203".'); return; }
      if (f.end <= f.start) { flagField(document.querySelector('#add-class [name="end"]'), 'End time must be later than the start time.'); return; }
      baselineChange(`Added class ${f.title}`, () => state.baseline.classes.push({ id: S.uid(state, 'c'), title: f.title.trim(), day: Number(f.day), start: f.start, end: f.end, mode: f.mode }));
    },
    addRecurringForm() {
      const f = formValues('add-rec');
      if (!f.title.trim()) { flagField(document.querySelector('#add-rec [name="title"]'), 'Name is missing. Type what the commitment is, e.g. "Org meeting".'); return; }
      if (f.end <= f.start) { flagField(document.querySelector('#add-rec [name="end"]'), 'End time must be later than the start time.'); return; }
      baselineChange(`Added weekly ${f.title}`, () => S.addRecurring(state, { title: f.title.trim(), kind: f.kind, days: [Number(f.day)], start: f.start, end: f.end }));
    },

    // --- Profile management views (weekly baseline)
    profileOpen(ds) { ui.sub = SUBS.includes(ds.sub) ? ds.sub : null; render(); window.scrollTo(0, 0); focusHeading(); },
    profileBack() { const from = ui.sub; ui.sub = null; render(); window.scrollTo(0, 0); const b = document.querySelector(`[data-action="profileOpen"][data-sub="${from}"]`); if (b) b.focus({ preventScroll: true }); },
    accToggle(ds) { const d = Number(ds.d); ui.accOpen[d] = !ui.accOpen[d]; ui.accJust = ui.accOpen[d] ? d : null; render(); ui.accJust = null; },
    formDay(ds) { const f = ui.sheet.form, d = Number(ds.d); f.days = f.days.includes(d) ? f.days.filter((x) => x !== d) : f.days.concat(d).sort((a, c) => dayRank(a) - dayRank(c)); ui.sheet.dayError = false; render(); },
    formSet(ds) { ui.sheet.form[ds.k] = ds.v; render(); },
    classAdd(ds) { ui.sheet = { type: 'classForm', groupIds: [], form: { title: '', days: ds.d != null ? [Number(ds.d)] : [], start: '08:00', end: '10:00', mode: 'FTF', room: '' } }; render(); },
    classEdit(ds) {
      const c = state.baseline.classes.find((x) => x.id === ds.id);
      if (!c) return;
      const same = state.baseline.classes.filter((x) => x.title === c.title && x.start === c.start && x.end === c.end && x.mode === c.mode && (x.room || '') === (c.room || ''));
      ui.sheet = { type: 'classForm', groupIds: same.map((x) => x.id), form: { title: c.title, days: same.map((x) => x.day).sort((a, d) => dayRank(a) - dayRank(d)), start: c.start, end: c.end, mode: c.mode, room: c.room || '' } };
      render();
    },
    classSave() {
      const sh = ui.sheet, f = sh.form;
      if (!baselineFormOk('Subject is missing. Type the class name or code, e.g. "IT 203".')) return;
      const title = f.title.trim(), editing = sh.groupIds.length > 0, overlap = sh.conflicts.length > 0;
      ui.sheet = null;
      for (const d of f.days) ui.accOpen[d] = true;
      baselineChange(`${editing ? 'Edited' : 'Added'} class ${title}`,
        () => writeBaselineRows('classes', 'c', sh.groupIds, f.days, { title, start: f.start, end: f.end, mode: f.mode, room: f.room.trim() }),
        `${editing ? 'Saved' : 'Added'} ${title}${overlap ? ' with an overlap to review' : ''}. Plan recalculated.`);
      focusHeading();
    },
    classRemove(ds) {
      const c = state.baseline.classes.find((x) => x.id === ds.id);
      if (!c) return;
      askConfirm({ run: 'removeClass', id: c.id, title: `Remove ${c.title} on ${T.DAY_NAMES[c.day]}?`, body: `This ${T.DAY_NAMES[c.day]} class is removed from every week and your plan is recalculated. Other days stay. You can undo this right after.`, label: 'Remove class' });
    },
    commitAdd(ds) { ui.sheet = { type: 'commitForm', groupIds: [], form: { title: '', cat: ds.kind || 'other', kind: null, days: [], start: '17:00', end: '19:00', notes: '', place: '' } }; render(); },
    commitEdit(ds) {
      const g = commitGroups().find((x) => x.ids.join(',') === ds.ids);
      if (!g) return;
      ui.sheet = { type: 'commitForm', groupIds: g.ids, form: { title: g.title, cat: g.cat, kind: g.kind, days: g.days.slice().sort((a, d) => dayRank(a) - dayRank(d)), start: g.start, end: g.end, notes: g.notes, place: g.place } };
      render();
    },
    commitSave() {
      const sh = ui.sheet, f = sh.form;
      if (!baselineFormOk(COMMIT_FIELDS[f.cat].missing)) return;
      const title = f.title.trim(), editing = sh.groupIds.length > 0, overlap = sh.conflicts.length > 0;
      // "Other" keeps the kind an existing entry already had (e.g. one added through Ask SIKAD).
      const kind = f.cat === 'other' ? (f.kind && f.kind !== 'work' && f.kind !== 'org' ? f.kind : 'event') : f.cat;
      ui.sheet = null;
      baselineChange(`${editing ? 'Edited' : 'Added'} weekly ${title}`,
        () => writeBaselineRows('recurring', 'r', sh.groupIds, f.days, { title, kind, start: f.start, end: f.end, notes: f.notes.trim(), place: f.cat === 'work' ? f.place.trim() : '' }),
        `${editing ? 'Saved' : 'Added'} ${title}${overlap ? ' with an overlap to review' : ''}. Plan recalculated.`);
      focusHeading();
    },
    commitRemove(ds) {
      const g = commitGroups().find((x) => x.ids.join(',') === ds.ids);
      if (!g) return;
      askConfirm({ run: 'removeCommit', ids: g.ids, name: g.title, title: `Remove ${g.title}?`, body: `It is removed from every week (${daySpan(g.days)}) and your plan is recalculated. You can undo this right after.`, label: 'Remove commitment' });
    },
    openEngine() { ui.dock = false; ui.sheet = { type: 'engine' }; render(); },

    // --- sheet chrome
    closeSheet() { if (ui.sheet && ui.sheet.type === 'confirm') { A.confirmNo(); return; } stopVoice(); keepDraft(); ui.sheet = null; render(); },
    backdrop(ds, el, e) { if (e.target === el) A.closeSheet(); },
  });

  /**
   * Dismissing Ask SIKAD must not throw away what the student typed. Everything else starts fresh
   * next time: answered questions are cleared, and an example question is never kept as a draft.
   */
  const ownDraft = (text) => { const t = (text || '').trim(); return t && !D.QUESTIONS.includes(t) ? t : null; };
  function keepDraft() {
    if (!ui.sheet) return;
    if (ui.sheet.type === 'dump' || ui.sheet.type === 'proposal') ui.askThread = [];
    if (ui.sheet.type === 'dump') {
      ui.dumpDraft = ownDraft(ui.sheet.text);
      const f = ui.sheet.form;
      ui.formDraft = f && (f.title.trim() || (f.notes || '').trim() || f.deadline != null) ? f : null;
    }
    if (ui.sheet.type === 'proposal') ui.dumpDraft = ownDraft(ui.sheet.review.text);
  }

  /** The student has said how the session went: record it, update the task and replan. */
  function endFocusSession(outcome, remainingMins) {
    const a = state.active;
    if (!a) return;
    const s = S.findSession(state, a.sessionId);
    const focusedMins = F.timer(a, S.focusElapsedMs(a)).focusedMins;
    snapshot('End session');
    S.endFocus(state, { outcome, remainingMins, focusedMins });
    ui.focusPartial = false;
    const say = () => toast(outcome === 'complete' ? `"${s.title}" is done. Your plan has been updated.`
      : outcome === 'partial' ? `Progress saved. ${T.dur(remainingMins)} is back in your plan.`
      : 'Session recorded. The work is still on your plan.', { undo: true });
    if (outcome === 'complete') { ui.celebrate = true; settle(s.id, say); return; }
    render();
    say();
  }

  function formValues(id) {
    const out = {};
    document.querySelectorAll(`#${id} [name]`).forEach((el) => { out[el.name] = el.value; });
    return out;
  }

  function baselineChange(trigger, fn, msg) {
    snapshot(trigger);
    fn();
    S.replan(state, trigger);
    render();
    toast(msg || 'Baseline updated. Plan recalculated.', { undo: true });
  }
  /** Every replan offers Undo in one place: the toast. */
  const planToast = () => toast('Plan updated.', { undo: true });

  // ----------------------------------------------------------------- clock --
  // state.now follows the device's local time: on load, at each new minute, and whenever the app
  // comes back to the front. The data is always brought up to date; the screen waits until the
  // student isn't mid-entry, so typing is never interrupted.
  let clockDirty = false, clockTimer = 0;
  const midEntry = () => {
    const el = document.activeElement;
    return !!(ui.sheet || ui.askMenu || pending || (el && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) || document.querySelector('details.add[open]'));
  };
  function syncClock(quiet) {
    const real = T.now();
    if (real !== state.now) {
      const newDay = T.dayStart(real) !== T.dayStart(state.now);
      const hadCheckins = state.checkins.length;
      // A running focus session is never ended by the clock; the student ends it.
      if (!state.onboarded || state.active) state.now = real;
      else S.setClock(state, real);
      if (newDay) { ui.dayView = 'today'; ui.weekDay = null; ui.weekStart = null; }
      if (newDay || state.checkins.length > hadCheckins) undoSnap = null;
      clockDirty = true;
      if (!quiet && state.checkins.length > hadCheckins) toast('A session ended without "Done". Check in on the Home tab.');
    }
    if (quiet || !clockDirty) return;
    if (midEntry()) { S.save(state); return; }
    clockDirty = false;
    render();
  }
  function scheduleClock() {
    clearTimeout(clockTimer);
    clockTimer = setTimeout(() => { syncClock(); scheduleClock(); }, clockDirty ? 3000 : 60000 - (Date.now() % 60000) + 40);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { syncClock(); scheduleClock(); } });
  window.addEventListener('pageshow', () => { syncClock(); scheduleClock(); });
  window.addEventListener('focus', () => { syncClock(); scheduleClock(); });

  // ----------------------------------------------------------------- voice --
  let recog = null;
  function dictStart(path) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { render(); return; }                        // the panel already shows the fallback
    const field = document.querySelector(`[data-bind="${path}"]`);
    ui.dict = { path, state: 'recording', final: '', interim: '', base: field && field.value.trim() ? field.value.trim() + ' ' : '', startedReal: Date.now() };
    recog = new SR();
    recog.lang = 'en-PH';
    recog.continuous = true;
    recog.interimResults = true;
    recog.onresult = (e) => {
      if (!ui.dict) return;
      // Some browsers (Chrome on Android) repeat everything said so far in each new result, so a
      // result that restates the text is taken as its replacement, not added after it.
      const join = (a, b) => {
        const x = a.trim(), y = b.trim(), lx = x.toLowerCase(), ly = y.toLowerCase();
        if (!y || lx.endsWith(ly)) return x;
        return !x || ly.startsWith(lx) ? y : `${x} ${y}`;
      };
      let fin = '', interim = '';
      for (let i = 0; i < e.results.length; i++) { if (e.results[i].isFinal) fin = join(fin, e.results[i][0].transcript); else interim = join(interim, e.results[i][0].transcript); }
      const all = join(fin, interim);
      interim = all.slice(fin.length).trim(); fin = fin ? fin + ' ' : '';
      ui.dict.final = fin; ui.dict.interim = interim;
      const live = document.getElementById('dict-interim');
      if (live) live.textContent = (fin + interim) || 'Listening…';
    };
    recog.onerror = (e) => { if (ui.dict) ui.dict.errorCode = e.error; };
    recog.onend = finishDictation;
    try { recog.start(); } catch (err) { ui.dict.errorCode = 'start-failed'; finishDictation(); return; }
    render();
    const stop = document.querySelector('[data-action="dictStop"]');
    if (stop) stop.focus({ preventScroll: true });
  }
  /** Recording ended (Stop, Cancel, silence or an error): put the transcript in the editable field, or explain why there is none. */
  function finishDictation() {
    const d = ui.dict;
    recog = null;
    if (!d || d.state !== 'recording') return;
    const text = (d.final + d.interim).trim();
    d.state = 'ready';
    if (d.cancelled) d.note = 'cancelled';
    else if (text) { setPath(ui, d.path, d.base + text); d.note = 'transcribed'; }
    else d.error = VOICE_ERRORS[d.errorCode] || 'Nothing was transcribed. Try again, or type instead.';
    render();
    const field = document.querySelector(`[data-bind="${d.path}"]`);
    if (field && !d.cancelled && text) field.focus({ preventScroll: true });
  }
  /** Leaving the panel while recording discards the recording quietly. */
  function stopVoice() {
    if (!ui.dict || ui.dict.state !== 'recording') return;
    const r = recog;
    recog = null; ui.dict = null;
    if (r) { r.onend = null; try { r.abort(); } catch (e) { /* already stopped */ } }
  }

  // ---------------------------------------------------------------- events --
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || el.disabled) return;
    const fn = A[el.dataset.action];
    if (!fn) return;
    // A completion is still settling: show its result now. A tap on a control that no longer exists is dropped.
    if (pending) { render(); if (!el.isConnected) return; }
    if (el.dataset.action !== 'backdrop') e.preventDefault();
    // ERROR state (design.md §8): if an action throws, put the plan back exactly as it was and say so.
    const before = undoSnap, sheetBefore = ui.sheet ? JSON.parse(JSON.stringify(ui.sheet)) : null;
    try {
      fn(el.dataset, el, e);
    } catch (err) {
      console.warn('SIKAD action failed:', el.dataset.action, err);
      if (undoSnap && undoSnap !== before) {
        const log = state.engineLog;
        state = Object.assign(S.initialState(), JSON.parse(undoSnap.json));
        state.engineLog = log;
        undoSnap = before;
      }
      ui.error = { detail: '', retrySheet: sheetBefore };
      ui.sheet = null; ui.tab = 'home';
      render();
      toast("Couldn't update your plan. Nothing was changed.");
    }
  });

  document.addEventListener('click', (e) => {
    document.querySelectorAll('.row-menu[open]').forEach((m) => { if (!m.contains(e.target)) m.open = false; });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const m = document.querySelector('.row-menu[open]');
    if (m) { m.open = false; m.querySelector('summary').focus(); e.stopPropagation(); }
  }, true);

  document.addEventListener('input', (e) => {
    const el = e.target;
    clearFieldError(el);
    if (el.dataset.bind && el.type !== 'checkbox' && el.tagName !== 'SELECT' && !['datetime-local', 'time'].includes(el.type)) {
      setPath(ui, el.dataset.bind.replace(/^ob\./, 'ob.'), convert(el));
      if (el.dataset.est) setPath(ui, el.dataset.est, false);
      if (el.dataset.bind === 'sheet.text') { /* keep typing smooth: no re-render */ }
    }
  });

  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset.bind) {
      setPath(ui, el.dataset.bind, convert(el));
      if (el.dataset.est) setPath(ui, el.dataset.est, false);
      if (el.dataset.rerender !== undefined || el.tagName === 'SELECT' || el.type === 'checkbox') {
        if (el.dataset.bind.startsWith('ob.classes')) ui.ob.analysis = E.analyzeBaseline(ui.ob.classes);
        if (el.dataset.rerender !== undefined) render();
      }
      return;
    }
    if (el.dataset.setting) {
      const key = el.dataset.setting;
      const val = el.type === 'checkbox' ? el.checked : el.dataset.type === 'int' ? parseInt(el.value, 10) : el.value;
      baselineChange('Baseline settings changed', () => { state.baseline[key] = val; });
      return;
    }
    if (el.dataset.change === 'obUpload' && el.files && el.files[0] && !ui.ob.extracting) {
      ui.ob.uploadNote = 'Prototype: reading files uses a sample schedule. Edit anything.';
      ui.ob.corText = D.SAMPLE_COR_TEXT;
      A.obExtract();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' && ui.sheet) {
      // checkVisibility() also excludes content of closed <details> (offsetParent alone does not).
      const visible = (x) => (x.checkVisibility ? x.checkVisibility() : x.offsetParent !== null);
      const f = [...$sheet.querySelectorAll('button:not([disabled]), input:not([disabled]), select, textarea, summary, [tabindex="0"]')].filter(visible);
      if (f.length) {
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && (document.activeElement === first || !$sheet.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    if (e.key === 'Escape' && ui.sheet) A.closeSheet();
    else if (e.key === 'Escape' && ui.askMenu) A.askMenuClose();
    else if (e.key === 'Escape' && document.body.classList.contains('spotlight')) A.spotlightOff();
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && ui.sheet && ui.sheet.type === 'dump' && ui.sheet.mode === 'input') A.processDump();
  });

  // Offline: say so once, in one place. The plan is computed on this device, so it keeps working.
  const setOffline = (off) => { if (ui.offline !== off) { ui.offline = off; render(); } };
  window.addEventListener('offline', () => setOffline(true));
  window.addEventListener('online', () => setOffline(false));
  // App shell cache for offline launches (network first, so a new deploy is never masked by the cache).
  try { if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {}); } catch (e) { /* not available: the app still runs online */ }

  // Keep the toggle's icon in sync when following the OS setting and it changes.
  if (darkQuery && darkQuery.addEventListener) darkQuery.addEventListener('change', () => { if (!document.documentElement.dataset.theme) render(); });

  // Tell the student if saved data was unreadable and had to be replaced.
  if (state.loadNotice) { const msg = state.loadNotice; delete state.loadNotice; setTimeout(() => toast(msg, { ms: 7000 }), 300); }

  // Deep link: open the tab named in the URL (e.g. index.html#tasks).
  if (state.onboarded && TABS.includes(location.hash.slice(1).split('/')[0])) readRoute();

  // App-open intro (motion-spec §5.7): pure CSS; this only lets a tap skip it and removes the node afterwards.
  const intro = document.getElementById('intro');
  if (intro) {
    if (getComputedStyle(intro).display === 'none') intro.remove();
    else {
      intro.addEventListener('animationend', (e) => { if (e.target === intro) intro.remove(); });
      intro.addEventListener('pointerdown', () => intro.classList.add('is-skipped'));
    }
  }

  syncClock(true);   // a plan saved earlier is brought up to the real current time before first paint
  render();
  scheduleClock();
})();
