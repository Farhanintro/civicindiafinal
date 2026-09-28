"use client";

// CivicLens — admin incident drawer: full detail + authority workflow
// (verify / reject / assign / start / evidence upload / resolve / reopen).

import { useCallback, useEffect, useRef, useState } from "react";
import { useCivicLens } from "@/store/civiclens";
import { fetchIncident, incidentAction, uploadEvidence, compressImage, ApiError } from "@/lib/civiclens/api";
import type { IncidentDetail } from "@/lib/civiclens/types";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  CategoryIcon,
  DemoBadge,
  HazardChip,
  PriorityBadge,
  SeverityBadge,
  StatusBadge,
  categoryLabel,
} from "../badges";
import { Photo } from "../photo";
import { formatDateTime, locationLine, timeAgo } from "@/lib/civiclens/format";
import { useToast } from "@/hooks/use-toast";
import {
  BadgeCheck,
  Ban,
  Camera,
  CheckCircle2,
  ChevronDown,
  Clock,
  ImagePlus,
  Loader2,
  Route,
  Sparkles,
  Upload,
  Users,
  Wrench,
  XCircle,
} from "lucide-react";

export function IncidentDrawer({
  publicId,
  open,
  onOpenChange,
}: {
  publicId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { categories, departments } = useCivicLens();
  const { toast } = useToast();
  const [incident, setIncident] = useState<IncidentDetail | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // workflow forms
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignDept, setAssignDept] = useState<string>("");
  const [assignTeam, setAssignTeam] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveNote, setResolveNote] = useState("");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidenceNote, setEvidenceNote] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!publicId) return;
    try {
      const data = await fetchIncident(publicId);
      setIncident(data.incident);
      setAssignDept(data.incident.departmentKey ?? "");
    } catch {
      setIncident(null);
    }
  }, [publicId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const runAction = useCallback(
    async (label: string, fn: () => Promise<void>) => {
      setBusy(label);
      try {
        await fn();
        await load();
      } catch (err) {
        toast({
          title: `${label} failed`,
          description: err instanceof ApiError ? err.message : "Please try again.",
          variant: "destructive",
        });
      } finally {
        setBusy(null);
      }
    },
    [load, toast]
  );

  const verify = () =>
    runAction("Verification", () =>
      incidentAction(publicId!, { action: "verify", note: "Verified from command center with AI analysis." }).then(() => undefined)
    );

  const reject = () =>
    runAction("Rejection", async () => {
      await incidentAction(publicId!, { action: "reject", note: rejectNote || "Rejected after review." });
      setRejectOpen(false);
      setRejectNote("");
    });

  const assign = () =>
    runAction("Assignment", async () => {
      if (!assignDept) throw new Error("Choose a department first.");
      await incidentAction(publicId!, {
        action: "assign",
        departmentKey: assignDept,
        team: assignTeam || undefined,
        assignedToName: assignTeam || undefined,
        note: assignTeam ? `Assigned to ${assignTeam}` : undefined,
      });
      setAssignOpen(false);
    });

  const start = () =>
    runAction("Start", () => incidentAction(publicId!, { action: "start" }).then(() => undefined));

  const resolve = () =>
    runAction("Resolution", async () => {
      await incidentAction(publicId!, { action: "resolve", resolutionNote: resolveNote || undefined });
      setResolveOpen(false);
      setResolveNote("");
    });

  const reopen = () =>
    runAction("Reopen", () => incidentAction(publicId!, { action: "reopen", note: "Reopened — issue reappeared." }).then(() => undefined));

  const uploadAfterPhoto = () =>
    runAction("Evidence upload", async () => {
      if (!evidenceFile) throw new Error("Attach an after photo first.");
      const compressed = await compressImage(evidenceFile);
      await uploadEvidence(publicId!, compressed, evidenceNote || undefined);
      setEvidenceFile(null);
      setEvidenceNote("");
      if (fileRef.current) fileRef.current.value = "";
    });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="cl-scroll w-full overflow-y-auto sm:max-w-xl">
        {incident === null ? (
          <>
            <SheetHeader className="sr-only">
              <SheetTitle>Loading incident</SheetTitle>
              <SheetDescription>Fetching incident details</SheetDescription>
            </SheetHeader>
            <div className="space-y-4 pt-8">
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          </>
        ) : (
          <>
            <SheetHeader className="space-y-1 pb-0">
              <div className="flex flex-wrap items-center gap-2">
                <SheetTitle className="font-mono">{incident.publicId}</SheetTitle>
                {incident.isDemo ? <DemoBadge /> : null}
              </div>
              <SheetDescription className="text-left">
                {incident.title ?? categoryLabel(incident.categoryKey, categories)} · {locationLine(incident)}
              </SheetDescription>
              <div className="flex flex-wrap gap-2 pt-1">
                <PriorityBadge priority={incident.priority} />
                <StatusBadge status={incident.status} />
                <SeverityBadge severity={incident.severity} />
              </div>
            </SheetHeader>

            <div className="space-y-5 px-4 pb-10">
              {/* workflow actions */}
              <div className="rounded-xl border bg-muted/30 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Authority actions
                </p>
                <div className="flex flex-wrap gap-2">
                  {incident.status === "REPORTED" ? (
                    <>
                      <Button size="sm" disabled={busy !== null} onClick={verify}>
                        {busy === "Verification" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <BadgeCheck className="mr-1 h-3.5 w-3.5" />}
                        Verify
                      </Button>
                      <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => setRejectOpen(true)}>
                        <XCircle className="mr-1 h-3.5 w-3.5" /> Reject
                      </Button>
                    </>
                  ) : null}
                  {incident.status === "VERIFIED" ? (
                    <>
                      <Button size="sm" disabled={busy !== null} onClick={() => setAssignOpen(true)}>
                        <Route className="mr-1 h-3.5 w-3.5" /> Assign department…
                      </Button>
                      <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => setRejectOpen(true)}>
                        <XCircle className="mr-1 h-3.5 w-3.5" /> Reject
                      </Button>
                    </>
                  ) : null}
                  {incident.status === "ASSIGNED" ? (
                    <Button size="sm" disabled={busy !== null} onClick={start}>
                      {busy === "Start" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Wrench className="mr-1 h-3.5 w-3.5" />}
                      Start work
                    </Button>
                  ) : null}
                  {incident.status === "IN_PROGRESS" ? (
                    <>
                      <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => fileRef.current?.click()}>
                        <Upload className="mr-1 h-3.5 w-3.5" /> After photo
                      </Button>
                      <Button size="sm" disabled={busy !== null} onClick={() => setResolveOpen(true)}>
                        {busy === "Resolution" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1 h-3.5 w-3.5" />}
                        Resolve
                      </Button>
                    </>
                  ) : null}
                  {incident.status === "RESOLVED" ? (
                    <Button size="sm" variant="outline" disabled={busy !== null} onClick={reopen}>
                      <Ban className="mr-1 h-3.5 w-3.5" /> Reopen (issue reappeared)
                    </Button>
                  ) : null}
                  {incident.status === "REJECTED" ? (
                    <p className="text-xs text-muted-foreground">
                      Rejected — no further actions available.
                      {incident.resolutionNote ? ` Note: ${incident.resolutionNote}` : ""}
                    </p>
                  ) : null}
                </div>

                {/* assign form */}
                {assignOpen ? (
                  <div className="mt-3 space-y-2.5 rounded-lg border bg-background p-3">
                    <div>
                      <Label className="mb-1 block text-xs">Department</Label>
                      <Select value={assignDept} onValueChange={setAssignDept}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Choose department" />
                        </SelectTrigger>
                        <SelectContent>
                          {departments.map((d) => (
                            <SelectItem key={d.key} value={d.key}>
                              {d.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="mb-1 block text-xs" htmlFor="cl-team">Team / officer (optional)</Label>
                      <Input id="cl-team" className="h-9" value={assignTeam} onChange={(e) => setAssignTeam(e.target.value)} placeholder="e.g. Road Repair Crew A-2" />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" disabled={busy !== null || !assignDept} onClick={assign}>
                        {busy === "Assignment" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                        Confirm assignment
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setAssignOpen(false)}>Cancel</Button>
                    </div>
                  </div>
                ) : null}

                {/* reject form */}
                {rejectOpen ? (
                  <div className="mt-3 space-y-2.5 rounded-lg border bg-background p-3">
                    <Label className="block text-xs" htmlFor="cl-reject-note">Reason for rejection</Label>
                    <Textarea
                      id="cl-reject-note"
                      rows={2}
                      value={rejectNote}
                      onChange={(e) => setRejectNote(e.target.value)}
                      placeholder="e.g. Duplicate of INC-1017 in the same stretch."
                    />
                    <div className="flex gap-2">
                      <Button size="sm" variant="destructive" disabled={busy !== null} onClick={reject}>
                        {busy === "Rejection" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                        Reject report
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setRejectOpen(false)}>Cancel</Button>
                    </div>
                  </div>
                ) : null}

                {/* resolve form */}
                {resolveOpen ? (
                  <div className="mt-3 space-y-2.5 rounded-lg border bg-background p-3">
                    <Label className="block text-xs" htmlFor="cl-resolve-note">Resolution note</Label>
                    <Textarea
                      id="cl-resolve-note"
                      rows={2}
                      value={resolveNote}
                      onChange={(e) => setResolveNote(e.target.value)}
                      placeholder="e.g. Pothole filled with hot-mix asphalt; site cleared."
                    />
                    {incident.resolutionEvidences.length === 0 ? (
                      <p className="text-xs text-amber-600">
                        ⚠ An after photo is required before resolving. Use “After photo” to attach evidence.
                      </p>
                    ) : (
                      <p className="text-xs text-emerald-600">
                        ✓ {incident.resolutionEvidences.length} evidence photo(s) attached.
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Button size="sm" disabled={busy !== null || incident.resolutionEvidences.length === 0} onClick={resolve}>
                        {busy === "Resolution" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                        Mark resolved
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setResolveOpen(false)}>Cancel</Button>
                    </div>
                  </div>
                ) : null}

                {/* evidence upload */}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  aria-label="After photo"
                  onChange={(e) => setEvidenceFile(e.target.files?.[0] ?? null)}
                />
                {evidenceFile ? (
                  <div className="mt-3 space-y-2.5 rounded-lg border bg-background p-3">
                    <div className="flex items-center gap-2">
                      <ImagePlus className="h-4 w-4 text-primary" />
                      <p className="text-xs font-medium">{evidenceFile.name}</p>
                    </div>
                    <Textarea
                      rows={2}
                      value={evidenceNote}
                      onChange={(e) => setEvidenceNote(e.target.value)}
                      placeholder="Note (optional) — what action was taken?"
                      aria-label="Evidence note"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" disabled={busy !== null} onClick={uploadAfterPhoto}>
                        {busy === "Evidence upload" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1 h-3.5 w-3.5" />}
                        Upload evidence
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setEvidenceFile(null); if (fileRef.current) fileRef.current.value = ""; }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* meta */}
              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                {[
                  { label: "Category", value: categoryLabel(incident.categoryKey, categories) },
                  { label: "Department", value: incident.departmentName ?? "—" },
                  { label: "Reports", value: String(incident.reportCount) },
                  { label: "AI confidence", value: incident.aiConfidence != null ? `${Math.round(incident.aiConfidence * 100)}%` : "—" },
                ].map((m) => (
                  <div key={m.label} className="rounded-lg bg-muted/50 p-2.5">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{m.label}</p>
                    <p className="mt-0.5 truncate text-xs font-semibold">{m.value}</p>
                  </div>
                ))}
              </div>

              {/* priority reasons */}
              <div className="rounded-xl border p-3">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
                  <Sparkles className="h-3.5 w-3.5 text-primary" /> Priority {incident.priority} · score {incident.priorityScore}/100
                </p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {incident.priorityReasons.map((r, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" /> {r}
                    </li>
                  ))}
                </ul>
              </div>

              {/* evidence photos (before/after) */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Evidence · {incident.reportCount} citizen report{incident.reportCount > 1 ? "s" : ""}
                </p>
                <div className="cl-scroll flex gap-2 overflow-x-auto pb-1">
                  {incident.reports.map((r) =>
                    r.imagePath ? (
                      <div key={r.id} className="w-40 shrink-0">
                        <div className="aspect-video overflow-hidden rounded-lg border">
                          <Photo src={r.imagePath} alt={`Citizen evidence ${r.publicId}`} width={160} height={90} className="h-full w-full object-cover" />
                        </div>
                        <p className="mt-1 truncate text-[10px] text-muted-foreground">
                          {r.publicId} · {timeAgo(r.submissionTimestamp)}
                          {r.reporterName ? ` · ${r.reporterName}` : ""}
                        </p>
                      </div>
                    ) : null
                  )}
                  {incident.resolutionEvidences.map((e) => (
                    <div key={e.id} className="w-40 shrink-0">
                      <div className="relative aspect-video overflow-hidden rounded-lg border-2 border-emerald-400">
                        <Photo src={e.imagePath} alt="Resolution evidence" width={160} height={90} className="h-full w-full object-cover" />
                        <span className="absolute left-1 top-1 rounded bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
                          AFTER
                        </span>
                      </div>
                      <p className="mt-1 truncate text-[10px] text-muted-foreground">
                        {e.note ?? "Resolution evidence"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI analysis */}
              {(() => {
                const a = incident.reports.find((r) => r.analysis)?.analysis;
                if (!a) return null;
                return (
                  <div className="rounded-xl border p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="flex items-center gap-1.5 text-xs font-semibold">
                        <Sparkles className="h-3.5 w-3.5 text-primary" /> AI analysis (stored · one call per report)
                      </p>
                      {a.source === "DEMO_PRECOMPUTED" ? <DemoBadge className="text-[9px]" /> : null}
                    </div>
                    <p className="text-xs leading-relaxed">{a.description}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {a.hazards.map((h) => (
                        <HazardChip key={h} hazard={h} />
                      ))}
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {a.severity} · confidence {Math.round(a.confidence * 100)}% · recommends: {a.recommendedAction} · model {a.model}
                    </p>
                  </div>
                );
              })()}

              <Separator />

              {/* assignments */}
              {incident.assignments.length > 0 ? (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Assignments</p>
                  <ul className="space-y-1.5 text-xs">
                    {incident.assignments.map((a) => (
                      <li key={a.id} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                        <span>
                          <span className="font-semibold">{a.departmentName}</span>
                          {a.team ? ` · ${a.team}` : ""}
                        </span>
                        <span className="text-muted-foreground">{timeAgo(a.createdAt)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {/* timeline */}
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" /> Status history
                </p>
                <ol className="relative space-y-3 border-l pl-4">
                  {incident.statusHistory.map((h) => (
                    <li key={h.id} className="relative text-xs">
                      <span className="absolute -left-[21px] h-2.5 w-2.5 rounded-full border-2 border-background bg-primary" aria-hidden />
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={h.toStatus} />
                        <span className="text-muted-foreground">{formatDateTime(h.createdAt)}</span>
                      </div>
                      {h.note ? <p className="mt-1 text-muted-foreground">{h.note}</p> : null}
                    </li>
                  ))}
                </ol>
              </div>

              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Users className="h-3 w-3" /> Citizen identities are visible to authorities for verification only.
                <ChevronDown className="ml-auto h-3 w-3" />
              </p>
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Camera className="h-3 w-3" /> Created {formatDateTime(incident.createdAt)} · updated {timeAgo(incident.updatedAt)}
              </p>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
