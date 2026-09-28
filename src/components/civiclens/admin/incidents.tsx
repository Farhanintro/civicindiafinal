"use client";

// CivicLens — admin incidents table: full filters (status/category/priority/department/
// city/state), search, pagination, and the workflow drawer.

import { useCallback, useEffect, useState } from "react";
import { useCivicLens } from "@/store/civiclens";
import { fetchIncidents } from "@/lib/civiclens/api";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CategoryIcon, DemoBadge, EmptyState, PriorityBadge, StatusBadge } from "../badges";
import { IncidentDrawer } from "./incident-drawer";
import { timeAgo } from "@/lib/civiclens/format";
import { ChevronLeft, ChevronRight, Search, Users, X } from "lucide-react";

const PAGE_SIZE = 15;

export function AdminIncidents() {
  const { categories, departments } = useCivicLens();
  const [incidents, setIncidents] = useState<IncidentSummary[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");
  const [category, setCategory] = useState("ALL");
  const [priority, setPriority] = useState("ALL");
  const [department, setDepartment] = useState("ALL");
  const [city, setCity] = useState("ALL");
  const [state, setState] = useState("ALL");
  const [cities, setCities] = useState<string[]>([]);
  const [states, setStates] = useState<string[]>([]);

  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const load = useCallback(async () => {
    setIncidents(null);
    try {
      const data = await fetchIncidents({
        q: q.trim() || undefined,
        status: status === "ALL" ? undefined : status,
        category: category === "ALL" ? undefined : category,
        priority: priority === "ALL" ? undefined : priority,
        department: department === "ALL" ? undefined : department,
        city: city === "ALL" ? undefined : city,
        state: state === "ALL" ? undefined : state,
        page,
        limit: PAGE_SIZE,
        sort: "recent",
      });
      setIncidents(data.incidents);
      setTotal(data.total);
      // collect filter vocab from a forMap fetch (cheap, cached server-side)
      const all = await fetchIncidents({ forMap: true, limit: 400 });
      setCities([...new Set(all.incidents.map((i) => i.city).filter(Boolean))].sort() as string[]);
      setStates([...new Set(all.incidents.map((i) => i.state).filter(Boolean))].sort() as string[]);
    } catch {
      setIncidents([]);
    }
  }, [q, status, category, priority, department, city, state, page]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters =
    q.trim() !== "" || status !== "ALL" || category !== "ALL" || priority !== "ALL" || department !== "ALL" || city !== "ALL" || state !== "ALL";

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div>
        <h1 className="text-lg font-bold">Incidents</h1>
        <p className="text-xs text-muted-foreground">
          {total} tracked incident{total === 1 ? "" : "s"} · click a row to open the workflow
        </p>
      </div>

      {/* filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-44 flex-1 sm:max-w-60">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search ID, area, city…"
            className="h-9 pl-8"
            aria-label="Search incidents"
          />
        </div>
        {[
          { value: status, set: setStatus, options: ["REPORTED", "VERIFIED", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "REJECTED"], placeholder: "Status", width: "w-32" },
          { value: priority, set: setPriority, options: ["P1", "P2", "P3", "P4"], placeholder: "Priority", width: "w-28" },
        ].map((f) => (
          <Select key={f.placeholder} value={f.value} onValueChange={(v) => { f.set(v); setPage(1); }}>
            <SelectTrigger className={`h-9 ${f.width}`}>
              <SelectValue placeholder={f.placeholder} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All {f.placeholder.toLowerCase()}s</SelectItem>
              {f.options.map((o) => (
                <SelectItem key={o} value={o}>
                  {o.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
        <Select value={category} onValueChange={(v) => { setCategory(v); setPage(1); }}>
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
        <Select value={department} onValueChange={(v) => { setDepartment(v); setPage(1); }}>
          <SelectTrigger className="h-9 w-40">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All departments</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d.key} value={d.key}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={city} onValueChange={(v) => { setCity(v); setPage(1); }}>
          <SelectTrigger className="h-9 w-32">
            <SelectValue placeholder="City" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All cities</SelectItem>
            {cities.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={state} onValueChange={(v) => { setState(v); setPage(1); }}>
          <SelectTrigger className="h-9 w-36">
            <SelectValue placeholder="State" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All states</SelectItem>
            {states.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
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
              setQ(""); setStatus("ALL"); setCategory("ALL"); setPriority("ALL"); setDepartment("ALL"); setCity("ALL"); setState("ALL"); setPage(1);
            }}
          >
            <X className="mr-1 h-3.5 w-3.5" /> Clear
          </Button>
        ) : null}
      </div>

      {/* table */}
      {incidents === null ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-13 w-full" />
          ))}
        </div>
      ) : incidents.length === 0 ? (
        <EmptyState title="No incidents match these filters" hint="Try clearing filters or widening the search." />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Incident</TableHead>
                <TableHead>Issue</TableHead>
                <TableHead className="w-24">Priority</TableHead>
                <TableHead className="w-28">Status</TableHead>
                <TableHead className="w-32">City</TableHead>
                <TableHead className="w-20 text-right">Reports</TableHead>
                <TableHead className="w-28 text-right">Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {incidents.map((inc) => (
                <TableRow
                  key={inc.id}
                  className="cursor-pointer"
                  onClick={() => {
                    setDrawerId(inc.publicId);
                    setDrawerOpen(true);
                  }}
                >
                  <TableCell className="font-mono text-xs font-bold">
                    {inc.publicId}
                    {inc.isDemo ? <DemoBadge className="ml-1 px-1 py-0 text-[8px]" /> : null}
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <CategoryIcon categoryKey={inc.categoryKey} className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="max-w-56 truncate">{inc.title ?? inc.categoryLabel}</span>
                    </span>
                  </TableCell>
                  <TableCell>
                    <PriorityBadge priority={inc.priority} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={inc.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{inc.city ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <span className="inline-flex items-center gap-1 text-sm">
                      <Users className="h-3 w-3 text-muted-foreground" />
                      {inc.reportCount}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">{timeAgo(inc.updatedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* pagination */}
      {pages > 1 ? (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Page {page} of {pages} · {total} incidents
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}

      <IncidentDrawer publicId={drawerId} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  );
}
