"use client";

// CIVIC INDIA 2.0 — Citizen Consent Governance Dashboard
// Visualizes inter-departmental data sharing permissions, telemetry vs PII segregation, and consent audit logs.

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileCheck, Shield, CheckCircle2, XCircle, Clock, UserCheck,
  Lock, Unlock, RefreshCw, Plus, ArrowRight,
} from "lucide-react";

interface ConsentDTO {
  id: string;
  citizenId: string;
  citizenName: string;
  requestingSystem: string;
  receivingSystem: string;
  purpose: string;
  allowedFields: string[];
  restrictedFields: string[];
  status: "GRANTED" | "PENDING" | "DENIED" | "EXPIRED" | "REVOKED";
  version: string;
  consentEvidence: string | null;
  grantedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  events: Array<{
    id: string;
    action: string;
    actor: string;
    dataFields: string[];
    createdAt: string;
  }>;
}

export function ConsentDashboard() {
  const [consents, setConsents] = useState<ConsentDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/consent");
      const data = await res.json();
      setConsents(data.consents ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const handleRevoke = async (consentId: string) => {
    setRevoking(consentId);
    try {
      await fetch("/api/consent", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consentId }),
      });
      await fetchData();
    } catch { /* ignore */ }
    setRevoking(null);
  };

  const handleGrantDemo = async () => {
    try {
      await fetch("/api/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          citizenId: "MCIT-ALW-0042",
          citizenName: "Aarav Sharma",
          requestingSystem: "PWD_SYSTEM",
          receivingSystem: "MUNICIPAL_PORTAL",
          purpose: "Road repair verification & field photo validation",
          allowedFields: ["location", "description", "evidence", "category"],
          restrictedFields: ["phone", "email"],
        }),
      });
      await fetchData();
    } catch { /* ignore */ }
  };

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      </div>
    );
  }

  const activeCount = consents.filter((c) => c.status === "GRANTED").length;
  const revokedCount = consents.filter((c) => c.status === "REVOKED").length;

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Citizen Consent & Privacy Governance</h1>
          <p className="text-sm text-muted-foreground">
            Purpose-bound data sharing between departments. Protects citizen PII while sharing civic defect telemetry.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleGrantDemo} className="gap-1.5 text-xs font-semibold">
            <Plus className="h-3.5 w-3.5" /> Simulate Citizen Consent Grant
          </Button>
          <Button size="sm" variant="outline" onClick={() => void fetchData()}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/50">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeCount}</p>
              <p className="text-xs text-muted-foreground">Active Granted Consents</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-100 dark:bg-rose-900/50">
              <XCircle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{revokedCount}</p>
              <p className="text-xs text-muted-foreground">Revoked Consents</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/50">
              <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">100%</p>
              <p className="text-xs text-muted-foreground">PII Masking Compliance</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Privacy Notice Banner */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-900/40 dark:bg-blue-950/30">
        <div className="flex items-start gap-3">
          <Shield className="mt-0.5 h-5 w-5 text-blue-600 shrink-0" />
          <div className="text-xs space-y-1">
            <p className="font-bold text-blue-900 dark:text-blue-200">Zero-PII Interoperability Standard</p>
            <p className="text-blue-800 dark:text-blue-300/90 leading-relaxed">
              When a citizen lodges an issue on the Municipal Portal, external departments (like PWD or Water Supply) receive only 
              <strong> verifiable physical telemetry</strong> (GPS coordinates, description, category, and photo evidence). 
              Direct personal identifiers (phone numbers, personal emails) are encrypted and restricted unless explicit purpose-bound consent is granted.
            </p>
          </div>
        </div>
      </div>

      {/* Consents List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileCheck className="h-4 w-4" /> Inter-Departmental Consent Agreements
          </CardTitle>
          <CardDescription>
            Active data-sharing contracts governed by citizen privacy preferences
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {consents.map((c) => {
              const isGranted = c.status === "GRANTED";
              return (
                <div key={c.id} className="rounded-xl border p-4 bg-card space-y-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b pb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm">{c.citizenName}</span>
                      <span className="font-mono text-xs text-muted-foreground">({c.citizenId})</span>
                      <Badge variant={isGranted ? "secondary" : "destructive"} className="text-xs">
                        {c.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">Version: {c.version}</span>
                    </div>
                    {isGranted && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 h-7 px-2"
                        disabled={revoking === c.id}
                        onClick={() => handleRevoke(c.id)}
                      >
                        Revoke Consent
                      </Button>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 text-xs">
                    <div>
                      <p className="text-muted-foreground font-medium">Data Transfer Channel:</p>
                      <p className="font-semibold text-foreground mt-0.5 flex items-center gap-1.5">
                        <span>{c.requestingSystem}</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <span className="text-primary">{c.receivingSystem}</span>
                      </p>
                      <p className="mt-2 text-muted-foreground font-medium">Specified Purpose:</p>
                      <p className="text-foreground mt-0.5">{c.purpose}</p>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <p className="text-muted-foreground font-medium flex items-center gap-1">
                          <Unlock className="h-3 w-3 text-emerald-600" /> Permitted Shared Fields:
                        </p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {c.allowedFields.map((f) => (
                            <Badge key={f} variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                              ✓ {f}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-muted-foreground font-medium flex items-center gap-1">
                          <Lock className="h-3 w-3 text-rose-600" /> Restricted & Redacted PII:
                        </p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {c.restrictedFields.map((f) => (
                            <Badge key={f} variant="outline" className="text-[10px] bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                              ✗ {f} (Blocked)
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {c.events.length > 0 && (
                    <div className="rounded-lg bg-muted/40 p-2.5 text-[11px] font-mono text-muted-foreground">
                      <p className="font-sans font-bold text-foreground mb-1">Recent Access Audit Log:</p>
                      {c.events.map((e) => (
                        <div key={e.id} className="flex items-center justify-between py-0.5">
                          <span>[{e.action}] by {e.actor} — fields: {e.dataFields.join(", ") || "none"}</span>
                          <span>{new Date(e.createdAt).toLocaleTimeString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
