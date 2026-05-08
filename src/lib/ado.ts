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
    queryId: "16192bfd-6a76-46fc-a027-6c676fe159d8",
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

// ---------- Client-side ADO REST API calls ----------

const ADO_API_VERSION = "7.1";

// Execute an ADO saved/temp query → returns work item IDs
async function fetchAdoQueryIds(org: string, project: string, queryId: string, pat: string): Promise<number[]> {
  const url = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}/_apis/wit/wiql/${queryId}?api-version=${ADO_API_VERSION}`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: adoAuthHeader(pat.trim()) },
      mode: "cors",
      credentials: "omit",
    });
  } catch (err) {
    // Network-level failure (DNS, proxy, SSL inspection, etc.)
    throw new Error(`NETWORK_ERROR: Could not reach dev.azure.com — ${err instanceof Error ? err.message : String(err)}`);
  }
  // ADO returns 203 + HTML sign-in page when PAT is invalid/missing (203 is "ok" but wrong)
  if (res.status === 203 || res.status === 401) throw new Error("AUTH_FAILED");
  if (res.status === 404) throw new Error("QUERY_NOT_FOUND");
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ADO query failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  return (data.workItems ?? []).map((wi: { id: number }) => wi.id);
}

// Fetch full work item details by IDs (max 200 per request)
async function fetchAdoWorkItemDetails(org: string, project: string, ids: number[], pat: string): Promise<AdoWorkItem[]> {
  if (ids.length === 0) return [];
  const all: AdoWorkItem[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const url = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}/_apis/wit/workitems?ids=${chunk.join(",")}&$expand=all&api-version=${ADO_API_VERSION}`;
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { Authorization: adoAuthHeader(pat.trim()) },
        mode: "cors",
        credentials: "omit",
      });
    } catch (err) {
      throw new Error(`NETWORK_ERROR: Could not fetch work items — ${err instanceof Error ? err.message : String(err)}`);
    }
    if (res.status === 203 || res.status === 401) throw new Error("AUTH_FAILED");
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`ADO work items fetch failed (${res.status}): ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    all.push(...(data.value ?? []));
  }
  return all;
}

function mapWorkItemType(adoType: string): string {
  const lower = adoType.toLowerCase();
  if (lower.includes("bug")) return "Bug";
  if (lower.includes("epic")) return "Epic";
  if (lower.includes("task")) return "Task";
  if (lower.includes("user story") || lower.includes("story")) return "User Story";
  return "Feature";
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

export type AdoDraft = {
  title: string;
  description: string;
  justification: string;
  sbu: string;
  work_item_type: string;
  classification: string;
  target_timeline: string;
  requested_by: string;
  source_ref: string | null;
  ado_id: string;
};

// Main entry point: fetch work items from ADO and map to draft requests
export async function fetchAdoWorkItems(
  org: string,
  project: string,
  queryId: string,
  pat: string,
  sbu: string
): Promise<AdoDraft[]> {
  const ids = await fetchAdoQueryIds(org, project, queryId, pat);
  if (ids.length === 0) return [];

  const workItems = await fetchAdoWorkItemDetails(org, project, ids, pat);
  return workItems.map((wi) => {
    const f = wi.fields;
    const title = String(f["System.Title"] ?? `Work Item ${wi.id}`);
    const rawDesc = String(f["System.Description"] ?? "");
    const description = stripHtml(rawDesc) || title;
    const assignedTo = f["System.AssignedTo"];
    const requestedBy =
      typeof assignedTo === "object" && assignedTo !== null
        ? String((assignedTo as { displayName?: string }).displayName ?? "")
        : String(assignedTo ?? "");

    return {
      title,
      description,
      justification: description,
      sbu,
      work_item_type: mapWorkItemType(String(f["System.WorkItemType"] ?? "Feature")),
      classification: "Tooling",
      target_timeline: "Backlog",
      requested_by: requestedBy || "imported",
      source_ref: `https://dev.azure.com/${org}/${project}/_workitems/edit/${wi.id}`,
      ado_id: `ADO-${wi.id}`,
    };
  });
}
