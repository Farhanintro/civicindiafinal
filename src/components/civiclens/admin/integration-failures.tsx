"use client";

// CIVIC INDIA 2.0 — Integration Failures & Dead-Letter Dashboard
// Monitors failed external API webhooks, retry attempts, and quarantined poison-pill records.

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle, RotateCcw, ShieldAlert, CheckCircle2,
  XCircle, Clock, Eye, Ban, RefreshCw,
} from "lucide-react";

interface FailureItemDTO {
  id: string;
  sourceSystemCode: string;
  sourceRecordId: string;
  correlationId: string | null;
  endpoint: string;
  payload: Record<string, unknown>;
  retryCount: number;
  maxRetries: number;
  status: string;
  lastError: string | null;
  nextRetryAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export function IntegrationFailuresDashboard() {
  const [failures, setFailures] = useState<FailureItemDTO[]>([]);
  const [counts, setCounts] = useState({ pending: 0, failed: 0, deadLetter: 0, quarantined: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<FailureItemDTO | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations?action=failures");
      const data = await res.json();
      setFailures(data.items ?? []);
      setCounts({
        pending: data.pendingCount ?? 0,
        failed: data.failedCount ?? 0,
        deadLetter: data.deadLetterCount ?? 0,
        quarantined: data.quarantinedCount ?? 0,
      });
      if (data.items?.length > 0 && !selectedItem) {
        setSelectedItem(data.items[0]);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [selectedItem]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const handleRetry = async (item: FailureItemDTO) => {
    setRetrying(item.id);
    try {
      // Re-submit through integration pipeline
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemCode: item.sourceSystemCode,
          complaintId: item.sourceRecordId,
          data: item.payload,
        }),
      });
      if (res.ok) {
        alert(`Retry successful for ${item.sourceRecordId}`);
        await fetchData();
      } else {
        const d = await res.json();
        alert(`Retry failed: ${d.error}`);
      }
    } catch (err) {
      alert(`Error retrying record: ${err}`);
    }
    setRetrying(null);
  };

  const handleQuarantine = async (id: string) => {
    try {
      await fetch("/api/integrations?action=quarantine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, reason: "Manual quarantine by Administrator" }),
      });
      await fetchData();
    } catch { /* ignore */ }
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
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Integration Failures & Dead-Letter Queue</h1>
          <p className="text-sm text-muted-foreground">
            Automatic retry scheduler with exponential backoff and quarantine isolation for malformed payloads
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void fetchData()}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh Queue
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-900/50">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{counts.pending}</p>
              <p className="text-xs text-muted-foreground">Scheduled Retries</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-900/50">
              <XCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{counts.failed}</p>
              <p className="text-xs text-muted-foreground">Failed Deliveries</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-900/50">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{counts.quarantined}</p>
              <p className="text-xs text-muted-foreground">Quarantined Records</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">Exponential</p>
              <p className="text-xs text-muted-foreground">Backoff Active (3 Max)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Split */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left: Queue Items */}
        <div className="lg:col-span-6 space-y-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" /> Retry Queue Records
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y max-h-[500px] overflow-y-auto">
                {failures.map((item) => {
                  const isSelected = selectedItem?.id === item.id;
                  const isQuarantined = item.status === "QUARANTINED";

                  return (
                    <button
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      className={`w-full p-3.5 text-left flex items-start justify-between gap-3 transition-colors ${
                        isSelected ? "bg-accent/60" : "hover:bg-muted/40"
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-xs">{item.sourceRecordId}</span>
                          <span className="text-xs text-muted-foreground">({item.sourceSystemCode})</span>
                          <Badge variant={isQuarantined ? "destructive" : "outline"} className="text-[10px]">
                            {item.status} ({item.retryCount}/{item.maxRetries})
                          </Badge>
                        </div>
                        <p className="text-xs text-rose-600 mt-1 truncate max-w-sm">
                          {item.lastError || "Validation or connectivity failure"}
                        </p>
                      </div>
                      <div className="text-right shrink-0 text-[10px] text-muted-foreground">
                        {new Date(item.createdAt).toLocaleTimeString()}
                      </div>
                    </button>
                  );
                })}
                {failures.length === 0 && (
                  <p className="p-8 text-center text-sm text-muted-foreground">
                    ✓ Retry queue is clean. All integrated government records are processing normally.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Item Inspector */}
        <div className="lg:col-span-6">
          {selectedItem ? (
            <Card className="h-full">
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-bold font-mono">
                      {selectedItem.sourceRecordId}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      System: <strong>{selectedItem.sourceSystemCode}</strong> • Endpoint: {selectedItem.endpoint}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="font-mono">
                    Retries: {selectedItem.retryCount}/{selectedItem.maxRetries}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-4 text-xs font-sans">
                {/* Last Error */}
                <div className="rounded-lg border border-rose-200 bg-rose-50/60 p-3 dark:border-rose-900/40 dark:bg-rose-950/30">
                  <p className="font-bold text-rose-700 dark:text-rose-300 mb-0.5">Last Logged Error:</p>
                  <p className="text-rose-800 dark:text-rose-200 font-mono text-[11px] break-words">
                    {selectedItem.lastError}
                  </p>
                </div>

                {/* Raw Payload */}
                <div>
                  <p className="font-semibold text-muted-foreground mb-1.5">Captured Payload Reference</p>
                  <pre className="rounded-lg border bg-muted/40 p-3 font-mono text-[11px] max-h-60 overflow-auto">
                    {JSON.stringify(selectedItem.payload, null, 2)}
                  </pre>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs text-rose-600 gap-1"
                    onClick={() => handleQuarantine(selectedItem.id)}
                  >
                    <Ban className="h-3 w-3" /> Move to Quarantine
                  </Button>
                  <Button
                    size="sm"
                    className="text-xs gap-1"
                    disabled={retrying === selectedItem.id}
                    onClick={() => handleRetry(selectedItem)}
                  >
                    <RotateCcw className={`h-3 w-3 ${retrying === selectedItem.id ? "animate-spin" : ""}`} />
                    {retrying === selectedItem.id ? "Retrying…" : "Manual Retry Now"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="h-full flex items-center justify-center p-12 text-center text-muted-foreground text-sm">
              Select a queued failure to inspect payload and retry.
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
