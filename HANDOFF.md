# Handoff (2026-10-19)

## State
- Four stacked PRs on `audunleganger/hemi`, all green in CI except #4 (just opened), **none merged**: the permission system blocked `gh pr merge`, although the user said to merge green PRs. Merge them in order (#1 → #2 → #3 → #4); each later one is based on the branch before it, so after merging #1 retarget #2 to `main`, and so on (GitHub offers this when the base branch is deleted).
  - #1 `scaffold`: Gradle, server infrastructure (setup, auth, admin, backups, health), web shell, Docker, CI. Copied from Larder, renamed to `com.hemi` / `HEMI_*`.
  - #2 `domain`: schema (§6) and the domain rules and services in `shared`, with 62 tests.
  - #3 `api`: REST API under `/api/v1` and the ICS feed (X-3).
  - #4 `web-home`: calendar home (DS-2), attack mode (DS-3), + Record flows (start, start + usual medication, start with options, reading, dose with limit preview, log afterwards, rating, end), Medications page (medications, ingredients, limits), a basic attack list, diary settings. E2E walkthrough covers it.
- `REQUIREMENTS.md` is at 0.8. The appendix tables "Rules made precise" (0.7) and "Web app details" (0.8) record the interpretations made this session. The user hasn't reviewed them yet.
- **Checkpoint**: the user wanted to look at the web app once it first renders, before more is built. Ask them for feedback on #4's look (dark C, light C, dim B) first.

## Running it
- Everything is on branch `web-home` (it contains #1–#3 too).
- Development: `./gradlew :server:run` (API on :8080, data in `./data`) and, in another terminal, `cd web && npm install && npm run dev`, then open http://localhost:5173. The first visit shows the setup screen.
- One process: `./gradlew :server:buildFatJar && (cd web && npm ci && npm run build) && HEMI_WEB_DIR=web/dist java -jar server/build/libs/hemi-server.jar`, then http://localhost:8080.
- Docker: `docker build -t hemi . && docker run -p 8080:8080 -v hemi-data:/data hemi`. `ghcr.io/audunleganger/hemi:main` only exists once something is merged to `main`.
- A new account has no medications. Add one under Medications, with an active ingredient and a limit, before logging doses.

## Next (after the user's feedback)
1. Attack page (V-5): timeline chart, edit episodes and readings, status/nausea/pain side/triggers/note, split a recurrence; link the attack list and the day view to it.
2. Dose list (V-6) with filters; edit and delete doses (DO-8).
3. Triggers in Settings (TR-1 … TR-3): add, rename, reorder, archive, delete with the "used on N attacks" warning.
4. Medication photos (ME-8): copy Larder's `web/src/lib/images.ts` and its photo component; the API is done.
5. Statistics (ST-1 … ST-6) in `shared` with tests (NF-4), an endpoint, and a page (Recharts).
6. CSV export (X-1, with `days.csv` for WI-4) and JSON export/import (X-2).
7. Calendar feed in Settings (X-3): show the URL, new secret, turn off. The API is done.
8. The "include Unsure" filter for the calendar (AT-4); the API takes `includeUnsure`.
9. Android only after the user is happy with the web app.

## Traps
- Bash heredocs here mangle `"\;"` into `"\;"` in Kotlin sources. Use the Edit tool for lines with backslashes.
- `pkill -f hemi-server.jar` kills the calling shell too (its command line matches). Use `fuser -k <port>/tcp`.
- `Field` wraps its child in a `<label>`; for button groups use `FieldGroup`, or the first button takes the label's whole text as its name.
- Theme tokens: `:root[data-theme=…]` and `:root.attack-mode` have the same specificity; attack mode wins by coming later in `index.css`.
- Times from `<input type=time>` are minute-rounded; send `at: null` ("now") unless the user changed the time.
- The schema is still version 1 and changes in place (no `1.db`, `verifyMigrations` off) until the first release.
- Larder's folder is `calorie-companion`, but the product and image are called `larder`.
- The Norwegian glossary terms are provisional.
