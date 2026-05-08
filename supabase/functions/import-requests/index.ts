// Imports work items from Azure DevOps (live fetch) or from a file (AI extraction).
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SBUS = ["MSS", "SCIM", "A&I", "ACT", "TPC"];
const WORK_ITEM_TYPES = ["Feature", "Bug", "User Story", "Task", "Epic"];
const CLASSIFICATIONS = [
  "Automation — Enhancement",
  "Automation — New",
  "Bug Fix",
  "Data / Reporting",
  "Infrastructure",
  "Process Improvement",
  "Tooling",
];
const TIMELINES = [
  "FY27 Semester 1 — Sprint 1",
  "FY27 Semester 1 — Sprint 2",
  "FY27 Semester 1 — Sprint 3",
  "FY27 Semester 2",
  "Backlog",
];

const ADO_API_VERSION = "7.1";

// ---------- ADO live-fetch helpers ----------

type AdoField = Record<string, unknown>;

async function fetchAdoQuery(
  org: string,
  project: string,
  queryId: string,
  pat: string
): Promise<number[]> {
  const auth = "Basic " + btoa(":" + pat);
  const url = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}/_apis/wit/wiql/${queryId}?api-version=${ADO_API_VERSION}`;
  const res = await fetch(url, { headers: { Authorization: auth } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ADO query failed (${res.status}): ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  return (data.workItems ?? []).map((wi: { id: number }) => wi.id);
}

async function fetchAdoWorkItems(
  org: string,
  project: string,
  ids: number[],
  pat: string
): Promise<Array<{ id: number; fields: AdoField; url: string }>> {
  if (ids.length === 0) return [];
  const auth = "Basic " + btoa(":" + pat);
  // ADO allows max 200 IDs per request
  const chunks: number[][] = [];
  for (let i = 0; i < ids.length; i += 200) chunks.push(ids.slice(i, i + 200));

  const all: Array<{ id: number; fields: AdoField; url: string }> = [];
  for (const chunk of chunks) {
    const url = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}/_apis/wit/workitems?ids=${chunk.join(",")}&$expand=all&api-version=${ADO_API_VERSION}`;
    const res = await fetch(url, { headers: { Authorization: auth } });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`ADO work items fetch failed (${res.status}): ${body.slice(0, 300)}`);
    }
    const data = await res.json();
    all.push(...(data.value ?? []));
  }
  return all;
}

function mapAdoWorkItemType(adoType: string): string {
  const lower = adoType.toLowerCase();
  if (lower.includes("bug")) return "Bug";
  if (lower.includes("epic")) return "Epic";
  if (lower.includes("task")) return "Task";
  if (lower.includes("user story") || lower.includes("story")) return "User Story";
  return "Feature";
}

function mapAdoToRequest(
  wi: { id: number; fields: AdoField; url: string },
  sbu: string
) {
  const f = wi.fields;
  const title = String(f["System.Title"] ?? `Work Item ${wi.id}`);
  // Strip HTML tags from description
  const rawDesc = String(f["System.Description"] ?? "");
  const description = rawDesc.replace(/<[^>]*>/g, "").trim() || title;
  const workItemType = mapAdoWorkItemType(String(f["System.WorkItemType"] ?? "Feature"));
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
    work_item_type: workItemType,
    classification: "Tooling" as string,
    target_timeline: "Backlog" as string,
    requested_by: requestedBy || "imported",
    source_ref: wi.url,
    ado_id: `ADO-${wi.id}`,
  };
}

// ---------- AI extraction tool (for file/URL fallback) ----------

const tool = {
  type: "function",
  function: {
    name: "extract_requests",
    description: "Extract one or more technical-debt prioritization requests from imported content.",
    parameters: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              justification: { type: "string" },
              sbu: { type: "string", enum: SBUS },
              work_item_type: { type: "string", enum: WORK_ITEM_TYPES },
              classification: { type: "string", enum: CLASSIFICATIONS },
              target_timeline: { type: "string", enum: TIMELINES },
              requested_by: { type: "string" },
            },
            required: ["title", "description", "justification", "sbu", "work_item_type", "classification", "target_timeline", "requested_by"],
            additionalProperties: false,
          },
        },
      },
      required: ["items"],
      additionalProperties: false,
    },
  },
};

// ---------- Main handler ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const { url, filename, content, ado_org, ado_project, ado_query_id, ado_pat, sbu } = body;

    // ---------- Mode 1: Live ADO fetch ----------
    if (ado_org && ado_project && ado_query_id && ado_pat) {
      const ids = await fetchAdoQuery(ado_org, ado_project, ado_query_id, ado_pat);
      if (ids.length === 0) {
        return new Response(JSON.stringify({ items: [], count: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const workItems = await fetchAdoWorkItems(ado_org, ado_project, ids, ado_pat);
      const items = workItems.map((wi) => mapAdoToRequest(wi, sbu || "MSS"));
      return new Response(JSON.stringify({ items, count: items.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---------- Mode 2: AI inference from URL or file ----------
    if (!url && !content) {
      return new Response(JSON.stringify({ error: "Provide ado_pat + ado_org + ado_project + ado_query_id for live fetch, or url/content for AI extraction." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ctx = url
      ? `Azure DevOps reference URL: ${url}\n(No live API access — infer plausible content from the URL path/IDs/keywords.)`
      : `Filename: ${filename ?? "(unnamed)"}\nContents:\n${String(content).slice(0, 8000)}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You convert imported work items into structured prioritization requests. If the source describes multiple distinct items, return multiple. If only one, return one. Write justifications that include impact metrics, scope, and a strategic angle when possible.",
          },
          { role: "user", content: ctx },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "extract_requests" } },
      }),
    });

    if (res.status === 429 || res.status === 402) {
      return new Response(JSON.stringify({ error: res.status === 402 ? "credits_exhausted" : "rate_limited" }), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) {
      return new Response(JSON.stringify({ items: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const parsed = JSON.parse(args);
    const adoMatch = url ? url.match(/(?:edit\/|id=)(\d+)/i) : null;
    const adoFromUrl = adoMatch ? `ADO-${adoMatch[1]}` : null;
    const items = (parsed.items ?? []).map((it: Record<string, unknown>) => ({
      ...it,
      source_ref: url || filename || null,
      ado_id: adoFromUrl ?? `ADO-${Math.floor(100000 + Math.random() * 899999)}`,
    }));

    return new Response(JSON.stringify({ items }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
