"use client";

// Civic India — admin India map view: nationwide incidents with jurisdiction filters.

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useCivicLens } from "@/store/civiclens";
import { fetchIncidents } from "@/lib/civiclens/api";
import type { IncidentSummary } from "@/lib/civiclens/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DemoBadge } from "../badges";
import { IncidentDrawer } from "./incident-drawer";
import { X } from "lucide-react";

const IncidentMap = dynamic(() => import("../map").then((m) => m.default), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

export function AdminMap() {
  const { categories, departments } = useCivicLens();
  const [incidents, setIncidents] = useState<IncidentSummary[] | null>(null);
  const [cities, setCities] = useState<string[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [category, setCategory] = useState("ALL");
  const [priority, setPriority] = useState("ALL");
  const [department, setDepartment] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [city, setCity] = useState("ALL");
  const [state, setState] = useState("ALL");
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchIncidents({
        forMap: true,
        limit: 500,
        category: category === "ALL" ? undefined : category,
        priority: priority === "ALL" ? undefined : priority,
        department: department === "ALL" ? undefined : department,
        status: status === "ALL" ? undefined : status,
        city: city === "ALL" ? undefined : city,
        state: state === "ALL" ? undefined : state,
      });
      setIncidents(data.incidents);
      setCities([...new Set(data.incidents.map((i) => i.city).filter(Boolean))].sort() as string[]);
      setStates([...new Set(data.incidents.map((i) => i.state).filter(Boolean))].sort() as string[]);
    } catch {
      setIncidents([]);
    }
  }, [category, priority, department, status, city, state]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 200);
    return () => clearTimeout(t);
  }, [load]);

  const hasFilters = [category, priority, department, status, city, state].some((v) => v !== "ALL");

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col space-y-3 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold">India map view</h1>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {incidents?.length ?? 0} incidents shown
          </p>
        </div>
        {hasFilters ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setCategory("ALL"); setPriority("ALL"); setDepartment("ALL"); setStatus("ALL"); setCity("ALL"); setState("ALL");
            }}
          >
            <X className="mr-1 h-3.5 w-3.5" /> Clear filters
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={state} onValueChange={setState}>
          <SelectTrigger className="h-9 w-36"><SelectValue placeholder="State" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All states</SelectItem>
            {states.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={city} onValueChange={setCity}>
          <SelectTrigger className="h-9 w-32"><SelectValue placeholder="City" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All cities</SelectItem>
            {cities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-9 w-40"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All categories</SelectItem>
            {categories.map((c) => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="h-9 w-28"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All priorities</SelectItem>
            {["P1", "P2", "P3", "P4"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={department} onValueChange={setDepartment}>
          <SelectTrigger className="h-9 w-44"><SelectValue placeholder="Department" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All departments</SelectItem>
            {departments.map((d) => <SelectItem key={d.key} value={d.key}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {["REPORTED", "VERIFIED", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "REJECTED"].map((s) => (
              <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border">
        {incidents === null ? (
          <Skeleton className="h-full w-full rounded-none" />
        ) : (
          <IncidentMap
            incidents={incidents}
            onViewIncident={(id) => {
              setDrawerId(id);
              setDrawerOpen(true);
            }}
          />
        )}
      </div>

      <IncidentDrawer publicId={drawerId} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  );
}