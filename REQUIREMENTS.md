# Hemi — Requirement Specification

Version 0.13 · 2026-10-20

*0.13: where the dose list lives, and what it shows (appendix, "Dose list").*

*0.12: "Start attack + choose medication" (appendix, "Starting with a medication").*

*0.11: severity colors set (DS-6, proposal A of three the user compared), with a legend under the month calendar.*

*0.10: three layouts by width (appendix, "Layouts by width"): phones up to 719 px, tablets 720–1099 px, PCs from 1100 px.*

*0.9: feedback from the first look at the web app (appendix, "Feedback on the web app"): start with a chosen medication, discard an ongoing attack, everything editable from the attack page, pink–red severity colors, at least one status in the attack filter, layouts between phone and PC.*

*0.8: web app details decided while building the calendar home and attack mode (appendix, "Web app details").*

*0.7: precise rules found while building the shared module (appendix, "Rules made precise").*

*0.6: code identifiers and license (appendix).*

*0.5: look and layout (3.12): calendar-first app with an attack mode, dark by default; the separate night theme is replaced by attack mode (V-7, S-4).*

*0.4: logging an attack afterwards (AT-14) and missing data allowed everywhere (AT-15); acute medication days (ST-7).*

*0.3: remedies without an active ingredient (ME-2); work impact (WI-1–WI-4); medication stock as FUTURE (ME-9).*

*0.2: name Hemi; medication photos (ME-8); pain-side icon in the attack list (V-4).*

Keywords: **MUST** = required for v1, **SHOULD** = v1 if feasible, **FUTURE** = explicitly out of v1 scope but the design must not block it.

---

## 1. Overview

A personal migraine diary. Users log **attacks** (with severity readings over time, nausea, pain side, triggers and notes) and the **doses** of medication they take. The app checks doses against limits the user sets per **active ingredient**, and shows how well each medication works.

Same structure as Larder:
- **Web GUI** — React + TypeScript, talks to a server. Built first.
- **Android app** — native Kotlin + Jetpack Compose, with **local mode** (on-device backend) and **server mode**. Built once the web app's functionality is settled.

---

## 2. Glossary

| Term | Norwegian UI term (provisional) | Meaning |
|---|---|---|
| Attack | Anfall | One migraine attack, from first sign to pain free, possibly with recurrences (AT-7). |
| Episode | Periode | A continuous stretch of pain within an attack. An attack with a recurrence has two or more. |
| Recurrence | Tilbakefall | Pain that returns within 48 h of an attack ending; joins that attack as a new episode. |
| Severity | Alvorlighetsgrad | 0 = pain free, 1 = mild (partly functioning), 2 = moderate (can't work), 3 = severe (bed-ridden / nausea). |
| Reading | Måling | A severity recorded at a point in time. |
| Active ingredient | Virkestoff | The substance in a medication, e.g. sumatriptan, paracetamol. |
| Medication | Legemiddel | A product or remedy the user takes: name, form, dose unit, and the active ingredients it contains (none for remedies like a cold pack). |
| Work impact | Arbeidsfravær | What a migraine day did to the working day: missed work, went home early, or none (WI-1). |
| Dose | Inntak | One logged intake of a medication: medication + quantity + time. |
| Limit | Grense | A user-set maximum for an active ingredient over a rolling window (LI-1). |
| Rating | Vurdering | How well a dose worked (DO-5). |
| Trigger | Utløser | A user-defined possible cause, toggled on an attack (e.g. sleep, alcohol). |
| Day | Dag | A calendar day shifted by the user's **day cutoff** (default 04:00): 00:00–03:59 belongs to the day before. |
| Migraine day | Migrenedag | A day (by cutoff) on which any episode of an attack with status *Migraine* is ongoing. |

The Norwegian terms are a first guess and live only in the localization files.

---

## 3. Functional requirements

### 3.1 Active ingredients

- **IN-1 (MUST)** Create an active ingredient with a **name** and a **measure unit** (mg, µg, g, ml, IU, or free text). Names are unique per user, compared case-insensitively after trimming; renaming is allowed (relations use IDs).
- **IN-2 (MUST)** Ingredients are **per user**. A new user starts with none; nothing is seeded, since doses and limits are personal.
- **IN-3 (MUST)** An ingredient has zero or more **limits** (3.3).
- **IN-4 (MUST)** The ingredient page lists the medications that contain it and the current status of its limits.
- **IN-5 (MUST)** Delete only when no medication contains it; otherwise archive (hidden from pickers, kept in history).
- **IN-6 (FUTURE)** **Ingredient groups** (e.g. "Triptans") whose limits count doses of all member ingredients together. The limit table already allows a limit to belong to a group instead of an ingredient (§6).

### 3.2 Medications

- **ME-1 (MUST)** Create a medication with a **name** (e.g. "Imigran nasal spray 20 mg"), a **dose unit** (tablet, spray, suppository, ml, … free text with plural, as in Larder) and a **default quantity** (default 1).
- **ME-2 (MUST)** A medication contains **zero or more active ingredients**. With none it is a **remedy** (cold pack, dark room, coffee, sleep): logged and rated like any dose, never counted toward limits. With ingredients, each has an **amount per dose unit** in the ingredient's measure unit (e.g. 1 tablet = 500 mg paracetamol + 30 mg codeine). The amount may be left empty; such doses count toward dose and day limits but not amount limits, and are flagged.
- **ME-3 (MUST)** Optional **follow-up delay** per medication: when to ask for a rating after a dose. Default is the user's setting (default 2 h).
- **ME-4 (MUST)** A medication has a **kind**, `acute` or `preventive`. v1 only offers `acute`; preventive medication is FUTURE (ME-7).
- **ME-5 (MUST)** Delete only when no dose uses it; otherwise archive.
- **ME-6 (MUST)** The medication page shows its doses and its effectiveness (ST-3).
- **ME-8 (MUST)** A medication can have **one photo**, as Larder's food photos: uploaded from a file or the camera, shrunk by the client (max ~1280 px plus a square thumbnail), type and size checked by the server, stored in the database so backups and export include it. The thumbnail is shown in the medication picker, medication list, dose list and on doses in an attack's timeline; the photo large on the medication page.
- **ME-9 (FUTURE)** **Stock**: units left per medication, reduced by each dose's quantity, with a low-stock warning, refills, and optionally expiry dates. Doses already store their quantity, so stock can be added as a table of refills (medication, quantity, date, expiry) without changing doses.
- **ME-7 (FUTURE)** Preventive medication: a schedule, adherence, and before/after comparison of attack frequency.

### 3.3 Limits

- **LI-1 (MUST)** A limit belongs to an active ingredient and is one of:
  - **Amount**: at most *X* (ingredient's unit) within a rolling window. E.g. paracetamol 4000 mg per 24 h.
  - **Doses**: at most *N* doses within a rolling window. One logged dose counts as one, whatever its quantity and whichever medication it came from. E.g. sumatriptan 2 doses per 24 h — a tablet and a spray count the same.
  - **Days with use**: at most *N* days (by cutoff) with at least one dose within a rolling window. E.g. sumatriptan 6 days per 30 days.
  - **Minimum interval**: at least *T* between two doses. E.g. 2 h.
- **LI-2 (MUST)** Windows are **rolling** and end now: a length in hours, days or weeks, or "month" (= 30 days). There are no calendar-month limits.
- **LI-3 (MUST)** All values are **set by the user**. The app ships no medical defaults and doesn't suggest any.
- **LI-4 (MUST)** **Warnings only, never blocking.** While logging a dose, the form previews its effect on every affected limit ("Sumatriptan: 5 → 6 of 6 days in 30 days"; "Next dose allowed from 16:40"). If the dose would go over a limit, it says so clearly and asks to confirm. A dose saved over a limit is marked as such.
- **LI-5 (MUST)** Limit status per limit: used / max in the current window, with three states: OK, near (≥ 80 %), reached/over. Also when the window frees up the next unit ("1 day frees up on 24 Oct").
- **LI-6 (MUST)** Limits count **all doses**, whether or not they belong to an attack, and whatever the attack's status (AT-4).

### 3.4 Attacks

- **AT-1 (MUST)** **Start an attack in one tap** from the front page: start time now, severity 1, status *Migraine*. Everything else is optional and can be filled in later. A combined action **"Start attack + take ⟨usual medication⟩"** logs the dose too (the user's most used medication; changeable). A second combined action **"Start attack + choose medication"** opens a picker of the user's medications and logs the chosen one.
- **AT-2 (MUST)** Start options: a chosen time (for logging afterwards), a starting severity, and **"Woke up with it"**, which sets the start to a wake-up time and marks the real start as unknown.
- **AT-3 (MUST)** **Severity readings** (0–3) can be added at any time, with time defaulting to now. Readings are also taken when logging a dose (DO-2) and when rating one (DO-5). The attack shows its readings as a step curve with doses marked on it. **Peak severity** is the highest reading.
- **AT-4 (MUST)** **Status**: *Migraine* / *Unsure* / *Not migraine*, changeable at any time (for pain that fades on its own). *Unsure* and *Not migraine* attacks are kept and shown, but left out of migraine days and statistics by default, with a filter to include them. Their doses still count toward limits (LI-6).
- **AT-5 (MUST)** **Type**: always `migraine` in v1. Other headache types are FUTURE; the field exists so they can be added.
- **AT-6 (MUST)** **Ending**:
  - A **reading of 0 ends the current episode** at the time of that reading.
  - **"It's over"** ends it now or at a chosen time.
  - Nothing else ends an attack. If an attack started live (not logged afterwards, AT-14) has been open for more than 24 h without a new reading, the app asks on the next visit: "Is the attack from ⟨day⟩ still going? Last reading: 2 at 21:30", offering to end it at the last reading or a chosen time.
- **AT-7 (MUST)** **Recurrence**: starting an attack within **48 h** of the previous one ending adds a new **episode** to that attack instead, marked as a recurrence, and says so ("Added to Monday's attack as a recurrence · Undo"). Undo splits it into its own attack. The timeline shows the pain-free gap between episodes.
- **AT-8 (MUST)** **Nausea**: none / nauseous / vomited (per attack).
- **AT-9 (MUST)** **Pain side**: left / right / both, picked on a small drawing of a head **seen from behind**, so the user's left is on the left. Optional.
- **AT-10 (MUST)** **Triggers**: toggles for the user's own triggers (3.6), any number per attack.
- **AT-11 (MUST)** **Note**: free text.
- **AT-12 (MUST)** Attacks, episodes, readings can be edited and deleted. Deleting an attack keeps its doses (they become doses without an attack). **Every** part of an attack stays editable after it's logged: times, episodes, readings (estimated or not), doses, status, nausea, pain side, triggers, note. Nothing is locked.
- **AT-16 (MUST)** **Discard the ongoing attack**: undoes the start, for an attack started by mistake. It removes the ongoing episode with its readings. If that episode was a recurrence (AT-7), the earlier attack goes back to how it was, ended; otherwise the attack is deleted. Doses logged in the episode are listed in the confirmation, with a choice to delete them too (default) or keep them as doses without an attack. A small text button next to **It's over**, always behind a confirmation.
- **AT-14 (MUST)** **Log afterwards**: one form for an attack that is over, e.g. "yesterday 14:00–22:00". Only the **start** is required; everything else is optional and can be filled in now, later or never: end, peak severity, doses taken (medication, quantity, time), status, nausea, pain side, triggers, note. A peak severity given here is stored as one reading at the start time, marked **estimated**. Doses added here are never put in the pending ratings (DO-6); they can be rated on the form or later, or stay unrated.
- **AT-15 (MUST)** **Missing data is normal**, not an error. An attack may have no readings, no end, no doses and no details, and everything derived must handle it:
  - no readings → peak severity unknown; shown as "?" and in a neutral color in calendars and the attack list
  - no end on an attack logged afterwards → it's still over, never "ongoing"; it counts as one day (its start day) for migraine days and in the calendar feed, and isn't offered for recurrence merging
  - no reading near a dose → no rating prefill (DO-5); unrated doses are left out of effectiveness shares but counted as "not rated"
  - no readings on a workday → no work impact proposed (WI-2); the user can still set one
- **AT-13 (FUTURE)** Weather: air pressure and temperature at the attack's start, fetched by the server (e.g. Open-Meteo, with history) for a home location per user. Needs only the attack's start time and the user's location.

### 3.5 Doses

- **DO-1 (MUST)** Log a dose: **medication** (picker, most used first), **quantity** (positive decimal, default from ME-1), **time** (default now), optional note. It belongs to the ongoing attack if there is one; it can be moved to another attack or to none.
- **DO-2 (MUST)** When the dose belongs to an attack, the form asks for the **current severity** (prefilled with the last reading) and stores it as a reading at the dose's time.
- **DO-3 (MUST)** Doses can be logged **without an attack** (e.g. paracetamol for back pain). They count toward limits and are listed, but aren't rated.
- **DO-4 (MUST)** Limit preview and warnings while logging (LI-4).
- **DO-5 (MUST)** **Rating**: *Pain free* / *Relieved* / *No effect* / *Unsure*. A dose in an attack is **due for rating** once its follow-up delay (ME-3) has passed. Rating asks for the current severity (stored as a reading) and **prefills the rating from the readings**:
  - reached 0 → *Pain free*
  - dropped at least one step → *Relieved*
  - same or higher → *No effect*

  The user's choice is what's stored. If another acute dose was taken between the dose and the rating, no prefill is made (the effect can't be attributed).
- **DO-6 (MUST)** **Pending ratings** are shown on the front page each time the app opens ("Imigran nasal spray, 2 h ago: how is it now?"), until rated or dismissed.
- **DO-7 (MUST)** **Sustained**: a *Pain free* dose whose attack gets a recurrence (AT-7) within 48 h is shown and counted as "pain free, not sustained".
- **DO-8 (MUST)** Doses can be edited and deleted.
- **DO-9 (FUTURE)** Web Push reminders for due ratings (PWA + service worker; needs HTTPS). On Android, native notifications are MUST for the Android app (AN-2).

### 3.6 Triggers

- **TR-1 (MUST)** Triggers are **per user** and user-defined: a name, unique per user (same rules as IN-1), and an order set by the user.
- **TR-2 (MUST)** A new user starts with a short editable list: Poor sleep, Alcohol, Stress, Skipped meal, Dehydration, Screen time. They're ordinary triggers the user can rename or delete.
- **TR-3 (MUST)** Delete removes the trigger from its attacks after confirming ("used on 14 attacks"); archive hides it from the toggles but keeps it on old attacks.

### 3.7 Views

- **V-1 (MUST)** **Home** is the calendar with the selected day (DS-2), or the attack screen while an attack is ongoing (DS-3). Either way it shows:
  - pending ratings (DO-6) and open-attack questions (AT-6)
  - limit status for every limit (LI-5), with near/over ones first
  - **acute medication days** in the last 30 days (ST-7)
  - the way to start an attack, start one with the usual medication, log a dose, or log afterwards (**+ Record**, DS-1)
- **V-2 (MUST)** **Calendar, month view**: one cell per day (by cutoff), colored by the day's peak severity, with a marker on days with medication use. Tapping a day shows its attacks and doses. Prev/next month and "today".
- **V-3 (MUST)** **Calendar, year view**: one small square per day, colored the same way. Tapping a day opens it in the month view.
- **V-4 (MUST)** **Attack list**, newest first, with filters: status, peak severity, trigger, medication, date range. The status filter always keeps **at least one** status on: turning off the last one is not possible. Tapping an attack opens its page (V-5). Each row's icon is the **head drawing from AT-9** with the attack's pain side filled in (left, right or both; outline only when not set), tinted by peak severity.
- **V-5 (MUST)** **Attack page**: timeline of episodes and readings (step curve) with doses and their ratings marked, plus all attack fields, all editable (AT-12). Opened by tapping an attack in the attack list, the calendar's day view, or the ongoing-attack header.
- **V-6 (MUST)** **Dose list**, newest first, filterable by medication, ingredient, rated/unrated, attack/no attack.
- **V-7 (MUST)** **Attack mode** with a dim, low-contrast look and no white areas while an attack is ongoing (DS-3, DS-4). It replaces the separate night theme from earlier versions.
- **V-8 (MUST)** Logging during an attack is reachable from the front page in at most **two taps** (AT-1, DO-1), with large touch targets.

### 3.8 Statistics

All exclude *Unsure* and *Not migraine* attacks by default (AT-4).

- **ST-1 (MUST)** Migraine days and acute medication days (ST-7) per month (calendar months, for overview; limits stay rolling).
- **ST-2 (MUST)** Attacks per month, average duration, peak severity distribution.
- **ST-3 (MUST)** **Effectiveness per medication**: number of rated doses, share *Pain free* / *Relieved* / *No effect*, share sustained (DO-7), median time from dose to the reading that gave the rating.
- **ST-4 (SHOULD)** Trigger frequency: share of attacks with each trigger.
- **ST-5 (SHOULD)** Time of day / weekday attacks start, including "woke up with it".
- **ST-6 (MUST)** Work impact per month (WI-4).
- **ST-7 (MUST)** **Acute medication days**: days (by cutoff) with at least one dose of an acute medication that has an active ingredient, across all medications, in the last 30 days (rolling, as LI-2). Remedies (ME-2) and preventive medication don't count. Doses in *Unsure* and *Not migraine* attacks and doses without an attack do count, since this is about overuse. Shown on the front page, independent of any limit.

### 3.9 Work impact

- **WI-1 (MUST)** Every **migraine day** (status *Migraine*, by cutoff) has a **work impact**: *Missed work* / *Went home early* / *No impact* / *Not a workday*.
- **WI-2 (MUST)** The app **proposes** it from the readings, using the user's workdays and work window (S-5):
  - not a workday (default Saturday and Sunday) → *Not a workday*
  - severity ≥ 2 at the start of the work window (08:00) → *Missed work*
  - else severity ≥ 2 at some point during the work window (08:00–14:00) → *Went home early*
  - else (only mild, or ≥ 2 only after 14:00) → *No impact*

  Severity between readings is the last reading (step curve), carried over from the previous day for attacks past midnight. Without readings that day, nothing is proposed (AT-15).
- **WI-3 (MUST)** The user can **override** it per day (holiday, sick leave, worked from home anyway). An overridden day keeps its value when readings change; a proposed one follows them.
- **WI-4 (MUST)** Statistics per month: days missed, days home early (ST-6). Both are columns in the CSV export (`days.csv`).

### 3.10 Export, import and calendar feed

- **X-1 (MUST)** **CSV export** for a date range: a ZIP with `attacks.csv`, `episodes.csv`, `readings.csv`, `doses.csv`, `days.csv` (one row per migraine day with its work impact), with readable column names in the user's language and times in local time.
- **X-2 (MUST)** **JSON export/import** of all the user's data (versioned format), for backup and moving between local and server mode. Import into an empty account.
- **X-3 (SHOULD)** **Calendar feed**: a read-only iCalendar (`.ics`) URL per user containing one event per attack: title "Migraine · severity 3" (or "Possible migraine" for *Unsure*; *Not migraine* left out), start and end from its episodes (ongoing: until now), description with doses, nausea, pain side and triggers. The URL holds a secret token; the user can create a new token, which stops the old URL working. The user can turn the feed off.
- **X-4 (FUTURE)** Doses as their own events in the feed.

### 3.11 Settings (per user)

- **S-1 (MUST)** Day cutoff (default 04:00), applied everywhere days are counted: migraine days, days with use (LI-1), calendars, statistics.
- **S-2 (MUST)** Default follow-up delay (default 2 h).
- **S-3 (MUST)** Usual medication for AT-1 (default: most used).
- **S-4 (MUST)** Language, theme (dark (default) / light / system), **Dim during attacks** (default on, DS-4), time zone (default from the browser).
- **S-5 (MUST)** Workdays (default Monday–Friday) and work window (default 08:00–14:00), for WI-2.

### 3.12 Look and layout

Chosen in the design review (2026-10-19) from three mockups in `docs/design/directions.html` (also published at https://claude.ai/artifact/R8MPzA6awi9fsvhU8v8Wqg): **direction C "Diary"** for the everyday app, with **direction B "Dim"** taking over while an attack is ongoing. Direction A was not chosen.

- **DS-1 (MUST)** **Mobile first**, and a real wide-screen layout for PCs (16:9 / 16:10), not a stretched phone:
  - **Phone** (< 720 px): one column; bottom navigation (Calendar · Attacks · Medications · More); a floating **+ Record** button above it (start attack, add reading, log dose, log afterwards).
  - **PC** (≥ 1100 px): top bar with the navigation and **+ Record**; under it a full-width strip with the **year view** (V-3) and four stat tiles (migraine days this month, acute medication days in 30 days, missed work and home early this month); under that three columns: month calendar · selected day · limits and recent attacks.
  - In between: two columns (calendar + selected day), limits below.
  - Every width from 320 px up must look deliberate, including just around the breakpoints (about 650–1150 px): no squeezed columns, overflowing rows or half-switched navigation.
- **DS-2 (MUST)** **Home is the calendar** (direction C). On the phone: the month grid at the top, the selected day (default today) below it as a **vertical timeline** of readings, doses, due ratings ("Rate Imigran: how is it now?") and the day's work impact, followed by the limit rings (DS-8). Tapping another day selects it.
- **DS-3 (MUST)** **Attack mode** (direction B): while an attack is ongoing, home becomes the attack screen. Nothing else changes; the navigation still reaches the calendar and everything else.
  - "How bad is it now?" with four large round buttons **0 1 2 3** (Pain free · Mild · Moderate · Severe). One tap records a reading at the current time. The current severity is highlighted; "Last reading: 2 at 08:10" below.
  - A large button for the **usual medication** (S-3) with its limit status ("2nd dose today is within limits"), and a smaller **Other medication**.
  - The pending rating, if any, with the prefilled suggestion as one tap.
  - A compact limits line (ingredient days and doses, acute medication days).
  - **It's over** as a small text button at the bottom, so it isn't hit by accident.
  - On a PC: these controls in a left panel (about 430 px); to the right the attack's timeline chart (step curve with doses and due ratings), and below it limits, the month, and recent attacks.
- **DS-4 (MUST)** **Themes**: **dark is the default**; light and "follow system" are available, switched in settings and with a quick toggle in the top bar (PC) or More (phone). Attack mode always uses the dim amber palette (DS-6) in the dark theme. In the light theme it uses the same layout in light colors, unless **Dim during attacks** is on (setting, default on), which makes attack mode dim in either theme.
- **DS-5 (MUST)** **Fonts**: Schibsted Grotesk for the app, Atkinson Hyperlegible in attack mode (made for readers with low vision). Both are open fonts, **bundled with the app** rather than loaded from Google, so the app works offline and contacts no third parties. Numbers use tabular figures.
- **DS-6 (MUST)** **Colors** (tokens; exact values may be tuned, the roles stay):

  | Token | Light (C) | Dark (C) | Dim attack mode (B) |
  |---|---|---|---|
  | background | #eef1ef | #121614 | #0e0f12 |
  | surface | #ffffff | #1a201d | #17181d |
  | border | #d5dbd7 | #2a332f | #262830 |
  | text | #1b2420 | #e3e9e6 | #d9cdb5 |
  | secondary text | #5f6b65 | #93a19a | #857c6c |
  | accent | #1f6f68 (teal) | #4fb3a9 | #c99a4e (amber) |
  | severity 1 / 2 / 3 | #f4b3c5 / #cf3a3a / #8e1d26 | #e29aae / #cc3836 / #9a2530 | #805663 / #a5423b / #7b2a2e |
  | text on severity 1 / 2 / 3 | #4a1325 / #ffffff / #ffffff | #2a0c15 / #ffffff / #fbe3e3 | #f6e6ea / #f8e1dc / #efd4d2 |
  | limit near / over | #c98a1c / #c0392b | #e0a63a / #e5645a | #d9a441 / #d9604f |

  Severity is **pink for 1, red for 2, dark red for 3** everywhere, attack mode included (changed in 0.9 from the plum scale and attack mode's amber scale, at the user's request); in attack mode the same hues are dimmed to fit its low-contrast look. The calendar legend shows the same three colors. Severity is always shown with its number too (NF-3). Unknown severity (AT-15) is a neutral gray.
- **DS-7 (MUST)** **Pain-side icon**: a small head **seen from behind** (oval, ears, neck, dashed midline), so the user's left is on the left. The left, right or both halves are filled with the color of the attack's **peak severity**; outline only when no side is set, gray fill when severity is unknown. Used as the icon of every attack in lists (V-4), on the attack page, in the ongoing-attack header, and as the picker for AT-9.
- **DS-8 (MUST)** **Limits as rings**: a small donut per limit with "4 / 6" and a short label ("Sumatriptan days"), colored accent when OK, near and over per DS-6. The PC limits column lists them vertically, the phone in a row.
- **DS-9 (MUST)** **Calendar cells** (V-2, V-3): filled with the day's peak severity color, a small dot for days with medication use, today outlined, the ongoing attack's day ringed in the accent. Days after today are faded. *Unsure* attacks, when shown (AT-4), are outlined in the severity color instead of filled.
- **DS-10 (SHOULD)** The attack timeline chart (V-5, DS-3): readings as a filled step curve on a 0–3 axis, doses as markers with the medication name, due ratings as hollow dots, recurrences as gaps between episodes.

### 3.13 Localization

- **L-1 (MUST)** UI in **English and Norwegian (bokmål)**, per user or device, defaulting to the system locale.
- **L-2 (MUST)** Numbers and dates per locale (decimal comma in Norwegian); decimal input accepts `,` and `.`.
- **L-3 (MUST)** All UI strings in resource files (web: i18n JSON; Android: `strings.xml`).
- **L-4** User-entered names (ingredients, medications, triggers) have a single name; they are the user's own and not translated. The starter triggers (TR-2) are created in the user's language.

---

## 4. Users, auth & modes

As in Larder, except that **nothing is shared between users**.

- **A-1 (MUST)** A server is multi-user. Every user's data is fully separate: ingredients, medications, limits, triggers, attacks, doses and settings.
- **A-2 (MUST)** First-run setup screen creates the first user as admin; disabled once any user exists.
- **A-3 (MUST)** No open registration. Admins create users, reset passwords, disable users and grant admin. Admins **cannot see other users' health data**.
- **A-4 (MUST)** Username + password (Argon2id or bcrypt), token-based sessions; users change their own password.
- **A-5 (MUST)** Android local mode is single-user, no login. Android picks Local or Server at first launch and can switch later; switching doesn't move data (X-2).
- **A-6 (MUST)** The web GUI is server-only.
- **O-1 (MUST)** Server mode is online-only in v1. No offline queue or sync.

---

## 5. Architecture & technology

Same as Larder:

| Part | Choice |
|---|---|
| Web GUI | React + TypeScript, Vite, react-i18next. Charts: Recharts (or similar). |
| Android | Kotlin, Jetpack Compose, Material 3. minSdk 26. |
| Server | Kotlin + Ktor, REST/JSON under `/api/v1`. |
| Shared code | Pure-Kotlin `shared` module (Java 17 bytecode) with the domain model, validation, **limit calculation, day cutoff, recurrence merging, rating prefill and statistics**, and the persistence schema. Used by the server and Android local mode, so these rules are written once. |
| Persistence | SQLite via SQLDelight, versioned migrations, pre-migration backup. |
| API contract | Kotlin DTOs in `shared` are the source of truth; web TypeScript types are generated from them, with a test that fails when stale. |
| Android data layer | `Repository` interface with `LocalRepository` and `RemoteRepository`. |

- **DEP-1 (MUST)** One Docker image serving API + web GUI; published to ghcr.io per version tag and `main`.
- **DEP-2 (MUST)** SQLite on a mounted volume; configuration via env vars. Also runnable as a plain JAR.
- **DEP-3 (SHOULD)** Built-in backups (`VACUUM INTO`), health endpoint and server version.
- **DEP-4 (MUST)** Android as a sideloaded, signed APK.

### 5.1 Time

- **TI-1 (MUST)** Times are stored as an **instant (UTC) plus the UTC offset at the time**, so rolling windows and durations are exact across DST changes, and each time is shown as the local time it happened.
- **TI-2 (MUST)** Days are derived from the local time and the day cutoff (S-1).

### 5.2 Android app (after the web app)

- **AN-1 (MUST)** Same functionality as the web app, in local and server mode.
- **AN-2 (MUST)** **Notifications** when a dose is due for rating (DO-5), and optionally when a limit's window frees up. In server mode the schedule is computed on the device from the doses it knows.
- **AN-3 (SHOULD)** A home-screen widget or quick-settings tile for "start attack" and "take usual medication".

---

## 6. Data model (logical)

All tables carry `user_id`. Names are stored as entered plus a normalized column with a per-user unique index.

| Entity | Fields |
|---|---|
| user | id, username, password_hash, is_admin, is_disabled, locale, time_zone, theme (default dark), dim_during_attacks (default true), day_cutoff (default 04:00), follow_up_minutes (default 120), usual_medication_id, workdays (default Mon–Fri), work_start (08:00), work_end (14:00), ics_token (nullable = feed off), created_at |
| ingredient | id, user_id, name, name_norm, measure_unit, archived, created_at |
| ingredient_group | *(FUTURE, IN-6)* id, user_id, name; ingredient_group_member(group_id, ingredient_id) |
| medication | id, user_id, name, name_norm, kind (acute/preventive), dose_unit, dose_unit_plural, default_quantity, follow_up_minutes (nullable), archived, created_at |
| medication_image | medication_id, content_type, image, thumbnail, updated_at (ME-8) |
| medication_ingredient | medication_id, ingredient_id, amount_per_unit (nullable) |
| intake_limit | id, user_id, ingredient_id (nullable), group_id (nullable, FUTURE), kind (amount/doses/days/min_interval), max_value, window_minutes (nullable for min_interval; "month" = 30 days) |
| trigger | id, user_id, name, name_norm, sort_order, archived |
| attack | id, user_id, type (migraine), logged_afterwards (AT-14), status (migraine/unsure/not_migraine), nausea (none/nauseous/vomited), pain_side (left/right/both, nullable), note, created_at, updated_at |
| episode | id, attack_id, started_at, started_offset, start_unknown (woke up with it), ended_at (nullable = ongoing), ended_offset, is_recurrence |
| reading | id, attack_id, at, at_offset, severity (0–3), estimated (AT-14) |
| attack_trigger | attack_id, trigger_id |
| work_day_override | user_id, day, impact (missed/home_early/none/not_workday) (WI-3) |
| dose | id, user_id, medication_id, attack_id (nullable), quantity, taken_at, taken_offset, note, rating (nullable: pain_free/relieved/no_effect/unsure), rated_at, rating_dismissed, over_limit, created_at, updated_at |

Derived, not stored: attack start/end (first/last episode), peak severity, migraine days, proposed work impact, limit usage, rating prefill, sustained (DO-7).

---

## 7. Non-functional requirements

- **NF-1** Front page and dose logging respond in < 300 ms on a LAN server with 10 years of data.
- **NF-2** Web GUI responsive and usable on phone-width screens; touch targets ≥ 44 px on logging actions.
- **NF-3** Accessible: keyboard navigation, contrast, TalkBack labels; severity colors also distinguished by number, not color alone.
- **NF-4** The `shared` module has unit tests for every limit kind, rolling windows across DST, day cutoff, recurrence merging/splitting, rating prefill, work impact proposals and the statistics.
- **NF-5** Health data: HTTPS expected when exposed beyond the LAN (operator's responsibility, as in Larder); the ICS token is long and random; no data in logs.

---

## 8. Out of scope for v1 (tracked as FUTURE)

Ingredient groups (IN-6) · medication stock (ME-9) · preventive medication (ME-7) · other headache types (AT-5) · weather (AT-13) · Web Push (DO-9) · doses in the calendar feed (X-4) · offline queue / sync · aura · menstrual tracking · Play Store / F-Droid.

---

## 9. Open questions

None at the moment.

---

## Appendix: Decisions from the requirements review (2026-10-19)

| Topic | Decision |
|---|---|
| Structure | As Larder: Kotlin server + SQLite, React web, Android (local + server mode) later |
| Users | Multi-user, nothing shared between users |
| Severity | 0–3; 0 only as a later reading (pain free) |
| Medication model | Medication contains one or more active ingredients with an amount per dose unit |
| Limits | Per ingredient, set entirely by the user; amount, doses, days with use, minimum interval; rolling windows; warnings only |
| Two triptans | Same ingredient in tablet and spray; a dose counts as one dose regardless of form, so no groups needed yet |
| Effectiveness | Manual rating, prefilled from readings; dropping a step counts as relieved, reaching 0 as pain free |
| Attack start/end | One tap to start at severity 1; status Migraine/Unsure/Not migraine; "woke up with it"; a 0 reading ends it; never ended silently otherwise |
| Recurrence | Within 48 h joins the previous attack as a marked episode; can be undone |
| Day cutoff | 04:00 by default, per user |
| Attack details | Nausea (none/nauseous/vomited), pain side (left/right/both, from the patient's side), user-defined triggers, free-text note. No aura, no menstrual tracking |
| Weather | FUTURE, fetched automatically |
| Preventive medication | FUTURE; `kind` field exists |
| Export | CSV (ZIP) for the doctor; JSON for backup |
| Calendar | Month and year views in the app; read-only ICS feed for external calendars |
| Reminders | In-app pending ratings on the web; notifications in the Android app; Web Push FUTURE |
| Language | English + Norwegian |
| Name | Hemi (from Greek *hemikrania*, "half the skull") |
| Medication photos | One per medication, as Larder's food photos |
| Attack list icon | Head drawing showing the pain side |
| Remedies | Medications may have no active ingredient; rated, never limited |
| Work impact | Proposed per migraine day from readings (≥ 2 by 08:00 = missed, ≥ 2 during 08:00–14:00 = home early, weekends not workdays); user can override |
| Medication stock | FUTURE; model leaves room for it |
| Acute medication days | Last 30 days across all medications with an active ingredient, on the front page |
| Logging afterwards | One form, only the start required; all missing data handled without errors |
| Design | Direction C (calendar first, plum severity scale, Schibsted Grotesk) with direction B (dim amber, big buttons, Atkinson Hyperlegible) as attack mode; dark by default with a toggle |
| Code identifiers | `hemi`: package `com.hemi`, env vars `HEMI_*`, image `ghcr.io/audunleganger/hemi`. The visible name is still only in the i18n `appName` |
| License | AGPL-3.0, as Larder |
| Schema before release | Schema version 1 changes in place until the first release; then `1.db` is snapshotted and migrations start |

### Rules made precise (0.7)

Decided while writing the `shared` module; the tests in `shared/src/test` pin them down.

| Topic | Decision |
|---|---|
| Days-with-use windows (LI-1, ST-7) | Count whole days by cutoff: today and the days before it, as many as the window has days (rounded up). "6 days per 30 days" = today + the 29 days before; the oldest day frees up the day after it leaves |
| Limit states (LI-5) | OK (< 80 %), near (≥ 80 %), reached (= max), over (> max). Reached and over look the same; "over" is for doses saved past the max |
| Limit previews (LI-4) | Windows end at the new dose's time. A minimum interval also checks the next dose when logging in the past |
| Ongoing attacks | At most one at a time; starting another while one is ongoing is refused |
| Recurrence merging (AT-7) | Only when starting an attack. Logging afterwards (AT-14) always makes its own attack. Only attacks with an end can be joined. Splitting an episode moves it, the later episodes, and the readings and doses from its start |
| "It's over" (AT-6) | Ends the episode without adding a reading; the step curve is 0 outside episodes |
| Rating prefill (DO-5) | No prefill when any other acute dose, remedies included, was taken between the dose and the rating, or when the severity at the dose isn't known |
| Sustained (DO-7) | A *Pain free* dose is not sustained when its attack has a recurrence episode starting after the dose |
| Work impact (WI-2) | Uses the step curve with carry-over from the day before. Nothing is proposed only when no reading tells the severity that day (none that day and none carried in) |
| Logged-afterwards doses (AT-14) | Stored with `rating_dismissed` set, which keeps them out of pending ratings while still allowing a rating |
| Limits are never blocking (LI-4) | The server always saves the dose and marks `over_limit`; clients show the preview and ask to confirm |
| Usual medication (S-3) | The one set; else the most used acute medication; else the first acute one by name |
| Schema names | The trigger table is `trigger_def` (`TRIGGER` is an SQL keyword). The feed secret is stored as is (`ics_token`), so Settings can show the URL again; it only grants that read-only feed |

### Web app details (0.8)

| Topic | Decision |
|---|---|
| Navigation during an attack (DS-3) | Home (`/`) is the attack screen, labelled **Now**; the calendar moves to `/calendar` and gets its own nav item. On phones the bottom bar has five items while an attack is ongoing |
| Dim look (V-7, DS-4) | Applies to the whole app while an attack is ongoing, not only the attack screen |
| Usual medication button (DS-3) | One tap logs the dose in the attack without a new reading; the last reading stands. "Other medication" opens the full form, which asks the current severity (DO-2). If the dose would go over a limit, the button opens the full form instead, to confirm (LI-4) |
| Dose time | Means "now" to the second until the user changes it, so a dose a moment ago is counted in the preview |
| Attack mode on phones | Shows only the controls, as in mockup B; the chart and panels are for tablets and PCs |

### Feedback on the web app (0.9)

The user's first look at PR #4, running in Docker.

| Topic | Decision |
|---|---|
| Layouts between phone and PC (DS-1) | Some widths around the breakpoints look broken. Every width must look deliberate |
| Start with a chosen medication (AT-1) | Added "Start attack + choose medication" with a picker of the user's medications, next to "Start attack + take ⟨usual⟩" |
| Attack page (V-5) | Tapping an attack in the calendar or attack list opens its page, where the status (Migraine / Unsure / Not migraine) and everything else is set |
| Nothing locked (AT-12) | Times, episodes, readings, doses and all fields stay editable after logging |
| Discard the ongoing attack (AT-16) | Agreed as "undo the start": removes the ongoing episode, restores the earlier attack if it was a recurrence, and asks whether its doses go too. Chosen over a full undo history, which would be more to build for little gain |
| Severity colors (DS-6) | Pink / red / dark red for 1 / 2 / 3, replacing plum, in attack mode too (dimmed there) instead of amber. The accent stays amber |
| Status filter (V-4) | Turning off all three statuses still showed attacks. Now at least one status must stay on |

### Layouts by width (0.10)

Fixes the broken widths between phone and PC view (DS-1, 0.9). `web/e2e/flow.mjs` checks 720, 900 and 1099 px for horizontal overflow.

| Width | Decision |
|---|---|
| Phones, up to 719 px | Bottom navigation and floating + Record. The content stays at most 600 px wide and centred, instead of stretching on small tablets |
| Tablets, 720–1099 px | Top bar with the phone's items (Calendar · Attacks · Medications · More); Settings, Admin and Log out are under More and the username is hidden, so the bar always fits |
| PCs, from 1100 px | Top bar with every item, the username and Log out |
| Calendar home | Calendar and day side by side from 720 px, with limits and recent attacks underneath; the year strip from 1100 px; three columns only from 1280 px |
| Attack mode | Controls and chart side by side from 720 px (a narrower controls column on tablets, with limits and recent attacks under the chart); on phones only the controls (0.8) |
| Limit form | "per ⟨length⟩ ⟨unit⟩" wraps as one piece |

### Severity colors (0.11)

| Topic | Decision |
|---|---|
| Values (DS-6) | Proposal A, "clear steps": a light pink, a clear red and a deep red, chosen over a softer rose set and the old plum/amber, so 2 and 3 are easy to tell apart in the calendar. Numbers on the fills have at least 4.5:1 contrast in all three looks |
| Legend (DS-6) | Under the month calendar: 1 Mild, 2 Moderate, 3 Severe, Unknown |
| Pills | The "peak 3" / "Ongoing" pill is neutral; its head icon carries the severity color. It used to be severity 1's color whatever the peak |
| Limit "over" | Stays red (#c0392b light). It is close to severity 2 in light mode but only appears in rings and warnings, never in calendar cells |

### Starting with a medication (0.12)

| Topic | Decision |
|---|---|
| The picker (AT-1) | "Start attack + choose medication" in + Record lists the active medications: acute first, then preventive ones, then remedies, each by name, with the usual quantity. One tap starts the attack and logs that quantity |
| Over a limit (LI-4) | If the dose would go over a limit, the picker shows what it does and asks: "Start attack + take ⟨medication⟩ anyway" or "Choose another medication". "Start attack + take ⟨usual⟩" in + Record now asks the same way, as it already did in attack mode (0.8) |

### Dose list (0.13)

| Topic | Decision |
|---|---|
| Where (V-6, DS-1) | `/doses`. "Doses" is in the PC top bar after Medications; on phones and tablets it's under More, since the bottom navigation stays at four items |
| Rows | Newest first: date and time, medication, quantity, "over limit" badge; below, the rating, a link to the attack (if any) and the note. **Edit** opens the same form as on the attack page (DO-8); "Part of this attack" shows only for doses in an attack |
| Filters | Medication and active ingredient (archived ones included, marked), rated or not, with or without attack |
