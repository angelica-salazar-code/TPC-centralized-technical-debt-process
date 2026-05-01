import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Check, X, Loader2, Gem, Sparkles, Star, GripVertical, RotateCcw, ChevronDown } from "lucide-react";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useAppState } from "@/lib/appState";
import { useAutoScore, useRequests, useUpdateStatus, explainRanking, useSetManualRank, useResetManualRank, useSetReviewerRating, useUpdateRequest } from "@/lib/useRequests";
import { RoleSwitcher } from "@/components/RoleSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ResetButton } from "@/components/ResetButton";
import { ReportButton } from "@/components/ReportButton";
import { ImportDialog } from "@/components/ImportDialog";
import { CAPACITY_DAYS_BUDGET, CLASSIFICATIONS, NEXT_TIMELINE, SBUS, STATUS_LABEL, TIMELINES, WORK_ITEM_TYPES, compareTimelines, rankingValue, type Classification, type RequestWithScore, type SBU, type Timeline, type WorkItemType } from "@/lib/domain";
import { useSubmitForm } from "@/components/useSubmitForm";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { CouncilCapacity } from "@/components/CouncilCapacity";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";

const SBU_CSS: Record<SBU, string> = {
  MSS: "var(--sbu-mss)",
  SCIM: "var(--sbu-scim)",
  "A&I": "var(--sbu-ai)",
  ACT: "var(--sbu-act)",
  TPC: "var(--sbu-tpc)",
};

export default function CouncilVariant() {
  const { role } = useAppState();
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }} className="council-root">
      <header className="border-b border-[hsl(var(--council-line))]" role="banner">
        <div className="mx-auto grid max-w-screen-xl grid-cols-3 items-center px-10 py-6">
          <div className="flex items-center gap-3 justify-self-start">
            <Gem className="h-5 w-5 text-[hsl(var(--council-gold))]" aria-hidden="true" />
            <div>
              <div className="council-display text-xl">Council</div>
              <div className="text-[11px] tracking-[0.2em] text-[hsl(var(--council-text-dim))] uppercase">Prioritization Chamber</div>
            </div>
          </div>
          <div className="justify-self-center">
            <RoleSwitcher tone="council" />
          </div>
          <div className="flex items-center gap-2 justify-self-end">
            <ThemeToggle tone="council" />
            <ResetButton tone="council" />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-screen-xl px-10 py-12">
        {role === "requestor" && <CouncilSubmit />}
        {role === "reviewer" && <CouncilReview />}
        {role === "stakeholder" && <CouncilVisibility />}
      </main>
    </motion.div>
  );
}

/* -------- SUBMIT (paper card) -------- */
function CouncilSubmit() {
  const f = useSubmitForm();
  return (
    <div className="grid grid-cols-12 gap-10">
      <div className="col-span-12 lg:col-span-8">
        <div className="council-paper p-12">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <div className="mb-1 text-[11px] uppercase tracking-[0.25em] text-[hsl(var(--council-ink))]/60">Request for Consideration</div>
              <h1 className="council-display text-4xl text-[hsl(var(--council-ink))]">Petition the Council</h1>
            </div>
            <ImportDialog tone="council" />
          </div>
          <div className="council-rule my-6" />

          <div className="space-y-7">
            <CRow label="Submitted by SBU"><select className="council-input" value={f.form.sbu} onChange={(e) => f.setForm({ ...f.form, sbu: e.target.value as SBU })}>{SBUS.map((s) => <option key={s}>{s}</option>)}</select></CRow>
            <CRow label="Work item type"><select className="council-input" value={f.form.work_item_type} onChange={(e) => f.setForm({ ...f.form, work_item_type: e.target.value as never })}>{WORK_ITEM_TYPES.map((s) => <option key={s}>{s}</option>)}</select></CRow>
            <CRow label="Title" error={f.errors.title}><input className="council-input council-display !text-2xl" value={f.form.title} onChange={(e) => f.setForm({ ...f.form, title: e.target.value })} placeholder="A short, evocative summary…" /></CRow>
            <CRow label="Petitioner alias" error={f.errors.requested_by}><input className="council-input" value={f.form.requested_by} onChange={(e) => f.setForm({ ...f.form, requested_by: e.target.value })} /></CRow>
            <CRow label="The matter at hand" error={f.errors.description}><textarea className="council-input min-h-[100px]" value={f.form.description} onChange={(e) => f.setForm({ ...f.form, description: e.target.value })} /></CRow>
            <CRow label="Why it matters (justification)" error={f.errors.justification}><textarea className="council-input min-h-[120px]" value={f.form.justification} onChange={(e) => f.setForm({ ...f.form, justification: e.target.value })} /></CRow>
            <div className="grid grid-cols-2 gap-6">
              <CRow label="Classification"><select className="council-input" value={f.form.classification} onChange={(e) => f.setForm({ ...f.form, classification: e.target.value as never })}>{CLASSIFICATIONS.map((s) => <option key={s}>{s}</option>)}</select></CRow>
              <CRow label="Target timeline"><select className="council-input" value={f.form.target_timeline} onChange={(e) => f.setForm({ ...f.form, target_timeline: e.target.value as Timeline })}>{TIMELINES.map((s) => <option key={s}>{s}</option>)}</select></CRow>
              <CRow label="Estimated days" error={f.errors.estimated_days}>
                <div className="flex items-center gap-2">
                  <input type="number" min={1} max={365} className="council-input" value={f.form.estimated_days ?? ""} onChange={(e) => f.setForm({ ...f.form, estimated_days: e.target.value === "" ? null : Number(e.target.value) })} placeholder="—" />
                  {f.aiSuggestedDays != null && f.form.estimated_days !== f.aiSuggestedDays && (
                    <button type="button" onClick={f.acceptAiDays} className="whitespace-nowrap rounded-sm border border-[hsl(var(--council-gold))]/50 bg-[hsl(var(--council-gold))]/10 px-2 py-1 text-[11px] uppercase tracking-wider text-[hsl(var(--council-gold))]">AI: {f.aiSuggestedDays}d</button>
                  )}
                </div>
              </CRow>
            </div>
          </div>

          <div className="council-rule my-8" />
          <button disabled={!f.canSubmit} onClick={f.submit} className="rounded-sm bg-[hsl(var(--council-ink))] px-6 py-3 text-sm font-medium tracking-wider text-[hsl(var(--council-paper))] uppercase disabled:opacity-30">
            {f.isSubmitting ? "Sealing…" : "Seal & Submit"}
          </button>
        </div>
      </div>

      <div className="col-span-12 lg:col-span-4">
        <div className="sticky top-28 rounded-sm border border-[hsl(var(--council-line))] bg-[hsl(var(--council-surface))] p-6">
          <div className="mb-4 flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-[hsl(var(--council-gold))]"><Sparkles className="h-3.5 w-3.5" /> Oracle's review</div>
          {!f.coach && !f.coaching && <p className="text-sm text-[hsl(var(--council-text-dim))]">Begin your petition. The Oracle will assess the strength of your case as you write.</p>}
          {f.coaching && <Loader2 className="h-4 w-4 animate-spin text-[hsl(var(--council-gold))]" />}
          {f.coach && (
            <div className="space-y-4 text-sm">
              <div className="council-display text-3xl capitalize text-[hsl(var(--council-gold))]">{f.coach.strength}</div>
              {f.coach.missing.length > 0 && (
                <div>
                  <div className="mb-2 text-[11px] uppercase tracking-wider text-[hsl(var(--council-text-dim))]">Considerations missing</div>
                  <ul className="space-y-1">{f.coach.missing.map((m) => <li key={m} className="border-l-2 border-[hsl(var(--council-gold))]/40 pl-2">{m}</li>)}</ul>
                </div>
              )}
              <p className="italic text-[hsl(var(--council-text-dim))]">"{f.coach.suggestion}"</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CRow({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[11px] uppercase tracking-[0.2em] text-[hsl(var(--council-ink))]/60">{label}</span>
        {error && <span className="text-[11px] text-[hsl(var(--destructive))]">{error}</span>}
      </div>
      {children}
    </label>
  );
}

/* -------- REVIEW -------- */
type Confidence = "high" | "medium" | "low";

function CouncilReview() {
  const { data, isLoading } = useRequests();
  useAutoScore(data, true);
  const update = useUpdateStatus();
  const updateReq = useUpdateRequest();
  const setManualRank = useSetManualRank();
  const resetRank = useResetManualRank();
  const setRating = useSetReviewerRating();
  const { toast } = useToast();
  const [idx, setIdx] = useState(0);
  const [explainText, setExplainText] = useState<string | null>(null);
  const [explaining, setExplaining] = useState(false);
  const [filterSbus, setFilterSbus] = useState<Set<SBU>>(new Set());
  const [filterConf, setFilterConf] = useState<Set<Confidence>>(new Set());
  const [filterTimelines, setFilterTimelines] = useState<Set<Timeline>>(new Set());
  const [sortMode, setSortMode] = useState<"score" | "timeline">("score");
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState<{
    title: string; sbu: SBU; work_item_type: WorkItemType; classification: Classification;
    target_timeline: Timeline; requested_by: string; description: string; justification: string;
    estimated_days: number | null;
  } | null>(null);

  // Items eligible for the queue (pre-sort/filter). Includes pending + decided items
  // that the reviewer can still re-rank or revisit; deferred & handed-off items are excluded.
  const eligible = useMemo(() => {
    return (data ?? []).filter(
      (r) => r.status === "scored" || r.status === "submitted" || r.status === "in_review" || r.status === "approved" || r.status === "handed_off"
    );
  }, [data]);

  // baseRanked: full unfiltered list. We sort by score (or timeline), then *demote*
  // items that are already approved for a future timeline (target_timeline !== NEXT_TIMELINE)
  // to immediately after the days-budget cut line.
  const baseRanked = useMemo(() => {
    const sorted = [...eligible].sort((a, b) => {
      if (sortMode === "timeline") {
        const t = compareTimelines(a.target_timeline, b.target_timeline);
        if (t !== 0) return t;
      }
      return rankingValue(b) - rankingValue(a);
    });

    // Compute days-budget cut line on the un-demoted list.
    // Handed-off items consume days first (they're not in `eligible`).
    const handedOffDays = (data ?? [])
      .filter((r) => r.status === "handed_off")
      .reduce((sum, r) => sum + (r.estimated_days ?? 0), 0);

    // Walk sorted, separating "demote" candidates from the rest as we go.
    // A demote candidate is approved (future-timeline) — these don't consume budget
    // for cut-line purposes (they're already approved), but they sit below the cut.
    const isDemoted = (r: RequestWithScore) =>
      r.status === "approved" && r.target_timeline !== NEXT_TIMELINE;

    const above: RequestWithScore[] = [];
    const demoted: RequestWithScore[] = [];
    const below: RequestWithScore[] = [];
    let acc = handedOffDays;
    let cutClosed = false;

    // Handed-off items always go above the cut line
    const handedOff = sorted.filter((r) => r.status === "handed_off");
    const rest = sorted.filter((r) => r.status !== "handed_off");
    above.push(...handedOff);
    // Their days are already counted via handedOffDays, so proceed with the rest
    for (const r of rest) {
      if (isDemoted(r)) { demoted.push(r); continue; }
      const d = r.estimated_days ?? 0;
      if (!cutClosed && acc + d <= CAPACITY_DAYS_BUDGET) {
        acc += d;
        above.push(r);
      } else {
        cutClosed = true;
        below.push(r);
      }
    }
    return { ordered: [...above, ...demoted, ...below], aboveCount: above.length };
  }, [eligible, sortMode, data]);

  const ranked = useMemo(() => {
    return baseRanked.ordered.filter((r) => {
      if (filterSbus.size > 0 && !filterSbus.has(r.sbu)) return false;
      if (filterConf.size > 0 && (!r.score || !filterConf.has(r.score.confidence))) return false;
      if (filterTimelines.size > 0 && !filterTimelines.has(r.target_timeline)) return false;
      return true;
    });
  }, [baseRanked, filterSbus, filterConf, filterTimelines]);

  const current = ranked[idx];
  const next = ranked[idx + 1];

  // Reset draft + exit edit mode whenever the focused item changes
  useEffect(() => {
    if (current) {
      setDraft({
        title: current.title, sbu: current.sbu, work_item_type: current.work_item_type,
        classification: current.classification, target_timeline: current.target_timeline,
        requested_by: current.requested_by, description: current.description,
        justification: current.justification, estimated_days: current.estimated_days,
      });
    } else {
      setDraft(null);
    }
    setEditMode(false);
  }, [current?.id]);

  const handleSaveEdit = async () => {
    if (!current || !draft) return;
    const oldTotal = current.score?.total ?? null;
    try {
      const result = await updateReq.mutateAsync({ id: current.id, updates: draft, rescore: true });
      const newTotal = result.score?.total ?? oldTotal;
      toast({
        title: oldTotal != null && newTotal != null ? `Re-scored: ${oldTotal} → ${newTotal}` : "Saved",
        description: draft.title.slice(0, 60),
      });
      setEditMode(false);
    } catch (e) {
      toast({ title: "Save failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!current) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowRight" && current.status !== "handed_off") handleApprove();
      if (e.key === "ArrowLeft" && current.status !== "handed_off") handleDefer();
      if (e.key === "ArrowDown") setIdx((i) => Math.min(i + 1, ranked.length - 1));
      if (e.key === "ArrowUp") setIdx((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, idx, ranked.length]);

  const handleApprove = async () => {
    if (!current) return;
    await update.mutateAsync({ id: current.id, status: "approved" });
    await update.mutateAsync({ id: current.id, status: "handed_off" });
    toast({ title: `${current.title.slice(0, 40)} approved`, description: "Handed off to SXG." });
    setIdx((i) => Math.min(i + 1, ranked.length - 1));
    setExplainText(null);
  };
  const handleDefer = async () => {
    if (!current) return;
    await update.mutateAsync({ id: current.id, status: "deferred" });
    setIdx((i) => Math.min(i + 1, ranked.length - 1));
    setExplainText(null);
  };
  const handleExplain = async () => {
    if (!current || !next || !current.score || !next.score) return;
    setExplaining(true); setExplainText("");
    try { setExplainText(await explainRanking(current, next)); } catch { setExplainText("Could not generate explanation."); }
    finally { setExplaining(false); }
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const handleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = ranked.findIndex((r) => r.id === active.id);
    const newIdx = ranked.findIndex((r) => r.id === over.id);
    const next = arrayMove(ranked, oldIdx, newIdx);
    await setManualRank.mutateAsync(next.map((r) => r.id));
  };

  const toggleSbu = (s: SBU) => {
    const n = new Set(filterSbus);
    n.has(s) ? n.delete(s) : n.add(s);
    setFilterSbus(n);
    setIdx(0);
  };
  const toggleConf = (c: Confidence) => {
    const n = new Set(filterConf);
    n.has(c) ? n.delete(c) : n.add(c);
    setFilterConf(n);
    setIdx(0);
  };
  const toggleTimeline = (t: Timeline) => {
    const n = new Set(filterTimelines);
    n.has(t) ? n.delete(t) : n.add(t);
    setFilterTimelines(n);
    setIdx(0);
  };

  if (isLoading) return <div className="text-center text-[hsl(var(--council-text-dim))]">Convening the chamber…</div>;
  if (!current) return <div className="council-paper mx-auto max-w-md p-12 text-center"><div className="council-display text-2xl">Chamber is clear.</div><p className="mt-2 text-sm text-[hsl(var(--council-ink))]/60">All petitions reviewed.</p></div>;

  // Map each request id to its index in the demoted/ordered base list.
  const overallIdxById = new Map(baseRanked.ordered.map((r, i) => [r.id, i]));

  // Days-based capacity: sum of estimated_days for items currently committed.
  const capacityUsed = (data ?? [])
    .filter((r) => r.status === "in_review" || r.status === "approved" || r.status === "handed_off")
    .reduce((sum, r) => sum + (r.estimated_days ?? 0), 0);
  const capacityPct = Math.min((capacityUsed / CAPACITY_DAYS_BUDGET) * 100, 100);
  const capacityWarn = capacityPct > 80;
  const handedOffCount = (data ?? []).filter((r) => r.status === "handed_off").length;

  // Cut line is the boundary between the `above` section and the demoted/below section
  // already encoded in baseRanked.ordered. cutOverallIdx is the LAST index above the cut.
  const cutOverallIdx = baseRanked.aboveCount - 1;

  const currentOverallIdx = overallIdxById.get(current.id) ?? 0;
  const isAboveCutLine = currentOverallIdx <= cutOverallIdx;
  const filtersActive = filterSbus.size > 0 || filterConf.size > 0 || filterTimelines.size > 0;

  // Decide where to draw the cut-line marker among the filtered rows.
  // It sits before the first filtered row whose overall index is > cutOverallIdx.
  let cutBeforeFilteredIdx = -1;
  for (let i = 0; i < ranked.length; i++) {
    const oi = overallIdxById.get(ranked[i].id) ?? 0;
    if (oi > cutOverallIdx) { cutBeforeFilteredIdx = i; break; }
  }
  // If no filtered row is below the cut but cut exists, mark "after end".
  const allFilteredAboveCut = ranked.length > 0 && cutBeforeFilteredIdx === -1 && cutOverallIdx >= 0;
  // If the very first filtered row is already below the cut, mark "before start".
  const allFilteredBelowCut = ranked.length > 0 && cutBeforeFilteredIdx === 0;

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Queue rail (40%) */}
      <aside className="col-span-12 lg:col-span-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[11px] uppercase tracking-[0.2em] text-[hsl(var(--council-text-dim))]">
            Queue · {ranked.length}{filtersActive && ` of ${baseRanked.ordered.length}`}
          </div>
          <button
            onClick={() => resetRank.mutate()}
            disabled={resetRank.isPending}
            className="text-[10px] uppercase tracking-wider text-[hsl(var(--council-text-dim))] hover:text-[hsl(var(--council-gold))]"
            title="Reset to AI ranking"
          >
            <RotateCcw className="inline h-3 w-3" /> AI rank
          </button>
        </div>

        {/* Filters */}
        <div className="mb-3 space-y-2 rounded-sm border border-[hsl(var(--council-line))] bg-[hsl(var(--council-surface))] p-2.5">
          <div className="flex flex-wrap gap-1">
            {SBUS.map((s) => {
              const active = filterSbus.has(s);
              const sbuColor = `hsl(${SBU_CSS[s]})`;
              const sbuColorDark = `color-mix(in srgb, hsl(${SBU_CSS[s]}) 55%, black)`;
              return (
                <button
                  key={s}
                  onClick={() => toggleSbu(s)}
                  style={{
                    borderColor: sbuColor,
                    backgroundColor: active ? sbuColorDark : "transparent",
                    color: active ? "white" : sbuColor,
                  }}
                  className="rounded-sm border px-3 py-1.5 text-[12px] uppercase tracking-wider font-semibold transition-colors"
                >{s}</button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-sm border border-[hsl(var(--council-line))] bg-transparent px-3 py-1.5 text-[11px] uppercase tracking-wider text-[hsl(var(--council-text))] hover:bg-white/5"
                >
                  Confidence:{" "}
                  <span className="text-[hsl(var(--council-gold))]">
                    {filterConf.size === 0
                      ? "All"
                      : Array.from(filterConf).join(", ")}
                  </span>
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[160px]">
                {(["high", "medium", "low"] as Confidence[]).map((c) => (
                  <DropdownMenuCheckboxItem
                    key={c}
                    checked={filterConf.has(c)}
                    onCheckedChange={() => toggleConf(c)}
                    onSelect={(e) => e.preventDefault()}
                    className="text-xs uppercase tracking-wider"
                  >
                    {c}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-sm border border-[hsl(var(--council-line))] bg-transparent px-3 py-1.5 text-[11px] uppercase tracking-wider text-[hsl(var(--council-text))] hover:bg-white/5"
                >
                  Timeline:{" "}
                  <span className="text-[hsl(var(--council-gold))]">
                    {filterTimelines.size === 0
                      ? "All"
                      : Array.from(filterTimelines)
                          .map((t) =>
                            t === "Backlog"
                              ? "Backlog"
                              : t.replace("FY27 Semester 1 — ", "S1 ").replace("FY27 Semester 2", "Sem 2"),
                          )
                          .join(", ")}
                  </span>
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[260px]">
                {TIMELINES.map((t) => (
                  <DropdownMenuCheckboxItem
                    key={t}
                    checked={filterTimelines.has(t)}
                    onCheckedChange={() => toggleTimeline(t)}
                    onSelect={(e) => e.preventDefault()}
                    className="text-xs"
                  >
                    {t}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-[hsl(var(--council-text-dim))]">
              <span>Sort:</span>
              {(["score", "timeline"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => { setSortMode(m); setIdx(0); }}
                  className={`rounded-sm px-2 py-1 ${
                    sortMode === m
                      ? "bg-[hsl(var(--council-gold))]/25 text-[hsl(var(--council-gold))]"
                      : "text-[hsl(var(--council-text-dim))] hover:text-[hsl(var(--council-text))]"
                  }`}
                >{m}</button>
              ))}
            </div>
            {filtersActive && (
              <button onClick={() => { setFilterSbus(new Set()); setFilterConf(new Set()); setFilterTimelines(new Set()); }} className="text-[10px] text-[hsl(var(--council-text-dim))] hover:text-[hsl(var(--council-text))]">clear filters</button>
            )}
          </div>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={ranked.map((r) => r.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-1 max-h-[70vh] overflow-y-auto pr-1">
              {allFilteredBelowCut && (
                <CutLineMarker label={`cut line at overall #${cutOverallIdx + 1}`} ghost />
              )}
              {ranked.map((r, i) => {
                const overallIdx = overallIdxById.get(r.id) ?? 0;
                return (
                  <QueueItem
                    key={r.id}
                    item={r}
                    index={i}
                    overallIdx={overallIdx}
                    showOverall={filtersActive}
                    active={i === idx}
                    cutLine={!allFilteredBelowCut && cutBeforeFilteredIdx === i}
                    onSelect={() => setIdx(i)}
                    onRate={(rating) => setRating.mutate({ id: r.id, rating })}
                  />
                );
              })}
              {allFilteredAboveCut && (
                <CutLineMarker label={`cut line at overall #${cutOverallIdx + 1}`} ghost />
              )}
            </div>
          </SortableContext>
        </DndContext>
      </aside>

      {/* Right column: Capacity (top) + Hero card (60%) */}
      <section className="col-span-12 lg:col-span-7">
        {/* Capacity widget — segmented by status, one bar per timeline */}
        <CouncilCapacity data={data} pulseKey={handedOffCount} />

        <div className="mb-3 flex items-center justify-between text-[11px] uppercase tracking-[0.25em] text-[hsl(var(--council-text-dim))]">
          <span>
            Item {idx + 1} of {ranked.length}
            {filtersActive && <span className="ml-2 normal-case tracking-normal text-[hsl(var(--council-text-dim))]/70">· #{currentOverallIdx + 1} overall</span>}
          </span>
          <span className={isAboveCutLine ? "text-[hsl(var(--council-gold))]" : "text-[hsl(var(--destructive))]"}>
            {isAboveCutLine ? "Within capacity" : "Below the cut line"}
          </span>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.35, ease: [0.22, 0.8, 0.36, 1] }}
            className="council-paper p-10 relative"
          >
            {!editMode && (
              <button
                onClick={() => setEditMode(true)}
                className="absolute right-6 top-6 rounded-sm border border-[hsl(var(--council-ink))]/20 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--council-ink))]/70 hover:bg-[hsl(var(--council-ink))]/5"
              >
                Edit
              </button>
            )}

            {!editMode && (
              <>
                <div className="mb-2 text-[11px] uppercase tracking-[0.25em] text-[hsl(var(--council-ink))]/60">{current.sbu} · {current.classification} · <span className="text-[hsl(var(--council-gold))]">{current.target_timeline}</span> · <span className="text-[hsl(var(--council-ink))]/80">Effort {current.estimated_days != null ? `${current.estimated_days}d` : "—"}</span></div>
                <h2 className="council-display text-3xl text-[hsl(var(--council-ink))] leading-tight pr-20">{current.title}</h2>
                <div className="council-rule my-5" />

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-[hsl(var(--council-ink))]/60">Justification</div>
                    <p className="mt-2 text-[14px] leading-relaxed text-[hsl(var(--council-ink))]">{current.justification}</p>
                  </div>
                  <div>
                    {current.score ? (
                      <>
                        <div className="text-[11px] uppercase tracking-wider text-[hsl(var(--council-ink))]/60">AI judgment</div>
                        <div className="council-display mt-1 text-5xl text-[hsl(var(--council-ink))]">{current.score.total}<span className="text-xl text-[hsl(var(--council-ink))]/40">/100</span></div>
                        <div className="mt-2 text-[11px] uppercase tracking-[0.2em] text-[hsl(var(--council-ink))]/60">Confidence: <span className="text-[hsl(var(--council-ink))]">{current.score.confidence}</span></div>
                        <div className="mt-3 grid grid-cols-5 gap-2 text-center text-[10px]">
                          {(["impact","cost_avoidance","scale","strategic_alignment","feasibility"] as const).map((k) => (
                            <div key={k}>
                              <div className="text-[hsl(var(--council-ink))]/50 capitalize">{k.replace("_"," ").slice(0, 8)}</div>
                              <div className="font-semibold">{current.score![k]}</div>
                            </div>
                          ))}
                        </div>
                        <p className="mt-3 italic text-[12px] text-[hsl(var(--council-ink))]/70">"{current.score.rationale}"</p>
                      </>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-[hsl(var(--council-ink))]/60"><Loader2 className="h-4 w-4 animate-spin" /> Oracle is judging…</div>
                    )}
                  </div>
                </div>

                {/* Why this rank? + Effort — 50/50 split */}
                <div className="mt-6 grid grid-cols-2 gap-4 border-t border-[hsl(var(--council-ink))]/10 pt-4">
                  <div className="flex flex-col">
                    <button
                      onClick={handleExplain}
                      disabled={!next}
                      className="rounded-sm border border-[hsl(var(--council-gold))]/40 px-4 py-2 text-sm tracking-wider uppercase text-[hsl(var(--council-gold))] hover:bg-[hsl(var(--council-gold))]/10 disabled:opacity-30"
                    >
                      Why this rank?
                    </button>
                    {explainText !== null && (
                      <div className="mt-3">
                        <div className="text-[11px] uppercase tracking-wider text-[hsl(var(--council-ink))]/60">Tradeoff vs next item</div>
                        {explaining && !explainText ? <Loader2 className="mt-2 h-4 w-4 animate-spin" /> : <p className="mt-2 text-sm text-[hsl(var(--council-ink))]/80">{explainText}</p>}
                      </div>
                    )}
                  </div>
                  <div className="rounded-sm border border-[hsl(var(--council-ink))]/15 bg-[hsl(var(--council-ink))]/[0.03] px-4 py-2 flex flex-col justify-center">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-[hsl(var(--council-ink))]/60">Effort</div>
                    <div className="mt-0.5 flex items-baseline gap-2">
                      <span className="council-display text-3xl text-[hsl(var(--council-ink))] tabular-nums">
                        {current.estimated_days != null ? current.estimated_days : "—"}
                      </span>
                      <span className="text-xs text-[hsl(var(--council-ink))]/50">days</span>
                    </div>
                    <div className="mt-1 text-[11px] text-[hsl(var(--council-ink))]/60 truncate">{current.target_timeline}</div>
                  </div>
                </div>

                {/* Reviewer rating */}
                <div className="mt-6 flex items-center gap-3 border-t border-[hsl(var(--council-ink))]/10 pt-4">
                  <span className="text-[11px] uppercase tracking-wider text-[hsl(var(--council-ink))]/60">Your rating</span>
                  <RatingStars
                    value={current.reviewer_rating ?? 0}
                    onChange={(v) => setRating.mutate({ id: current.id, rating: v })}
                    size="lg"
                  />
                </div>
              </>
            )}

            {editMode && draft && (
              <div className="space-y-4">
                <div className="text-[11px] uppercase tracking-[0.25em] text-[hsl(var(--council-ink))]/60">Editing petition</div>
                <EditField label="Title"><input className="council-input council-display !text-2xl" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></EditField>
                <div className="grid grid-cols-2 gap-4">
                  <EditField label="SBU"><select className="council-input" value={draft.sbu} onChange={(e) => setDraft({ ...draft, sbu: e.target.value as SBU })}>{SBUS.map((s) => <option key={s}>{s}</option>)}</select></EditField>
                  <EditField label="Work item type"><select className="council-input" value={draft.work_item_type} onChange={(e) => setDraft({ ...draft, work_item_type: e.target.value as WorkItemType })}>{WORK_ITEM_TYPES.map((s) => <option key={s}>{s}</option>)}</select></EditField>
                  <EditField label="Classification"><select className="council-input" value={draft.classification} onChange={(e) => setDraft({ ...draft, classification: e.target.value as Classification })}>{CLASSIFICATIONS.map((s) => <option key={s}>{s}</option>)}</select></EditField>
                  <EditField label="Target timeline"><select className="council-input" value={draft.target_timeline} onChange={(e) => setDraft({ ...draft, target_timeline: e.target.value as Timeline })}>{TIMELINES.map((s) => <option key={s}>{s}</option>)}</select></EditField>
                  <EditField label="Petitioner alias"><input className="council-input" value={draft.requested_by} onChange={(e) => setDraft({ ...draft, requested_by: e.target.value })} /></EditField>
                  <EditField label="Estimated days"><input type="number" min={1} max={365} className="council-input" value={draft.estimated_days ?? ""} onChange={(e) => setDraft({ ...draft, estimated_days: e.target.value === "" ? null : Number(e.target.value) })} /></EditField>
                </div>
                <EditField label="Description"><textarea className="council-input min-h-[80px]" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></EditField>
                <EditField label="Justification"><textarea className="council-input min-h-[100px]" value={draft.justification} onChange={(e) => setDraft({ ...draft, justification: e.target.value })} /></EditField>
                <div className="flex items-center justify-end gap-2 border-t border-[hsl(var(--council-ink))]/10 pt-4">
                  <button
                    onClick={() => {
                      setEditMode(false);
                      if (current) setDraft({
                        title: current.title, sbu: current.sbu, work_item_type: current.work_item_type,
                        classification: current.classification, target_timeline: current.target_timeline,
                        requested_by: current.requested_by, description: current.description,
                        justification: current.justification, estimated_days: current.estimated_days,
                      });
                    }}
                    className="rounded-sm border border-[hsl(var(--council-ink))]/20 px-4 py-2 text-sm uppercase tracking-wider text-[hsl(var(--council-ink))] hover:bg-[hsl(var(--council-ink))]/5"
                  >Cancel</button>
                  <button
                    disabled={updateReq.isPending}
                    onClick={handleSaveEdit}
                    className="council-cta rounded-sm bg-[hsl(var(--council-gold))] px-4 py-2 text-sm uppercase tracking-wider text-[hsl(var(--council-ink))] hover:brightness-110 disabled:opacity-60 inline-flex items-center gap-2"
                  >
                    {updateReq.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                    Save & re-score
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-6 flex items-center justify-between">
          <button onClick={() => setIdx((i) => Math.max(i - 1, 0))} className="text-sm text-[hsl(var(--council-text-dim))] hover:text-[hsl(var(--council-text))]"><ChevronLeft className="inline h-4 w-4" /> Previous</button>
          <div className="flex gap-2">
            {current.status === "handed_off" ? (
              <span className="inline-flex items-center gap-2 rounded-sm border border-[hsl(var(--council-gold))]/50 bg-[hsl(var(--council-gold))]/10 px-4 py-2 text-sm tracking-wider uppercase text-[hsl(var(--council-gold))]"><Check className="h-4 w-4" /> Handed Off</span>
            ) : (
              <>
                <button onClick={handleDefer} className="inline-flex items-center gap-2 rounded-sm border border-[hsl(var(--council-line))] px-4 py-2 text-sm tracking-wider uppercase text-[hsl(var(--council-text))] hover:bg-white/5"><X className="h-4 w-4" /> Defer</button>
                <button onClick={handleApprove} className="council-cta inline-flex items-center gap-2 rounded-sm bg-[hsl(var(--council-gold))] px-4 py-2 text-sm tracking-wider uppercase text-[hsl(var(--council-ink))] hover:brightness-110"><Check className="h-4 w-4" /> Approve & hand off</button>
              </>
            )}
          </div>
          <button onClick={() => setIdx((i) => Math.min(i + 1, ranked.length - 1))} className="text-sm text-[hsl(var(--council-text-dim))] hover:text-[hsl(var(--council-text))]">Next <ChevronRight className="inline h-4 w-4" /></button>
        </div>
        <div className="mt-3 text-center text-[10px] uppercase tracking-[0.25em] text-[hsl(var(--council-text-dim))]">
          ← defer · → approve · ↑↓ navigate · drag handles to re-rank
        </div>
      </section>
    </div>
  );
}

function CutLineMarker({ label = "Cut", ghost = false }: { label?: string; ghost?: boolean }) {
  return (
    <div className={`my-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-[hsl(var(--council-gold))] ${ghost ? "opacity-60" : ""}`}>
      <div className="h-px flex-1 bg-[hsl(var(--council-gold))]/40" />
      {label}
      <div className="h-px flex-1 bg-[hsl(var(--council-gold))]/40" />
    </div>
  );
}

function QueueItem({ item, index, overallIdx, showOverall, active, cutLine, onSelect, onRate }: {
  item: RequestWithScore; index: number; overallIdx: number; showOverall: boolean; active: boolean; cutLine: boolean;
  onSelect: () => void; onRate: (v: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style}>
      {cutLine && <CutLineMarker />}
      <div className={`group flex items-stretch gap-1 rounded-sm pr-1 py-1.5 transition-colors overflow-hidden ${
        active ? "bg-[hsl(var(--council-gold))]/15" : "hover:bg-white/5"
      }`}>
        <span
          className="w-1 shrink-0 rounded-sm"
          style={{ background: `hsl(${SBU_CSS[item.sbu]})` }}
          aria-label={`SBU ${item.sbu}`}
          title={item.sbu}
        />
        <button {...attributes} {...listeners} className="cursor-grab text-[hsl(var(--council-text-dim))] hover:text-[hsl(var(--council-text))] self-center pl-1" title="Drag to re-rank">
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <button onClick={onSelect} className="flex flex-1 items-start gap-2 text-left text-[11px] min-w-0">
          <span className={`font-mono shrink-0 ${showOverall ? "w-12" : "w-5"} ${active ? "text-[hsl(var(--council-gold))]" : "text-[hsl(var(--council-text-dim))]"}`}>
            {showOverall
              ? `${index + 1}/${overallIdx + 1}`
              : String(index + 1).padStart(2, "0")}
          </span>
          <span className="flex-1 min-w-0">
            <span className={`block line-clamp-2 break-words ${active ? "text-[hsl(var(--council-gold))]" : "text-[hsl(var(--council-text-dim))]"}`}>{item.title}</span>
            <span className="mt-0.5 flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-[hsl(var(--council-text-dim))]/70">
              {(item.status === "submitted" || item.status === "scored") && (
                <span
                  className="inline-flex items-center gap-1 rounded-sm border border-[hsl(var(--council-gold))]/50 px-1 py-px text-[8px] text-[hsl(var(--council-gold))]"
                  title="No decision yet"
                >
                  <span className="h-1 w-1 rounded-full bg-[hsl(var(--council-gold))]" />
                  pending
                </span>
              )}
              {item.status === "handed_off" && (
                <span
                  className="inline-flex items-center gap-1 rounded-sm border border-green-500/50 bg-green-500/10 px-1 py-px text-[8px] text-green-400"
                  title="Approved & handed off"
                >
                  <Check className="h-2 w-2" />
                  approved
                </span>
              )}
              <span className="truncate">{item.sbu} · {item.target_timeline}</span>
            </span>
          </span>
          <span className="font-mono text-[10px] text-[hsl(var(--council-text-dim))]/70 shrink-0 tabular-nums" title="Estimated effort">
            {item.estimated_days != null ? `${item.estimated_days}d` : "—"}
          </span>
          <span className="font-mono text-[hsl(var(--council-text-dim))] shrink-0">{item.score?.total ?? "·"}</span>
        </button>
      </div>
      <div className="px-6 pb-1">
        <RatingStars value={item.reviewer_rating ?? 0} onChange={onRate} size="sm" />
      </div>
    </div>
  );
}

function RatingStars({ value, onChange, size = "sm" }: { value: number; onChange: (v: number) => void; size?: "sm" | "lg" }) {
  const sz = size === "lg" ? "h-5 w-5" : "h-3 w-3";
  return (
    <div className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          onClick={(e) => { e.stopPropagation(); onChange(value === n ? 0 : n); }}
          className="transition-colors"
          aria-label={`Rate ${n} stars`}
        >
          <Star className={`${sz} ${n <= value ? "fill-[hsl(var(--council-gold))] text-[hsl(var(--council-gold))]" : "text-[hsl(var(--council-text-dim))]/40"}`} />
        </button>
      ))}
    </div>
  );
}

/* -------- VISIBILITY -------- */
type VisSort = "score" | "date" | "sbu";

function CouncilVisibility() {
  const { data } = useRequests();
  const update = useUpdateStatus();
  const updateReq = useUpdateRequest();
  const { toast } = useToast();
  const [sort, setSort] = useState<VisSort>("score");
  const [showDeferred, setShowDeferred] = useState(true);
  const [open, setOpen] = useState<RequestWithScore | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState<{
    title: string; sbu: SBU; work_item_type: WorkItemType; classification: Classification;
    target_timeline: Timeline; requested_by: string; description: string; justification: string;
    estimated_days: number | null;
  } | null>(null);

  // Reset edit state when modal opens/closes or item changes
  useEffect(() => {
    if (open) {
      setDraft({
        title: open.title, sbu: open.sbu, work_item_type: open.work_item_type,
        classification: open.classification, target_timeline: open.target_timeline,
        requested_by: open.requested_by, description: open.description,
        justification: open.justification, estimated_days: open.estimated_days,
      });
    } else {
      setEditMode(false);
      setDraft(null);
    }
  }, [open]);

  const sortFn = (a: RequestWithScore, b: RequestWithScore) => {
    if (sort === "score") return (b.score?.total ?? -1) - (a.score?.total ?? -1);
    if (sort === "date") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    return a.sbu.localeCompare(b.sbu);
  };

  const approved = (data ?? []).filter((r) => r.status === "approved" || r.status === "handed_off").sort(sortFn);
  const inFlight = (data ?? []).filter((r) => r.status === "scored" || r.status === "in_review").sort(sortFn);
  const deferred = (data ?? []).filter((r) => r.status === "deferred").sort(sortFn);

  const handleApprove = async (r: RequestWithScore) => {
    await update.mutateAsync({ id: r.id, status: "approved" });
    await update.mutateAsync({ id: r.id, status: "handed_off" });
    toast({ title: "Approved & handed off", description: r.title.slice(0, 60) });
    setOpen(null);
  };
  const handleDefer = async (r: RequestWithScore) => {
    await update.mutateAsync({ id: r.id, status: "deferred" });
    setOpen(null);
  };
  const handleReopen = async (r: RequestWithScore) => {
    await update.mutateAsync({ id: r.id, status: "scored" });
    setOpen(null);
  };

  const handleSaveEdit = async () => {
    if (!open || !draft) return;
    const oldTotal = open.score?.total ?? null;
    try {
      const result = await updateReq.mutateAsync({ id: open.id, updates: draft, rescore: true });
      const newTotal = result.score?.total ?? oldTotal;
      // Compute new rank in score-sorted queue
      const all = [...(data ?? [])].filter((r) => r.id !== open.id);
      const updatedItem: RequestWithScore = { ...open, ...draft, score: result.score ?? open.score };
      const ranked = [...all, updatedItem].sort((a, b) => (b.score?.total ?? -1) - (a.score?.total ?? -1));
      const newRank = ranked.findIndex((r) => r.id === open.id) + 1;
      toast({
        title: oldTotal != null && newTotal != null ? `Re-scored: ${oldTotal} → ${newTotal}` : "Saved",
        description: `Now ranked #${newRank} of ${ranked.length}`,
      });
      setEditMode(false);
      setOpen(null);
    } catch (e) {
      toast({ title: "Save failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  return (
    <div className="space-y-12">
      <CouncilCapacity data={data} pulseKey={(data ?? []).filter((r) => r.status === "handed_off").length} />

      <div className="flex items-center justify-end gap-2">
        <ReportButton tone="council" />
        <span className="text-[11px] uppercase tracking-[0.25em] text-[hsl(var(--council-text-dim))]">Sort</span>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as VisSort)}
          className="rounded-sm border border-[hsl(var(--council-line))] bg-[hsl(var(--council-surface))] px-2 py-1 text-[12px] text-[hsl(var(--council-text))]"
        >
          <option value="score">Score (high → low)</option>
          <option value="date">Date (newest)</option>
          <option value="sbu">SBU</option>
        </select>
      </div>

      <section>
        <div className="mb-4 text-[11px] uppercase tracking-[0.25em] text-[hsl(var(--council-gold))]">Decreed by the Council</div>
        <div className="space-y-3">
          {approved.slice(0, 12).map((r) => (
            <button key={r.id} onClick={() => setOpen(r)} className="council-paper flex w-full items-center justify-between p-5 text-left transition-shadow hover:shadow-md">
              <div>
                <div className="council-display text-lg text-[hsl(var(--council-ink))]">{r.title}</div>
                <div className="text-[11px] text-[hsl(var(--council-ink))]/60">{r.sbu} · {STATUS_LABEL[r.status]} · <span className="text-[hsl(var(--council-gold))]">{r.target_timeline}</span> · <span className="tabular-nums">{r.estimated_days != null ? `${r.estimated_days}d` : "—"}</span> {r.sxg_ado_id && `· ${r.sxg_ado_id}`}</div>
              </div>
              {r.score && <div className="council-display text-2xl text-[hsl(var(--council-gold))]">{r.score.total}</div>}
            </button>
          ))}
          {approved.length === 0 && <p className="text-sm text-[hsl(var(--council-text-dim))]">No decisions yet.</p>}
        </div>
      </section>

      <section>
        <div className="mb-4 text-[11px] uppercase tracking-[0.25em] text-[hsl(var(--council-text-dim))]">Awaiting judgment ({inFlight.length})</div>
        <ul className="space-y-1">
          {inFlight.slice(0, 12).map((r) => (
            <li key={r.id}>
              <button onClick={() => setOpen(r)} className="flex w-full items-center gap-3 border-b border-[hsl(var(--council-line))] py-2 text-sm text-left hover:bg-white/5">
                <span className="font-mono text-[hsl(var(--council-text-dim))] w-10">{r.score?.total ?? "··"}</span>
                <span className="flex-1 truncate">{r.title}</span>
                <span className="text-[10px] uppercase tracking-wider text-[hsl(var(--council-gold))]/80 w-44 truncate text-right">{r.target_timeline}</span>
                <span className="font-mono text-[10px] text-[hsl(var(--council-text-dim))] w-10 text-right tabular-nums">{r.estimated_days != null ? `${r.estimated_days}d` : "—"}</span>
                <span className="text-[11px] text-[hsl(var(--council-text-dim))] w-12 text-right">{r.sbu}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <button
          onClick={() => setShowDeferred(!showDeferred)}
          className="mb-4 flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-[hsl(var(--council-gold))]/70 hover:text-[hsl(var(--council-gold))]"
        >
          <ChevronDown className={`h-3 w-3 transition-transform ${showDeferred ? "" : "-rotate-90"}`} />
          Deferred ({deferred.length})
        </button>
        {showDeferred && (
          <ul className="space-y-1">
            {deferred.length === 0 && <li className="text-sm italic text-[hsl(var(--council-text-dim))]">Nothing deferred.</li>}
            {deferred.slice(0, 20).map((r) => (
              <li key={r.id}>
                <button onClick={() => setOpen(r)} className="flex w-full items-center gap-3 border-b border-[hsl(var(--council-line))] py-2 text-sm italic text-left text-[hsl(var(--council-text-dim))] hover:bg-white/5">
                  <span className="font-mono w-10">{r.score?.total ?? "··"}</span>
                  <span className="flex-1 truncate">{r.title}</span>
                  <span className="text-[10px] uppercase tracking-wider w-44 truncate text-right not-italic">{r.target_timeline}</span>
                  <span className="font-mono text-[10px] text-[hsl(var(--council-text-dim))] w-10 text-right tabular-nums not-italic">{r.estimated_days != null ? `${r.estimated_days}d` : "—"}</span>
                  <span className="text-[11px] w-12 text-right">{r.sbu}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-2xl">
          {open && (
            <>
              <DialogHeader>
                <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: `hsl(${SBU_CSS[(editMode && draft ? draft.sbu : open.sbu)]})` }} aria-hidden="true" />
                  {(editMode && draft ? draft.sbu : open.sbu)} · {(editMode && draft ? draft.classification : open.classification)} · {(editMode && draft ? draft.target_timeline : open.target_timeline)}
                </div>
                <DialogTitle className="council-display text-2xl">{editMode && draft ? draft.title : open.title}</DialogTitle>
                <DialogDescription>Status: {STATUS_LABEL[open.status]}{(editMode && draft ? draft.requested_by : open.requested_by) ? ` · Requested by ${editMode && draft ? draft.requested_by : open.requested_by}` : ""}</DialogDescription>
              </DialogHeader>

              {!editMode && open.score && (
                <div className="rounded-md border bg-muted/30 p-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground">AI score</span>
                    <span className="text-2xl font-semibold tabular-nums">{open.score.total}<span className="text-sm text-muted-foreground">/89</span></span>
                  </div>
                  <div className="mt-2 grid grid-cols-5 gap-2 text-center text-[11px]">
                    {(["impact","cost_avoidance","scale","strategic_alignment","feasibility"] as const).map((k) => (
                      <div key={k}>
                        <div className="text-muted-foreground capitalize">{k.replace("_"," ")}</div>
                        <div className="font-semibold">{open.score![k]}</div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-xs italic text-muted-foreground">"{open.score.rationale}"</p>
                </div>
              )}

              {!editMode && (
                <div className="space-y-3 text-sm max-h-[40vh] overflow-y-auto">
                  <div><div className="text-[11px] uppercase tracking-wider text-muted-foreground">Justification</div><p>{open.justification}</p></div>
                  <div><div className="text-[11px] uppercase tracking-wider text-muted-foreground">Description</div><p>{open.description}</p></div>
                  {open.estimated_days != null && <div><div className="text-[11px] uppercase tracking-wider text-muted-foreground">Estimated days</div><p>{open.estimated_days}d</p></div>}
                  {open.ado_id && <div><div className="text-[11px] uppercase tracking-wider text-muted-foreground">ADO ID</div><p>{open.ado_id}</p></div>}
                  {open.sxg_ado_id && <div><div className="text-[11px] uppercase tracking-wider text-muted-foreground">SXG ADO</div><p>{open.sxg_ado_id}</p></div>}
                </div>
              )}

              {editMode && draft && (
                <div className="space-y-3 text-sm max-h-[55vh] overflow-y-auto pr-1">
                  <EditField label="Title"><input className="council-input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></EditField>
                  <div className="grid grid-cols-2 gap-3">
                    <EditField label="SBU"><select className="council-input" value={draft.sbu} onChange={(e) => setDraft({ ...draft, sbu: e.target.value as SBU })}>{SBUS.map((s) => <option key={s}>{s}</option>)}</select></EditField>
                    <EditField label="Work item type"><select className="council-input" value={draft.work_item_type} onChange={(e) => setDraft({ ...draft, work_item_type: e.target.value as WorkItemType })}>{WORK_ITEM_TYPES.map((s) => <option key={s}>{s}</option>)}</select></EditField>
                    <EditField label="Classification"><select className="council-input" value={draft.classification} onChange={(e) => setDraft({ ...draft, classification: e.target.value as Classification })}>{CLASSIFICATIONS.map((s) => <option key={s}>{s}</option>)}</select></EditField>
                    <EditField label="Target timeline"><select className="council-input" value={draft.target_timeline} onChange={(e) => setDraft({ ...draft, target_timeline: e.target.value as Timeline })}>{TIMELINES.map((s) => <option key={s}>{s}</option>)}</select></EditField>
                  </div>
                  <EditField label="Petitioner alias"><input className="council-input" value={draft.requested_by} onChange={(e) => setDraft({ ...draft, requested_by: e.target.value })} /></EditField>
                  <EditField label="Description"><textarea className="council-input min-h-[80px]" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></EditField>
                  <EditField label="Justification"><textarea className="council-input min-h-[100px]" value={draft.justification} onChange={(e) => setDraft({ ...draft, justification: e.target.value })} /></EditField>
                  <EditField label="Estimated days"><input type="number" min={1} max={365} className="council-input" value={draft.estimated_days ?? ""} onChange={(e) => setDraft({ ...draft, estimated_days: e.target.value === "" ? null : Number(e.target.value) })} /></EditField>
                </div>
              )}

              <DialogFooter>
                {!editMode && (
                  <>
                    <button onClick={() => setEditMode(true)} className="rounded-sm border border-[hsl(var(--council-line))] px-4 py-2 text-sm uppercase tracking-wider hover:bg-white/5 mr-auto">Edit</button>
                    {(open.status === "scored" || open.status === "in_review") && (
                      <>
                        <button onClick={() => handleDefer(open)} className="rounded-sm border border-[hsl(var(--council-line))] px-4 py-2 text-sm uppercase tracking-wider hover:bg-white/5">Defer</button>
                        <button onClick={() => handleApprove(open)} className="council-cta rounded-sm bg-[hsl(var(--council-gold))] px-4 py-2 text-sm uppercase tracking-wider text-[hsl(var(--council-ink))] hover:brightness-110">Approve & hand off</button>
                      </>
                    )}
                    {open.status === "deferred" && (
                      <button onClick={() => handleReopen(open)} className="rounded-sm border border-[hsl(var(--council-gold))]/40 px-4 py-2 text-sm uppercase tracking-wider text-[hsl(var(--council-gold))] hover:bg-[hsl(var(--council-gold))]/10">Re-open</button>
                    )}
                    <button onClick={() => setOpen(null)} className="rounded-sm border px-4 py-2 text-sm uppercase tracking-wider hover:bg-white/5">Close</button>
                  </>
                )}
                {editMode && (
                  <>
                    <button
                      onClick={() => {
                        setEditMode(false);
                        if (open) setDraft({
                          title: open.title, sbu: open.sbu, work_item_type: open.work_item_type,
                          classification: open.classification, target_timeline: open.target_timeline,
                          requested_by: open.requested_by, description: open.description,
                          justification: open.justification, estimated_days: open.estimated_days,
                        });
                      }}
                      className="rounded-sm border px-4 py-2 text-sm uppercase tracking-wider hover:bg-white/5 mr-auto"
                    >Cancel</button>
                    <button
                      disabled={updateReq.isPending}
                      onClick={handleSaveEdit}
                      className="council-cta rounded-sm bg-[hsl(var(--council-gold))] px-4 py-2 text-sm uppercase tracking-wider text-[hsl(var(--council-ink))] hover:brightness-110 disabled:opacity-60 inline-flex items-center gap-2"
                    >
                      {updateReq.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                      Save & re-score
                    </button>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      {children}
    </div>
  );
}
