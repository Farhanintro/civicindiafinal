"use client";

// CivicLens — incident detail view (public/citizen): full lifecycle transparency —
// AI analysis, linked citizen reports, priority explanation, timeline, before/after evidence.

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useCivicLens } from "@/store/civiclens";
import { fetchIncident } from "@/lib/civiclens/api";
import type { IncidentDetail } from "@/lib/civiclens/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  CategoryIcon,
  DemoBadge,
  EmptyState,
  HazardChip,
  PriorityBadge,
  SeverityBadge,
  StatusBadge,
  categoryLabel,
} from "./badges";
import { Photo } from "./photo";
import { formatDateTime, locationLine, timeAgo } from "@/lib/civiclens/format";
import {
  ArrowLeft,
  ChevronDown,
  CircleAlert,
  Clock,
  FileQuestion,
  Layers,
  MapPin,
  Route,
  ShieldCheck,
  Sparkles,
  Users,
  Wrench,
} from "lucide-react";

const IncidentMap = dynamic(() => import("./map").then((m) => m.default), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

export function IncidentView({ publicId }: { publicId: string }) {
  const { setView, categories } = useCivicLens();
  const [incident, setIncident] = useState<IncidentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await fetchIncident(publicId);
      setIncident(data.incident);
    } catch {
      setError("Incident not found.");
    }
  }, [publicId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <EmptyState
          icon={FileQuestion}
          title={error}
          hint="It may have been removed or the link is incorrect."
          action={
            <Button size="sm" variant="outline" onClick={() => setView({ name: "explore" })}>
              Explore incidents
            </Button>
          }
        />
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  const primaryAnalysis = incident.reports.find((r) => r.analysis)?.analysis ?? null;
  const beforePhoto = incident.reports.find((r) => r.imagePath)?.imagePath ?? null;
  const afterPhoto = incident.resolutionEvidences[0]?.imagePath ?? null;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 pb-16">
      <Button variant="ghost" size="sm" onClick={() => setView({ name: "explore" })}>
        <ArrowLeft className="mr-1 h-4 w-4" /> Back to explore
      </Button>

      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-lg font-bold">{incident.publicId}</span>
            {incident.isDemo ? <DemoBadge /> : null}
          </div>
          <h1 className="mt-1 text-xl font-bold leading-tight sm:text-2xl">
            {incident.title ?? categoryLabel(incident.categoryKey, categories)}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> {locationLine(incident)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> reported {timeAgo(incident.createdAt)}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PriorityBadge priority={incident.priority} />
          <StatusBadge status={incident.status} />
          <SeverityBadge severity={incident.severity} />
        </div>
      </div>

      {/* meta grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Issue type", value: categoryLabel(incident.categoryKey, categories), icon: <CategoryIcon categoryKey={incident.categoryKey} className="mb-1.5 h-4 w-4 text-primary" />, key: "cat" },
          { label: "Routed department", value: incident.departmentName ?? "General Municipal", icon: <Route className="mb-1.5 h-4 w-4 text-primary" />, key: "dept" },
          { label: "Citizen reports", value: `${incident.reportCount}`, icon: <Users className="mb-1.5 h-4 w-4 text-primary" />, key: "rep" },
          { label: "AI confidence", value: incident.aiConfidence != null ? `${Math.round(incident.aiConfidence * 100)}%` : "—", icon: <Sparkles className="mb-1.5 h-4 w-4 text-primary" />, key: "ai" },
        ].map((m) => (
          <Card key={m.key}>
            <CardContent className="p-3.5">
              {m.icon}
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{m.label}</p>
              <p className="mt-0.5 truncate text-sm font-semibold">{m.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* left column */}
        <div className="space-y-6">
          {/* map */}
          <Card className="overflow-hidden">
            <div className="h-64">
              <IncidentMap
                incidents={[incident]}
                center={[incident.latitude, incident.longitude]}
                zoom={16}
                cluster={false}
                focusPublicId={incident.publicId}
                onViewIncident={() => setView({ name: "incident", publicId: incident.publicId })}
              />
            </div>
          </Card>

          {/* priority explanation */}
          <Card>
            <CardContent className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-bold">
                  <Layers className="h-4 w-4 text-primary" /> Priority assessment
                </h2>
                <span className="text-xs text-muted-foreground">Score {incident.priorityScore}/100</span>
              </div>
              <p className="mb-2 text-xs text-muted-foreground">
                AI-assisted priority assessment (not an official government algorithm):
              </p>
              <ul className="space-y-1.5 text-sm">
                {incident.priorityReasons.map((r, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* AI analysis */}
          {primaryAnalysis ? (
            <Card>
              <CardContent className="space-y-3 p-5">
                <div className="flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-sm font-bold">
                    <Sparkles className="h-4 w-4 text-primary" /> AI evidence analysis
                  </h2>
                  {primaryAnalysis.source === "DEMO_PRECOMPUTED" ? <DemoBadge /> : null}
                </div>
                <p className="text-sm">{primaryAnalysis.description}</p>
                {primaryAnalysis.hazards.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {primaryAnalysis.hazards.map((h) => (
                      <HazardChip key={h} hazard={h} />
                    ))}
                  </div>
                ) : null}
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-muted/60 p-2">
                    <p className="text-muted-foreground">Confidence</p>
                    <p className="mt-0.5 font-bold">{Math.round(primaryAnalysis.confidence * 100)}%</p>
                  </div>
                  <div className="rounded-lg bg-muted/60 p-2">
                    <p className="text-muted-foreground">Severity</p>
                    <p className="mt-0.5 font-bold">{primaryAnalysis.severity}</p>
                  </div>
                  <div className="rounded-lg bg-muted/60 p-2">
                    <p className="text-muted-foreground">Score</p>
                    <p className="mt-0.5 font-bold">{primaryAnalysis.severityScore}/10</p>
                  </div>
                </div>
                {primaryAnalysis.reasoning ? (
                  <Collapsible>
                    <CollapsibleTrigger className="flex items-center gap-1 text-xs font-medium text-primary">
                      <ChevronDown className="h-3.5 w-3.5" /> AI reasoning
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2 rounded-lg bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
                      {primaryAnalysis.reasoning}
                      <span className="mt-1.5 block opacity-70">
                        Model: {primaryAnalysis.model} · {primaryAnalysis.source}
                      </span>
                    </CollapsibleContent>
                  </Collapsible>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </div>

        {/* right column */}
        <div className="space-y-6">
          {/* citizen reports */}
          <Card>
            <CardContent className="p-5">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold">
                <Users className="h-4 w-4 text-primary" /> Citizen reports ({incident.reportCount})
              </h2>
              <ul className="cl-scroll max-h-96 space-y-4 overflow-y-auto pr-1">
                {incident.reports.map((r) => (
                  <li key={r.id} className="flex gap-3">
                    {r.imagePath ? (
                      <span className="h-16 w-20 shrink-0 overflow-hidden rounded-lg border">
                        <Photo src={r.imagePath} alt={`Evidence photo for report ${r.publicId}`} width={80} height={64} className="h-full w-full object-cover" />
                      </span>
                    ) : (
                      <span className="flex h-16 w-20 shrink-0 items-center justify-center rounded-lg border bg-muted">
                        <CircleAlert className="h-5 w-5 text-muted-foreground" />
                      </span>
                    )}
                    <div className="min-w-0 text-sm">
                      <p className="font-mono text-xs font-bold text-muted-foreground">{r.publicId}</p>
                      {r.description ? <p className="mt-0.5 leading-snug">{r.description}</p> : <p className="mt-0.5 italic text-muted-foreground">No description provided</p>}
                      <p className="mt-1 text-[11px] text-muted-foreground/70">{timeAgo(r.submissionTimestamp)}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] text-muted-foreground">
                Citizen identity is protected — only report content is public.
              </p>
            </CardContent>
          </Card>

          {/* resolution evidence: before / after */}
          {afterPhoto ? (
            <Card>
              <CardContent className="p-5">
                <h2 className="mb-3 flex items-center gap-2 text-sm font-bold">
                  <Wrench className="h-4 w-4 text-primary" /> Resolution evidence
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="mb-1.5 text-xs font-semibold text-muted-foreground">BEFORE</p>
                    <div className="aspect-video overflow-hidden rounded-lg border">
                      {beforePhoto ? (
                        <Photo src={beforePhoto} alt="Before — citizen evidence photo" width={320} height={180} className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1.5 text-xs font-semibold text-emerald-600">AFTER</p>
                    <div className="aspect-video overflow-hidden rounded-lg border">
                      <Photo src={afterPhoto} alt="After — resolution evidence photo" width={320} height={180} className="h-full w-full object-cover" />
                    </div>
                  </div>
                </div>
                {incident.resolutionEvidences[0]?.note ? (
                  <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    {incident.resolutionEvidences[0].note}
                  </p>
                ) : null}
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Authority-uploaded evidence. Visual comparison is informational, not proof of repair quality.
                </p>
              </CardContent>
            </Card>
          ) : null}

          {/* timeline */}
          <Card>
            <CardContent className="p-5">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-bold">
                <Clock className="h-4 w-4 text-primary" /> Lifecycle timeline
              </h2>
              <ol className="relative space-y-5 border-l pl-5">
                {incident.statusHistory.map((h) => (
                  <li key={h.id} className="relative">
                    <span
                      className="absolute -left-[27px] flex h-4 w-4 items-center justify-center rounded-full border-2 border-background"
                      style={{ backgroundColor: timelineColor(h.toStatus) }}
                      aria-hidden
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={h.toStatus} />
                      <span className="text-[11px] text-muted-foreground">{formatDateTime(h.createdAt)}</span>
                    </div>
                    {h.note ? <p className="mt-1 text-xs text-muted-foreground">{h.note}</p> : null}
                    <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                      by {h.actorRole === "ADMIN" ? "Municipal authority" : "Citizen report"}
                    </p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function timelineColor(status: string): string {
  switch (status) {
    case "REPORTED": return "#64748b";
    case "VERIFIED": return "#0d9488";
    case "ASSIGNED": return "#7c3aed";
    case "IN_PROGRESS": return "#d97706";
    case "RESOLVED": return "#16a34a";
    case "REJECTED": return "#e11d48";
    default: return "#94a3b8";
  }
}
