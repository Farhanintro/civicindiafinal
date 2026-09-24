"use client";

// CivicLens — public "Explore issues" map view with filters, search, and an incident list.

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useCivicLens } from "@/store/civiclens";
import { fetchIncidents, type IncidentQuery } from "@/lib/civiclens/api";
import type { IncidentSummary } from "@/lib/civiclens/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CategoryIcon, DemoBadge, EmptyState, PriorityBadge, StatusBadge } from "./badges";
import { locationLine, timeAgo } from "@/lib/civiclens/format";
import { Search, X, Users, Activity, CheckCircle2 } from "lucide-react";

const IncidentMap = dynamic(() => import("./map").then((m) => m.default), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

const STATUS_OPTIONS = ["REPORTED", "VERIFIED", "ASSIGNED", "IN_PROGRESS", "RESOLVED"];

export function Explore({ focus }: { focus?: string }) {
  const { setView, categories } = useCivicLens();
  const [incidents, setIncidents] = useState<IncidentSummary[] | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("ALL");
  const [category, setCategory] = useState<string>("ALL");
  const [priority, setPriority] = useState<string>("ALL");
  const [focusId, setFocusId] = useState<string | null>(focus ?? null);

  const load = useCallback(async () => {
    const query: IncidentQuery = { forMap: true, limit: 400 };
    if (q.trim()) query.q = q.trim();
    if (status !== "ALL") query.status = status;
    if (category !== "ALL") query.category = category;
    if (priority !== "ALL") query.priority = priority;
    try {
      const data = await fetchIncidents(query);
      setIncidents(data.incidents);
    } catch {
      setIncidents([]);
    }
  }, [q, status, category, priority]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);

  const stats = useMemo(() => {
    if (!incidents) return null;
    const active = incidents.filter((i) => !["RESOLVED", "REJECTED"].includes(i.status));
    const resolved = incidents.filter((i) => i.status === "RESOLVED");
    const reports = incidents.reduce((s, i) => s + i.reportCount, 0);
    return { total: incidents.length, active: active.length, resolved: resolved.length, reports };
  }, [incidents]);

  const hasFilters = q.trim() !== "" || status !== "ALL" || category !== "ALL" || priority !== "ALL";

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* DEMO banner */}
      <div className="flex items-center justify-center gap-2 border-b bg-amber-50 px-4 py-1.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
        <DemoBadge /> includes seeded demo incidents across Indian cities — not real government data
      </div>

      {/* filters */}
      <div className="flex flex-wrap items-center gap-2 border-b bg-background px-4 py-2.5">
        <div className="relative min-w-44 flex-1 sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search ID, area, city…"
            className="h-9 pl-8"
            aria-label="Search incidents"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-32">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s.replace("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-9 w-40">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.key} value={c.key}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="h-9 w-28">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All priorities</SelectItem>
            {["P1", "P2", "P3", "P4"].map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasFilters ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-9"
            onClick={() => {
              setQ("");
              setStatus("ALL");
              setCategory("ALL");
              setPriority("ALL");
            }}
          >
            <X className="mr-1 h-3.5 w-3.5" /> Clear
          </Button>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* map */}
        <div className="relative min-h-72 flex-1">
          {incidents === null ? (
            <Skeleton className="h-full w-full rounded-none" />
          ) : (
            <IncidentMap
              incidents={incidents}
              focusPublicId={focusId}
              onViewIncident={(id) => setView({ name: "incident", publicId: id })}
            />
          )}
        </div>

        {/* side list */}
        <aside className="flex w-full flex-col border-t lg:w-96 lg:border-l lg:border-t-0">
          <div className="grid grid-cols-4 border-b bg-muted/40 text-center">
            {[
              { label: "Incidents", value: stats?.total ?? "—", icon: Activity },
              { label: "Active", value: stats?.active ?? "—", icon: Activity },
              { label: "Resolved", value: stats?.resolved ?? "—", icon: CheckCircle2 },
              { label: "Reports", value: stats?.reports ?? "—", icon: Users },
            ].map((s) => (
              <div key={s.label} className="px-2 py-2.5">
                <div className="text-base font-bold leading-none">{s.value}</div>
                <div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="cl-scroll min-h-0 flex-1 overflow-y-auto">
            {incidents === null ? (
              <div className="space-y-2 p-3">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-lg" />
                ))}
              </div>
            ) : incidents.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title="No incidents match these filters"
                  hint={hasFilters ? "Try clearing filters or search a different area." : "Be the first to report a civic issue."}
                  action={
                    <Button size="sm" onClick={() => setView({ name: "report" })}>
                      Report an issue
                    </Button>
                  }
                />
              </div>
            ) : (
              <ul className="divide-y">
                {incidents.map((inc) => (
                  <li key={inc.id}>
                    <button
                      className="w-full px-4 py-3 text-left transition-colors hover:bg-accent"
                      onClick={() => {
                        setFocusId(inc.publicId);
                        setView({ name: "incident", publicId: inc.publicId });
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 font-mono text-xs font-bold">
                          {inc.publicId}
                          {inc.isDemo ? <DemoBadge className="px-1.5 py-0 text-[9px]" /> : null}
                        </span>
                        <PriorityBadge priority={inc.priority} />
                      </div>
                      <p className="mt-1 flex items-center gap-1.5 truncate text-sm font-medium">
                        <CategoryIcon categoryKey={inc.categoryKey} className="h-3.5 w-3.5 shrink-0 text-primary" />
                        {inc.title ?? inc.categoryLabel}
                      </p>
                      <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span className="truncate">{locationLine(inc)}</span>
                        <span className="shrink-0">{timeAgo(inc.updatedAt)}</span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <StatusBadge status={inc.status} />
                        <span className="text-[11px] text-muted-foreground">
                          {inc.reportCount} report{inc.reportCount > 1 ? "s" : ""}
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
