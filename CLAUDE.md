# Hemi

Self-hosted migraine tracker: attacks, severity readings, medication doses, user-set limits per active ingredient, and effectiveness. Web app first; the Android app comes after the web functionality is settled.

- Read `HANDOFF.md` first: where the last session stopped.
- `REQUIREMENTS.md` is the source of truth. Cite requirement IDs (e.g. LI-1, DS-3) in code and commits where useful. Record new decisions there (bump the version and add an appendix row) rather than only in chat.
- `docs/design/directions.html`: design mockups. Direction C is the app, B is attack mode (REQUIREMENTS §3.12).
- Structure and conventions mirror Larder at `~/development/calorie-companion`: Kotlin `shared`/`server`/`android`, React `web`, SQLite via SQLDelight. When unsure how something is done, look there first.
- The visible app name lives in one place (`appName` in the web i18n files). Code identifiers use `hemi` (package `com.hemi`, env vars `HEMI_*`), but UI text never hard-codes the name.
