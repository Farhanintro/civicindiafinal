"use client";

// CIVIC INDIA 2.0 — Civic Problem Graph & Interoperability Topology
// Visualizes multi-dimensional relationships across Citizens, Complaints, Master Infrastructure,
// Departments, Root Causes, and SLA Events.

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Network, ArrowRight, Building2, User, Layers, ShieldCheck,
  AlertTriangle, CheckCircle2, GitCommit, FileText, Zap,
} from "lucide-react";

interface GraphNode {
  id: string;
  type: "CITIZEN" | "COMPLAINT" | "UNIFIED_CASE" | "ROAD" | "INFRASTRUCTURE" | "DEPARTMENT" | "ROOT_CAUSE" | "SLA";
  label: string;
  sublabel?: string;
  status?: string;
}

const DEMO_GRAPH_NODES: GraphNode[] = [
  { id: "c1", type: "CITIZEN", label: "Aarav Sharma", sublabel: "Citizen ID: MCIT-ALW-0042" },
  { id: "m1", type: "COMPLAINT", label: "MUN-1938", sublabel: "Municipal Portal (JSON)" },
  { id: "s1", type: "COMPLAINT", label: "STATE-8812", sublabel: "State Grievance (XML/REST)" },
  { id: "p1", type: "COMPLAINT", label: "PWD-4921", sublabel: "PWD Work Order System" },
  { id: "uc1", type: "UNIFIED_CASE", label: "CIVIC-2026-000421", sublabel: "Unified Civic Case (Clustered)" },
  { id: "r1", type: "ROAD", label: "ROAD-MASTER-001", sublabel: "Master Road: Station Road" },
  { id: "inf1", type: "INFRASTRUCTURE", label: "INFRA-ALW-PWD-019", sublabel: "Storm Drain & Culvert" },
  { id: "rc1", type: "ROOT_CAUSE", label: "Subgrade Waterlogging", sublabel: "Underground pipeline seep" },
  { id: "d1", type: "DEPARTMENT", label: "PWD Division 2", sublabel: "Responsible Department" },
  { id: "sla1", type: "SLA", label: "P1 SLA (24h Clock)", sublabel: "Escalation Chain Active" },
];

export function CivicProblemGraph() {
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(DEMO_GRAPH_NODES[4]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Civic Problem Graph & Interoperability Topology</h1>
          <p className="text-sm text-muted-foreground">
            Multi-dimensional relational intelligence mapping root causes, cross-system complaints, and infrastructure assets
          </p>
        </div>
        <Badge variant="outline" className="gap-1.5 font-mono text-primary border-primary/30">
          <Network className="h-3.5 w-3.5" /> 10 Active Nodes · 12 Relationship Edges
        </Badge>
      </div>

      {/* Explainer Banner */}
      <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-4 dark:border-indigo-900/40 dark:bg-indigo-950/30">
        <div className="flex items-start gap-3">
          <Zap className="mt-0.5 h-5 w-5 text-indigo-600 shrink-0" />
          <div className="text-xs space-y-1">
            <p className="font-bold text-indigo-900 dark:text-indigo-200">Beyond Ticketing — True Root Cause Intelligence</p>
            <p className="text-indigo-800 dark:text-indigo-300 leading-relaxed">
              CIVIC INDIA connects three disparate citizen reports into ONE unified case, identifies that the recurring pothole is actually 
              caused by a chronic drainage overflow on <strong>INFRA-ALW-PWD-019</strong>, and coordinates joint action across PWD and the Water Department.
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Topology Graph Visualizer */}
      <Card className="border-2 border-border/80 bg-card overflow-hidden">
        <CardHeader className="border-b pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span>Interoperability Relationship Diagram</span>
            <span className="text-xs font-normal text-muted-foreground">Click any node to inspect data linkages</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex flex-col items-center gap-8 py-4">
            {/* Level 1: Input Portals & Citizens */}
            <div className="text-center w-full">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-3">
                Layer 1: Disparate Government Portals & Citizens
              </span>
              <div className="flex flex-wrap justify-center gap-4">
                <button
                  onClick={() => setSelectedNode(DEMO_GRAPH_NODES[0])}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    selectedNode?.id === "c1" ? "border-primary bg-primary/10 shadow-md ring-2 ring-primary/40" : "bg-card hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-emerald-600" />
                    <span className="font-bold text-xs">Aarav Sharma</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Citizen Identity (MCIT-ALW-0042)</p>
                </button>

                <button
                  onClick={() => setSelectedNode(DEMO_GRAPH_NODES[1])}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    selectedNode?.id === "m1" ? "border-primary bg-primary/10 shadow-md ring-2 ring-primary/40" : "bg-card hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-600" />
                    <span className="font-bold text-xs">MUN-1938</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Municipal Complaint Portal</p>
                </button>

                <button
                  onClick={() => setSelectedNode(DEMO_GRAPH_NODES[2])}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    selectedNode?.id === "s1" ? "border-primary bg-primary/10 shadow-md ring-2 ring-primary/40" : "bg-card hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-amber-600" />
                    <span className="font-bold text-xs">STATE-8812</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">State Grievance Redressal</p>
                </button>

                <button
                  onClick={() => setSelectedNode(DEMO_GRAPH_NODES[3])}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    selectedNode?.id === "p1" ? "border-primary bg-primary/10 shadow-md ring-2 ring-primary/40" : "bg-card hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-purple-600" />
                    <span className="font-bold text-xs">PWD-4921</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">PWD Works Inspection</p>
                </button>
              </div>
            </div>

            {/* Connecting arrows */}
            <div className="flex items-center justify-center gap-8 text-muted-foreground">
              <span className="text-xl">↓</span>
              <span className="text-xl">↓</span>
              <span className="text-xl">↓</span>
            </div>

            {/* Level 2: Interoperability Gateway & Master Resolution */}
            <div className="text-center w-full">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-3">
                Layer 2: Common Schema Normalization & Master Entity Resolution
              </span>
              <div className="flex flex-wrap justify-center gap-4">
                <button
                  onClick={() => setSelectedNode(DEMO_GRAPH_NODES[5])}
                  className={`rounded-xl border p-3.5 text-left transition-all ${
                    selectedNode?.id === "r1" ? "border-primary bg-primary/10 shadow-md ring-2 ring-primary/40" : "bg-card hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    <span className="font-bold text-xs">ROAD-MASTER-001</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Station Road (5 Portal Aliases)</p>
                </button>

                <button
                  onClick={() => setSelectedNode(DEMO_GRAPH_NODES[6])}
                  className={`rounded-xl border p-3.5 text-left transition-all ${
                    selectedNode?.id === "inf1" ? "border-primary bg-primary/10 shadow-md ring-2 ring-primary/40" : "bg-card hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-indigo-600" />
                    <span className="font-bold text-xs">INFRA-ALW-PWD-019</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Culvert Drain Asset</p>
                </button>

                <button
                  onClick={() => setSelectedNode(DEMO_GRAPH_NODES[7])}
                  className={`rounded-xl border p-3.5 text-left transition-all ${
                    selectedNode?.id === "rc1" ? "border-rose-500 bg-rose-500/10 shadow-md ring-2 ring-rose-500/40" : "bg-card hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-rose-600" />
                    <span className="font-bold text-xs">Root Cause Analysis</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Recurring Subgrade Waterlogging</p>
                </button>
              </div>
            </div>

            {/* Connecting arrows */}
            <div className="text-xl text-muted-foreground">↓</div>

            {/* Level 3: Unified Civic Case */}
            <div className="text-center w-full">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-3">
                Layer 3: Single Unified Civic Case (Deduplicated & Backed by 3 Sources)
              </span>
              <button
                onClick={() => setSelectedNode(DEMO_GRAPH_NODES[4])}
                className={`mx-auto rounded-2xl border-2 p-5 text-left max-w-md transition-all ${
                  selectedNode?.id === "uc1" ? "border-primary bg-primary/15 shadow-xl ring-2 ring-primary" : "border-primary/40 bg-card hover:bg-primary/5"
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="font-mono text-base font-black text-primary">CIVIC-2026-000421</span>
                  <Badge className="bg-emerald-600 text-white text-xs">CLUSTERED (3 TICKETS)</Badge>
                </div>
                <p className="font-semibold text-xs mt-1 text-foreground">
                  Deep Rainwater Pothole on Station Road
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  1 Physical Incident • 3 Interconnected Portal Confirmations • 96% AI Match
                </p>
              </button>
            </div>

            {/* Connecting arrows */}
            <div className="flex items-center justify-center gap-12 text-muted-foreground">
              <span className="text-xl">↙</span>
              <span className="text-xl">↘</span>
            </div>

            {/* Level 4: Action & SLA */}
            <div className="text-center w-full">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-3">
                Layer 4: Department Dispatch & SLA Accountability
              </span>
              <div className="flex flex-wrap justify-center gap-6">
                <button
                  onClick={() => setSelectedNode(DEMO_GRAPH_NODES[8])}
                  className={`rounded-xl border p-3.5 text-left transition-all ${
                    selectedNode?.id === "d1" ? "border-primary bg-primary/10 shadow-md ring-2 ring-primary/40" : "bg-card hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    <span className="font-bold text-xs">PWD Division 2</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Assigned Department (Work Order Active)</p>
                </button>

                <button
                  onClick={() => setSelectedNode(DEMO_GRAPH_NODES[9])}
                  className={`rounded-xl border p-3.5 text-left transition-all ${
                    selectedNode?.id === "sla1" ? "border-primary bg-primary/10 shadow-md ring-2 ring-primary/40" : "bg-card hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    <span className="font-bold text-xs">SLA Tracker: P1 (24 Hours)</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Automated Escalation Active</p>
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Node Details Card */}
      {selectedNode && (
        <Card className="bg-muted/20">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <Badge variant="outline" className="text-[10px] mb-1">{selectedNode.type}</Badge>
                <CardTitle className="text-base font-bold">{selectedNode.label}</CardTitle>
                <CardDescription className="text-xs">{selectedNode.sublabel}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            <p>
              This node forms an active component in the <strong>CIVIC INDIA Interoperability Grid</strong>. 
              Changes or status transitions propagate bi-directionally to all connected government platforms.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
