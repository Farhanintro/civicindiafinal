"use client";

// CIVIC INDIA 2.0 — Master Data & Entity Resolution Dashboard
// Inspects Master Roads, Master Infrastructure, Master Citizens, and tests live entity matching.

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Server, MapPin, Building2, User, Search, CheckCircle2,
  Sparkles, Layers, RefreshCw, GitMerge, ArrowRight,
} from "lucide-react";

interface MasterRoadDTO {
  id: string;
  masterCode: string;
  canonicalName: string;
  aliases: string[];
  sourceIds: Record<string, string>;
  city: string;
  ward: string | null;
  owningDepartment: string;
  confidence: number;
}

interface MasterInfraDTO {
  id: string;
  infraCode: string;
  name: string;
  type: string;
  roadCode: string | null;
  owningDepartment: string;
  maintenanceCrew: string | null;
  latitude: number | null;
  longitude: number | null;
  confidence: number;
}

interface MasterCitizenDTO {
  id: string;
  citizenCode: string;
  canonicalName: string;
  phoneMasked: string | null;
  emailMasked: string | null;
  sourceIds: Record<string, string>;
  city: string | null;
  isVerified: boolean;
  confidence: number;
}

export function MasterDataDashboard() {
  const [data, setData] = useState<{
    roads: MasterRoadDTO[];
    infrastructure: MasterInfraDTO[];
    citizens: MasterCitizenDTO[];
  } | null>(null);

  const [loading, setLoading] = useState(true);

  // Live Entity Resolver Tester
  const [testAddress, setTestAddress] = useState("Station Marg near Railway Station");
  const [testCitizen, setTestCitizen] = useState("Aarav Sharma");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/master-data");
      const json = await res.json();
      setData(json);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const handleTestResolution = async () => {
    setTesting(true);
    try {
      const res = await fetch("/api/master-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: testAddress,
          citizenName: testCitizen,
          latitude: 27.5548,
          longitude: 76.6165,
        }),
      });
      const result = await res.json();
      setTestResult(result);
    } catch { /* ignore */ }
    setTesting(false);
  };

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
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Master Data Management & Entity Resolution</h1>
          <p className="text-sm text-muted-foreground">
            Canonical reference registries for roads, physical infrastructure assets, and cross-platform citizen personas
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void fetchData()}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{data?.roads.length ?? 0}</p>
              <p className="text-xs text-muted-foreground">Master Road Corridors</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{data?.infrastructure.length ?? 0}</p>
              <p className="text-xs text-muted-foreground">Infrastructure Assets</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400">
              <User className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{data?.citizens.length ?? 0}</p>
              <p className="text-xs text-muted-foreground">Master Citizen Identities</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Live Entity Resolution Sandbox / Tester */}
      <Card className="border-2 border-primary/40 bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Live Entity Resolution Engine Tester
          </CardTitle>
          <CardDescription>
            Simulate how fuzzy road names, localized aliases, and partial citizen details from external portals resolve to canonical master entities.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Input Road / Location Text:</label>
              <Input
                value={testAddress}
                onChange={(e) => setTestAddress(e.target.value)}
                placeholder="e.g. Station Marg, Railway Station Rd"
                className="mt-1 h-9 text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Input Citizen Name / Contact:</label>
              <Input
                value={testCitizen}
                onChange={(e) => setTestCitizen(e.target.value)}
                placeholder="e.g. Aarav Sharma"
                className="mt-1 h-9 text-xs"
              />
            </div>
          </div>

          <Button
            size="sm"
            onClick={handleTestResolution}
            disabled={testing}
            className="text-xs font-semibold gap-1.5"
          >
            <Search className={`h-3.5 w-3.5 ${testing ? "animate-spin" : ""}`} />
            {testing ? "Resolving Entities…" : "Test Resolution Matching"}
          </Button>

          {testResult && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3 text-xs">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border bg-background p-3">
                  <p className="text-muted-foreground font-semibold flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-primary" /> Matched Road Entity:
                  </p>
                  <p className="text-sm font-bold text-foreground mt-1">
                    {testResult.roadMatch?.canonicalName} ({testResult.roadMatch?.masterCode})
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-[10px]">
                      Confidence: {Math.round((testResult.roadMatch?.confidence ?? 0) * 100)}%
                    </Badge>
                    <Badge variant="outline" className="text-[10px] text-emerald-600">
                      {testResult.roadMatch?.status}
                    </Badge>
                  </div>
                  <ul className="mt-2 space-y-0.5 text-muted-foreground text-[11px]">
                    {(testResult.roadMatch?.signals ?? []).map((s: string, i: number) => (
                      <li key={i} className="flex items-center gap-1 text-foreground">
                        <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" /> {s}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-lg border bg-background p-3">
                  <p className="text-muted-foreground font-semibold flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-emerald-600" /> Matched Citizen Identity:
                  </p>
                  <p className="text-sm font-bold text-foreground mt-1">
                    {testResult.citizenMatch?.canonicalName} ({testResult.citizenMatch?.masterCode})
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-[10px]">
                      Confidence: {Math.round((testResult.citizenMatch?.confidence ?? 0) * 100)}%
                    </Badge>
                    <Badge variant="outline" className="text-[10px] text-emerald-600">
                      {testResult.citizenMatch?.status}
                    </Badge>
                  </div>
                  <ul className="mt-2 space-y-0.5 text-muted-foreground text-[11px]">
                    {(testResult.citizenMatch?.signals ?? []).map((s: string, i: number) => (
                      <li key={i} className="flex items-center gap-1 text-foreground">
                        <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" /> {s}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Master Roads Register */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4" /> Master Road Registry
          </CardTitle>
          <CardDescription>
            Harmonizes different naming conventions used by PWD, State Grievances, and Municipalities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(data?.roads ?? []).map((road) => (
              <div key={road.id} className="rounded-lg border p-4 bg-card text-xs space-y-2">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between border-b pb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-primary text-sm">{road.masterCode}</span>
                    <span className="font-bold text-sm">{road.canonicalName}</span>
                    <Badge variant="outline" className="text-[10px]">{road.city}, {road.ward ?? "Zone 1"}</Badge>
                    <Badge variant="secondary" className="text-[10px]">Owner: {road.owningDepartment}</Badge>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 pt-1">
                  <div>
                    <span className="font-semibold text-muted-foreground">Recognized Name Aliases:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {road.aliases.map((a, i) => (
                        <Badge key={i} variant="outline" className="text-[10px] bg-muted/30">
                          {a}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="font-semibold text-muted-foreground">Source System Identifiers:</span>
                    <div className="flex flex-wrap gap-2 mt-1 font-mono text-[11px]">
                      {Object.entries(road.sourceIds).map(([sys, id]) => (
                        <span key={sys} className="rounded border bg-muted/40 px-2 py-0.5">
                          {sys}: <strong className="text-foreground">{id}</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
