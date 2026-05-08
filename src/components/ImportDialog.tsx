import { useState, useEffect } from "react";
import { Upload, Link as LinkIcon, FileUp, Loader2, X, Database, Eye, KeyRound } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { importRequests } from "@/lib/useRequests";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { CLASSIFICATIONS, SBUS, TIMELINES, WORK_ITEM_TYPES, type Classification, type SBU, type Timeline, type WorkItemType } from "@/lib/domain";
import { ADO_SOURCES, getSavedPat, savePat, parseAdoQueryUrl, fetchAdoWorkItems } from "@/lib/ado";

type Draft = {
  title: string;
  description: string;
  justification: string;
  sbu: SBU;
  work_item_type: WorkItemType;
  classification: Classification;
  target_timeline: Timeline;
  requested_by: string;
  source_ref: string | null;
  ado_id: string | null;
};

export function ImportDialog({ tone = "light" }: { tone?: "light" | "dark" | "council" }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [filename, setFilename] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState<Draft[] | null>(null);

  // ADO preview state
  const [adoSbu, setAdoSbu] = useState<SBU>("MSS");
  const [adoPat, setAdoPat] = useState(() => getSavedPat());
  const [adoCustomUrl, setAdoCustomUrl] = useState("");
  const [showPat, setShowPat] = useState(false);

  const qc = useQueryClient();
  const { toast } = useToast();

  // Save PAT when it changes
  useEffect(() => { if (adoPat) savePat(adoPat); }, [adoPat]);

  const styles =
    tone === "dark"
      ? "bg-[hsl(var(--signal-accent))]/15 border border-[hsl(var(--signal-accent))]/40 text-[hsl(var(--signal-accent))] hover:bg-[hsl(var(--signal-accent))]/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--signal-accent))]"
      : tone === "council"
      ? "bg-[hsl(var(--council-gold))] text-[hsl(var(--council-ink))] hover:brightness-110 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--council-gold))]"
      : "border border-[hsl(var(--atlas-accent))] text-[hsl(var(--atlas-accent))] hover:bg-[hsl(var(--atlas-accent))]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--atlas-accent))]";

  const onFile = async (file: File) => {
    if (file.size > 1024 * 1024) {
      toast({ title: "File too large", description: "Max 1MB.", variant: "destructive" });
      return;
    }
    setFilename(file.name);
    const text = await file.text();
    setContent(text);
  };

  const runImport = async (mode: "url" | "file") => {
    setBusy(true);
    try {
      const payload = mode === "url" ? { url } : { filename, content };
      const res = await importRequests(payload);
      if (!res.items?.length) {
        toast({ title: "Nothing extracted", description: "The AI could not find any requests in the source.", variant: "destructive" });
      } else {
        setDrafts(res.items as Draft[]);
      }
    } catch (e) {
      toast({ title: "Import failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  // ADO live fetch
  const runAdoFetch = async () => {
    if (!adoPat.trim()) {
      toast({ title: "PAT required", description: "Enter your Azure DevOps Personal Access Token to fetch work items.", variant: "destructive" });
      return;
    }

    setBusy(true);
    try {
      // Resolve org/project/queryId from pre-configured source or custom URL
      const source = ADO_SOURCES[adoSbu];
      let org: string, project: string, queryId: string;

      if (adoCustomUrl.trim()) {
        const parsed = parseAdoQueryUrl(adoCustomUrl.trim());
        if (!parsed) {
          toast({ title: "Invalid URL", description: "Could not parse the ADO query URL. Paste a link like https://dev.azure.com/org/project/_queries/query/{id}", variant: "destructive" });
          setBusy(false);
          return;
        }
        org = parsed.org;
        project = parsed.project;
        queryId = parsed.queryId;
      } else if (source) {
        org = source.org;
        project = source.project;
        queryId = source.queryId;
      } else {
        toast({ title: "No source configured", description: `No ADO query is configured for ${adoSbu} yet. Paste a custom query URL instead.`, variant: "destructive" });
        setBusy(false);
        return;
      }

      const items = await fetchAdoWorkItems(org, project, queryId, adoPat, adoSbu);

      if (!items.length) {
        toast({ title: "No work items found", description: "The ADO query returned 0 results. Check that the query ID is valid and your PAT has read access." });
      } else {
        toast({ title: `Fetched ${items.length} work items`, description: `From ${org}/${project}` });
        setDrafts(items as Draft[]);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "AUTH_FAILED") {
        toast({ title: "Authentication failed", description: "Your PAT may be expired or lack permissions. Go to dev.azure.com → User Settings → PATs to create a new one with Work Items (Read) scope.", variant: "destructive" });
      } else if (msg === "QUERY_NOT_FOUND") {
        toast({ title: "Query not found", description: "The query ID was not found. Temp queries expire — try saving the query in ADO first, then paste the saved query URL.", variant: "destructive" });
      } else if (msg.startsWith("NETWORK_ERROR")) {
        toast({ title: "Network error", description: "Could not reach Azure DevOps. This can happen if your corporate network blocks API calls from the browser, or if there's a VPN/proxy issue. Try from a different network.", variant: "destructive" });
      } else {
        toast({ title: "ADO fetch failed", description: msg, variant: "destructive" });
      }
    } finally {
      setBusy(false);
    }
  };

  const submitAll = async () => {
    if (!drafts) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("requests").insert(drafts);
      if (error) throw error;
      toast({ title: `Imported ${drafts.length} item${drafts.length === 1 ? "" : "s"}`, description: "Background AI scoring will run when the reviewer view opens." });
      qc.invalidateQueries({ queryKey: ["requests"] });
      setOpen(false);
      setDrafts(null); setUrl(""); setFilename(""); setContent("");
    } catch (e) {
      toast({ title: "Bulk insert failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const configuredSbus = SBUS.filter((s) => s in ADO_SOURCES);
  const currentSource = ADO_SOURCES[adoSbu];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[12px] font-medium transition-colors ${styles}`}>
          <Upload className="h-3.5 w-3.5" /> Import
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import requests</DialogTitle>
        </DialogHeader>

        {!drafts && (
          <Tabs defaultValue="ado">
            <TabsList>
              <TabsTrigger value="ado"><Database className="mr-1.5 h-3.5 w-3.5" /> ADO Preview</TabsTrigger>
              <TabsTrigger value="url"><LinkIcon className="mr-1.5 h-3.5 w-3.5" /> From URL</TabsTrigger>
              <TabsTrigger value="file"><FileUp className="mr-1.5 h-3.5 w-3.5" /> From file</TabsTrigger>
            </TabsList>

            {/* -------- ADO Preview tab (live fetch) -------- */}
            <TabsContent value="ado" className="space-y-4 pt-3">
              <div className="rounded-md border bg-muted/40 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Eye className="h-4 w-4 text-blue-500" /> Live ADO Query Preview
                </div>
                <p className="text-xs text-muted-foreground">
                  Fetches real work items from Azure DevOps using your PAT. Select an SBU to use its pre-configured query, or paste a custom query URL.
                </p>
              </div>

              {/* SBU selector */}
              <div>
                <label className="block text-sm font-medium mb-1">SBU source</label>
                <div className="flex gap-2">
                  {SBUS.map((s) => {
                    const configured = s in ADO_SOURCES;
                    return (
                      <button
                        key={s}
                        onClick={() => { setAdoSbu(s as SBU); setAdoCustomUrl(""); }}
                        className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                          adoSbu === s
                            ? "border-blue-500 bg-blue-500/10 text-blue-600"
                            : configured
                            ? "border-border hover:bg-muted"
                            : "border-border text-muted-foreground opacity-50"
                        }`}
                      >
                        {s}
                        {configured && <span className="ml-1 text-green-500">●</span>}
                      </button>
                    );
                  })}
                </div>
                {currentSource && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    ✓ Connected: <span className="font-mono">{currentSource.org}/{currentSource.project}</span>
                  </p>
                )}
                {!currentSource && (
                  <p className="mt-1 text-xs text-amber-600">
                    ⚠ No query configured for {adoSbu} yet. Paste a custom URL below.
                  </p>
                )}
              </div>

              {/* Custom URL (optional override) */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Custom query URL <span className="text-muted-foreground font-normal">(optional — overrides SBU default)</span>
                </label>
                <input
                  value={adoCustomUrl}
                  onChange={(e) => setAdoCustomUrl(e.target.value)}
                  placeholder="https://dev.azure.com/org/project/_queries/query/{id}"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
              </div>

              {/* PAT input */}
              <div>
                <label className="flex items-center gap-1.5 text-sm font-medium mb-1">
                  <KeyRound className="h-3.5 w-3.5" /> Personal Access Token (PAT)
                </label>
                <div className="flex gap-2">
                  <input
                    type={showPat ? "text" : "password"}
                    value={adoPat}
                    onChange={(e) => setAdoPat(e.target.value)}
                    placeholder="Paste your ADO PAT here"
                    className="flex-1 rounded-md border bg-background px-3 py-2 text-sm font-mono"
                  />
                  <button
                    onClick={() => setShowPat(!showPat)}
                    className="rounded-md border px-3 py-2 text-xs hover:bg-muted"
                  >
                    {showPat ? "Hide" : "Show"}
                  </button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Needs <strong>Work Items (Read)</strong> scope. Create one at <span className="font-mono">dev.azure.com → User Settings → PATs</span>. Saved locally in your browser only.
                </p>
              </div>

              <button
                onClick={runAdoFetch}
                disabled={!adoPat || (!currentSource && !adoCustomUrl) || busy}
                className="inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-40"
              >
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {busy ? "Fetching from ADO…" : "Fetch & Preview"}
              </button>
            </TabsContent>

            {/* -------- URL tab (AI inference) -------- */}
            <TabsContent value="url" className="space-y-3 pt-3">
              <label className="block text-sm font-medium">ADO work item URL or query link</label>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://dev.azure.com/org/project/_workitems/edit/12345"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
              <p className="text-xs text-muted-foreground">
                AI will infer request fields from the URL keywords. For live ADO data, use the <strong>ADO Preview</strong> tab instead.
              </p>
              <button
                onClick={() => runImport("url")}
                disabled={!url || busy}
                className="inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-40"
              >
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Extract requests
              </button>
            </TabsContent>

            {/* -------- File tab -------- */}
            <TabsContent value="file" className="space-y-3 pt-3">
              <label className="block text-sm font-medium">Upload .csv, .json, .md, or .txt (≤1MB)</label>
              <input
                type="file"
                accept=".csv,.json,.md,.txt"
                onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
                className="block w-full text-sm"
              />
              {filename && <div className="text-xs text-muted-foreground">Loaded: <span className="font-mono">{filename}</span> ({content.length} chars)</div>}
              <button
                onClick={() => runImport("file")}
                disabled={!content || busy}
                className="inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-40"
              >
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Extract requests
              </button>
            </TabsContent>
          </Tabs>
        )}

        {/* -------- Drafts preview (shared by all import methods) -------- */}
        {drafts && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Review extracted ({drafts.length}). Edit any field, then submit.</div>
              <button onClick={() => setDrafts(null)} className="text-xs text-muted-foreground hover:text-foreground"><X className="inline h-3 w-3" /> Start over</button>
            </div>
            <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
              {drafts.map((d, i) => (
                <div key={i} className="rounded-md border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      className="flex-1 rounded border bg-background px-2 py-1 text-sm font-medium"
                      value={d.title}
                      onChange={(e) => setDrafts(drafts.map((x, j) => j === i ? { ...x, title: e.target.value } : x))}
                    />
                    {d.ado_id && (
                      <span className="shrink-0 rounded bg-blue-500/10 px-2 py-0.5 text-[10px] font-mono text-blue-600">
                        {d.ado_id}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <select value={d.sbu} onChange={(e) => setDrafts(drafts.map((x, j) => j === i ? { ...x, sbu: e.target.value as SBU } : x))} className="rounded border bg-background px-2 py-1">
                      {SBUS.map((s) => <option key={s}>{s}</option>)}
                    </select>
                    <select value={d.work_item_type} onChange={(e) => setDrafts(drafts.map((x, j) => j === i ? { ...x, work_item_type: e.target.value as WorkItemType } : x))} className="rounded border bg-background px-2 py-1">
                      {WORK_ITEM_TYPES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                    <select value={d.classification} onChange={(e) => setDrafts(drafts.map((x, j) => j === i ? { ...x, classification: e.target.value as Classification } : x))} className="rounded border bg-background px-2 py-1">
                      {CLASSIFICATIONS.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <textarea
                    className="w-full rounded border bg-background px-2 py-1 text-xs"
                    rows={2}
                    value={d.justification}
                    onChange={(e) => setDrafts(drafts.map((x, j) => j === i ? { ...x, justification: e.target.value } : x))}
                  />
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <select value={d.target_timeline} onChange={(e) => setDrafts(drafts.map((x, j) => j === i ? { ...x, target_timeline: e.target.value as Timeline } : x))} className="rounded border bg-background px-2 py-0.5">
                      {TIMELINES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                    <input
                      className="flex-1 rounded border bg-background px-2 py-0.5"
                      placeholder="requested by"
                      value={d.requested_by}
                      onChange={(e) => setDrafts(drafts.map((x, j) => j === i ? { ...x, requested_by: e.target.value } : x))}
                    />
                    {d.source_ref && <span className="truncate max-w-[200px]" title={d.source_ref}>↗ {d.source_ref}</span>}
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={submitAll}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-40"
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Submit {drafts.length} item{drafts.length === 1 ? "" : "s"}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
