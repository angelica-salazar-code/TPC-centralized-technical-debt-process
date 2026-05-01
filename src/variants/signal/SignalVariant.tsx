import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Activity, ArrowUpRight, Loader2, Radio, AlertTriangle, Layers, Zap, Check, X, Send } from "lucide-react";
import { useAppState } from "@/lib/appState";
import { useAutoScore, useRequests, useUpdateStatus, useUpdateRequest, explainRanking } from "@/lib/useRequests";
import { RoleSwitcher } from "@/components/RoleSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ResetButton } from "@/components/ResetButton";
import { ReportButton } from "@/components/ReportButton";
import { ImportDialog } from "@/components/ImportDialog";
import { CAPACITY_DAYS_BUDGET, CLASSIFICATIONS, SBUS, STATUSES, STATUS_LABEL, TIMELINES, WORK_ITEM_TYPES, type Classification, type RequestWithScore, type SBU, type Status, type Timeline, type WorkItemType } from "@/lib/domain";
import { useSubmitForm } from "@/components/useSubmitForm";
import { useToast } from "@/hooks/use-toast";
import { SidePanel } from "@/components/SidePanel";

const SBU_CSS: Record<SBU, string> = {
  MSS: "var(--sbu-mss)",
  SCIM: "var(--sbu-scim)",
  "A&I": "var(--sbu-ai)",
  ACT: "var(--sbu-act)",
  TPC: "var(--sbu-tpc)",
};

export default function SignalVariant() {
  const { role, theme } = useAppState();
  const tone = theme === "light" ? "light" : "dark";
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }} className="signal-root">
      <header className="signal-surface border-b" role="banner">
        <div className="mx-auto grid max-w-screen-2xl grid-cols-3 items-center px-5 py-3">
          <div className="flex items-center gap-3 justify-self-start">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-[hsl(var(--signal-accent))]/15 text-[hsl(var(--signal-accent))]" aria-hidden="true"><Radio className="h-4 w-4" /></div>
            <div>
              <div className="text-sm font-semibold tracking-tight">SIGNAL · Prioritization Ops</div>
              <div className="signal-mono text-[hsl(var(--signal-text-dim))]">Cross-SBU control tower · live</div>
            </div>
          </div>
          <div className="justify-self-center">
            <RoleSwitcher tone={tone} />
          </div>
          <div className="flex items-center gap-2 justify-self-end">
            <ThemeToggle tone={tone} />
            <ResetButton tone={tone} />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-screen-2xl px-5 py-5">
        {role === "requestor" && <SignalSubmit />}
        {role === "reviewer" && <SignalReview />}
        {role === "stakeholder" && <SignalVisibility />}
      </main>
    </motion.div>
  );
}

/* -------- SUBMIT -------- */
function SignalSubmit() {
  const f = useSubmitForm();
  return (
    <div className="grid grid-cols-12 gap-4">
      <section className="col-span-12 lg:col-span-8 signal-surface rounded-lg p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="signal-mono mb-1 text-[hsl(var(--signal-accent))]">// new intake</div>
            <h1 className="text-xl font-semibold">New ADO request</h1>
          </div>
          <ImportDialog tone="dark" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SRow label="SBU"><select className="signal-input" value={f.form.sbu} onChange={(e) => f.setForm({ ...f.form, sbu: e.target.value as SBU })}>{SBUS.map((s) => <option key={s}>{s}</option>)}</select></SRow>
          <SRow label="Type"><select className="signal-input" value={f.form.work_item_type} onChange={(e) => f.setForm({ ...f.form, work_item_type: e.target.value as never })}>{WORK_ITEM_TYPES.map((s) => <option key={s}>{s}</option>)}</select></SRow>
          <SRow label="Title" full error={f.errors.title}><input className="signal-input" value={f.form.title} onChange={(e) => f.setForm({ ...f.form, title: e.target.value })} placeholder="≤120 chars" /></SRow>
          <SRow label="Requested by" error={f.errors.requested_by}><input className="signal-input" value={f.form.requested_by} onChange={(e) => f.setForm({ ...f.form, requested_by: e.target.value })} placeholder="alias" /></SRow>
          <SRow label="Classification"><select className="signal-input" value={f.form.classification} onChange={(e) => f.setForm({ ...f.form, classification: e.target.value as never })}>{CLASSIFICATIONS.map((s) => <option key={s}>{s}</option>)}</select></SRow>
          <SRow label="Description" full error={f.errors.description}><textarea className="signal-input min-h-[80px]" value={f.form.description} onChange={(e) => f.setForm({ ...f.form, description: e.target.value })} /></SRow>
          <SRow label="Justification" full error={f.errors.justification}><textarea className="signal-input min-h-[100px]" value={f.form.justification} onChange={(e) => f.setForm({ ...f.form, justification: e.target.value })} /></SRow>
          <SRow label="Target timeline"><select className="signal-input" value={f.form.target_timeline} onChange={(e) => f.setForm({ ...f.form, target_timeline: e.target.value as Timeline })}>{TIMELINES.map((s) => <option key={s}>{s}</option>)}</select></SRow>
          <SRow label="Estimated days" error={f.errors.estimated_days}>
            <div className="flex items-center gap-2">
              <input
                type="number" min={1} max={365}
                className="signal-input"
                value={f.form.estimated_days ?? ""}
                onChange={(e) => f.setForm({ ...f.form, estimated_days: e.target.value === "" ? null : Number(e.target.value) })}
                placeholder="—"
              />
              {f.aiSuggestedDays != null && f.form.estimated_days !== f.aiSuggestedDays && (
                <button type="button" onClick={f.acceptAiDays} className="signal-mono whitespace-nowrap rounded border border-[hsl(var(--signal-accent))]/50 bg-[hsl(var(--signal-accent))]/10 px-2 py-1 text-[10px] text-[hsl(var(--signal-accent))]">
                  AI: {f.aiSuggestedDays}d ✓
                </button>
              )}
            </div>
          </SRow>
        </div>
        <div className="mt-5 flex items-center gap-3">
          <button disabled={!f.canSubmit} onClick={f.submit} className="inline-flex items-center gap-2 rounded bg-[hsl(var(--signal-accent))] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-black disabled:opacity-30">
            {f.isSubmitting && <Loader2 className="h-3 w-3 animate-spin" />} Push to backlog
          </button>
          <span className="signal-mono text-[hsl(var(--signal-text-dim))]">
            {Object.keys(f.errors).length === 0 ? "✓ valid intake" : `${Object.keys(f.errors).length} errors`}
          </span>
        </div>
      </section>
      <aside className="col-span-12 lg:col-span-4 signal-surface rounded-lg p-5">
        <div className="signal-mono mb-3 text-[hsl(var(--signal-accent))] flex items-center gap-2"><Zap className="h-3 w-3" /> AI coach</div>
        {!f.coach && !f.coaching && <p className="text-xs text-[hsl(var(--signal-text-dim))]">Streaming intake will be analyzed live for missing strategic signals.</p>}
        {f.coaching && <div className="flex items-center gap-2 text-xs"><Loader2 className="h-3 w-3 animate-spin" /> analyzing…</div>}
        {f.coach && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className={`signal-pulse !inline-block`} />
              <span className="signal-mono">strength: <span className="text-[hsl(var(--signal-accent))]">{f.coach.strength}</span></span>
            </div>
            {f.coach.missing.length > 0 && (
              <div>
                <div className="signal-mono text-[hsl(var(--signal-text-dim))] mb-1">missing</div>
                <div className="flex flex-wrap gap-1">
                  {f.coach.missing.map((m) => <span key={m} className="signal-mono rounded border border-[hsl(var(--signal-warn))]/40 bg-[hsl(var(--signal-warn))]/10 px-1.5 py-0.5 text-[hsl(var(--signal-warn))]">{m}</span>)}
                </div>
              </div>
            )}
            <p className="text-xs leading-relaxed text-[hsl(var(--signal-text-dim))]">{f.coach.suggestion}</p>
          </div>
        )}
      </aside>
    </div>
  );
}
function SRow({ label, full, error, children }: { label: string; full?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <label className={`block ${full ? "col-span-2" : ""}`}>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="signal-mono text-[hsl(var(--signal-text-dim))]">{label}</span>
        {error && <span className="signal-mono text-[hsl(var(--destructive))]">{error}</span>}
      </div>
      {children}
    </label>
  );
}

/* -------- REVIEW (board) -------- */
const STAGES: { key: Status; label: string }[] = [
  { key: "scored", label: "Scored" },
  { key: "in_review", label: "In Review" },
  { key: "handed_off", label: "Handed Off" },
  { key: "deferred", label: "Deferred" },
];

function SignalReview() {
  const { data, isLoading } = useRequests();
  useAutoScore(data, true);
  const update = useUpdateStatus();
  const updateReq = useUpdateRequest();
  const [selected, setSelected] = useState<RequestWithScore | null>(null);
  const [explainState, setExplainState] = useState<{ loading: boolean; text: string } | null>(null);
  const [sbuFilter, setSbuFilter] = useState<Set<SBU>>(new Set());
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState<{
    title: string; sbu: SBU; work_item_type: WorkItemType; classification: Classification;
    target_timeline: Timeline; requested_by: string; description: string; justification: string;
    estimated_days: number | null;
  } | null>(null);
  const { toast } = useToast();

  const filtered = useMemo(() => {
    if (sbuFilter.size === 0) return data ?? [];
    return (data ?? []).filter((r) => sbuFilter.has(r.sbu));
  }, [data, sbuFilter]);

  const grouped = useMemo(() => {
    const g: Record<Status, RequestWithScore[]> = { submitted: [], scored: [], in_review: [], approved: [], handed_off: [], deferred: [] };
    filtered.forEach((r) => g[r.status].push(r));
    Object.values(g).forEach((arr) => arr.sort((a, b) => (b.score?.total ?? -1) - (a.score?.total ?? -1)));
    return g;
  }, [filtered]);

  const sbuCounts = useMemo(() => {
    const c: Record<SBU, number> = { MSS: 0, SCIM: 0, "A&I": 0, TPC: 0 };
    (data ?? []).forEach((r) => { c[r.sbu]++; });
    return c;
  }, [data]);

  const statusCounts = useMemo(() => {
    const c: Record<Status, number> = { submitted: 0, scored: 0, in_review: 0, approved: 0, handed_off: 0, deferred: 0 };
    (data ?? []).forEach((r) => { c[r.status]++; });
    return c;
  }, [data]);

  const capacityUsed = useMemo(() => {
    return (data ?? [])
      .filter((r) => r.status === "in_review" || r.status === "approved" || r.status === "handed_off")
      .reduce((sum, r) => sum + (r.estimated_days ?? 0), 0);
  }, [data]);
  const capacityPct = Math.min((capacityUsed / CAPACITY_DAYS_BUDGET) * 100, 100);
  const capacityWarn = capacityPct > 80;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      setSelected(null);
      setExplainState(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Sync edit draft when selection changes
  useEffect(() => {
    if (selected) {
      setDraft({
        title: selected.title, sbu: selected.sbu, work_item_type: selected.work_item_type,
        classification: selected.classification, target_timeline: selected.target_timeline,
        requested_by: selected.requested_by, description: selected.description,
        justification: selected.justification, estimated_days: selected.estimated_days,
      });
    } else {
      setDraft(null);
    }
    setEditMode(false);
  }, [selected?.id]);

  const handleSaveEdit = async () => {
    if (!selected || !draft) return;
    const oldTotal = selected.score?.total ?? null;
    try {
      const result = await updateReq.mutateAsync({ id: selected.id, updates: draft, rescore: true });
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

  const advance = async (r: RequestWithScore, direction: 1 | -1) => {
    const order: Status[] = ["submitted", "scored", "in_review", "approved", "handed_off"];
    const i = order.indexOf(r.status);
    const next = order[Math.min(Math.max(i + direction, 0), order.length - 1)];
    if (next === r.status) return;
    await update.mutateAsync({ id: r.id, status: next });
    if (next === "approved") {
      await update.mutateAsync({ id: r.id, status: "handed_off" });
      toast({ title: "Approved → SXG", description: `Auto-created ADO for "${r.title.slice(0, 40)}"` });
    }
  };

  const handleExplain = async (r: RequestWithScore) => {
    const sameStage = grouped[r.status];
    const idx = sameStage.findIndex((x) => x.id === r.id);
    const next = sameStage[idx + 1];
    if (!next || !r.score || !next.score) { setExplainState({ loading: false, text: "No comparable next item." }); return; }
    setExplainState({ loading: true, text: "" });
    try { setExplainState({ loading: false, text: await explainRanking(r, next) }); }
    catch { setExplainState({ loading: false, text: "Could not generate explanation." }); }
  };

  const toggleSbu = (s: SBU) => {
    const n = new Set(sbuFilter);
    n.has(s) ? n.delete(s) : n.add(s);
    setSbuFilter(n);
  };

  return (
    <div className="grid grid-cols-12 gap-4">
      <section className="col-span-12 lg:col-span-9">
        <div className="mb-3 grid grid-cols-4 gap-2" role="group" aria-label="Filter by SBU">
          {SBUS.map((s) => {
            const active = sbuFilter.has(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleSbu(s)}
                aria-pressed={active}
                className={`signal-surface rounded p-2.5 flex items-center gap-2 transition-colors text-left ${active ? "!border-[hsl(var(--signal-accent))] !bg-[hsl(var(--signal-accent))]/10" : "hover:border-[hsl(var(--signal-accent))]/40"}`}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: `hsl(${SBU_CSS[s]})` }} aria-hidden="true" />
                <span className={`signal-mono ${active ? "text-[hsl(var(--signal-accent))]" : "text-[hsl(var(--signal-text-dim))]"}`}>{s}</span>
                <span className={`ml-auto text-sm font-semibold tabular-nums ${active ? "text-[hsl(var(--signal-accent))]" : ""}`}>{sbuCounts[s]}</span>
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-4 gap-2 min-h-[60vh]">
          {STAGES.map((stage) => {
            const items = grouped[stage.key];
            const effortTotal = items.reduce((sum, r) => sum + (r.estimated_days ?? 0), 0);
            return (
            <div key={stage.key} className="signal-surface rounded p-2 flex flex-col">
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="signal-mono text-[hsl(var(--signal-text-dim))]">{stage.label}</span>
                <span className="signal-mono">
                  <span className="text-[hsl(var(--signal-accent))]">{items.length}</span>
                  <span className="text-[hsl(var(--signal-text-dim))]/70 tabular-nums"> · {effortTotal}d</span>
                </span>
              </div>
              <div className="flex-1 space-y-1.5 overflow-y-auto max-h-[65vh] pr-0.5">
                {isLoading && <div className="text-xs text-[hsl(var(--signal-text-dim))]">…</div>}
                {grouped[stage.key].slice(0, 30).map((r) => {
                  const isActive = selected?.id === r.id;
                  return (
                  <div
                    key={r.id}
                    onClick={() => {
                      if (isActive) { setSelected(null); setExplainState(null); }
                      else { setSelected(r); setExplainState(null); }
                    }}
                    className={`signal-surface-2 cursor-pointer rounded p-2 transition-colors ${isActive ? "!border-[hsl(var(--signal-accent))]" : "hover:border-[hsl(var(--signal-accent))]/60"}`}
                  >
                    <div className="mb-1 flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: `hsl(${SBU_CSS[r.sbu]})` }} />
                      <span className="signal-mono text-[hsl(var(--signal-text-dim))]">{r.sbu}</span>
                      {!r.score && stage.key === "submitted" && <span className="signal-pulse signal-mono text-[hsl(var(--signal-accent))] ml-auto">scoring</span>}
                      {r.score && <span className="ml-auto signal-mono font-semibold text-[hsl(var(--signal-accent))]">{r.score.total}</span>}
                      <span className="signal-mono text-[hsl(var(--signal-text-dim))]/70 tabular-nums">· {r.estimated_days != null ? `${r.estimated_days}d` : "—"}</span>
                    </div>
                    <div className="text-[12px] leading-snug">{r.title}</div>
                    {r.score && (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <ConfidenceDot conf={r.score.confidence} />
                        <span className="signal-mono text-[hsl(var(--signal-text-dim))]">{r.score.confidence}</span>
                      </div>
                    )}
                  </div>
                  );
                })}
                {grouped[stage.key].length === 0 && <div className="signal-mono text-center text-[hsl(var(--signal-text-dim))]/60 py-4">empty</div>}
              </div>
            </div>
            );
          })}
        </div>
      </section>

      <aside className="col-span-12 lg:col-span-3 space-y-2">
        <div className="signal-surface rounded-lg p-4">
          <div className="signal-mono text-[hsl(var(--signal-text-dim))] mb-2 flex items-center gap-2">
            <AlertTriangle className="h-3 w-3 text-[hsl(var(--signal-warn))]" /> backlog health
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px]">
            <Stat label="submitted" v={statusCounts.submitted} />
            <Stat label="awaiting review" v={statusCounts.scored} />
            <Stat label="in flight" v={statusCounts.in_review + statusCounts.approved} />
            <Stat label="handed off" v={statusCounts.handed_off} accent />
          </div>
          <motion.div
            key={`signal-cap-${statusCounts.handed_off}`}
            initial={{ boxShadow: "0 0 0 0 hsl(var(--signal-accent) / 0.5)" }}
            animate={{ boxShadow: ["0 0 0 0 hsl(var(--signal-accent) / 0.5)", "0 0 0 6px hsl(var(--signal-accent) / 0)"] }}
            transition={{ duration: 0.7 }}
            className="mt-3 rounded"
          >
            <div className="flex items-center justify-between text-[11px]">
              <span className="signal-mono text-[hsl(var(--signal-text-dim))]">capacity</span>
              <span className={`signal-mono font-semibold ${capacityWarn ? "text-[hsl(var(--signal-warn))]" : "text-[hsl(var(--signal-accent))]"}`}>
                {capacityUsed}d / {CAPACITY_DAYS_BUDGET}d
              </span>
            </div>
            <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-[hsl(var(--signal-border))]" role="progressbar" aria-valuenow={Math.round(capacityPct)} aria-valuemin={0} aria-valuemax={100}>
              <div className={`h-full transition-all ${capacityWarn ? "bg-[hsl(var(--signal-warn))]" : "bg-[hsl(var(--signal-accent))]"}`} style={{ width: `${capacityPct}%` }} />
            </div>
          </motion.div>
        </div>
        {selected ? (
          <div className="signal-surface rounded-lg p-4 relative">
            <button
              onClick={() => { setSelected(null); setExplainState(null); }}
              aria-label="Close details"
              className="absolute right-2 top-2 rounded p-1 text-[hsl(var(--signal-text-dim))] hover:text-[hsl(var(--signal-text))]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            {!editMode && (
              <button
                onClick={() => setEditMode(true)}
                className="absolute right-9 top-2 signal-mono rounded border border-[hsl(var(--signal-border))] px-1.5 py-0.5 text-[10px] uppercase text-[hsl(var(--signal-text-dim))] hover:text-[hsl(var(--signal-accent))] hover:border-[hsl(var(--signal-accent))]"
              >edit</button>
            )}
            {!editMode && (<>
            <div className="mb-2 flex items-center gap-2 pr-20">
              <span className="h-2 w-2 rounded-full" style={{ background: `hsl(${SBU_CSS[selected.sbu]})` }} />
              <span className="signal-mono text-[hsl(var(--signal-text-dim))]">{selected.sbu} · {selected.classification}</span>
            </div>
            <h3 className="text-sm font-semibold mb-3">{selected.title}</h3>
            {selected.score && (
              <div className="mb-3 rounded bg-[hsl(var(--signal-surface-2))] p-3">
                <div className="flex items-baseline justify-between">
                  <span className="signal-mono text-[hsl(var(--signal-text-dim))]">total</span>
                  <span className="text-2xl font-bold tabular-nums text-[hsl(var(--signal-accent))]">{selected.score.total}</span>
                </div>
                <div className="mt-2 grid grid-cols-5 gap-1 text-center">
                  {(["impact","cost_avoidance","scale","strategic_alignment","feasibility"] as const).map((k) => (
                    <div key={k}>
                      <div className="signal-mono text-[8px] text-[hsl(var(--signal-text-dim))]">{k.slice(0,3)}</div>
                      <div className="signal-mono font-semibold">{selected.score![k]}</div>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-[hsl(var(--signal-text-dim))]">{selected.score.rationale}</p>
              </div>
            )}
            <div className="space-y-2 text-[12px]">
              <div><div className="signal-mono text-[hsl(var(--signal-text-dim))]">justification</div><p>{selected.justification}</p></div>
              <div><div className="signal-mono text-[hsl(var(--signal-text-dim))]">requested_by</div><p>{selected.requested_by}</p></div>
              <div><div className="signal-mono text-[hsl(var(--signal-text-dim))]">effort</div><p className="tabular-nums">{selected.estimated_days != null ? `${selected.estimated_days}d` : "—"}</p></div>
              {selected.ado_id && <div><div className="signal-mono text-[hsl(var(--signal-text-dim))]">ado_id</div><p className="text-[hsl(var(--signal-accent))]">{selected.ado_id}</p></div>}
              {selected.sxg_ado_id && <div><div className="signal-mono text-[hsl(var(--signal-text-dim))]">sxg_ado</div><p className="text-[hsl(var(--signal-accent))]">{selected.sxg_ado_id} <ArrowUpRight className="inline h-3 w-3" /></p></div>}
            </div>
            {explainState && (
              <div className="mt-3 rounded bg-[hsl(var(--signal-surface-2))] p-2 text-[11px]">
                {explainState.loading ? <Loader2 className="h-3 w-3 animate-spin" /> : explainState.text}
              </div>
            )}
            <div className="mt-4 grid grid-cols-2 gap-1.5">
              <button onClick={() => advance(selected, -1)} className="rounded border border-[hsl(var(--signal-border))] py-1.5 signal-mono text-[hsl(var(--signal-text-dim))] hover:text-[hsl(var(--signal-text))]">← back</button>
              <button onClick={() => advance(selected, 1)} className="rounded bg-[hsl(var(--signal-accent))] py-1.5 signal-mono font-bold text-black">{selected.status === "in_review" ? "approve →" : "advance →"}</button>
              {selected.status !== "deferred" && selected.status !== "approved" && (
                <button
                  onClick={async () => {
                    await update.mutateAsync({ id: selected.id, status: "deferred" });
                    toast({ title: "Deferred", description: selected.title.slice(0, 60) });
                    setSelected(null);
                    setExplainState(null);
                  }}
                  className="col-span-2 rounded border border-[hsl(var(--signal-warn))]/40 py-1.5 signal-mono text-[hsl(var(--signal-warn))] hover:bg-[hsl(var(--signal-warn))]/10"
                >defer</button>
              )}
              <button onClick={() => handleExplain(selected)} className="col-span-2 rounded border border-[hsl(var(--signal-border))] py-1.5 signal-mono text-[hsl(var(--signal-text-dim))]">explain rank</button>
            </div>
            </>)}

            {editMode && draft && (
              <div className="space-y-2 pr-6">
                <div className="signal-mono text-[hsl(var(--signal-text-dim))] mb-1">editing</div>
                <SEditField label="title"><input className="signal-input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></SEditField>
                <div className="grid grid-cols-2 gap-2">
                  <SEditField label="sbu"><select className="signal-input" value={draft.sbu} onChange={(e) => setDraft({ ...draft, sbu: e.target.value as SBU })}>{SBUS.map((s) => <option key={s}>{s}</option>)}</select></SEditField>
                  <SEditField label="type"><select className="signal-input" value={draft.work_item_type} onChange={(e) => setDraft({ ...draft, work_item_type: e.target.value as WorkItemType })}>{WORK_ITEM_TYPES.map((s) => <option key={s}>{s}</option>)}</select></SEditField>
                  <SEditField label="classification"><select className="signal-input" value={draft.classification} onChange={(e) => setDraft({ ...draft, classification: e.target.value as Classification })}>{CLASSIFICATIONS.map((s) => <option key={s}>{s}</option>)}</select></SEditField>
                  <SEditField label="timeline"><select className="signal-input" value={draft.target_timeline} onChange={(e) => setDraft({ ...draft, target_timeline: e.target.value as Timeline })}>{TIMELINES.map((s) => <option key={s}>{s}</option>)}</select></SEditField>
                  <SEditField label="requested_by"><input className="signal-input" value={draft.requested_by} onChange={(e) => setDraft({ ...draft, requested_by: e.target.value })} /></SEditField>
                  <SEditField label="effort (days)"><input type="number" min={1} max={365} className="signal-input" value={draft.estimated_days ?? ""} onChange={(e) => setDraft({ ...draft, estimated_days: e.target.value === "" ? null : Number(e.target.value) })} /></SEditField>
                </div>
                <SEditField label="description"><textarea className="signal-input min-h-[140px]" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></SEditField>
                <SEditField label="justification"><textarea className="signal-input min-h-[180px]" value={draft.justification} onChange={(e) => setDraft({ ...draft, justification: e.target.value })} /></SEditField>
                <div className="mt-3 grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => {
                      setEditMode(false);
                      if (selected) setDraft({
                        title: selected.title, sbu: selected.sbu, work_item_type: selected.work_item_type,
                        classification: selected.classification, target_timeline: selected.target_timeline,
                        requested_by: selected.requested_by, description: selected.description,
                        justification: selected.justification, estimated_days: selected.estimated_days,
                      });
                    }}
                    className="rounded border border-[hsl(var(--signal-border))] py-1.5 signal-mono text-[hsl(var(--signal-text-dim))] hover:text-[hsl(var(--signal-text))]"
                  >cancel</button>
                  <button
                    disabled={updateReq.isPending}
                    onClick={handleSaveEdit}
                    className="rounded bg-[hsl(var(--signal-accent))] py-1.5 signal-mono font-bold text-black inline-flex items-center justify-center gap-1 disabled:opacity-60"
                  >
                    {updateReq.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                    save & re-score
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="signal-surface rounded-lg p-4 text-xs text-[hsl(var(--signal-text-dim))]">
            <Layers className="h-4 w-4 mb-2 text-[hsl(var(--signal-accent))]" />
            Select a card to inspect signals, AI rationale, and advance through the pipeline. Press Esc to clear.
          </div>
        )}
      </aside>
    </div>
  );
}

function SEditField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="signal-mono mb-1 text-[hsl(var(--signal-text-dim))] text-[10px] uppercase">{label}</div>
      {children}
    </label>
  );
}

function ConfidenceDot({ conf }: { conf: "high" | "medium" | "low" }) {
  const c = conf === "high" ? "var(--signal-accent)" : conf === "medium" ? "var(--signal-warn)" : "var(--destructive)";
  return <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: `hsl(${c})` }} />;
}
function Stat({ label, v, accent }: { label: string; v: number; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="signal-mono text-[hsl(var(--signal-text-dim))]">{label}</span>
      <span className={`signal-mono font-semibold ${accent ? "text-[hsl(var(--signal-accent))]" : ""}`}>{v}</span>
    </div>
  );
}

/* -------- VISIBILITY -------- */
const FILTERABLE: Status[] = ["in_review", "approved", "handed_off", "deferred"];
type SortKey = "newest" | "score" | "sbu" | "status";

function SignalVisibility() {
  const { data } = useRequests();
  const { toast } = useToast();
  const [activeFilters, setActiveFilters] = useState<Set<Status>>(new Set());
  const [sort, setSort] = useState<SortKey>("newest");
  const [open, setOpen] = useState<RequestWithScore | null>(null);

  const counts = useMemo(() => {
    const c: Record<Status, number> = { submitted: 0, scored: 0, in_review: 0, approved: 0, handed_off: 0, deferred: 0 };
    (data ?? []).forEach((r) => { c[r.status]++; });
    return c;
  }, [data]);

  const capacityUsed = useMemo(() => {
    return (data ?? [])
      .filter((r) => r.status === "in_review" || r.status === "approved" || r.status === "handed_off")
      .reduce((sum, r) => sum + (r.estimated_days ?? 0), 0);
  }, [data]);
  const capacityPct = Math.min((capacityUsed / CAPACITY_DAYS_BUDGET) * 100, 100);
  const capacityWarn = capacityPct > 80;

  const feed = useMemo(() => {
    let rows = [...(data ?? [])];
    if (activeFilters.size > 0) rows = rows.filter((r) => activeFilters.has(r.status));
    rows.sort((a, b) => {
      if (sort === "score") return (b.score?.total ?? -1) - (a.score?.total ?? -1);
      if (sort === "sbu") return a.sbu.localeCompare(b.sbu);
      if (sort === "status") return a.status.localeCompare(b.status);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return rows.slice(0, 24);
  }, [data, activeFilters, sort]);

  const toggleFilter = (s: Status) => {
    const next = new Set(activeFilters);
    next.has(s) ? next.delete(s) : next.add(s);
    setActiveFilters(next);
  };

  return (
    <div className="space-y-4">
      {/* Instruction + backlog health (above the data cards) */}
      <div className="grid grid-cols-12 gap-3">
        <div className="signal-surface col-span-12 lg:col-span-7 rounded-lg p-4 flex items-center gap-3 text-xs text-[hsl(var(--signal-text-dim))]">
          <Layers className="h-4 w-4 text-[hsl(var(--signal-accent))] shrink-0" aria-hidden="true" />
          Select a card to inspect signals, AI rationale, and advance through the pipeline.
        </div>
        <div className="signal-surface col-span-12 lg:col-span-5 rounded-lg p-4">
          <div className="signal-mono text-[hsl(var(--signal-text-dim))] mb-2 flex items-center gap-2">
            <AlertTriangle className="h-3 w-3 text-[hsl(var(--signal-warn))]" /> backlog health
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px]">
            <Stat label="submitted" v={counts.submitted} />
            <Stat label="awaiting review" v={counts.scored} />
            <Stat label="in flight" v={counts.in_review + counts.approved} />
            <Stat label="handed off" v={counts.handed_off} accent />
          </div>
          <div className="mt-3">
            <div className="flex items-center justify-between text-[11px]">
              <span className="signal-mono text-[hsl(var(--signal-text-dim))]">capacity</span>
              <span className={`signal-mono font-semibold ${capacityWarn ? "text-[hsl(var(--signal-warn))]" : "text-[hsl(var(--signal-accent))]"}`}>
                {capacityUsed}d / {CAPACITY_DAYS_BUDGET}d
              </span>
            </div>
            <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-[hsl(var(--signal-border))]" role="progressbar" aria-valuenow={Math.round(capacityPct)} aria-valuemin={0} aria-valuemax={100}>
              <div
                className={`h-full transition-all ${capacityWarn ? "bg-[hsl(var(--signal-warn))]" : "bg-[hsl(var(--signal-accent))]"}`}
                style={{ width: `${capacityPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-6 gap-2">
        {STATUSES.map((s) => {
          const isFilterable = FILTERABLE.includes(s);
          const active = activeFilters.has(s);
          return (
            <button
              key={s}
              onClick={() => isFilterable && toggleFilter(s)}
              disabled={!isFilterable}
              className={`signal-surface rounded p-3 text-left transition-colors ${
                isFilterable ? "cursor-pointer hover:border-[hsl(var(--signal-accent))]/40" : "cursor-default opacity-70"
              } ${active ? "!border-[hsl(var(--signal-accent))] !bg-[hsl(var(--signal-accent))]/10" : ""}`}
            >
              <div className="signal-mono text-[hsl(var(--signal-text-dim))]">{STATUS_LABEL[s]}</div>
              <div className={`text-2xl font-bold tabular-nums mt-1 ${active ? "text-[hsl(var(--signal-accent))]" : ""}`}>{counts[s]}</div>
              {isFilterable && <div className="signal-mono mt-1 text-[9px] text-[hsl(var(--signal-text-dim))]/60">{active ? "click to clear" : "click to filter"}</div>}
            </button>
          );
        })}
      </div>

      <div className="signal-surface rounded-lg p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="signal-mono text-[hsl(var(--signal-accent))] flex items-center gap-2"><Activity className="h-3 w-3" aria-hidden="true" /> live feed
            <ReportButton tone="dark" />
            <button
              onClick={() => toast({ title: "Published to ADO", description: `${(data ?? []).length} item${(data ?? []).length === 1 ? "" : "s"} queued for sync.` })}
              className="signal-mono inline-flex items-center gap-1 rounded border border-[hsl(var(--signal-border))] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[hsl(var(--signal-text-dim))] hover:text-[hsl(var(--signal-accent))] hover:border-[hsl(var(--signal-accent))]"
            >
              <Send className="h-3 w-3" /> publish to ado
            </button>
          </div>
          <div className="flex items-center gap-3">
            {activeFilters.size > 0 && (
              <button onClick={() => setActiveFilters(new Set())} className="signal-mono text-[hsl(var(--signal-text-dim))] hover:text-[hsl(var(--signal-text))]">
                clear filters ({activeFilters.size})
              </button>
            )}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="signal-input !w-auto"
            >
              <option value="newest">newest</option>
              <option value="score">highest score</option>
              <option value="sbu">by SBU</option>
              <option value="status">by status</option>
            </select>
          </div>
        </div>
        {/* Column headers — establishes the vertical score column */}
        <div className="mb-2 flex items-center gap-3 px-1 pb-2 border-b border-[hsl(var(--signal-border))] signal-mono text-[10px] text-[hsl(var(--signal-text-dim))]/70 uppercase">
          <span className="w-1.5" aria-hidden="true" />
          <span className="w-12">SBU</span>
          <span className="flex-1">Title</span>
          <span className="w-14 text-right border-l border-[hsl(var(--signal-border))] pl-3">Score</span>
          <span className="w-12 text-right">Effort</span>
          <span className="w-24 text-right">Status</span>
          <span className="w-4" aria-hidden="true" />
        </div>
        <ul className="divide-y divide-[hsl(var(--signal-border))]">
          {feed.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setOpen(r)}
                className="flex w-full items-center gap-3 py-2.5 text-sm text-left hover:bg-[hsl(var(--signal-surface-2))]/40 px-1 rounded transition-colors"
              >
                <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: `hsl(${SBU_CSS[r.sbu]})` }} />
                <span className="signal-mono text-[hsl(var(--signal-text-dim))] w-12">{r.sbu}</span>
                <span className="flex-1 truncate">{r.title}</span>
                <span className="signal-mono font-semibold tabular-nums w-14 text-right border-l border-[hsl(var(--signal-border))] pl-3 text-[hsl(var(--signal-accent))]">{r.score?.total ?? "··"}</span>
                <span className="signal-mono text-[hsl(var(--signal-text-dim))] w-12 text-right tabular-nums">{r.estimated_days != null ? `${r.estimated_days}d` : "—"}</span>
                <span className="signal-mono text-[hsl(var(--signal-text-dim))] w-24 text-right">{STATUS_LABEL[r.status]}</span>
                {r.sxg_ado_id ? <Check className="h-3.5 w-3.5 text-[hsl(var(--signal-accent))]" /> : <span className="w-3.5" aria-hidden="true" />}
              </button>
            </li>
          ))}
          {feed.length === 0 && <li className="py-6 text-center signal-mono text-[hsl(var(--signal-text-dim))]/60">no items match active filters</li>}
        </ul>
      </div>

      {open && (
        <SidePanel tone="signal" onClose={() => setOpen(null)}>
          <div className="signal-mono mb-1 text-[hsl(var(--signal-text-dim))] py-[24px]">{open.sbu} · {open.classification}</div>
          <h2 className="text-xl font-semibold mb-3">{open.title}</h2>
          <div className="signal-mono text-[hsl(var(--signal-text-dim))] mb-4">status: <span className="text-[hsl(var(--signal-accent))]">{STATUS_LABEL[open.status]}</span></div>
          {open.score && (
            <div className="mb-5 rounded bg-[hsl(var(--signal-surface-2))] p-4">
              <div className="flex items-baseline justify-between">
                <span className="signal-mono text-[hsl(var(--signal-text-dim))]">total</span>
                <span className="text-3xl font-bold tabular-nums text-[hsl(var(--signal-accent))]">{open.score.total}<span className="text-sm text-[hsl(var(--signal-text-dim))]">/89</span></span>
              </div>
              <div className="mt-3 grid grid-cols-5 gap-1 text-center">
                {(["impact","cost_avoidance","scale","strategic_alignment","feasibility"] as const).map((k) => (
                  <div key={k}>
                    <div className="signal-mono text-[9px] text-[hsl(var(--signal-text-dim))]">{k.slice(0,3)}</div>
                    <div className="signal-mono font-semibold">{open.score![k]}</div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[12px] leading-relaxed text-[hsl(var(--signal-text-dim))]">{open.score.rationale}</p>
            </div>
          )}
          <div className="space-y-3 text-sm">
            <div><div className="signal-mono text-[hsl(var(--signal-text-dim))] mb-1">justification</div><p>{open.justification}</p></div>
            <div><div className="signal-mono text-[hsl(var(--signal-text-dim))] mb-1">description</div><p className="text-[hsl(var(--signal-text-dim))]">{open.description}</p></div>
            <div><div className="signal-mono text-[hsl(var(--signal-text-dim))] mb-1">requested_by</div><p>{open.requested_by}</p></div>
            <div><div className="signal-mono text-[hsl(var(--signal-text-dim))] mb-1">target timeline</div><p>{open.target_timeline}</p></div>
            {open.estimated_days != null && <div><div className="signal-mono text-[hsl(var(--signal-text-dim))] mb-1">estimated days</div><p>{open.estimated_days}d</p></div>}
            {open.ado_id && <div><div className="signal-mono text-[hsl(var(--signal-text-dim))] mb-1">ado_id</div><p className="text-[hsl(var(--signal-accent))]">{open.ado_id}</p></div>}
            {open.sxg_ado_id && <div><div className="signal-mono text-[hsl(var(--signal-text-dim))] mb-1">sxg_ado</div><p className="text-[hsl(var(--signal-accent))]">{open.sxg_ado_id}</p></div>}
          </div>
          <div className="mt-5">
            <button
              disabled={!!open.sxg_ado_id}
              onClick={() => toast({ title: "Sent to ADO", description: open.title.slice(0, 60) })}
              className="signal-mono inline-flex w-full items-center justify-center gap-2 rounded border border-[hsl(var(--signal-border))] py-2 text-[11px] uppercase tracking-wider text-[hsl(var(--signal-text-dim))] hover:text-[hsl(var(--signal-accent))] hover:border-[hsl(var(--signal-accent))] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="h-3 w-3" /> {open.sxg_ado_id ? "in ado" : "send to ado"}
            </button>
          </div>
        </SidePanel>
      )}
    </div>
  );
}
