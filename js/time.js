/*
 * SIKAD — wall-clock time helpers.
 *
 * All times are stored as "wall-clock milliseconds": a UTC timestamp whose UTC
 * fields equal the student's local wall time on this device. "Now" always comes
 * from the device clock and timezone (T.now); nothing in the product simulates
 * time. ISO 8601 strings carry the device's UTC offset.
 */
(function (root) {
  'use strict';

  const MIN = 60000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;
  /** Minutes the device's local time is ahead of UTC at a given instant (handles DST). */
  const tzMins = (real) => -new Date(real).getTimezoneOffset();
  const offsetLabel = (m) => (m < 0 ? '-' : '+') + String(Math.floor(Math.abs(m) / 60)).padStart(2, '0') + ':' + String(Math.abs(m) % 60).padStart(2, '0');
  const OFFSET = offsetLabel(tzMins(Date.now()));
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];

  const pad = (n) => String(n).padStart(2, '0');

  const T = {
    MIN, HOUR, DAY, OFFSET, DAY_NAMES, DAY_SHORT, MONTHS,

    /** The real current local minute as wall-clock ms. Tests may replace `now`; the app never does. */
    real() { const real = Date.now(); return Math.floor(real / MIN) * MIN + tzMins(real) * MIN; },
    /** What the app treats as "now": the real minute plus the presenter's demo shift (0 unless set in the judge dock). */
    now() { return T.real() + T.shift; },
    shift: 0,
    /** Presenter tool only: move the app's clock by `ms` from real time (0 = real time). Kept for this browser tab. */
    setShift(ms) {
      T.shift = Math.round((Number(ms) || 0) / MIN) * MIN;
      try { if (T.shift) sessionStorage.setItem('sikad-clock-shift', String(T.shift)); else sessionStorage.removeItem('sikad-clock-shift'); } catch (e) { /* tab-only anyway */ }
    },
    make(y, mo, d, h = 0, mi = 0) { return Date.UTC(y, mo - 1, d, h, mi); },
    parts(ms) {
      const d = new Date(ms);
      return { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate(),
        h: d.getUTCHours(), mi: d.getUTCMinutes(), dow: d.getUTCDay() };
    },
    dayStart(ms) { return Math.floor(ms / DAY) * DAY; },
    addDays(ms, n) { return ms + n * DAY; },
    dow(ms) { return new Date(ms).getUTCDay(); },
    hmToMins(s) { const [h, m] = String(s).split(':').map(Number); return h * 60 + (m || 0); },
    minsToHm(m) { return pad(Math.floor(m / 60)) + ':' + pad(m % 60); },
    at(dayMs, hm) { return dayMs + (typeof hm === 'string' ? T.hmToMins(hm) : hm) * MIN; },
    minsOfDay(ms) { return Math.round((ms - T.dayStart(ms)) / MIN); },
    ceilTo(ms, mins) { const step = mins * MIN; return Math.ceil(ms / step) * step; },
    /** End of the student's week (Sunday 23:59). On a Sunday, "this week" means the coming one. */
    endOfWeek(ms) {
      let diff = (7 - T.dow(ms)) % 7;
      if (diff === 0) diff = 7;
      return T.at(T.addDays(T.dayStart(ms), diff), '23:59');
    },

    toISO(ms) { return new Date(ms).toISOString().slice(0, 19) + OFFSET; },
    fromISO(s) {
      return Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10), +s.slice(11, 13) || 0, +s.slice(14, 16) || 0);
    },
    toInput(ms) { return new Date(ms).toISOString().slice(0, 16); },
    fromInput(s) { return s ? T.fromISO(s) : null; },
    key(ms) { return new Date(ms).toISOString().slice(0, 10); },
    // Form fields: a date input ("YYYY-MM-DD"), a time input ("HH:MM"), and a duration as hours + minutes.
    // Built from the digits the student typed, never through the device timezone, so 2:35 PM stays 2:35 PM.
    dateInput(ms) { return ms == null ? '' : T.key(ms); },
    timeInput(ms) { return ms == null ? '' : new Date(ms).toISOString().slice(11, 16); },
    /** → wall-clock ms, or null when the date is missing or either part is not a real date/time. */
    joinInput(date, time) {
      const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || ''), t = /^(\d{2}):(\d{2})/.exec(time || '');
      if (!d || !t || +t[1] > 23 || +t[2] > 59) return null;
      const ms = Date.UTC(+d[1], +d[2] - 1, +d[3], +t[1], +t[2]);
      return T.key(ms) === date ? ms : null;   // rejects 2026-02-31 and the like
    },
    splitDur(mins) { mins = Math.max(0, Math.round(mins || 0)); return { h: Math.floor(mins / 60), m: mins % 60 }; },
    /** Hours and minutes as typed ('' allowed for either) → whole minutes, or null when both are empty or not numbers. */
    joinDur(h, m) {
      if ((h === '' || h == null) && (m === '' || m == null)) return null;
      const hv = h === '' || h == null ? 0 : Number(h), mv = m === '' || m == null ? 0 : Number(m);
      if (!isFinite(hv) || !isFinite(mv) || hv < 0 || mv < 0) return null;
      return Math.round(hv * 60 + mv);
    },

    time(ms) {
      const { h, mi } = T.parts(ms);
      const h12 = h % 12 === 0 ? 12 : h % 12;
      return `${h12}:${pad(mi)} ${h < 12 ? 'AM' : 'PM'}`;
    },
    timeShort(ms) {
      const { h, mi } = T.parts(ms);
      const h12 = h % 12 === 0 ? 12 : h % 12;
      return `${h12}${mi ? ':' + pad(mi) : ''} ${h < 12 ? 'AM' : 'PM'}`;
    },
    hmLabel(hm) { return T.timeShort(T.at(0, hm)); },
    range(a, b) { return `${T.time(a)} – ${T.time(b)}`; },
    date(ms) { const p = T.parts(ms); return `${DAY_NAMES[p.dow]}, ${MONTHS[p.mo - 1]} ${p.d}`; },
    short(ms) { const p = T.parts(ms); return `${DAY_SHORT[p.dow]}, ${MONTHS[p.mo - 1].slice(0, 3)} ${p.d}`; },
    dur(mins) {
      mins = Math.round(mins);
      if (mins < 60) return `${mins} min`;
      const h = Math.floor(mins / 60), m = mins % 60;
      if (m === 0) return `${h} hr${h > 1 ? 's' : ''}`;
      if (m === 30) return `${h}.5 hrs`;
      return `${h} hr ${m} min`;
    },
    /** "Today" / "Tomorrow" / "Wed" / "Mon, Oct 19" relative to now. */
    rel(ms, now) {
      const diff = Math.round((T.dayStart(ms) - T.dayStart(now)) / DAY);
      if (diff === 0) return 'Today';
      if (diff === 1) return 'Tomorrow';
      if (diff === -1) return 'Yesterday';
      if (diff > 1 && diff < 7) return DAY_NAMES[T.dow(ms)];
      return T.short(ms);
    },
    when(ms, now) { return `${T.rel(ms, now)}, ${T.time(ms)}`; },
  };

  try { T.shift = Number(sessionStorage.getItem('sikad-clock-shift')) || 0; } catch (e) { T.shift = 0; }
  root.TempoTime = T;
})(typeof window !== 'undefined' ? window : globalThis);
