# Handoff (2026-10-20)

## State
- `main` has PRs #10–#14: the attack page (V-5) and the dose list (V-6, `/doses`, `web/src/pages/DosesPage.tsx`) are done. Both edit doses with `DoseEditForm` (`AttackDoses.tsx`), which takes `attackId: number | null`. "Doses" is in the PC top bar and under More (REQUIREMENTS 0.13).
- No open PRs; nothing half-done. Start new work from `origin/main`.
- Released: only `v0.1.0`. Everything since (#4… #14 web features) is unreleased; the user tags and bumps `~/development/infra/hemi`.

## Next
1. Moving a dose to another attack (DO-1): the server takes any `attackId` in `PUT /doses/{id}`; `DoseEditForm` only has "Part of this attack" (and nothing for doses without one). An attack picker there would serve both the attack page and the dose list.
2. Then: triggers in Settings (TR-1…3); medication photos (ME-8, copy Larder's `web/src/lib/images.ts`; thumbnails also go in the dose list); statistics (ST-1…6); CSV/JSON export (X-1, X-2); calendar feed + "include Unsure" filter (X-3, AT-4); Android last.

## Open questions
- Toasts stack up (up to five at once). Proposed: each new toast replaces the previous one. No answer yet.
- A rating can't be cleared (no server support), so "Not rated" is offered only for unrated doses. Add `DELETE /doses/{id}/rating` if the user wants it.
- Severity colours on the severity buttons and chart: offered, not asked for.

## Traps
- **Schema is released and migrated.** `databases/1.db` is the 0.1.0 schema, `migrations/1.sqm` adds warning signs (v2) and `2.sqm` the episode's `end_unknown` (v3; `databases/2.db` is v2); `verifyMigrations` is on, so `./gradlew check` fails if a `.sq` table changes without a matching new `migrations/N.sqm`. New queries alone need none of this.
- Check the server before saying an endpoint is missing: `server/.../DiaryRoutes.kt` already had dose update, episode update/delete/split and reading update/delete before the UI used them.
- `PUT /attacks/{id}` replaces all fields; omitted ones become null/empty. `updateReading` clears `estimated`.
- `useApiMutation` refreshes without awaiting, so e2e must wait for the new state (row counts etc.), not assert right after a click.
- `useDebounced` with an object never settles (new object every render): debounce `JSON.stringify(...)` instead. Check `enabled` on the debounced value, or a stale incomplete value gets sent.
- Time inputs are minute-rounded: `useMomentInputs` in `AttackEditors.tsx` sends the original moment back when untouched; reuse it.
- e2e prints failing requests; the one 401 on `/auth/login` is the intended wrong-password check. The chart-gap step logs in as `kari`, created in the admin step, so keep that order.
- Wait for CI with the Monitor tool (`until gh pr checks N …`); foreground `sleep` is blocked.
- Two PRs that both add e2e steps to `web/e2e/flow.mjs` conflict; warn about merge order.
- When tagging, fetch after the user says they've merged, and check the tag points at the merge commit.
- Breakpoints: phone ≤719, tablet 720–1099, PC ≥1100. `.btn` overrides `.only-pc` unless the selector is `.topbar .only-pc`.
- `pkill -f hemi-server.jar` kills the calling shell; use `fuser -k 8080/tcp`. Heredocs mangle `"\;"` in Kotlin; use Edit there.
- The e2e dose-list step takes an Imigran dose out of its attack; later steps that count doses per attack must allow for it.
- `Field` wraps its child in a `<label>`; button groups need `FieldGroup`.
- Inline selects need `.input.input-inline`: `select.input` (width 100%) outranks a lone `.input-inline`.
- Don't touch `~/development/infra` unless asked, and don't wipe its `data`.
