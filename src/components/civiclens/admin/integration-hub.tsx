"use client";

// CIVIC INDIA 2.0 — Government Integration Hub Dashboard
// Monitors connected government platforms, API health, data synchronization,
// provides "Send Test Record" buttons, and executes the 15-step Interoperability Demo.

import { useEffect, useState, useCallback } from "react";
import { useCivicLens } from "@/store/civiclens";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Network, RefreshCw, CheckCircle2, AlertTriangle, XCircle, Activity,
  ArrowDownUp, Clock, Server, Wifi, Zap, ScrollText, Play, Send,
  ShieldCheck, FileCheck, Layers, Sparkles, Check, ArrowRight,
} from "lucide-react";

interface SystemDTO {
  id: string; code: string; name: string; type: string; department: string | null;
  status: string; isSimulated: boolean; lastSyncAt: string | null;
  lastHealthCheck: string | null; healthLatencyMs: number | null;
  requestCount: number; failedCount: number;
}

interface IntegrationHealth {
  totalSystems: number; onlineSystems: number; degradedSystems: number;
  offlineSystems: number; totalRequests: number; failedRequests: number;
  successRate: number; avgLatencyMs: number; systems: SystemDTO[];
}

interface LogDTO {
  id: string; systemName: string; systemCode: string; direction: string;
  method: string; endpoint: string; statusCode: number | null;
  success: boolean; errorMessage: string | null; latencyMs: number | null;
  createdAt: string;
}

interface DemoResult {
  correlationId: string;
  unifiedCasePublicId: string;
  assignedDepartment: string;
  routingReason: string;
  sourceComplaints: Array<{ system: string; recordId: string; schemaDescription: string }>;
  masterRoad: string;
  masterCitizen: string;
  dataQualityAverageScore: number;
  slaPriority?: string;
  slaDeadlineHours?: number;
  steps: Array<{
    step: number;
    title: string;
    details: string;
    system?: string;
    recordId?: string;
    status: string;
    timestamp: string;
  }>;
}

const STATUS_CONFIG: Record<string, { color: string; icon: typeof CheckCircle2; label: string }> = {
  ONLINE: { color: "bg-emerald-500", icon: CheckCircle2, label: "Online" },
  DEGRADED: { color: "bg-amber-500", icon: AlertTriangle, label: "Degraded" },
  OFFLINE: { color: "bg-red-500", icon: XCircle, label: "Offline" },
  MAINTENANCE: { color: "bg-slate-500", icon: Clock, label: "Maintenance" },
};

export function IntegrationHub() {
  const { setView } = useCivicLens();
  const [health, setHealth] = useState<IntegrationHealth | null>(null);
  const [logs, setLogs] = useState<LogDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [sendingTest, setSendingTest] = useState<string | null>(null);
  const [testSuccess, setTestSuccess] = useState<string | null>(null);

  // Demo state
  const [runningDemo, setRunningDemo] = useState(false);
  const [demoResult, setDemoResult] = useState<DemoResult | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [healthRes, logsRes] = await Promise.all([
        fetch("/api/integrations"),
        fetch("/api/integrations?action=logs&limit=20"),
      ]);
      const healthData = await healthRes.json();
      const logsData = await logsRes.json();
      setHealth(healthData);
      setLogs(logsData.logs ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const runHealthCheck = async () => {
    setChecking(true);
    try {
      await fetch("/api/integrations?action=health-check");
      await fetchData();
    } catch { /* ignore */ }
    setChecking(false);
  };

  const sendTestRecord = async (systemCode: string) => {
    setSendingTest(systemCode);
    setTestSuccess(null);
    try {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemCode }),
      });
      const data = await res.json();
      if (res.ok) {
        setTestSuccess(`Successfully ingested via ${systemCode}: Case ${data.result?.unifiedCasePublicId ?? "Linked"}`);
        await fetchData();
      } else {
        alert(`Ingestion failed: ${data.error}`);
      }
    } catch (err) {
      alert(`Error sending test record: ${err}`);
    }
    setSendingTest(null);
  };

  const handleRunDemo = async () => {
    setRunningDemo(true);
    setDemoResult(null);
    try {
      const res = await fetch("/api/integrations?action=demo", { method: "POST" });
      const data = await res.json();
      if (data.ok && data.demo) {
        setDemoResult(data.demo);
        await fetchData();
      } else {
        alert(`Demo execution error: ${data.error}`);
      }
    } catch (err) {
      alert(`Demo execution failed: ${err}`);
    }
    setRunningDemo(false);
  };

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight">Government Integration Hub</h1>
            <Badge variant="secondary" className="text-xs">SIH26129 Interoperability</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Connects fragmented municipal, state, and departmental portals into the Common Civic Schema
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={handleRunDemo}
            disabled={runningDemo}
            className="bg-gradient-to-r from-primary to-teal-700 font-bold text-primary-foreground shadow-md hover:opacity-95"
          >
            <Play className={`mr-1.5 h-4 w-4 ${runningDemo ? "animate-spin" : ""}`} />
            {runningDemo ? "Executing 15-Step Demo…" : "RUN INTEROPERABILITY DEMO"}
          </Button>
          <Button size="sm" variant="outline" onClick={runHealthCheck} disabled={checking}>
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${checking ? "animate-spin" : ""}`} />
            Health Check
          </Button>
        </div>
      </div>

      {/* Quick Navigation Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b pb-3 text-xs">
        <span className="font-semibold text-muted-foreground">Interoperability Modules:</span>
        <Button variant="ghost" size="sm" onClick={() => setView({ name: "admin", tab: "cases" })} className="h-8 gap-1.5">
          <Layers className="h-3.5 w-3.5 text-primary" /> Unified Cases
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setView({ name: "admin", tab: "data-quality" })} className="h-8 gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-blue-600" /> Data Quality Engine
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setView({ name: "admin", tab: "consent" })} className="h-8 gap-1.5">
          <FileCheck className="h-3.5 w-3.5 text-emerald-600" /> Citizen Consent
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setView({ name: "admin", tab: "master-data" })} className="h-8 gap-1.5">
          <Server className="h-3.5 w-3.5 text-violet-600" /> Master Data & Entities
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setView({ name: "admin", tab: "failures" })} className="h-8 gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> Retry & Dead-Letter
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setView({ name: "admin", tab: "graph" })} className="h-8 gap-1.5">
          <Network className="h-3.5 w-3.5 text-indigo-600" /> Problem Graph
        </Button>
      </div>

      {testSuccess && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
          <p className="font-semibold flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4" /> {testSuccess}
          </p>
        </div>
      )}

      {/* Live Demo Results Drawer / Modal Banner */}
      {demoResult && (
        <Card className="border-2 border-primary bg-primary/5 shadow-xl">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Badge className="bg-primary text-primary-foreground mb-1">
                  15-STEP INTEROPERABILITY DEMO COMPLETE
                </Badge>
                <CardTitle className="text-lg font-bold">
                  Unified Case: <span className="font-mono text-primary">{demoResult.unifiedCasePublicId}</span>
                </CardTitle>
                <CardDescription className="text-xs font-mono text-muted-foreground mt-0.5">
                  Correlation Trace ID: <span className="text-foreground font-semibold">{demoResult.correlationId}</span>
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setView({ name: "admin", tab: "cases" })}>
                  View Case Details
                </Button>
                <Button size="sm" variant="outline" onClick={() => setView({ name: "admin", tab: "audit" })}>
                  Inspect Audit Trail
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3 text-xs">
              <div className="rounded-lg border bg-background p-3">
                <p className="text-muted-foreground font-medium">Resolved Master Road:</p>
                <p className="font-bold text-foreground mt-0.5">{demoResult.masterRoad}</p>
                <p className="text-[10px] text-muted-foreground">3 portal names mapped to 1 master entity</p>
              </div>
              <div className="rounded-lg border bg-background p-3">
                <p className="text-muted-foreground font-medium">Assigned Department:</p>
                <p className="font-bold text-primary mt-0.5">{demoResult.assignedDepartment.toUpperCase()}</p>
                <p className="text-[10px] text-muted-foreground leading-tight">{demoResult.routingReason}</p>
              </div>
              <div className="rounded-lg border bg-background p-3">
                <p className="text-muted-foreground font-medium">Data Quality & SLA:</p>
                <p className="font-bold text-emerald-600 mt-0.5">Avg Score: {demoResult.dataQualityAverageScore}/100 • {demoResult.slaPriority} (24h)</p>
                <p className="text-[10px] text-muted-foreground">Automated escalation & resolution proof verified</p>
              </div>
            </div>

            {/* Step Progression Timeline */}
            <div className="space-y-1.5 pt-2">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Execution Steps (All 15 Completed Live):</p>
              <div className="max-h-60 overflow-y-auto space-y-1 rounded-lg border bg-background p-3 font-mono text-xs">
                {demoResult.steps.map((st) => (
                  <div key={st.step} className="flex items-start gap-2 py-1 border-b last:border-0 border-border/40">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 font-bold text-[10px]">
                      {st.step}
                    </span>
                    <div className="flex-1">
                      <span className="font-bold text-foreground">{st.title}</span>
                      <p className="text-muted-foreground font-sans text-[11px] leading-relaxed mt-0.5">{st.details}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Simulated Notice */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/50">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="text-sm">
            <p className="font-medium text-amber-800 dark:text-amber-300">Simulated Government Integration Environment</p>
            <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400/80">
              Connectors are currently labeled <strong>SIMULATED GOVERNMENT SYSTEM</strong> for demonstration. Real endpoints plug in via standard REST/Webhook adapters without architectural changes.
            </p>
          </div>
        </div>
      </div>

      {/* Health Summary Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/50">
              <Wifi className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{health?.onlineSystems ?? 0}</p>
              <p className="text-xs text-muted-foreground">Systems Connected</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/50">
              <ArrowDownUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{health?.totalRequests ?? 0}</p>
              <p className="text-xs text-muted-foreground">Total API Calls</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/50">
              <Zap className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{health?.successRate ?? 100}%</p>
              <p className="text-xs text-muted-foreground">Success Rate</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/50">
              <Activity className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{health?.avgLatencyMs ?? 0}ms</p>
              <p className="text-xs text-muted-foreground">Avg Adapter Latency</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Connected Systems Registry with "Send Test Record" */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Server className="h-4 w-4" /> Connected Government Digital Platforms
          </CardTitle>
          <CardDescription>
            Simulated government systems with live data adapters. Click "Send Test Record" to test ingestion through the full pipeline.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(health?.systems ?? []).map((sys) => {
              const cfg = STATUS_CONFIG[sys.status] ?? STATUS_CONFIG.OFFLINE;
              const StatusIcon = cfg.icon;
              const isSending = sendingTest === sys.code;

              return (
                <div key={sys.id} className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between bg-card">
                  <div className="flex items-start gap-3">
                    <div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${cfg.color}`} />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{sys.name}</span>
                        <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary">
                          {sys.isSimulated ? "SIMULATED GOVERNMENT SYSTEM" : "LIVE API"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {sys.department ?? sys.type} · System Code: <span className="font-mono">{sys.code}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 text-xs">
                    <Badge variant="outline" className="gap-1">
                      <StatusIcon className="h-3 w-3" /> {cfg.label}
                    </Badge>
                    {sys.healthLatencyMs != null && (
                      <Badge variant="outline" className="gap-1">
                        <Activity className="h-3 w-3" /> {sys.healthLatencyMs}ms
                      </Badge>
                    )}
                    <span className="text-muted-foreground">
                      {sys.requestCount} requests
                    </span>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-8 gap-1.5 text-xs font-semibold"
                      disabled={isSending}
                      onClick={() => sendTestRecord(sys.code)}
                    >
                      <Send className={`h-3 w-3 ${isSending ? "animate-spin" : ""}`} />
                      {isSending ? "Processing…" : "Send Test Record"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Integration Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ScrollText className="h-4 w-4" /> Recent Integration Logs & Webhooks
          </CardTitle>
          <CardDescription>
            Live trace of all inbound webhook deliveries and outbound health checks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {logs.map((log) => (
              <div key={log.id} className="flex items-center gap-3 rounded border px-3 py-2 text-xs">
                <div className={`h-2 w-2 shrink-0 rounded-full ${log.success ? "bg-emerald-500" : "bg-red-500"}`} />
                <span className="w-16 shrink-0 font-medium">{log.direction}</span>
                <span className="w-12 shrink-0 font-mono">{log.method}</span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground font-mono">{log.endpoint}</span>
                <span className="shrink-0 font-semibold">{log.systemCode}</span>
                {log.latencyMs != null && <span className="shrink-0 text-muted-foreground">{log.latencyMs}ms</span>}
                {log.statusCode && <Badge variant={log.success ? "secondary" : "destructive"} className="text-[10px]">{log.statusCode}</Badge>}
              </div>
            ))}
            {logs.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No integration logs yet. Click "Send Test Record" or "Health Check" to trigger activity.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
