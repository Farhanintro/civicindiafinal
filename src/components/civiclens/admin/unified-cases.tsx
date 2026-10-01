"use client";

// CIVIC INDIA 2.0 — Unified Cases Dashboard
// Shows unified civic cases that aggregate complaints from multiple government systems.

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FolderKanban, LinkIcon, Building2, MapPin, Clock, AlertTriangle,
  CheckCircle2, ChevronDown, ChevronUp, Shield, BrainCircuit,
} from "lucide-react";

interface CaseLinkDTO {
  id: string; sourceSystemName: string | null; sourceSystemCode: string | null;
  sourceComplaintId: string; incidentPublicId: string | null;
  linkType: string; matchConfidence: number | null;
  matchReasons: string[]; createdAt: string;
}

interface UnifiedCaseDTO {
  id: string; caseId: string; title: string; description: string | null;
  categoryKey: string | null; severity: string; priority: string;
  priorityScore: number; priorityReasons: string[];
  departmentKey: string | null; departmentReason: string | null;
  address: string | null; city: string | null; status: string;
  sourceCount: number; complaintCount: number;
  matchConfidence: number | null; matchReasons: string[];
  isRecurring: boolean; slaBreached: boolean;
  createdAt: string; updatedAt: string; links: CaseLinkDTO[];
}

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  INVESTIGATING: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  IN_PROGRESS: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  RESOLVED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  CLOSED: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  ESCALATED: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

const PRIORITY_COLORS: Record<string, string> = {
  P1: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300",
  P2: "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950 dark:text-orange-300",
  P3: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300",
  P4: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300",
};

export function UnifiedCases() {
  const [cases, setCases] = useState<UnifiedCaseDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedCase, setExpandedCase] = useState<string | null>(null);

  const fetchCases = useCallback(async () => {
    try {
      const res = await fetch("/api/cases?limit=50");
      const data = await res.json();
      setCases(data.cases ?? []);
      setTotal(data.total ?? 0);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { void fetchCases(); }, [fetchCases]);

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Unified Civic Cases</h1>
          <p className="text-sm text-muted-foreground">
            Cross-platform cases linking complaints from multiple government systems into one actionable case
          </p>
        </div>
        <Badge variant="outline" className="gap-1.5">
          <FolderKanban className="h-3.5 w-3.5" />
          {total} Cases
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/50">
              <FolderKanban className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{total}</p>
              <p className="text-xs text-muted-foreground">Total Cases</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/50">
              <LinkIcon className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {cases.reduce((s, c) => s + c.complaintCount, 0)}
              </p>
              <p className="text-xs text-muted-foreground">Linked Complaints</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/50">
              <Building2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {cases.filter((c) => c.sourceCount >= 2).length}
              </p>
              <p className="text-xs text-muted-foreground">Cross-Platform</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/50">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {cases.filter((c) => c.slaBreached).length}
              </p>
              <p className="text-xs text-muted-foreground">SLA Breached</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cases List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Unified Cases</CardTitle>
          <CardDescription>Each case may link complaints from multiple government platforms</CardDescription>
        </CardHeader>
        <CardContent>
          {cases.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <FolderKanban className="h-10 w-10 text-muted-foreground/50" />
              <div>
                <p className="font-medium text-muted-foreground">No unified cases yet</p>
                <p className="mt-1 text-xs text-muted-foreground/70">
                  Cases are created when complaints from multiple government systems are linked together.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {cases.map((uc) => (
                <div key={uc.id} className="rounded-lg border">
                  <button
                    className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-muted/50"
                    onClick={() => setExpandedCase(expandedCase === uc.id ? null : uc.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-bold text-primary">{uc.caseId}</span>
                        <Badge className={`text-[10px] ${STATUS_COLORS[uc.status] ?? ""}`}>{uc.status}</Badge>
                        <Badge className={`text-[10px] ${PRIORITY_COLORS[uc.priority] ?? ""}`}>{uc.priority}</Badge>
                        {uc.slaBreached && <Badge variant="destructive" className="text-[10px]">SLA BREACHED</Badge>}
                        {uc.sourceCount >= 2 && (
                          <Badge variant="outline" className="gap-1 text-[10px]">
                            <LinkIcon className="h-2.5 w-2.5" /> {uc.sourceCount} Systems
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm font-medium">{uc.title}</p>
                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                        {uc.address && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {uc.address}</span>}
                        <span className="flex items-center gap-1"><LinkIcon className="h-3 w-3" /> {uc.complaintCount} complaints</span>
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(uc.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    {expandedCase === uc.id ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
                  </button>

                  {expandedCase === uc.id && (
                    <div className="border-t bg-muted/20 p-4 space-y-4">
                      {/* Match confidence */}
                      {uc.matchConfidence != null && (
                        <div className="rounded-lg border bg-background p-3">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <BrainCircuit className="h-4 w-4 text-primary" />
                            AI Match Confidence: {Math.round(uc.matchConfidence * 100)}%
                          </div>
                          {uc.matchReasons.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {uc.matchReasons.map((r, i) => (
                                <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <CheckCircle2 className="h-3 w-3 text-emerald-500" /> {r}
                                </div>
                              ))}
                            </div>
                          )}
                          <p className="mt-2 text-[10px] italic text-muted-foreground/70">
                            ⚠ AI-generated assessment — not a verified government conclusion
                          </p>
                        </div>
                      )}

                      {/* Linked complaints */}
                      <div>
                        <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Linked Complaints</p>
                        <div className="space-y-2">
                          {uc.links.map((link) => (
                            <div key={link.id} className="flex items-center gap-3 rounded border bg-background px-3 py-2 text-xs">
                              <Badge variant="outline" className="text-[10px]">{link.linkType}</Badge>
                              <span className="font-mono font-bold">{link.sourceComplaintId}</span>
                              {link.sourceSystemName && (
                                <span className="text-muted-foreground">← {link.sourceSystemName}</span>
                              )}
                              {link.incidentPublicId && (
                                <Badge variant="secondary" className="text-[10px]">→ {link.incidentPublicId}</Badge>
                              )}
                              {link.matchConfidence != null && (
                                <span className="ml-auto text-muted-foreground">
                                  {Math.round(link.matchConfidence * 100)}% match
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Department routing */}
                      {uc.departmentKey && (
                        <div className="rounded-lg border bg-background p-3">
                          <p className="text-xs font-semibold">Routed Department: <span className="text-primary">{uc.departmentKey}</span></p>
                          {uc.departmentReason && (
                            <p className="mt-1 text-xs text-muted-foreground">{uc.departmentReason}</p>
                          )}
                        </div>
                      )}

                      {/* Priority reasons */}
                      {uc.priorityReasons.length > 0 && (
                        <div className="rounded-lg border bg-background p-3">
                          <p className="text-xs font-semibold mb-1">Priority Assessment ({uc.priority})</p>
                          {uc.priorityReasons.map((r, i) => (
                            <p key={i} className="text-xs text-muted-foreground">• {r}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
