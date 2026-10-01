"use client";

// CIVIC INDIA 2.0 — Audit Trail Dashboard
// Immutable timeline of all system actions for full traceability.

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ScrollText, User, Bot, Shield, Monitor, Clock,
  ArrowRight, FileText, Link2, Megaphone, CheckCircle2,
} from "lucide-react";

interface AuditLogDTO {
  id: string; entityType: string; entityId: string;
  action: string; actorType: string; actorName: string | null;
  summary: string; createdAt: string;
}

const ACTOR_ICONS: Record<string, typeof User> = {
  SYSTEM: Monitor,
  AI: Bot,
  CITIZEN: User,
  OFFICER: Shield,
  ADMIN: Shield,
};

const ACTOR_COLORS: Record<string, string> = {
  SYSTEM: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  AI: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  CITIZEN: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  OFFICER: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  ADMIN: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
};

const ACTION_ICONS: Record<string, typeof CheckCircle2> = {
  CREATED: FileText,
  LINKED: Link2,
  UPDATED: ArrowRight,
  ROUTED: Megaphone,
  ESCALATED: Shield,
  RESOLVED: CheckCircle2,
  ROOT_CAUSE_ANALYZED: Bot,
};

export function AuditTrail() {
  const [logs, setLogs] = useState<AuditLogDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/audit?limit=50");
      const data = await res.json();
      setLogs(data.logs ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Audit Trail</h1>
        <p className="text-sm text-muted-foreground">
          Immutable timeline of all system actions — every important event is logged for traceability
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ScrollText className="h-4 w-4" /> System Activity Log
          </CardTitle>
          <CardDescription>Chronological record of all system events, AI decisions, and user actions</CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <ScrollText className="h-10 w-10 text-muted-foreground/50" />
              <div>
                <p className="font-medium text-muted-foreground">No audit logs yet</p>
                <p className="mt-1 text-xs text-muted-foreground/70">
                  System actions are automatically logged as they occur.
                </p>
              </div>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-[19px] top-0 bottom-0 w-px bg-border" />

              <div className="space-y-0">
                {logs.map((log, index) => {
                  const ActorIcon = ACTOR_ICONS[log.actorType] ?? Monitor;
                  const ActionIcon = ACTION_ICONS[log.action] ?? ArrowRight;
                  const actorColor = ACTOR_COLORS[log.actorType] ?? ACTOR_COLORS.SYSTEM;

                  return (
                    <div key={log.id} className="relative flex gap-3 py-3">
                      {/* Timeline dot */}
                      <div className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-background ${actorColor}`}>
                        <ActorIcon className="h-4 w-4" />
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1 pt-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-[10px] gap-1">
                            <ActionIcon className="h-2.5 w-2.5" />
                            {log.action}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px]">{log.entityType}</Badge>
                          <Badge variant="outline" className="text-[10px]">{log.actorType}</Badge>
                          {log.actorName && (
                            <span className="text-[10px] text-muted-foreground">by {log.actorName}</span>
                          )}
                        </div>
                        <p className="mt-1 text-sm">{log.summary}</p>
                        <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                          <Clock className="h-2.5 w-2.5" />
                          {new Date(log.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
