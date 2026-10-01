"use client";

// CIVIC INDIA 2.0 — AI Insights Dashboard
// Shows AI-generated civic intelligence insights and root cause analyses.

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BrainCircuit, RefreshCw, Lightbulb, AlertTriangle, TrendingUp,
  MapPin, Clock, Building2, GitBranch, Info, Zap,
} from "lucide-react";

interface InsightDTO {
  id: string; type: string; title: string; description: string;
  severity: string; confidence: number; isActive: boolean;
  createdAt: string;
}

interface RootCauseDTO {
  id: string; incidentId: string | null; possibleCause: string;
  evidence: string[]; confidence: number; recommendedAction: string;
  previousRepairs: number; relatedIncidents: string[];
  isAiGenerated: boolean; verifiedByHuman: boolean; createdAt: string;
}

const INSIGHT_ICONS: Record<string, typeof TrendingUp> = {
  TREND: TrendingUp,
  HOTSPOT: MapPin,
  RECURRING: GitBranch,
  SLA_RISK: Clock,
  DEPARTMENT: Building2,
  CORRELATION: Zap,
};

const SEVERITY_STYLES: Record<string, string> = {
  INFO: "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/50",
  WARNING: "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/50",
  CRITICAL: "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/50",
};

export function AiInsights() {
  const [insights, setInsights] = useState<InsightDTO[]>([]);
  const [rootCauses, setRootCauses] = useState<RootCauseDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [insightsRes, rcaRes] = await Promise.all([
        fetch("/api/ai"),
        fetch("/api/ai?action=root-cause"),
      ]);
      const insightsData = await insightsRes.json();
      const rcaData = await rcaRes.json();
      setInsights(insightsData.insights ?? []);
      setRootCauses(rcaData.analyses ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const generateNew = async () => {
    setGenerating(true);
    try {
      await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate-insights" }),
      });
      await fetchData();
    } catch { /* ignore */ }
    setGenerating(false);
  };

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">AI Civic Intelligence</h1>
          <p className="text-sm text-muted-foreground">
            AI-generated insights, trends, and root cause analyses based on real system data
          </p>
        </div>
        <Button size="sm" onClick={generateNew} disabled={generating}>
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${generating ? "animate-spin" : ""}`} />
          Generate Insights
        </Button>
      </div>

      {/* Disclaimer */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950/50">
        <div className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 text-blue-600 dark:text-blue-400" />
          <p className="text-sm text-blue-800 dark:text-blue-300">
            All insights are AI-generated <strong>recommendations</strong> based on system data — not verified government conclusions.
            Human review and override is always available.
          </p>
        </div>
      </div>

      {/* Insights Grid */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Active Insights ({insights.length})
        </h2>
        {insights.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <Lightbulb className="h-10 w-10 text-muted-foreground/50" />
              <div>
                <p className="font-medium text-muted-foreground">No insights yet</p>
                <p className="mt-1 text-xs text-muted-foreground/70">
                  Click "Generate Insights" to analyze system data for patterns and trends.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {insights.map((insight) => {
              const Icon = INSIGHT_ICONS[insight.type] ?? Lightbulb;
              return (
                <div key={insight.id} className={`rounded-lg border p-4 ${SEVERITY_STYLES[insight.severity] ?? ""}`}>
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">
                      <Icon className="h-5 w-5 text-current opacity-70" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[10px]">{insight.type}</Badge>
                        <Badge variant={insight.severity === "CRITICAL" ? "destructive" : "secondary"} className="text-[10px]">
                          {insight.severity}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {Math.round(insight.confidence * 100)}% confidence
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm font-semibold">{insight.title}</p>
                      <p className="mt-1 text-xs leading-relaxed opacity-80">{insight.description}</p>
                      <p className="mt-2 text-[10px] text-muted-foreground">
                        {new Date(insight.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Root Cause Analyses */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Root Cause Analyses ({rootCauses.length})
        </h2>
        {rootCauses.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <BrainCircuit className="h-10 w-10 text-muted-foreground/50" />
              <div>
                <p className="font-medium text-muted-foreground">No root cause analyses yet</p>
                <p className="mt-1 text-xs text-muted-foreground/70">
                  Root cause analyses are generated from incident detail pages.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {rootCauses.map((rca) => (
              <Card key={rca.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <BrainCircuit className="mt-0.5 h-5 w-5 shrink-0 text-violet-600" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[10px]">
                          {Math.round(rca.confidence * 100)}% confidence
                        </Badge>
                        <Badge variant={rca.verifiedByHuman ? "default" : "secondary"} className="text-[10px]">
                          {rca.verifiedByHuman ? "Human Verified" : "AI Generated"}
                        </Badge>
                        {rca.previousRepairs > 0 && (
                          <Badge variant="outline" className="text-[10px]">{rca.previousRepairs} previous repairs</Badge>
                        )}
                      </div>
                      <p className="mt-2 text-sm font-semibold">Possible Root Cause</p>
                      <p className="mt-1 text-sm text-muted-foreground">{rca.possibleCause}</p>

                      {rca.evidence.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs font-semibold">Evidence:</p>
                          {rca.evidence.map((e, i) => (
                            <p key={i} className="mt-0.5 text-xs text-muted-foreground">• {e}</p>
                          ))}
                        </div>
                      )}

                      <div className="mt-3 rounded-lg border bg-emerald-50 p-2 dark:bg-emerald-950/50">
                        <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">Recommended Action:</p>
                        <p className="text-xs text-emerald-700 dark:text-emerald-400">{rca.recommendedAction}</p>
                      </div>

                      <p className="mt-2 text-[10px] italic text-muted-foreground/70">
                        ⚠ AI-generated analysis — human verification required before action
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
