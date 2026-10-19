# Handoff (2026-10-19)

## State
- `main` has all of PRs #4–#9: domain, REST API, web app, and these items from the last Next list: tablet layouts, the status filter that keeps one status on, pink/red/dark-red severity colours, start attack + choose medication, and discard the ongoing attack. `REQUIREMENTS.md` is at version 0.12.
- Releases: tag `vX.Y.Z` on `main` → CI publishes `ghcr.io/audunleganger/hemi:X.Y.Z` (also `X.Y`, `latest`; pushes to main give `main` and `sha-…`). `v0.1.0` is published. The user's compose file in `~/development/infra/hemi` uses `:0.1.0`; the user bumps it there.
- No open PRs, nothing half-done. The local branch `discard-attack` is merged; start new work from `origin/main`.

## Next
1. Attack page (V-5 = a page per attack, AT-12 = everything about an attack is editable), as two PRs:
   a. The page itself: a timeline chart, plus editing status, nausea, pain side, triggers and note. It opens from the calendar day view, the attack list and the ongoing-attack header.
   b. Editing episodes, readings and doses, and splitting a recurrence into its own attack. Also make the chart readable when episodes are far apart (it's cramped now).
2. Then: dose list + edit/delete doses (V-6, DO-8); triggers in Settings (TR-1…3); medication photos (ME-8, copy Larder's `web/src/lib/images.ts`); statistics (ST-1…6); CSV/JSON export (X-1, X-2); calendar feed + "include Unsure" filter (X-3, AT-4); Android last.

## Open questions
- Toasts stack up (up to five at once). Proposed: each new toast replaces the previous one. No answer yet.
- "Over limit" stays red (as recorded in 0.11) unless the user says otherwise.
- Severity colours could also go on the severity buttons and the chart. This was offered, not asked for.

## Traps
- **Schema is now released.** v0.1.0 shipped with schema version 1 but no `1.db` snapshot. Before the first change to any `.sq` table: check out `v0.1.0`, run `generateMainHemiDatabaseSchema` to write `shared/src/main/sqldelight/databases/1.db`, then turn `verifyMigrations` on (`shared/build.gradle.kts`) and put the change in `1.sqm`. Adding queries only needs none of this.
- Wait for the PR's GitHub CI to pass before telling the user it's ready. CI is slower than local runs, so e2e steps must wait for state instead of asserting at once. `useApiMutation` invalidates queries without awaiting them, so attack mode ends only after the home refetch.
- Two PRs that both add e2e steps at the end of `web/e2e/flow.mjs` conflict. Warn about merge order, or rebase the second one after the first is merged.
- When tagging, fetch after the user says they've merged, and check that the tag points at the merge commit.
- Breakpoints: phone ≤719, tablet 720–1099 (topbar items via `.only-pc` / `.only-tablet`), PC ≥1100; the home view gets three columns only from 1280. `.btn` overrides `.only-pc` unless the selector is `.topbar .only-pc`.
- TS literal fields in arrays widen to `string`; use `as const`.
- When citing requirement IDs to the user, say what they mean.
- Heredocs mangle `"\;"` in Kotlin sources; use the Edit tool for lines with backslashes.
- `pkill -f hemi-server.jar` kills the calling shell; use `fuser -k 8080/tcp`.
- `Field` wraps its child in a `<label>`; button groups need `FieldGroup`.
- `:root[data-theme=…]` and `:root.attack-mode` have equal specificity; attack mode wins by coming later in `index.css`.
- `<input type=time>` is minute-rounded; send `at: null` unless the user changed the time.
- Don't touch `~/development/infra` unless asked, and don't wipe its `data`. Test with `./data` here.
