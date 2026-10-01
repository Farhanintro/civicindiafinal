"use client";

// CivicLens — citizen dashboard: report stats, recent reports with live incident status.

import { useCallback, useEffect, useState } from "react";
import { useCivicLens } from "@/store/civiclens";
import { fetchMyReports } from "@/lib/civiclens/api";
import type { IncidentSummary, ReportDTO } from "@/lib/civiclens/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryIcon, EmptyState, PriorityBadge, StatusBadge, DemoBadge } from "../badges";
import { locationLine, timeAgo } from "@/lib/civiclens/format";
import { Camera, CheckCircle2, Activity, FileText, ChevronRight } from "lucide-react";

type MyReport = ReportDTO & { incident: IncidentSummary | null };

export function CitizenDashboard() {
  const { user, setView, openAuth } = useCivicLens();
  const [reports, setReports] = useState<MyReport[] | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchMyReports();
      setReports(data.reports);
    } catch {
      setReports([]);
    }
  }, []);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  if (!user) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
        <Activity className="h-10 w-10 text-primary" />
        <p className="font-medium">Sign in to see your reports</p>
        <Button onClick={() => openAuth("dashboard")}>Sign in</Button>
      </div>
    );
  }

  const linked = reports?.filter((r) => r.incident) ?? [];
  const active = linked.filter((r) => !["RESOLVED", "REJECTED"].includes(r.incident!.status));
  const resolved = linked.filter((r) => r.incident?.status === "RESOLVED");

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 pb-20">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Namaste, {user.name.split(" ")[0]} 👋</h1>
          <p className="text-sm text-muted-foreground">Your civic contributions and their live status.</p>
        </div>
        <Button onClick={() => setView({ name: "report" })}>
          <Camera className="mr-1.5 h-4 w-4" /> Report an issue
        </Button>
      </div>

      {/* stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total reports", value: linked.length, icon: FileText },
          { label: "Active", value: active.length, icon: Activity },
          { label: "Resolved", value: resolved.length, icon: CheckCircle2 },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <s.icon className="h-4.5 w-4.5" />
              </span>
              <div>
                <div className="text-xl font-bold leading-none">{s.value}</div>
                <div className="mt-1 text-xs text-muted-foreground">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* recent reports */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Recent reports
        </h2>
        {reports === null ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ) : linked.length === 0 ? (
          <EmptyState
            icon={Camera}
            title="No reports yet"
            hint="Be the first to report a civic issue in your area — it only takes a photo."
            action={
              <Button size="sm" onClick={() => setView({ name: "report" })}>
                <Camera className="mr-1.5 h-4 w-4" /> Report an issue
              </Button>
            }
          />
        ) : (
          <ul className="space-y-3">
            {linked.map((r) => {
              const inc = r.incident!;
              return (
                <li key={r.id}>
                  <button
                    className="w-full rounded-xl border bg-card p-4 text-left transition-all hover:border-primary/50 hover:shadow-sm"
                    onClick={() => setView({ name: "incident", publicId: inc.publicId })}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <CategoryIcon categoryKey={inc.categoryKey} className="h-4.5 w-4.5" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-xs font-bold">{inc.publicId}</span>
                            {inc.isDemo ? <DemoBadge /> : null}
                          </div>
                          <p className="mt-0.5 truncate text-sm font-semibold">
                            {inc.title ?? inc.categoryLabel}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {locationLine(inc)}
                          </p>
                          <p className="mt-1 text-[11px] text-muted-foreground/70">
                            Updated {timeAgo(inc.updatedAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <PriorityBadge priority={inc.priority} />
                        <StatusBadge status={inc.status} />
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Citizen Consent & Data Governance Section */}
      <CitizenConsentCard />
    </div>
  );
}

function CitizenConsentCard() {
  const [consents, setConsents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const loadConsents = async () => {
    try {
      const res = await fetch("/api/consent");
      if (res.ok) {
        const data = await res.json();
        setConsents(data.consents || []);
      }
    } catch {
      // silently fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadConsents();
  }, []);

  const handleToggle = async (id: string, currentStatus: string) => {
    setActionInProgress(id);
    try {
      const action = currentStatus === "GRANTED" ? "REVOKE" : "GRANT";
      await fetch("/api/consent", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      await loadConsents();
    } catch (err) {
      console.error(err);
    } finally {
      setActionInProgress(null);
    }
  };

  if (loading) return null;

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
            <CheckCircle2 className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold">My Data Sharing & Privacy Consents</h3>
            <p className="text-xs text-muted-foreground">Manage which government departments can access your report telemetry</p>
          </div>
        </div>
        <span className="text-[11px] font-mono font-medium rounded-full bg-primary/10 text-primary px-2.5 py-0.5">
          DPDP Act 2023 Compliant
        </span>
      </div>

      {consents.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No active data sharing authorizations required at this moment.</p>
      ) : (
        <div className="space-y-3">
          {consents.map((c) => {
            const isGranted = c.status === "GRANTED";
            return (
              <div key={c.id} className="rounded-lg border bg-background/50 p-3.5 space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-foreground">
                        {c.requestingSystem?.replace("_", " ")}
                      </span>
                      <span className="text-[10px] text-muted-foreground">wants access for:</span>
                    </div>
                    <p className="text-xs text-foreground font-medium mt-0.5">{c.purpose}</p>
                  </div>
                  <Button
                    size="sm"
                    variant={isGranted ? "outline" : "default"}
                    className={isGranted ? "text-xs text-rose-600 hover:bg-rose-50 h-7 px-2.5" : "text-xs h-7 px-2.5"}
                    disabled={actionInProgress === c.id}
                    onClick={() => handleToggle(c.id, c.status)}
                  >
                    {isGranted ? "Revoke Access" : "Grant Access"}
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="rounded bg-emerald-500/5 border border-emerald-500/20 p-2">
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400 block mb-1">
                      ✓ Shared with Department:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {c.allowedFields.map((f: string) => (
                        <span key={f} className="rounded bg-background px-1.5 py-0.5 text-[10px] font-mono border">
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="rounded bg-rose-500/5 border border-rose-500/20 p-2">
                    <span className="font-semibold text-rose-700 dark:text-rose-400 block mb-1">
                      ✗ Protected (Masked/Withheld):
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {c.restrictedFields.map((f: string) => (
                        <span key={f} className="rounded bg-background px-1.5 py-0.5 text-[10px] font-mono border text-muted-foreground">
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t">
                  <span>Status: <strong className={isGranted ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}>{c.status}</strong></span>
                  <span>Consent Version: {c.version}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

