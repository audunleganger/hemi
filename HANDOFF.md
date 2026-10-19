# Handoff (2026-10-19)

## State
- Branch `web-home` = PR #4, now based on `main`, CI green. It carries the domain (§6 schema, rules, services, 62 tests), the REST API under `/api/v1` + ICS feed (X-3), and the web app: calendar home (DS-2), attack mode (DS-3), Record flows (`web/src/record/*`), Medications page, basic attack list, diary settings. `web/e2e/flow.mjs` walks through it.
- `main` only has the scaffold (#1). #2 and #3 were merged into their stacked bases (`scaffold`, `domain`), not into `main`, so their code reaches `main` only through #4.
- `REQUIREMENTS.md` 0.8: the appendices "Rules made precise" (0.7) and "Web app details" (0.8) hold this session's interpretations, which the user hasn't reviewed yet.
- **Checkpoint**: the user is looking at the web app now. Get feedback on the look (dark C, light C, dim B attack mode) and the attack flow before building more.

## Running it
- Dev: `./gradlew :server:run` (:8080, data in `./data`) + `cd web && npm install && npm run dev` → http://localhost:5173. The first visit shows setup.
- One process: `./gradlew :server:buildFatJar && (cd web && npm ci && npm run build) && HEMI_WEB_DIR=web/dist java -jar server/build/libs/hemi-server.jar` → :8080.
- Doses need a medication with an ingredient and a limit (Medications page) first.

## Next (after the user's feedback)
1. Attack page (V-5): timeline chart, edit episodes/readings, status/nausea/pain side/triggers/note, split a recurrence; link it from the attack list and the day view.
2. Dose list (V-6) with filters; edit/delete doses (DO-8).
3. Triggers in Settings (TR-1…TR-3), with the "used on N attacks" warning.
4. Medication photos (ME-8): copy Larder's `web/src/lib/images.ts` + photo component; the API is done.
5. Statistics (ST-1…ST-6) in `shared` with tests, an endpoint and a page (Recharts).
6. CSV export (X-1, incl. `days.csv` for WI-4), JSON export/import (X-2).
7. Calendar feed in Settings (X-3) and the "include Unsure" calendar filter (AT-4); the API does both.
8. Android only once the web app is settled.

## Open questions
- Stacking: stop stacking PRs on unmerged branches. Base new work on `main` once #4 is merged, or the same base-branch merge problem comes back.

## Traps
- Heredocs mangle `"\;"` in Kotlin sources; use the Edit tool for lines with backslashes.
- `pkill -f hemi-server.jar` kills the calling shell; use `fuser -k 8080/tcp`.
- `Field` wraps its child in a `<label>`; button groups need `FieldGroup`.
- `:root[data-theme=…]` and `:root.attack-mode` have equal specificity; attack mode wins by coming later in `index.css`.
- `<input type=time>` is minute-rounded; send `at: null` unless the user changed the time.
- The schema is version 1 and changes in place (no `1.db`, `verifyMigrations` off) until the first release.
- The Norwegian glossary terms are provisional.
