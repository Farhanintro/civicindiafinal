"use client";

// CIVIC INDIA 2.0 — SLA Monitor Dashboard
// Tracks SLA deadlines, warnings, breaches, and escalation status.

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Clock, AlertTriangle, CheckCircle2, XCircle, RefreshCw,
  Timer, TrendingUp, Shield, ArrowUpCircle,
} from "lucide-react";

interface SlaConfigDTO {
  id: string; priority: string; maxHours: number;
  warningHours: number; isActive: boolean;
}

interface SlaTrackerDTO {
  id: string; incidentId: string | null; unifiedCaseId: string | null;
  priority: string; startedAt: string; deadlineAt: string;
  warningAt: string; status: string; escalationLevel: number;
  remainingHours: number; isOverdue: boolean; createdAt: string;
}

interface SlaSummary {
  active: number; warning: number; breached: number; met: number; total: number;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: typeof CheckCircle2 }> = {
  ACTIVE: { bg: "bg-blue-100 dark:bg-blue-950/50", text: "text-blue-800 dark:text-blue-300", icon: Clock },
  WARNING: { bg: "bg-amber-100 dark:bg-amber-950/50", text: "text-amber-800 dark:text-amber-300", icon: AlertTriangle },
  BREACHED: { bg: "bg-red-100 dark:bg-red-950/50", text: "text-red-800 dark:text-red-300", icon: XCircle },
  MET: { bg: "bg-emerald-100 dark:bg-emerald-950/50", text: "text-emerald-800 dark:text-emerald-300", icon: CheckCircle2 },
  PAUSED: { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-600 dark:text-slate-400", icon: Clock },
};

export function SlaMonitor() {
  const [summary, setSummary] = useState<SlaSummary | null>(null);
  const [configs, setConfigs] = useState<SlaConfigDTO[]>([]);
  const [trackers, setTrackers] = useState<SlaTrackerDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/sla");
      const data = await res.json();
      setSummary(data.summary ?? null);
      setConfigs(data.configs ?? []);
      setTrackers(data.trackers ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const runCheck = async () => {
    setChecking(true);
    try {
      await fetch("/api/sla?action=check");
      await fetchData();
    } catch { /* ignore */ }
    setChecking(false);
  };

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">SLA Monitor</h1>
          <p className="text-sm text-muted-foreground">
            Service Level Agreement tracking, escalation status, and deadline monitoring
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={runCheck} disabled={checking}>
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${checking ? "animate-spin" : ""}`} />
          Check SLAs
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/50">
              <Timer className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{summary?.active ?? 0}</p>
              <p className="text-xs text-muted-foreground">Active Trackers</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/50">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{summary?.warning ?? 0}</p>
              <p className="text-xs text-muted-foreground">Warning</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/50">
              <XCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{summary?.breached ?? 0}</p>
              <p className="text-xs text-muted-foreground">Breached</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/50">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{summary?.met ?? 0}</p>
              <p className="text-xs text-muted-foreground">Met / Resolved</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SLA Configurations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4" /> SLA Configuration
          </CardTitle>
          <CardDescription>Configurable deadlines per priority level</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {configs.map((cfg) => (
              <div key={cfg.id} className="rounded-lg border p-3 text-center">
                <Badge className={`text-xs ${
                  cfg.priority === "P1" ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" :
                  cfg.priority === "P2" ? "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300" :
                  cfg.priority === "P3" ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" :
                  "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                }`}>
                  {cfg.priority}
                </Badge>
                <p className="mt-2 text-2xl font-bold">{cfg.maxHours}h</p>
                <p className="text-xs text-muted-foreground">Maximum resolution time</p>
                <p className="mt-1 text-xs text-muted-foreground">Warning at {cfg.warningHours}h</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Active SLA Trackers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" /> Active SLA Trackers
          </CardTitle>
        </CardHeader>
        <CardContent>
          {trackers.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <Timer className="h-10 w-10 text-muted-foreground/50" />
              <div>
                <p className="font-medium text-muted-foreground">No active SLA trackers</p>
                <p className="mt-1 text-xs text-muted-foreground/70">
                  SLA tracking starts automatically when cases are created.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {trackers.map((t) => {
                const style = STATUS_STYLES[t.status] ?? STATUS_STYLES.ACTIVE;
                const StatusIcon = style.icon;
                const totalHours = configs.find((c) => c.priority === t.priority)?.maxHours ?? 24;
                const elapsed = totalHours - t.remainingHours;
                const progressPercent = Math.min(100, Math.max(0, (elapsed / totalHours) * 100));

                return (
                  <div key={t.id} className={`rounded-lg border p-4 ${style.bg}`}>
                    <div className="flex items-start gap-3">
                      <StatusIcon className={`mt-0.5 h-5 w-5 shrink-0 ${style.text}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className="text-[10px]">{t.priority}</Badge>
                          <Badge variant={t.status === "BREACHED" ? "destructive" : "outline"} className="text-[10px]">{t.status}</Badge>
                          {t.escalationLevel > 0 && (
                            <Badge variant="outline" className="gap-1 text-[10px]">
                              <ArrowUpCircle className="h-2.5 w-2.5" /> Escalation Level {t.escalationLevel}
                            </Badge>
                          )}
                        </div>
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className={style.text}>
                              {t.isOverdue ? "OVERDUE" : `${t.remainingHours}h remaining`}
                            </span>
                            <span className="text-muted-foreground">
                              Deadline: {new Date(t.deadlineAt).toLocaleString()}
                            </span>
                          </div>
                          <Progress value={progressPercent} className="mt-1 h-2" />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
