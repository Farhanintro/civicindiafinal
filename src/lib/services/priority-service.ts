// Civic India — deterministic priority assessment engine.
import type { Priority, Severity } from "@/lib/civiclens/types";

export interface PriorityScoreBreakdown {
  score: number;
  priority: Priority;
  reasons: string[];
}

export interface PriorityInput {
  categoryKey?: string;
  categoryHazardWeight?: number;
  categoryLabel?: string;
  hazardWeight?: number;
  severityScore?: number;
  hazards?: string[] | string | unknown;
  reportCount?: number;
}

const CRITICAL_HAZARDS = new Set([
  "live_wire",
  "sparking",
  "electrical_hazard",
  "deep_open_manhole",
  "open_manhole",
  "traffic_obstruction",
  "skid_hazard",
  "pedestrian_fall_risk",
  "structural_collapse",
  "fire_risk",
  "water_contamination",
]);

export function severityBand(score: number): Severity {
  if (score >= 8) return "CRITICAL";
  if (score >= 6) return "HIGH";
  if (score >= 4) return "MEDIUM";
  return "LOW";
}

function normalizeHazards(hazards: unknown): string[] {
  if (Array.isArray(hazards)) return hazards.map(String);
  if (typeof hazards === "string") {
    try {
      const parsed = JSON.parse(hazards);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return hazards.split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

export function assessPriority(input: PriorityInput): PriorityScoreBreakdown {
  const reasons: string[] = [];
  let score = 0;

  const weight = input.categoryHazardWeight ?? input.hazardWeight ?? 0.5;
  const catWeight = Math.max(0, Math.min(1, weight));
  const catPoints = Math.round(catWeight * 30);
  score += catPoints;
  if (catPoints >= 20) {
    reasons.push(`High inherent category hazard (+${catPoints})`);
  }

  const severity = Math.max(1, Math.min(10, input.severityScore ?? 5));
  const sevPoints = Math.round((severity / 10) * 35);
  score += sevPoints;
  if (sevPoints >= 25) {
    reasons.push(`High visual damage severity ${severity}/10 (+${sevPoints})`);
  }

  const safeHazards = normalizeHazards(input.hazards);
  const critical = safeHazards.filter((h) => CRITICAL_HAZARDS.has(h));
  const others = safeHazards.filter((h) => !CRITICAL_HAZARDS.has(h));

  if (critical.length > 0) {
    const critPoints = Math.min(critical.length * 8, 16);
    score += critPoints;
    reasons.push(`Critical hazards identified: ${critical.join(", ")} (+${critPoints})`);
  }
  if (others.length > 0) {
    const othPoints = Math.min(others.length * 2, 4);
    score += othPoints;
    reasons.push(`Secondary hazards detected (+${othPoints})`);
  }

  const reports = Math.max(1, input.reportCount ?? 1);
  if (reports > 1) {
    const volPoints = Math.min((reports - 1) * 5, 15);
    score += volPoints;
    reasons.push(`${reports} citizen confirmations (+${volPoints})`);
  }

  const finalScore = Math.max(0, Math.min(100, score));

  let priority: Priority = "P4";
  if (finalScore >= 75) priority = "P1";
  else if (finalScore >= 55) priority = "P2";
  else if (finalScore >= 35) priority = "P3";

  return {
    score: finalScore,
    priority,
    reasons,
  };
}