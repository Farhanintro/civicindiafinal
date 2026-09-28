"use client";

// Civic India — shared badges & small presentational atoms.

import { Badge } from "@/components/ui/badge";
import {
  PRIORITY_CLASSES,
  PRIORITY_LABELS,
  SEVERITY_CLASSES,
  SEVERITY_LABELS,
  STATUS_CLASSES,
  STATUS_LABELS,
  hazardLabel,
} from "@/lib/civiclens/constants";
import type { IncidentStatus, Priority, Severity } from "@/lib/civiclens/types";
import {
  AlertOctagon,
  Construction,
  Droplets,
  Lightbulb,
  MapPin,
  PackageOpen,
  Ban,
  Trash2,
  TreePine,
  CircleDot,
  CircleHelp,
  Waves,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  return (
    <Badge variant="outline" className={cn(PRIORITY_CLASSES[priority], "font-semibold", className)}>
      {PRIORITY_LABELS[priority]}
    </Badge>
  );
}

export function StatusBadge({ status, className }: { status: IncidentStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn(STATUS_CLASSES[status], "font-medium", className)}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  return (
    <Badge variant="outline" className={cn(SEVERITY_CLASSES[severity], className)}>
      {SEVERITY_LABELS[severity]}
    </Badge>
  );
}

export function DemoBadge({ className }: { className?: string }) {
  return null;
}

export function HazardChip({ hazard }: { hazard: string }) {
  return (
    <Badge
      variant="outline"
      className="border-rose-200 bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800"
    >
      {hazardLabel(hazard)}
    </Badge>
  );
}

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  pothole: Construction,
  garbage: Trash2,
  water_leakage: Droplets,
  broken_streetlight: Lightbulb,
  open_manhole: CircleDot,
  sewage_drainage: Waves,
  illegal_dumping: Ban,
  road_obstruction: TreePine,
  damaged_infrastructure: AlertOctagon,
  other: PackageOpen,
};

export function CategoryIcon({ categoryKey, className }: { categoryKey: string; className?: string }) {
  const Icon = CATEGORY_ICONS[categoryKey] ?? CircleHelp;
  return <Icon className={className} />;
}

export function categoryLabel(
  key: string | null | undefined,
  categories: { key: string; label: string }[]
): string {
  if (!key) return "Civic issue";
  return categories.find((c) => c.key === key)?.label ?? key;
}

export function EmptyState({
  icon: Icon = MapPin,
  title,
  hint,
  action,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-10 text-center">
      <div className="rounded-full bg-muted p-3">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <div>
        <p className="font-medium">{title}</p>
        {hint ? <p className="mt-1 text-sm text-muted-foreground">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}