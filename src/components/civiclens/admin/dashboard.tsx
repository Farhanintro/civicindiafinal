"use client";

// Civic India — admin command center dashboard: KPIs, live map, priority queue, snapshot.

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useCivicLens } from "@/store/civiclens";
import { fetchAnalytics, fetchIncidents } from "@/lib/civiclens/api";
import type { AnalyticsDTO, IncidentSummary } from "@/lib/civiclens/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis } from "recharts";
import { CategoryIcon, DemoBadge, PriorityBadge, StatusBadge } from "../badges";
import { IncidentDrawer } from "./incident-drawer";
import { locationLine, timeAgo } from "@/lib/civiclens/format";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  FileText,
  Layers,
  Link2,
  AlertTriangle,
  MapPin,
} from "lucide-react";

const IncidentMap = dynamic(() => import("../map").then((m) => m.default), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

export function AdminDashboard() {
  const { setView } = useCivicLens();
  const [analytics, setAnalytics] = useState<AnalyticsDTO | null>(null);
  const [incidents, setIncidents] = useState<IncidentSummary[] | null>(null);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [a, inc] = await Promise.all([
        fetchAnalytics(),
        fetchIncidents({ forMap: true, limit: 300, sort: "priority" }),
      ]);
      setAnalytics(a);
      setIncidents(inc.incidents);
    } catch {
      setAnalytics(null);
      setIncidents([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openIncident = (publicId: string) => {
    setDrawerId(publicId);
    setDrawerOpen(true);
  };

  const topPriority = (incidents ?? [])
    .filter((i) => !["RESOLVED", "REJECTED"].includes(i.status))
    .slice(0, 6);

  const kpis = [
    { label: "Total reports", value: analytics?.totals.reports, icon: FileText, hint: "Citizen submissions" },
    { label: "Active incidents", value: analytics?.totals.activeIncidents, icon: Activity, hint: "Awaiting resolution" },
    { label: "High priority", value: analytics?.totals.highPriority, icon: AlertTriangle, hint: "P1 + P2 open" },
    { label: "Resolved", value: analytics?.totals.resolvedIncidents, icon: CheckCircle2, hint: `Avg ${analytics?.totals.avgResolutionHours ?? "—"}h` },
    { label: "Linked reports", value: analytics?.totals.linkedReports, icon: Link2, hint: "Duplicate-clustered" },
  ];

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">Civic intelligence overview</h1>
          <p className="text-xs text-muted-foreground">
            Live data across India
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setView({ name: "admin", tab: "incidents" })}>
          All incidents <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{k.label}</span>
                <k.icon className="h-4 w-4 text-primary" />
              </div>
              {analytics === null ? (
                <Skeleton className="mt-2 h-7 w-14" />
              ) : (
                <div className="mt-1 text-2xl font-bold">{k.value ?? "—"}</div>
              )}
              <p className="mt-0.5 text-[11px] text-muted-foreground">{k.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        {/* map */}
        <Card className="overflow-hidden xl:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-primary" /> Incident map
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="h-80 border-t">
              {incidents === null ? (
                <Skeleton className="h-full w-full rounded-none" />
              ) : (
                <IncidentMap incidents={incidents} onViewIncident={openIncident} />
              )}
            </div>
          </CardContent>
        </Card>

        {/* priority queue */}
        <Card className="xl:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Layers className="h-4 w-4 text-primary" /> Priority queue (top open incidents)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {incidents === null ? (
              [1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)
            ) : topPriority.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No active incidents 🎉</p>
            ) : (
              topPriority.map((inc) => (
                <button
                  key={inc.id}
                  onClick={() => openIncident(inc.publicId)}
                  className="w-full rounded-lg border p-3 text-left transition-all hover:border-primary/50 hover:shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <CategoryIcon categoryKey={inc.categoryKey} className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="truncate text-sm font-semibold">{inc.title ?? inc.categoryLabel}</span>
                    </span>
                    <PriorityBadge priority={inc.priority} />
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono">{inc.publicId}</span>
                    <StatusBadge status={inc.status} />
                    <span className="truncate">{inc.city ?? "—"} · {inc.reportCount} reports</span>
                    <span className="ml-auto">{timeAgo(inc.updatedAt)}</span>
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* snapshot chart */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Open incidents by category (snapshot)</CardTitle>
        </CardHeader>
        <CardContent>
          {analytics === null ? (
            <Skeleton className="h-56 w-full" />
          ) : (
            <div className="h-56">
              <ResponsiveBar data={analytics.byCategory.map((c) => ({ name: c.label.split(" / ")[0], open: c.open, total: c.count }))} />
            </div>
          )}
        </CardContent>
      </Card>

      <IncidentDrawer publicId={drawerId} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  );
}

function ResponsiveBar({ data }: { data: { name: string; open: number; total: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
        <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-28} textAnchor="end" height={56} />
        <Bar dataKey="total" name="Total" fill="#991b1b22" radius={[4, 4, 0, 0]} />
        <Bar dataKey="open" name="Open" fill="#0f766e" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}