# Handoff (2026-10-20)

## State
- `main` has PRs #10–#13: the attack page (V-5) is done. `/attacks/:id` (`web/src/pages/AttackPage.tsx`) has the chart, details form (status, nausea, pain side, triggers, note), episodes and readings editors (`AttackEditors.tsx`), doses editor (`AttackDoses.tsx`) and delete. It opens from attack rows, the day view (pill, "Attack started") and the attack-mode header. The chart layout (folded gaps, ticks, label rows) is in `web/src/lib/chartLayout.ts`, with unit tests.
- No open PRs; nothing half-done. Start new work from `origin/main`.
- Released: only `v0.1.0`. Everything since (#4… #13 web features) is unreleased; the user tags and bumps `~/development/infra/hemi`.

## Next
1. Dose list (V-6): newest first, filters by medication, ingredient, rated/unrated, attack/no attack. Reuse `DoseEditForm` from `AttackDoses.tsx` (it takes the attack today; make that optional) so doses without an attack become editable.
2. Moving a dose to another attack (DO-1): the server takes any `attackId` in `PUT /doses/{id}`; the UI only has "Part of this attack".
3. Then: triggers in Settings (TR-1…3); medication photos (ME-8, copy Larder's `web/src/lib/images.ts`); statistics (ST-1…6); CSV/JSON export (X-1, X-2); calendar feed + "include Unsure" filter (X-3, AT-4); Android last.

## Open questions
- Toasts stack up (up to five at once). Proposed: each new toast replaces the previous one. No answer yet.
- A rating can't be cleared (no server support), so "Not rated" is offered only for unrated doses. Add `DELETE /doses/{id}/rating` if the user wants it.
- Severity colours on the severity buttons and chart: offered, not asked for.

## Traps
- **Schema is released.** Before the first change to any `.sq` table: check out `v0.1.0`, run `generateMainHemiDatabaseSchema` to write `shared/src/main/sqldelight/databases/1.db`, turn `verifyMigrations` on (`shared/build.gradle.kts`), and put the change in `1.sqm`. New queries alone need none of this.
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
- `Field` wraps its child in a `<label>`; button groups need `FieldGroup`.
- Don't touch `~/development/infra` unless asked, and don't wipe its `data`.
