# SIKAD build rules

Stack: vanilla HTML/CSS/JS PWA. No frameworks, libraries, build step, npm packages, or new fonts/colors outside design.md tokens.
Source of truth: `design.md` (+ `motion-spec.md`). Audit: `SIKAD-UIUX-AUDIT-REPORT_v3.md`. How the system works and where things are: `system_codebase_summary.md`.
Scope: UI/UX. Never change engine.js / parser.js behavior or JSON contracts. store.js: no changes EXCEPT the additive ones named in Batch 10 and Batch 11. Keep every existing `data-action` name working.
Exception (14 Oct 2026 prompt, see process-log.md): narrow changes to engine.js (placement order; minutes waiting on a check-in are not placed) and to store.js (check-ins, `setClock`, snooze clears a pin) were authorized, as were narrow parser.js fixes for E2, E3, E4, E7 and E11 in errors.md. Exports and JSON contracts are unchanged; the rule above still applies to anything else.
Design rules to keep: one primary (Butter) button per view; protected items show lock + "Fixed"; AI estimates show ≈ + "AI estimate"; every replan shows before → after + Undo; the student always decides.

## Product vs prototype
The app must look like a real product. OCR/file reading, speech-to-text, and platform connections may use sample data (organizers allow it), but the core flow (typed brain dump → tasks → schedule → replan → Done/Snooze/Undo) must really work. No DEMO badges or dashed demo boxes in product mode. Where data is simulated show ONE small muted caption (helper-text style), and the Profile "limits" section says what's simulated. Presenter tools live only in the judge-mode dock.

## How to work (token budget is limited; this is graded)
- Do ONLY the batch I paste. No refactors, renames, cleanups, or "while I'm here" changes.
- Never read whole files. `grep -n` the function/selector, then `view` a narrow range. app.js is ~150KB.
- Edit with targeted replacements. Never rewrite a whole file.
- After editing JS run `node --check js/app.js` (and store.js if touched). Fix before reporting.
- Skills: `frontend-design`, `make-interfaces-feel-better` for visual edits; `motion-design` only if motion is touched (native CSS/WAAPI, motion-spec.md); `ios-design` for safe-area/touch. Don't use gsap-* or vercel-* skills.
- Report in ≤ 8 lines: files changed, what the user will see, how I verify it, anything you did NOT do and why.
- Append 3 lines to `process-log.md`: what changed, why (finding IDs), one test you ran and what it showed. Plain language.
- If something conflicts with design.md or the code, stop and ask one question instead of guessing.
