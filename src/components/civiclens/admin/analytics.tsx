"use client";

// CivicLens — analytics: category/city/state/priority breakdowns, open vs resolved,
// resolution trend, department workload, duplicate reports. All real DB aggregates.

import { useEffect, useState } from "react";
import { fetchAnalytics } from "@/lib/civiclens/api";
import type { AnalyticsDTO } from "@/lib/civiclens/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DemoBadge } from "../badges";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Link2, Timer, TrendingUp } from "lucide-react";

const PRIORITY_COLORS = { P1: "#dc2626", P2: "#ea580c", P3: "#d97706", P4: "#16a34a" };
const TEAL = "#0f766e";

export function AdminAnalytics() {
  const [data, setData] = useState<AnalyticsDTO | null>(null);

  useEffect(() => {
    fetchAnalytics().then(setData).catch(() => setData(null));
  }, []);

  if (!data) {
    return (
      <div className="grid gap-4 p-6 md:grid-cols-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-64 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  const openVsResolved = [
    { name: "Open", value: data.totals.activeIncidents },
    { name: "Resolved", value: data.totals.resolvedIncidents },
  ];

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold">Analytics</h1>
          <p className="text-xs text-muted-foreground">Lightweight aggregates computed from live database data</p>
        </div>
        <DemoBadge />
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Timer className="h-3.5 w-3.5 text-primary" /> Avg resolution time
            </div>
            <p className="mt-1 text-2xl font-bold">
              {data.totals.avgResolutionHours != null ? `${data.totals.avgResolutionHours} h` : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Link2 className="h-3.5 w-3.5 text-primary" /> Duplicate reports linked
            </div>
            <p className="mt-1 text-2xl font-bold">{data.totals.linkedReports}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5 text-primary" /> Reports → incidents ratio
            </div>
            <p className="mt-1 text-2xl font-bold">
              {data.totals.incidents > 0 ? (data.totals.reports / data.totals.incidents).toFixed(2) : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5 text-primary" /> High priority (P1+P2)
            </div>
            <p className="mt-1 text-2xl font-bold">{data.totals.highPriority}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* by category */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Issues by category</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.byCategory} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={0} angle={-30} textAnchor="end" height={64} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="count" name="Total" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="open" name="Open" fill={TEAL} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* by city */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Issues by city</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.byCity} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis dataKey="city" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={44} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="count" name="Total" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="open" name="Open" fill={TEAL} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* priority distribution */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Incidents by priority</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.byPriority}
                    dataKey="count"
                    nameKey="priority"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    label={({ priority, count }) => `${priority}: ${count}`}
                    labelLine={false}
                    fontSize={11}
                  >
                    {data.byPriority.map((entry) => (
                      <Cell key={entry.priority} fill={PRIORITY_COLORS[entry.priority]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* open vs resolved + trend */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Open vs resolved & resolution trend</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={data.resolutionTrend.map((w, i) => ({
                    week: w.week,
                    resolved: w.resolved,
                    openVsResolved: i === 0 ? `${data.totals.activeIncidents} open / ${data.totals.resolvedIncidents} resolved` : "",
                  }))}
                  margin={{ top: 8, right: 12, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Line type="monotone" dataKey="resolved" name="Resolved" stroke={TEAL} strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex justify-center gap-4 text-xs text-muted-foreground">
              <span>● Open: {data.totals.activeIncidents}</span>
              <span>● Resolved: {data.totals.resolvedIncidents}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* department workload */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Department workload</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.departmentWorkload} layout="vertical" margin={{ top: 4, right: 12, left: 30, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
                  <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={110} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="open" name="Open" fill={TEAL} radius={[0, 4, 4, 0]} />
                  <Bar dataKey="resolved" name="Resolved" fill="#16a34a" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* by state */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Issues by state</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.byState.map((s) => {
                const max = Math.max(...data.byState.map((x) => x.count), 1);
                return (
                  <li key={s.state} className="flex items-center gap-3 text-sm">
                    <span className="w-36 shrink-0 truncate text-muted-foreground">{s.state}</span>
                    <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <span className="block h-full rounded-full bg-primary" style={{ width: `${(s.count / max) * 100}%` }} />
                    </span>
                    <span className="w-8 text-right font-semibold">{s.count}</span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
