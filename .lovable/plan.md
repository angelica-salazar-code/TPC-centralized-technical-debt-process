# Plan

## GLOBAL — README as user guide

Rewrite `README.md` to be a usage-oriented walkthrough of the prioritization app, not a generic Lovable stub.

Sections:
1. **What this is** — A prioritization workspace where SBU teams submit tech-debt requests and reviewers triage them into a capped, score-ranked queue that hands off to delivery.
2. **The two experiences** — Signal (live ops kanban feel) and Council (decision-room feel). Same data, two presentation modes; pick via the variant switcher in the top bar.
3. **The three roles** (per role switcher: Intake / Triage / Review):
   - Intake: submit requests, get AI coaching on justification + suggested effort days.
   - Triage: work the ranked queue, edit, defer, approve & hand off; capacity-by-timeline visible at all times.
   - Review (stakeholder): read-only visibility of decisions and capacity.
4. **Day-to-day flow** — Submit → auto-score → triage queue (scored/submitted up top) → approve (auto-handoff to "SXG ADO") or defer → exported report.
5. **Key concepts** — Target timelines (Sprint 1 → Sprint 2 → Sprint 3 → Sem 2 → Backlog, in that chronological order), capacity cut line (200d budget across the four non-Backlog timelines), pending vs decided indicators, manual rank override.
6. **Reports** — Use the Report button to generate PDF/PPTX of the current state.
7. **Tech, briefly** — React + Vite, TanStack Query, Lovable Cloud (Supabase) backend with edge functions for scoring, coaching, ranking explanations, import, seed, and report build.

No build/deploy boilerplate beyond a one-liner pointer to the Lovable project page.

---

## SIGNAL

No changes.

---

## COUNCIL

### 1. Filters: high/medium/low and timeline become multi-select dropdowns

In `src/variants/council/CouncilVariant.tsx`, replace the two chip rows for confidence and timeline with two multi-select dropdowns. SBU chips stay as they are (separate, color-coded, already iconic for that filter).

UI:
- Two `DropdownMenu` triggers side by side under the SBU row, styled to match the council surface (bordered, uppercase micro-label, chevron):
  - **Confidence** — trigger label like `Confidence: All` / `Confidence: High +1` / `Confidence: High, Medium`. Menu contains three `DropdownMenuCheckboxItem`s.
  - **Timeline** — same pattern; trigger label uses the short forms (`S1 Sprint 1`, `S1 Sprint 2`, `S1 Sprint 3`, `Sem 2`, `Backlog`); menu items show the full label. Items render in canonical chronological order via `TIMELINES`.
- `filterConf` / `filterTimelines` state and `toggleConf` / `toggleTimeline` handlers stay; only the trigger surface changes.
- Existing `clear filters` button still resets all three sets.
- Sort segmented control stays where it is.

### 2. Capacity by timeline — fix the totals (queue-only)

The reason Sprint 1 shows 46d instead of 26d: the chart currently sums **all** request statuses per timeline (pending + in review + approved + handed off). For Sprint 1 that's 8 scored (26d) + 3 handed off (20d) = 46d.

Change `src/components/CouncilCapacity.tsx` to count only items that can still appear in the triage queue, matching the `eligible` filter used in `CouncilReview`:

- Include statuses: `submitted`, `scored`, `in_review`, `approved`.
- Exclude: `handed_off`, `deferred`.
- Drop the four-segment status palette; render a single fill per row (one `--council-gold` segment) since handed-off and pending are both gone or merged.
  - Or, retained for at-a-glance state: keep three segments — `pending` (`submitted`+`scored`), `in_review`, `approved`. Drop the `handed_off` segment + legend chip.

Per-timeline budget stays at 50d for the four non-Backlog timelines; Backlog stays uncapped (full-width fill, no `/ Nd` suffix). Right-side metric continues to read `{used}d / 50d` (or just `{used}d` for Backlog).

After this fix, with current data the bars will read:
- Sprint 1: 26d / 50d (8 scored)
- Sprint 2: 36d / 50d (6 scored; 3 deferred excluded)
- Sprint 3: 52d / 50d → over (7 scored)
- Sem 2: 94d / 50d → over (9 scored; 1 handed off excluded)
- Backlog: 10d (2 scored)

### 3. Files touched

- `README.md` — rewritten as user guide.
- `src/variants/council/CouncilVariant.tsx` — confidence + timeline filters become dropdowns.
- `src/components/CouncilCapacity.tsx` — queue-only counting; segment palette trimmed accordingly.

### Out of scope

- No DB/schema changes.
- Stakeholder/Visibility view's capacity widget uses the same `CouncilCapacity` component, so it inherits the fix automatically — no separate work.
- SBU filter row left as chips (still works well, distinct from the dropdown filters).
