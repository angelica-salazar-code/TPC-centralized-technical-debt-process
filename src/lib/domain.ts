export const SBUS = ["MSS", "SCIM", "A&I", "ACT", "TPC"] as const;
export type SBU = (typeof SBUS)[number];

export const WORK_ITEM_TYPES = ["Feature", "Bug", "User Story", "Task", "Epic"] as const;
export type WorkItemType = (typeof WORK_ITEM_TYPES)[number];

export const CLASSIFICATIONS = [
  "Automation — Enhancement",
  "Automation — New",
  "Bug Fix",
  "Data / Reporting",
  "Infrastructure",
  "Process Improvement",
  "Tooling",
] as const;
export type Classification = (typeof CLASSIFICATIONS)[number];

export const TIMELINES = [
  "FY27 Semester 1 — Sprint 1",
  "FY27 Semester 1 — Sprint 2",
  "FY27 Semester 1 — Sprint 3",
  "FY27 Semester 2",
  "Backlog",
] as const;
export type Timeline = (typeof TIMELINES)[number];

// Canonical chronological order. Always use this for sorting/grouping by timeline.
export const TIMELINE_INDEX: Record<Timeline, number> = TIMELINES.reduce((acc, t, i) => {
  acc[t] = i;
  return acc;
}, {} as Record<Timeline, number>);
export function compareTimelines(a: Timeline, b: Timeline): number {
  return TIMELINE_INDEX[a] - TIMELINE_INDEX[b];
}
// The "current" timeline period — items approved for any later timeline drop below the cut line.
export const NEXT_TIMELINE: Timeline = "FY27 Semester 1 — Sprint 1";

export const STATUSES = [
  "submitted",
  "scored",
  "in_review",
  "approved",
  "handed_off",
  "deferred",
] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<Status, string> = {
  submitted: "Submitted",
  scored: "Scored",
  in_review: "In Review",
  approved: "Approved",
  handed_off: "Handed Off",
  deferred: "Deferred",
};

export const ROLES = ["requestor", "reviewer", "stakeholder"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  requestor: "Intake",
  reviewer: "Triage",
  stakeholder: "Review",
};

export const CAPACITY_CUT_LINE = 12;
export const CAPACITY_DAYS_BUDGET = 200;

export type ScoreBand = "high" | "medium" | "low";
export function scoreBand(total: number | null | undefined): ScoreBand | null {
  if (total == null) return null;
  if (total >= 67) return "high";
  if (total >= 40) return "medium";
  return "low";
}

export type RequestRow = {
  id: string;
  sbu: SBU;
  work_item_type: WorkItemType;
  title: string;
  requested_by: string;
  description: string;
  justification: string;
  classification: Classification;
  target_timeline: Timeline;
  status: Status;
  sxg_ado_id: string | null;
  source_ref: string | null;
  manual_rank: number | null;
  reviewer_rating: number | null;
  estimated_days: number | null;
  ado_id: string | null;
  created_at: string;
  updated_at: string;
};

export function generateAdoId(): string {
  return `ADO-${Math.floor(100000 + Math.random() * 899999)}`;
}

export type ScoreRow = {
  id: string;
  request_id: string;
  impact: number;
  cost_avoidance: number;
  scale: number;
  strategic_alignment: number;
  feasibility: number;
  total: number;
  confidence: "high" | "medium" | "low";
  rationale: string;
  generated_at: string;
};

export type RequestWithScore = RequestRow & { score: ScoreRow | null };

// Effective ranking score: manual rank (lower is higher) overrides AI total
export function rankingValue(r: RequestWithScore): number {
  if (r.manual_rank != null) return 100000 - r.manual_rank;
  return r.score?.total ?? -1;
}
