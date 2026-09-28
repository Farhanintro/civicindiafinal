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
    </div>
  );
}
