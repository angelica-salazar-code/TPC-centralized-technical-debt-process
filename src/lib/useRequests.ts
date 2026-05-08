import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { RequestRow, RequestWithScore, ScoreRow, Status } from "./domain";
import { useEffect, useRef } from "react";

const REQUESTS_KEY = ["requests"];

async function ensureSeeded() {
  try {
    const { count } = await supabase.from("requests").select("*", { count: "exact", head: true });
    if ((count ?? 0) >= 5) return;
    // seed-backlog is optional demo data — don't block if it fails
    const { error } = await supabase.functions.invoke("seed-backlog", { body: {} });
    if (error) console.warn("seed-backlog skipped:", error.message);
  } catch {
    // Edge function may not be deployed — silently ignore
  }
}

export function useRequests() {
  return useQuery({
    queryKey: REQUESTS_KEY,
    queryFn: async (): Promise<RequestWithScore[]> => {
      await ensureSeeded();
      const { data: reqs, error } = await supabase
        .from("requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const { data: scores } = await supabase.from("request_scores").select("*");
      const byId = new Map((scores ?? []).map((s) => [s.request_id, s as ScoreRow]));
      return (reqs as RequestRow[]).map((r) => ({ ...r, score: byId.get(r.id) ?? null }));
    },
    staleTime: 10_000,
  });
}

// Auto-score any submitted items in the background, one at a time, persisting results.
export function useAutoScore(items: RequestWithScore[] | undefined, enabled: boolean) {
  const qc = useQueryClient();
  const running = useRef(false);
  useEffect(() => {
    if (!enabled || !items || running.current) return;
    const pending = items.filter((i) => !i.score);
    if (pending.length === 0) return;
    running.current = true;
    (async () => {
      for (const item of pending.slice(0, 25)) {
        try {
          const { data, error } = await supabase.functions.invoke("score-request", {
            body: { request: item },
          });
          if (error || !data?.score) continue;
          const s = data.score;
          await supabase.from("request_scores").upsert({
            request_id: item.id,
            impact: s.impact,
            cost_avoidance: s.cost_avoidance,
            scale: s.scale,
            strategic_alignment: s.strategic_alignment,
            feasibility: s.feasibility,
            total: s.total,
            confidence: s.confidence,
            rationale: s.rationale,
          }, { onConflict: "request_id" });
          const randomDays = Math.floor(Math.random() * 10) + 1; // 1–10 days
          await supabase.from("requests").update({ status: "scored", target_timeline: "Backlog", estimated_days: randomDays }).eq("id", item.id).eq("status", "submitted");
          await supabase.from("audit_events").insert({ request_id: item.id, event_type: "scored", payload: { total: s.total, confidence: s.confidence } });
          qc.invalidateQueries({ queryKey: REQUESTS_KEY });
        } catch (e) {
          console.error("score failed", e);
        }
      }
      running.current = false;
    })();
  }, [items, enabled, qc]);
}

type CreateInput = Omit<RequestRow, "id" | "status" | "sxg_ado_id" | "created_at" | "updated_at" | "source_ref" | "manual_rank" | "reviewer_rating" | "ado_id" | "estimated_days"> & {
  source_ref?: string | null;
  ado_id?: string | null;
  estimated_days?: number | null;
};

import { generateAdoId } from "./domain";

export function useCreateRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateInput) => {
      const payload = { ...input, ado_id: input.ado_id ?? generateAdoId() };
      const { data, error } = await supabase.from("requests").insert(payload).select().single();
      if (error) throw error;
      await supabase.from("audit_events").insert({ request_id: data.id, event_type: "submitted", payload: { sbu: input.sbu } });
      return data as RequestRow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: REQUESTS_KEY }),
  });
}

export function useSetManualRank() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      // Update each row with its index as manual_rank
      await Promise.all(orderedIds.map((id, i) =>
        supabase.from("requests").update({ manual_rank: i }).eq("id", id)
      ));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: REQUESTS_KEY }),
  });
}

export function useResetManualRank() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await supabase.from("requests").update({ manual_rank: null }).not("id", "is", null);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: REQUESTS_KEY }),
  });
}

export function useSetReviewerRating() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, rating }: { id: string; rating: number | null }) => {
      await supabase.from("requests").update({ reviewer_rating: rating }).eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: REQUESTS_KEY }),
  });
}

export function useResetScenario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("reset-scenario", { body: {} });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: REQUESTS_KEY }),
  });
}

export async function importRequests(payload: { url?: string; filename?: string; content?: string }) {
  const { data, error } = await supabase.functions.invoke("import-requests", { body: payload });
  if (error) throw error;
  return data as { items: Array<CreateInput & { source_ref: string | null }> };
}

export async function importFromAdo(payload: {
  ado_org: string;
  ado_project: string;
  ado_query_id: string;
  ado_pat: string;
  sbu: string;
}) {
  const { data, error } = await supabase.functions.invoke("import-requests", { body: payload });
  if (error) throw error;
  return data as { items: Array<CreateInput & { source_ref: string | null; ado_id: string }>; count: number };
}

export async function buildReport(role: string) {
  const { data, error } = await supabase.functions.invoke("build-report", { body: { role } });
  if (error) throw error;
  return data;
}

export function useUpdateStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status: Status; note?: string }) => {
      const updates: Partial<RequestRow> = { status };
      if (status === "handed_off") {
        updates.sxg_ado_id = `SXG-${Math.floor(100000 + Math.random() * 899999)}`;
      }
      const { error } = await supabase.from("requests").update(updates).eq("id", id);
      if (error) throw error;
      await supabase.from("audit_events").insert({ request_id: id, event_type: status, payload: { note } });
      if (status === "approved" || status === "deferred") {
        await supabase.from("decisions").insert({ request_id: id, reviewer_alias: "demo-reviewer", outcome: status === "approved" ? "approved" : "deferred", notes: note ?? null });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: REQUESTS_KEY }),
  });
}

export type UpdateRequestInput = Partial<Pick<RequestRow, "title" | "sbu" | "work_item_type" | "classification" | "target_timeline" | "requested_by" | "description" | "justification" | "estimated_days">>;

export function useUpdateRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates, rescore }: { id: string; updates: UpdateRequestInput; rescore?: boolean }) => {
      const { data: updated, error } = await supabase.from("requests").update(updates).eq("id", id).select().single();
      if (error) throw error;
      let newScore: ScoreRow | null = null;
      if (rescore) {
        const { data: scoreResp, error: sErr } = await supabase.functions.invoke("score-request", { body: { request: updated } });
        if (!sErr && scoreResp?.score) {
          const s = scoreResp.score;
          const { data: persisted } = await supabase.from("request_scores").upsert({
            request_id: id,
            impact: s.impact,
            cost_avoidance: s.cost_avoidance,
            scale: s.scale,
            strategic_alignment: s.strategic_alignment,
            feasibility: s.feasibility,
            total: s.total,
            confidence: s.confidence,
            rationale: s.rationale,
          }, { onConflict: "request_id" }).select().single();
          newScore = (persisted as ScoreRow) ?? null;
          await supabase.from("audit_events").insert({ request_id: id, event_type: "rescored", payload: { total: s.total } });
        }
      }
      return { request: updated as RequestRow, score: newScore };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: REQUESTS_KEY }),
  });
}

export async function explainRanking(a: RequestWithScore, b: RequestWithScore): Promise<string> {
  const { data, error } = await supabase.functions.invoke("explain-ranking", { body: { a, b } });
  if (error) throw error;
  return data?.explanation ?? "";
}

export async function coachJustification(input: { title: string; description: string; justification: string }) {
  const { data, error } = await supabase.functions.invoke("coach-justification", { body: input });
  if (error) throw error;
  return data as { strength: "strong" | "adequate" | "weak"; missing: string[]; suggestion: string; estimated_days?: number };
}
