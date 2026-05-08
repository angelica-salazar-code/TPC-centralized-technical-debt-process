import type { SBU } from "./domain";

// Pre-configured ADO query sources, one per SBU.
// Only MSS is wired up for now; remaining SBUs will be added as queries are finalized.
export type AdoSource = {
  org: string;
  project: string;
  queryId: string;
  label: string;
};

export const ADO_SOURCES: Partial<Record<SBU, AdoSource>> = {
  MSS: {
    org: "MSSTAT",
    project: "MSSTAT Feature Planning",
    queryId: "80d45e77-043c-4e34-beb9-349bd72bc41e",
    label: "MSS Feature Planning",
  },
  // SCIM, A&I, ACT, TPC — add when their saved queries are ready
};

// Parse an ADO query URL into its components
export function parseAdoQueryUrl(url: string): { org: string; project: string; queryId: string } | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("dev.azure.com")) return null;

    // Path: /{org}/{project}/_queries/query/{queryId}  or  /_queries/query/?tempQueryId={id}
    const parts = u.pathname.split("/").filter(Boolean);
    const org = decodeURIComponent(parts[0] ?? "");
    const project = decodeURIComponent(parts[1] ?? "");
    if (!org || !project) return null;

    // Check for tempQueryId param first, then path-based query ID
    const tempId = u.searchParams.get("tempQueryId")?.replace(/\/+$/, "");
    if (tempId) return { org, project, queryId: tempId };

    const qIdx = parts.indexOf("query");
    const pathId = qIdx >= 0 ? parts[qIdx + 1] : undefined;
    if (pathId) return { org, project, queryId: pathId };

    return null;
  } catch {
    return null;
  }
}

// ADO work item shape (subset of fields we care about)
export type AdoWorkItem = {
  id: number;
  fields: Record<string, unknown>;
  url: string;
};

// Build the Basic auth header from a PAT
export function adoAuthHeader(pat: string): string {
  return "Basic " + btoa(":" + pat);
}

const PAT_STORAGE_KEY = "ado_pat";

export function getSavedPat(): string {
  try { return localStorage.getItem(PAT_STORAGE_KEY) ?? ""; } catch { return ""; }
}

export function savePat(pat: string) {
  try { localStorage.setItem(PAT_STORAGE_KEY, pat); } catch { /* noop */ }
}

export function clearPat() {
  try { localStorage.removeItem(PAT_STORAGE_KEY); } catch { /* noop */ }
}
