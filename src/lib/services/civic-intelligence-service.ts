// CIVIC INDIA 2.0 — Civic Intelligence Service
// AI-powered insights, root cause analysis, and civic intelligence generation.
// All AI outputs are clearly labelled as recommendations, not verified conclusions.

import "server-only";
import { db } from "@/lib/db";
import { log } from "./logger";

// ── Types ──

export interface CivicInsightDTO {
  id: string;
  unifiedCaseId: string | null;
  type: string;
  title: string;
  description: string;
  severity: string;
  dataPoints: Record<string, unknown>;
  confidence: number;
  isActive: boolean;
  acknowledgedAt: string | null;
  createdAt: string;
}

export interface RootCauseDTO {
  id: string;
  incidentId: string | null;
  unifiedCaseId: string | null;
  possibleCause: string;
  evidence: string[];
  confidence: number;
  recommendedAction: string;
  previousRepairs: number;
  relatedIncidents: string[];
  isAiGenerated: boolean;
  verifiedByHuman: boolean;
  createdAt: string;
}

// ── Generate Insights from Actual Data ──

export async function generateInsights(): Promise<CivicInsightDTO[]> {
  const generatedInsights: CivicInsightDTO[] = [];

  try {
    // 1. Category trends
    const categoryStats = await db.incident.groupBy({
      by: ["categoryKey"],
      _count: { id: true },
      where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
    });

    for (const stat of categoryStats) {
      if (stat._count.id >= 3) {
        const category = await db.category.findUnique({ where: { key: stat.categoryKey } });
        const insight = await db.civicInsight.create({
          data: {
            type: "TREND",
            title: `${category?.label ?? stat.categoryKey} — ${stat._count.id} incidents this month`,
            description: `There have been ${stat._count.id} ${category?.label?.toLowerCase() ?? stat.categoryKey} incidents reported in the last 30 days. This may indicate a systemic issue requiring proactive attention.`,
            severity: stat._count.id >= 10 ? "CRITICAL" : stat._count.id >= 5 ? "WARNING" : "INFO",
            dataPoints: JSON.stringify({ categoryKey: stat.categoryKey, count: stat._count.id, period: "30d" }),
            confidence: 0.9,
          },
        });
        generatedInsights.push(toInsightDTO(insight));
      }
    }

    // 2. City hotspots
    const cityStats = await db.incident.groupBy({
      by: ["city"],
      _count: { id: true },
      where: {
        city: { not: null },
        status: { in: ["REPORTED", "VERIFIED", "ASSIGNED", "IN_PROGRESS"] },
      },
    });

    for (const stat of cityStats) {
      if (stat.city && stat._count.id >= 3) {
        const insight = await db.civicInsight.create({
          data: {
            type: "HOTSPOT",
            title: `${stat.city} — ${stat._count.id} active incidents`,
            description: `${stat.city} currently has ${stat._count.id} unresolved civic incidents. Consider allocating additional resources to this area.`,
            severity: stat._count.id >= 8 ? "WARNING" : "INFO",
            dataPoints: JSON.stringify({ city: stat.city, activeCount: stat._count.id }),
            confidence: 0.95,
          },
        });
        generatedInsights.push(toInsightDTO(insight));
      }
    }

    // 3. SLA risk detection
    const atRiskSla = await db.slaTracker.count({
      where: { status: { in: ["WARNING", "BREACHED"] } },
    });
    if (atRiskSla > 0) {
      const insight = await db.civicInsight.create({
        data: {
          type: "SLA_RISK",
          title: `${atRiskSla} cases at SLA risk`,
          description: `${atRiskSla} case(s) are currently at risk of or have already breached their SLA deadline. Immediate escalation may be required.`,
          severity: "CRITICAL",
          dataPoints: JSON.stringify({ atRiskCount: atRiskSla }),
          confidence: 1.0,
        },
      });
      generatedInsights.push(toInsightDTO(insight));
    }

    // 4. Department workload
    const deptWorkload = await db.incident.groupBy({
      by: ["departmentKey"],
      _count: { id: true },
      where: {
        departmentKey: { not: null },
        status: { in: ["ASSIGNED", "IN_PROGRESS"] },
      },
    });

    for (const dept of deptWorkload) {
      if (dept.departmentKey && dept._count.id >= 3) {
        const department = await db.department.findUnique({ where: { key: dept.departmentKey } });
        const insight = await db.civicInsight.create({
          data: {
            type: "DEPARTMENT",
            title: `${department?.name ?? dept.departmentKey} — ${dept._count.id} active assignments`,
            description: `${department?.name ?? dept.departmentKey} currently has ${dept._count.id} active cases. Consider load balancing if response times are affected.`,
            severity: dept._count.id >= 8 ? "WARNING" : "INFO",
            dataPoints: JSON.stringify({ departmentKey: dept.departmentKey, activeCount: dept._count.id }),
            confidence: 0.85,
          },
        });
        generatedInsights.push(toInsightDTO(insight));
      }
    }

    // 5. Recurring incidents (same location, same category)
    const incidents = await db.incident.findMany({
      where: { status: { in: ["REPORTED", "VERIFIED", "ASSIGNED", "IN_PROGRESS"] } },
      select: { id: true, publicId: true, categoryKey: true, latitude: true, longitude: true, reportCount: true, city: true },
    });

    // Simple proximity check for recurrence
    const checked = new Set<string>();
    for (const inc of incidents) {
      if (checked.has(inc.id)) continue;
      const nearby = incidents.filter(
        (other) =>
          other.id !== inc.id &&
          other.categoryKey === inc.categoryKey &&
          !checked.has(other.id) &&
          Math.abs(other.latitude - inc.latitude) < 0.002 &&
          Math.abs(other.longitude - inc.longitude) < 0.002
      );
      if (nearby.length >= 1) {
        const allIds = [inc.id, ...nearby.map((n) => n.id)];
        allIds.forEach((id) => checked.add(id));
        const insight = await db.civicInsight.create({
          data: {
            type: "RECURRING",
            title: `Recurring ${inc.categoryKey} issue — ${allIds.length} incidents in same area`,
            description: `${allIds.length} ${inc.categoryKey} incidents detected within close proximity${inc.city ? ` in ${inc.city}` : ""}. This may indicate a recurring infrastructure problem requiring root cause investigation.`,
            severity: "WARNING",
            dataPoints: JSON.stringify({ incidentIds: allIds.map((_, i) => (i === 0 ? inc.publicId : nearby[i-1]?.publicId)), categoryKey: inc.categoryKey, city: inc.city }),
            confidence: 0.8,
          },
        });
        generatedInsights.push(toInsightDTO(insight));
      }
    }

    // 6. Cross-platform cases (unified cases with multiple sources)
    const crossPlatform = await db.unifiedCase.count({
      where: { sourceCount: { gte: 2 } },
    });
    if (crossPlatform > 0) {
      const insight = await db.civicInsight.create({
        data: {
          type: "CORRELATION",
          title: `${crossPlatform} cross-platform case(s) detected`,
          description: `${crossPlatform} unified case(s) have been linked across multiple government systems, demonstrating the interoperability value of CIVIC INDIA.`,
          severity: "INFO",
          dataPoints: JSON.stringify({ crossPlatformCount: crossPlatform }),
          confidence: 1.0,
        },
      });
      generatedInsights.push(toInsightDTO(insight));
    }

  } catch (err) {
    log.error("insight_generation_failed", { error: String(err) });
  }

  return generatedInsights;
}

// ── Root Cause Analysis ──

export async function generateRootCause(incidentId: string): Promise<RootCauseDTO | null> {
  try {
    const incident = await db.incident.findUnique({
      where: { id: incidentId },
      include: {
        category: true,
        reports: { include: { aiAnalysis: true } },
        statusHistory: true,
        assignments: true,
      },
    });
    if (!incident) return null;

    // Check for related incidents (same category, nearby location)
    const relatedIncidents = await db.incident.findMany({
      where: {
        id: { not: incident.id },
        categoryKey: incident.categoryKey,
        latitude: { gte: incident.latitude - 0.005, lte: incident.latitude + 0.005 },
        longitude: { gte: incident.longitude - 0.005, lte: incident.longitude + 0.005 },
      },
      take: 10,
    });

    // Count previous repairs (resolved incidents at same location)
    const previousRepairs = await db.incident.count({
      where: {
        categoryKey: incident.categoryKey,
        status: "RESOLVED",
        latitude: { gte: incident.latitude - 0.002, lte: incident.latitude + 0.002 },
        longitude: { gte: incident.longitude - 0.002, lte: incident.longitude + 0.002 },
      },
    });

    // Build evidence
    const evidence: string[] = [];
    if (incident.reportCount > 1) evidence.push(`${incident.reportCount} citizen reports for this issue`);
    if (relatedIncidents.length > 0) evidence.push(`${relatedIncidents.length} related incidents in nearby area`);
    if (previousRepairs > 0) evidence.push(`${previousRepairs} previous repair(s) at same location`);
    if (incident.reports.length > 0) {
      const descriptions = incident.reports.map((r) => r.description).filter(Boolean);
      if (descriptions.length > 0) evidence.push(`Citizen descriptions: ${descriptions.slice(0, 3).join("; ")}`);
    }

    // Determine root cause based on available data
    let possibleCause = "Underlying infrastructure degradation requiring investigation.";
    let recommendedAction = "Conduct site inspection and assess infrastructure condition.";

    if (previousRepairs >= 2) {
      possibleCause = `Recurring issue at this location despite ${previousRepairs} previous repair(s). Likely structural or foundational cause rather than surface-level damage.`;
      recommendedAction = "Deep infrastructure assessment required. Previous surface repairs have not resolved the underlying cause. Consider foundation/drainage investigation.";
      evidence.push("Multiple previous repairs failed to permanently resolve the issue");
    } else if (relatedIncidents.length >= 3) {
      possibleCause = `Cluster of similar issues in the area suggests systemic infrastructure problem.`;
      recommendedAction = "Area-wide infrastructure audit recommended rather than individual repairs.";
    } else if (incident.reportCount >= 3) {
      possibleCause = `High citizen report volume indicates significant impact. Issue severity may be underestimated.`;
      recommendedAction = "Priority escalation recommended. Deploy inspection team to verify severity.";
    }

    // Confidence based on evidence strength
    const confidence = Math.min(
      0.95,
      0.4 + (previousRepairs * 0.15) + (relatedIncidents.length * 0.05) + (evidence.length * 0.05)
    );

    const rca = await db.rootCauseAnalysis.create({
      data: {
        incidentId,
        possibleCause,
        evidence: JSON.stringify(evidence),
        confidence: Math.round(confidence * 100) / 100,
        recommendedAction,
        previousRepairs,
        relatedIncidents: JSON.stringify(relatedIncidents.map((r) => r.publicId)),
        isAiGenerated: true,
      },
    });

    await db.auditLog.create({
      data: {
        entityType: "INCIDENT",
        entityId: incidentId,
        incidentId,
        action: "ROOT_CAUSE_ANALYZED",
        actorType: "AI",
        summary: `AI root cause analysis generated with ${Math.round(confidence * 100)}% confidence.`,
        details: JSON.stringify({ possibleCause, previousRepairs, relatedCount: relatedIncidents.length }),
      },
    });

    return toRootCauseDTO(rca);
  } catch (err) {
    log.error("root_cause_failed", { incidentId, error: String(err) });
    return null;
  }
}

// ── Fetch ──

export async function getInsights(opts?: {
  type?: string;
  isActive?: boolean;
  limit?: number;
}): Promise<CivicInsightDTO[]> {
  const insights = await db.civicInsight.findMany({
    where: {
      ...(opts?.type ? { type: opts.type } : {}),
      ...(opts?.isActive !== undefined ? { isActive: opts.isActive } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: opts?.limit ?? 30,
  });
  return insights.map(toInsightDTO);
}

export async function getRootCauses(opts?: {
  incidentId?: string;
  limit?: number;
}): Promise<RootCauseDTO[]> {
  const analyses = await db.rootCauseAnalysis.findMany({
    where: opts?.incidentId ? { incidentId: opts.incidentId } : {},
    orderBy: { createdAt: "desc" },
    take: opts?.limit ?? 20,
  });
  return analyses.map(toRootCauseDTO);
}

// ── Serialization ──

function safeParseArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === "string") {
    try { const v = JSON.parse(val); return Array.isArray(v) ? v.map(String) : []; }
    catch { return []; }
  }
  return [];
}

function safeParseObj(val: unknown): Record<string, unknown> {
  if (typeof val === "object" && val !== null) return val as Record<string, unknown>;
  if (typeof val === "string") {
    try { return JSON.parse(val); } catch { return {}; }
  }
  return {};
}

function toInsightDTO(i: any): CivicInsightDTO {
  return {
    id: i.id,
    unifiedCaseId: i.unifiedCaseId,
    type: i.type,
    title: i.title,
    description: i.description,
    severity: i.severity,
    dataPoints: safeParseObj(i.dataPoints),
    confidence: i.confidence,
    isActive: i.isActive,
    acknowledgedAt: i.acknowledgedAt?.toISOString?.() ?? null,
    createdAt: i.createdAt?.toISOString?.() ?? i.createdAt,
  };
}

function toRootCauseDTO(r: any): RootCauseDTO {
  return {
    id: r.id,
    incidentId: r.incidentId,
    unifiedCaseId: r.unifiedCaseId,
    possibleCause: r.possibleCause,
    evidence: safeParseArray(r.evidence),
    confidence: r.confidence,
    recommendedAction: r.recommendedAction,
    previousRepairs: r.previousRepairs,
    relatedIncidents: safeParseArray(r.relatedIncidents),
    isAiGenerated: r.isAiGenerated,
    verifiedByHuman: r.verifiedByHuman,
    createdAt: r.createdAt?.toISOString?.() ?? r.createdAt,
  };
}
