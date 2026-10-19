# Handoff (2026-10-19)

## State
- Branch `web-home` = PR #4 (based on `main`, CI green): domain, REST API `/api/v1` + ICS feed, and the web app (calendar home, attack mode, Record flows in `web/src/record/*`, Medications, basic attack list, settings). `main` only has the scaffold; #2/#3 reach it only through #4.
- The user runs it in Docker from `~/development/infra/hemi` (`docker compose up -d --build` builds *this checkout*, port 8082) and gave feedback, recorded as `REQUIREMENTS.md` 0.9 (appendix "Feedback on the web app"). No code for it yet.
- Two doc commits (f4e8efb, 05ad01b) are local only, not pushed.
- The 0.7/0.8 appendices (interpretations) are still unreviewed by the user.

## Next
1. Layouts around the breakpoints (DS-1): check every width 320–1400 px, especially 650–1150.
2. Attack list status filter keeps at least one status on (V-4); find why attacks showed with all three off.
3. Severity colors pink / red / dark red for 1 / 2 / 3 in light, dark and attack mode (dimmed there; the amber accent stays), plus the calendar legend (DS-6).
4. "Start attack + choose medication" with a medication picker (AT-1).
5. Discard the ongoing attack (AT-16): server endpoint (episode only if it's a recurrence) + confirmation listing its doses, "delete them too" checked by default.
6. Attack page (V-5), everything editable (AT-12): timeline chart, episodes/readings/doses, status/nausea/pain side/triggers/note, split a recurrence; opened from calendar day view, attack list and ongoing-attack header.
7. Then: dose list + edit/delete doses (V-6, DO-8); triggers in Settings (TR-1…3); medication photos (ME-8, copy Larder's `web/src/lib/images.ts`); statistics (ST-1…6); CSV/JSON export (X-1, X-2); calendar feed + "include Unsure" filter (X-3, AT-4); Android last.

## Open questions
- Exact pink/red/dark-red values: propose them and show the user.
- Stop stacking PRs: base new work on `main` once #4 is merged (or keep adding to #4 until then).

## Traps
- When citing requirement IDs to the user, say what they mean; they asked for an explanation once.
- Heredocs mangle `"\;"` in Kotlin sources; use the Edit tool for lines with backslashes.
- `pkill -f hemi-server.jar` kills the calling shell; use `fuser -k 8080/tcp`.
- `Field` wraps its child in a `<label>`; button groups need `FieldGroup`.
- `:root[data-theme=…]` and `:root.attack-mode` have equal specificity; attack mode wins by coming later in `index.css`.
- `<input type=time>` is minute-rounded; send `at: null` unless the user changed the time.
- Schema is version 1 and changes in place (no `1.db`, `verifyMigrations` off) until the first release.
- The user's Docker data is in `~/development/infra/hemi/data`; don't wipe it when testing, use `./data` here.
