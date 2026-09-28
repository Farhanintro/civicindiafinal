"use client";

// Civic India — Incident Detail View Component
// Displays public ID, status timeline, AI vision analysis, detected hazards,
// citizen photo gallery, and department routing.

import { useEffect, useState, useCallback } from "react";
import { useCivicLens } from "@/store/civiclens";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  CategoryIcon,
  PriorityBadge,
  SeverityBadge,
  HazardChip,
} from "./badges";
import { Photo } from "./photo";
import { locationLine, formatDateTime, timeAgo } from "@/lib/civiclens/format";
import type { IncidentDetail } from "@/lib/civiclens/types";
import {
  ChevronLeft,
  Clock,
  MapPin,
  Building2,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  History,
  Camera,
  Share2,
} from "lucide-react";

interface IncidentViewProps {
  publicId?: string;
}

export function IncidentView({ publicId: propPublicId }: IncidentViewProps = {}) {
  const { view, setView, user, openAuth } = useCivicLens();
  const activePublicId =
    propPublicId || (view.name === "incident" ? view.publicId : null);

  const [incident, setIncident] = useState<IncidentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchIncident = useCallback(async () => {
    if (!activePublicId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/incidents/${activePublicId}`);
      if (!res.ok) {
        throw new Error("Could not load incident details.");
      }
      const data = await res.json();
      setIncident(data.incident || data);
    } catch (err: any) {
      setError(err.message || "Failed to fetch incident details.");
    } finally {
      setLoading(false);
    }
  }, [activePublicId]);

  useEffect(() => {
    fetchIncident();
  }, [fetchIncident]);

  const handleShare = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center justify-center gap-3 px-4 py-24 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading incident details…</p>
      </div>
    );
  }

  if (error || !incident) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
        <h2 className="mt-3 text-lg font-bold">Incident Not Found</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {error || `No record found for ID: ${activePublicId}`}
        </p>
        <Button
          variant="outline"
          className="mt-6"
          onClick={() => setView({ name: "explore" })}
        >
          <ChevronLeft className="mr-1 h-4 w-4" /> Back to Map
        </Button>
      </div>
    );
  }

  const reports = incident.reports || [];
  const primaryReport = reports[0];
  const primaryImage =
    primaryReport?.imagePath || "/images/placeholder-issue.jpg";

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-20 pt-6">
      {/* Back button and Share */}
      <div className="mb-4 flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setView({ name: "explore" })}
          className="-ml-2 text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="mr-1 h-4 w-4" /> Back to Explore
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleShare}
          className="gap-1.5 text-xs"
        >
          <Share2 className="h-3.5 w-3.5" />
          {copied ? "Link Copied!" : "Share Incident"}
        </Button>
      </div>

      {/* Main Header */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-base font-bold text-primary">
            {incident.publicId}
          </span>
          <Badge variant="outline" className="capitalize">
            {incident.status.replace("_", " ").toLowerCase()}
          </Badge>
          <PriorityBadge priority={incident.priority} />
          <SeverityBadge severity={incident.severity} />
        </div>

        <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight sm:text-3xl">
          <CategoryIcon
            categoryKey={incident.categoryKey}
            className="h-7 w-7 shrink-0 text-primary"
          />
          {incident.title || incident.categoryLabel || "Civic Incident"}
        </h1>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-primary" />
            {locationLine(incident)}
          </span>
          <span className="flex items-center gap-1.5">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            {incident.departmentName || "Municipal Corporation"}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Reported {timeAgo(incident.createdAt)}
          </span>
        </div>
      </div>

      <Separator className="my-6" />

      {/* Grid: Left Column (Photos & AI), Right Column (Status & Timeline) */}
      <div className="grid gap-6 md:grid-cols-5">
        {/* Left Column (3 cols) */}
        <div className="space-y-6 md:col-span-3">
          {/* Evidence Photo */}
          <Card className="overflow-hidden">
            <div className="relative aspect-video w-full bg-muted">
              <Photo
                src={primaryImage}
                alt={incident.title}
                fill
                className="object-cover"
              />
            </div>
            {reports.length > 1 ? (
              <CardContent className="p-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Citizen photo gallery ({reports.length} reports)
                </p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {reports.map((r, i) => (
                    <div
                      key={r.id || i}
                      className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border bg-muted"
                    >
                      <Photo
                        src={r.imagePath || primaryImage}
                        alt={`Report photo ${i + 1}`}
                        fill
                        className="object-cover"
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            ) : null}
          </Card>

          {/* AI Intelligence Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" />
                AI Infrastructure Assessment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Visual Confidence</span>
                  <span className="font-semibold text-foreground">
                    {Math.round((incident.aiConfidence ?? 0.85) * 100)}%
                  </span>
                </div>
                <Progress
                  value={(incident.aiConfidence ?? 0.85) * 100}
                  className="h-1.5"
                />
              </div>

              {primaryReport?.analysis?.hazards &&
              primaryReport.analysis.hazards.length > 0 ? (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                    Identified Public Hazards
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {primaryReport.analysis.hazards.map((h) => (
                      <HazardChip key={h} hazard={h} />
                    ))}
                  </div>
                </div>
              ) : null}

              {primaryReport?.analysis?.description ? (
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    Computer Vision Notes
                  </p>
                  <p className="rounded-lg bg-muted/60 p-3 text-xs leading-relaxed">
                    {primaryReport.analysis.description}
                  </p>
                </div>
              ) : null}

              {incident.aiReasoning ? (
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    Priority Logic
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {incident.aiReasoning}
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        {/* Right Column (2 cols) */}
        <div className="space-y-6 md:col-span-2">
          {/* Quick Metrics */}
          <Card>
            <CardContent className="space-y-3.5 p-5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Citizen Reports</span>
                <span className="font-bold">{incident.reportCount}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Priority Score</span>
                <span className="font-bold">{incident.priorityScore}/100</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Severity Level</span>
                <span className="font-bold">{incident.severityScore}/10</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Target Dept</span>
                <span className="font-semibold text-primary">
                  {incident.departmentName || incident.departmentKey}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Status Timeline / History */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="h-4 w-4 text-primary" />
                Lifecycle History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {incident.statusHistory && incident.statusHistory.length > 0 ? (
                <div className="relative space-y-4 pl-4 before:absolute before:bottom-2 before:left-1 before:top-2 before:w-0.5 before:bg-muted">
                  {incident.statusHistory.map((step, idx) => (
                    <div key={step.id || idx} className="relative text-xs">
                      <div className="absolute -left-[19px] top-0.5 h-2.5 w-2.5 rounded-full border-2 border-primary bg-background" />
                      <div className="font-semibold text-foreground">
                        {step.toStatus.replace("_", " ")}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {formatDateTime(step.createdAt)}
                      </div>
                      {step.note ? (
                        <p className="mt-1 rounded bg-muted/60 p-1.5 text-muted-foreground">
                          {step.note}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2 font-medium text-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    Reported & AI Verified
                  </div>
                  <p>Incident logged and awaiting departmental assignment.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default IncidentView;