"use client";

// CIVIC INDIA 2.0 — Data Quality Dashboard
// Inspects data quality scores, validation errors, quarantined payloads, and allows manual reviews.

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ShieldCheck, AlertTriangle, XCircle, CheckCircle2, Clock,
  Filter, Eye, RefreshCw, FileText, Check, Ban,
} from "lucide-react";

interface DataQualityRecordDTO {
  id: string;
  systemName: string;
  systemCode: string;
  sourceRecordId: string;
  correlationId: string | null;
  score: number;
  status: "VALID" | "WARNING" | "REVIEW" | "REJECTED" | "QUARANTINED";
  errors: string[];
  warnings: string[];
  normalizedFields: string[];
  rejectedFields: string[];
  suggestedFix?: string;
  rawPayload: Record<string, unknown>;
  normalizedPayload: Record<string, unknown>;
  checkedAt: string;
}

interface DataQualityMetrics {
  total: number;
  validCount: number;
  warningCount: number;
  reviewCount: number;
  rejectedCount: number;
  quarantinedCount: number;
  avgScore: number;
  records: DataQualityRecordDTO[];
}

const STATUS_BADGES: Record<string, { color: string; label: string }> = {
  VALID: { color: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300", label: "Valid" },
  WARNING: { color: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300", label: "Warning" },
  REVIEW: { color: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300", label: "Needs Review" },
  REJECTED: { color: "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300", label: "Rejected" },
  QUARANTINED: { color: "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950 dark:text-purple-300", label: "Quarantined" },
};

export function DataQualityDashboard() {
  const [metrics, setMetrics] = useState<DataQualityMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<DataQualityRecordDTO | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const url = filterStatus ? `/api/data-quality?status=${filterStatus}` : "/api/data-quality";
      const res = await fetch(url);
      const data = await res.json();
      setMetrics(data);
      if (data.records?.length > 0 && !selectedRecord) {
        setSelectedRecord(data.records[0]);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [filterStatus, selectedRecord]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    setUpdating(true);
    try {
      await fetch("/api/data-quality", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });
      await fetchData();
    } catch { /* ignore */ }
    setUpdating(false);
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
          <h1 className="text-xl font-bold tracking-tight">Data Quality Engine</h1>
          <p className="text-sm text-muted-foreground">
            Automatic schema validation, coordinate bounding checks, and quarantined record governance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5 font-mono">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            Avg Score: {metrics?.avgScore ?? 100}/100
          </Badge>
          <Button size="sm" variant="outline" onClick={() => void fetchData()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setFilterStatus(null)}>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Total Ingested</p>
            <p className="text-2xl font-bold mt-1">{metrics?.total ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-emerald-500/50 transition-colors" onClick={() => setFilterStatus("VALID")}>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-emerald-600">Valid (Passed)</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{metrics?.validCount ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-amber-500/50 transition-colors" onClick={() => setFilterStatus("WARNING")}>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-amber-600">Warnings</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{metrics?.warningCount ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-blue-500/50 transition-colors" onClick={() => setFilterStatus("REVIEW")}>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-blue-600">Needs Review</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{metrics?.reviewCount ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-rose-500/50 transition-colors" onClick={() => setFilterStatus("REJECTED")}>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-rose-600">Rejected / Quarantined</p>
            <p className="text-2xl font-bold text-rose-600 mt-1">{(metrics?.rejectedCount ?? 0) + (metrics?.quarantinedCount ?? 0)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid: Record List + Detail Inspector */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left: Records Table */}
        <div className="lg:col-span-6 space-y-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Evaluated Inbound Records</span>
                {filterStatus && (
                  <Button size="sm" variant="ghost" onClick={() => setFilterStatus(null)} className="h-6 text-xs text-muted-foreground px-2">
                    Clear filter ({filterStatus})
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y max-h-[600px] overflow-y-auto">
                {(metrics?.records ?? []).map((rec) => {
                  const isSelected = selectedRecord?.id === rec.id;
                  const badge = STATUS_BADGES[rec.status] ?? STATUS_BADGES.VALID;

                  return (
                    <button
                      key={rec.id}
                      onClick={() => setSelectedRecord(rec)}
                      className={`w-full p-3.5 text-left flex items-start justify-between gap-3 transition-colors ${
                        isSelected ? "bg-accent/60" : "hover:bg-muted/40"
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-xs">{rec.sourceRecordId}</span>
                          <span className="text-xs text-muted-foreground">({rec.systemCode})</span>
                          <Badge variant="outline" className={`text-[10px] ${badge.color}`}>
                            {badge.label}
                          </Badge>
                        </div>
                        {rec.errors.length > 0 ? (
                          <p className="text-xs text-rose-600 mt-1 truncate max-w-sm">• {rec.errors[0]}</p>
                        ) : rec.warnings.length > 0 ? (
                          <p className="text-xs text-amber-600 mt-1 truncate max-w-sm">• {rec.warnings[0]}</p>
                        ) : (
                          <p className="text-xs text-muted-foreground mt-1">All schema validations passed successfully.</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`font-mono font-bold text-sm ${rec.score >= 80 ? "text-emerald-600" : rec.score >= 60 ? "text-amber-600" : "text-rose-600"}`}>
                          {rec.score}%
                        </span>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(rec.checkedAt).toLocaleTimeString()}</p>
                      </div>
                    </button>
                  );
                })}
                {(metrics?.records ?? []).length === 0 && (
                  <p className="p-6 text-center text-sm text-muted-foreground">
                    No data quality evaluation records found.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Detailed Record Inspector */}
        <div className="lg:col-span-6">
          {selectedRecord ? (
            <Card className="h-full">
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base font-bold font-mono">
                        {selectedRecord.sourceRecordId}
                      </CardTitle>
                      <Badge className={STATUS_BADGES[selectedRecord.status]?.color}>
                        {selectedRecord.status}
                      </Badge>
                    </div>
                    <CardDescription className="text-xs mt-0.5">
                      Source System: <strong className="text-foreground">{selectedRecord.systemName}</strong> ({selectedRecord.systemCode})
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-primary font-mono">{selectedRecord.score}</span>
                    <span className="text-xs text-muted-foreground">/100</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-4 text-xs font-sans">
                {/* Validation Warnings / Errors */}
                {selectedRecord.errors.length > 0 && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50/60 p-3 dark:border-rose-900/40 dark:bg-rose-950/30">
                    <p className="font-bold text-rose-700 dark:text-rose-300 flex items-center gap-1.5 mb-1">
                      <XCircle className="h-4 w-4" /> Validation Failures:
                    </p>
                    <ul className="list-disc list-inside space-y-0.5 text-rose-800 dark:text-rose-200">
                      {selectedRecord.errors.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  </div>
                )}

                {selectedRecord.warnings.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900/40 dark:bg-amber-950/30">
                    <p className="font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5 mb-1">
                      <AlertTriangle className="h-4 w-4" /> Warnings & Fallbacks:
                    </p>
                    <ul className="list-disc list-inside space-y-0.5 text-amber-800 dark:text-amber-200">
                      {selectedRecord.warnings.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                  </div>
                )}

                {/* Suggested Fix */}
                {selectedRecord.suggestedFix && (
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="font-semibold text-foreground mb-0.5">Automated Recommendation:</p>
                    <p className="text-muted-foreground">{selectedRecord.suggestedFix}</p>
                  </div>
                )}

                {/* Side-by-Side Payload Inspector */}
                <div className="grid gap-3 sm:grid-cols-2 pt-2">
                  <div>
                    <p className="font-semibold text-muted-foreground mb-1.5">Original Source Payload</p>
                    <pre className="rounded-lg border bg-muted/40 p-3 font-mono text-[11px] max-h-52 overflow-auto text-foreground">
                      {JSON.stringify(selectedRecord.rawPayload, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <p className="font-semibold text-primary mb-1.5">Normalized Canonical Schema</p>
                    <pre className="rounded-lg border border-primary/20 bg-primary/5 p-3 font-mono text-[11px] max-h-52 overflow-auto text-foreground">
                      {JSON.stringify(selectedRecord.normalizedPayload, null, 2)}
                    </pre>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-2 pt-4 border-t">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs gap-1"
                    disabled={updating}
                    onClick={() => handleUpdateStatus(selectedRecord.id, "REJECTED")}
                  >
                    <Ban className="h-3 w-3 text-rose-600" /> Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="text-xs gap-1"
                    disabled={updating}
                    onClick={() => handleUpdateStatus(selectedRecord.id, "QUARANTINED")}
                  >
                    <AlertTriangle className="h-3 w-3 text-purple-600" /> Quarantine
                  </Button>
                  <Button
                    size="sm"
                    className="text-xs gap-1"
                    disabled={updating}
                    onClick={() => handleUpdateStatus(selectedRecord.id, "VALID")}
                  >
                    <Check className="h-3 w-3" /> Approve Record
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="h-full flex items-center justify-center p-12 text-center text-muted-foreground text-sm">
              Select an inbound record to inspect quality metrics and side-by-side payloads.
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
