// CivicLens — Explainable priority engine ("AI-assisted priority assessment").
// NOT an officially validated government algorithm. Inputs & reasons are always surfaced to users.

import type { Priority } from "@/lib/civiclens/types";

export interface PriorityInput {
  severityScore: number; // 1..10 (0 when unknown)
  reportCount: number;
  hazards: string[];
  categoryHazardWeight: number; // from configurable Category
  categoryLabel: string;
}

export interface PriorityResult {
  score: number; // 0..100
  priority: Priority;
  reasons: string[];
}

/** Hazards that indicate immediate danger to life — strongest priority signal. */
const CRITICAL_HAZARDS = new Set([
  "fall_hazard",
  "child_safety_risk",
  "contamination_risk",
  "electrical_hazard",
  "health_risk",
]);

const MAX_SCORE = 100;

export function assessPriority(input: PriorityInput): PriorityResult {
  const reasons: string[] = [];
  let score = 0;

  // 1) Visual severity from AI analysis (max 50)
  if (input.severityScore > 0) {
    const sev = Math.min(10, Math.max(1, input.severityScore));
    score += sev * 5;
    reasons.push(`AI-assessed visual severity ${sev}/10`);
  }

  // 2) Citizen confirmations — multiple people reporting the same physical problem (max 30)
  if (input.reportCount > 1) {
    const capped = Math.min(input.reportCount, 10);
    score += capped * 3;
    reasons.push(
      input.reportCount === 2
        ? "2 citizen reports confirm this issue"
        : `${input.reportCount} citizen reports confirm this issue`
    );
  } else {
    score += 3;
  }

  // 3) Hazard signals (max 20)
  const critical = input.hazards.filter((h) => CRITICAL_HAZARDS.has(h));
  const others = input.hazards.filter((h) => !CRITICAL_HAZARDS.has(h));
  if (critical.length > 0) {
    score += Math.min(critical.length * 8, 16);
    reasons.push(`Critical hazard signal: ${critical.length > 1 ? `${critical.length} hazards` : "1 hazard"} (immediate danger)`);
  }
  if (others.length > 0) {
    score += Math.min(others.length, 2) * 3;
    reasons.push(`${others.length} additional risk factor${others.length > 1 ? "s" : ""} identified`);
  }

  // 4) Category weight — configurable per category (e.g. open manholes weigh more)
  if (input.categoryHazardWeight > 1) {
    const bonus = Math.round((input.categoryHazardWeight - 1) * 20);
    score += bonus;
    reasons.push(`High-risk category: ${input.categoryLabel}`);
  }

  score = Math.min(Math.round(score), MAX_SCORE);

  let priority: Priority;
  if (score >= 80) priority = "P1";
  else if (score >= 60) priority = "P2";
  else if (score >= 40) priority = "P3";
  else priority = "P4";

  if (reasons.length === 0) reasons.push("Baseline assessment from report evidence");

  return { score, priority, reasons };
}

/** Map a 1..10 severity score to a severity band. */
export function severityBand(score: number): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  if (score >= 9) return "CRITICAL";
  if (score >= 7) return "HIGH";
  if (score >= 4) return "MEDIUM";
  return "LOW";
}
