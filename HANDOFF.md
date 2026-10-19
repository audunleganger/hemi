# Handoff (2026-10-19)

## State
- No code yet, and the folder isn't a git repo yet. The requirements review is finished.
- `REQUIREMENTS.md` (v0.5) is the source of truth: all decisions, numbered requirements, data model, and a decision log in the appendix. Read it before building anything.
- `docs/design/directions.html` holds the three design mockups (A/B/C), also published at https://claude.ai/artifact/R8MPzA6awi9fsvhU8v8Wqg. **Chosen: C "Diary", with B "Dim" as attack mode; dark by default** (spec §3.12). A was rejected.
- The app is named **Hemi**. Keep the visible name in one place.
- Reference app: Larder, at `~/development/calorie-companion`, published as `ghcr.io/audunleganger/larder`. Hemi copies its structure: `shared/` (pure Kotlin, Java 17), `server/` (Ktor), `web/` (React + TS + Vite), `android/` (Compose), with SQLite via SQLDelight, generated TS types, Docker and backups. Its `REQUIREMENTS.md` is the format model.

## Next
1. `git init`, and create the GitHub repo (name to confirm with the user, probably `hemi`).
2. Scaffold by copying Larder's Gradle/Vite/Docker setup. Reuse its auth, admin, first-run setup, backups, i18n and photo upload (food photos → medication photos, ME-8).
3. `shared`: schema (spec §6) plus the domain rules, with unit tests first (NF-4):
   - limits (LI-1/2)
   - day cutoff (S-1)
   - recurrence merge/split (AT-7)
   - rating prefill (DO-5)
   - work impact (WI-2)
   - acute medication days (ST-7)
   - missing data (AT-15)
4. `server`: REST API under `/api/v1`, and the ICS feed (X-3).
5. `web`: calendar home (DS-2), attack mode (DS-3), Record flows, then lists, statistics, CSV export.
6. Android only after the user is happy with the web app.

## Open questions
- GitHub repo, image name and default port. Probably mirror Larder (`ghcr.io/audunleganger/hemi`, 8080).

## Traps
- Larder's folder is `calorie-companion`, but the product and image are called `larder`.
- The mockup page loads fonts from Google. The real app must **bundle** Schibsted Grotesk and Atkinson Hyperlegible (DS-5).
- The dark C palette in DS-6 was never mocked up. Check it once the web app renders.
- The Norwegian glossary terms are provisional.
- Unlike Larder, nothing is shared between users (not even units), and admins can't see health data (A-3).
