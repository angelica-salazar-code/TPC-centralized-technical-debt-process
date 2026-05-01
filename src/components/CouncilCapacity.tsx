import { motion } from "framer-motion";
import { CAPACITY_DAYS_BUDGET, TIMELINES, type RequestWithScore, type Timeline } from "@/lib/domain";

const SEGMENT_STATUSES = ["approved", "deferred"] as const;
type SegStatus = (typeof SEGMENT_STATUSES)[number];

const SEG_LABEL: Record<SegStatus, string> = {
  approved: "Approved",
  deferred: "Deferred",
};

const SEG_COLOR: Record<SegStatus, string> = {
  approved: "hsl(var(--council-gold))",
  deferred: "hsl(var(--council-text-dim) / 0.35)",
};

const BACKLOG: Timeline = "Backlog";
// Backlog has no cap; the remaining budget is split evenly across the other timelines.
const NON_BACKLOG_TIMELINES = TIMELINES.filter((t) => t !== BACKLOG);
const PER_TIMELINE_BUDGET = Math.round(CAPACITY_DAYS_BUDGET / NON_BACKLOG_TIMELINES.length);

function bucketFor(status: string): SegStatus | null {
  if (status === "approved" || status === "handed_off") return "approved";
  if (status === "deferred") return "deferred";
  return null;
}

export function CouncilCapacity({
  data,
  pulseKey,
}: {
  data: RequestWithScore[] | undefined;
  pulseKey?: string | number;
}) {
  // Build per-timeline + per-status totals. Every non-deferred request counts toward
  // its timeline's bar, segmented by the bucketed status.
  const totals: Record<Timeline, Record<SegStatus, number>> = TIMELINES.reduce((acc, t) => {
    acc[t] = { approved: 0, deferred: 0 };
    return acc;
  }, {} as Record<Timeline, Record<SegStatus, number>>);

  (data ?? []).forEach((r) => {
    const seg = bucketFor(r.status);
    if (!seg) return;
    const t = r.target_timeline as Timeline;
    if (!totals[t]) return;
    totals[t][seg] += r.estimated_days ?? 0;
  });

  return (
    <motion.div
      key={`council-cap-${pulseKey ?? "x"}`}
      initial={{ boxShadow: "0 0 0 0 hsl(var(--council-gold) / 0.45)" }}
      animate={{ boxShadow: ["0 0 0 0 hsl(var(--council-gold) / 0.45)", "0 0 0 8px hsl(var(--council-gold) / 0)"] }}
      transition={{ duration: 0.8 }}
      className="mb-4 rounded-sm border border-[hsl(var(--council-line))] bg-[hsl(var(--council-surface))] p-4"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-[11px] uppercase tracking-[0.25em] text-[hsl(var(--council-text-dim))]">
          Capacity by timeline
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] uppercase tracking-wider text-[hsl(var(--council-text-dim))]">
          {SEGMENT_STATUSES.map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm" style={{ background: SEG_COLOR[s] }} />
              {SEG_LABEL[s]}
            </span>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        {TIMELINES.map((t) => {
          const row = totals[t];
          const used = row.approved + row.deferred;
          const isBacklog = t === BACKLOG;
          const budget = isBacklog ? null : PER_TIMELINE_BUDGET;
          const over = !isBacklog && used > PER_TIMELINE_BUDGET;
          // Width denominator: Backlog (or over-capacity rows) normalize to actual usage so the bar fills.
          const denom = (isBacklog ? used : Math.max(PER_TIMELINE_BUDGET, used)) || 1;
          const pct = (n: number) => (n / denom) * 100;
          return (
            <div key={t} className="grid grid-cols-[160px_1fr_80px] items-center gap-3">
              <div
                className="text-[11px] leading-tight text-[hsl(var(--council-text-dim))] whitespace-normal break-words"
                title={t}
              >
                {t}
              </div>
              <div
                className="relative h-2 w-full overflow-hidden rounded-full bg-[hsl(var(--council-line))]"
                role="progressbar"
                aria-valuenow={isBacklog ? used : Math.min(used, PER_TIMELINE_BUDGET)}
                aria-valuemin={0}
                aria-valuemax={isBacklog ? Math.max(used, 1) : PER_TIMELINE_BUDGET}
                aria-label={`${t} capacity`}
              >
                {/* stacked segments */}
                <div className="absolute inset-0 flex">
                  {SEGMENT_STATUSES.map((s) => (
                    <div
                      key={s}
                      className="h-full"
                      style={{ width: `${pct(row[s])}%`, background: SEG_COLOR[s] }}
                      title={`${SEG_LABEL[s]}: ${row[s]}d`}
                    />
                  ))}
                </div>
              </div>
              <div className={`text-right text-[11px] tabular-nums ${over ? "text-[hsl(var(--destructive))]" : "text-[hsl(var(--council-text-dim))]"}`}>
                {used}d
                {budget != null && (
                  <span className="text-[hsl(var(--council-text-dim))]/60"> / {budget}d</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
