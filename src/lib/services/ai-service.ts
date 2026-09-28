// CivicLens — AI Service (multimodal civic image analysis).
//
// Provider-swappable by design:
//   • GeminiProvider  — active when GEMINI_API_KEY is set (Google Gemini multimodal API)
//   • ZAiVisionProvider — default in this environment (z-ai-web-dev-sdk, server-side only)
//   • Precomputed demo results for bundled sample photos (guarantees the SIH demo works
//     even when quota is exhausted / network is unstable)
//   • Heuristic fallback — never throws; report is always preserved for manual review
//
// One analysis per report. Results are persisted in `ai_analyses` and returned from
// storage on any repeat request (never re-billed / re-called).

import { z } from "zod";
import { log } from "./logger";
import { DEFAULT_CATEGORIES } from "@/lib/civiclens/constants";

export interface CivicAnalysisResult {
  isCivicIssue: boolean;
  categoryKey: string;
  confidence: number;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "UNKNOWN";
  severityScore: number;
  hazards: string[];
  departmentKey: string;
  description: string;
  reasoning: string;
  recommendedAction: string;
  model: string;
  source: "VLM_SDK" | "GEMINI" | "DEMO_PRECOMPUTED" | "FALLBACK_MANUAL";
  processingMs: number;
}

export interface AnalyzeImageInput {
  imageBuffer: Buffer;
  mimeType: string;
  description?: string | null;
  sampleKey?: string | null;
}

const CATEGORY_KEYS = DEFAULT_CATEGORIES.map((c) => c.key);
const DEPARTMENT_KEYS = [
  "roads", "sanitation", "water", "electrical", "drainage", "public_works", "traffic", "general",
];

const ANALYSIS_PROMPT = `You are CivicLens AI, a civic infrastructure analysis engine for Indian cities. Analyze the photo evidence of a reported civic issue.

Return ONLY a valid JSON object with exactly these fields:
{
  "is_civic_issue": boolean,          // true only if the image clearly shows a civic/infrastructure problem
  "category": string,                 // one of: ${CATEGORY_KEYS.join(", ")}
  "confidence": number,               // 0.0-1.0 your confidence in the classification
  "severity": string,                 // "low" | "medium" | "high" | "critical" | "unknown"
  "severity_score": number,           // 1-10 (0 if unknown)
  "hazards": string[],                // from: two_wheeler_risk, traffic_disruption, pedestrian_risk, child_safety_risk, fall_hazard, health_risk, water_wastage, slip_hazard, night_visibility_risk, contamination_risk, environmental_hazard, pest_infestation, flooding_risk, electrical_hazard, public_injury_risk, vehicle_damage_risk, odour, livestock_risk
  "department": string,               // one of: ${DEPARTMENT_KEYS.join(", ")}
  "description": string,              // one factual sentence about what is visible
  "recommended_action": string,       // short recommended municipal action
  "reasoning": string                 // 1-2 sentences explaining your classification
}

Rules:
- NEVER invent facts that cannot reasonably be inferred from the image.
- If the image is unclear, unrelated to civic issues, or evidence is insufficient: set is_civic_issue to false, category to "other", low confidence, severity "unknown", severity_score 0, empty hazards.
- Respond with the JSON object only. No markdown, no code fences, no commentary.`;

// ---------- JSON validation (AI output contract) ----------

const AnalysisSchema = z.object({
  is_civic_issue: z.boolean(),
  category: z.string(),
  confidence: z.coerce.number().min(0).max(1),
  severity: z.string(),
  severity_score: z.coerce.number().min(0).max(10),
  hazards: z.array(z.string()).default([]),
  department: z.string(),
  description: z.string().default(""),
  recommended_action: z.string().default(""),
  reasoning: z.string().default(""),
});

function extractJson(text: string): unknown {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("No JSON object in response");
  return JSON.parse(cleaned.slice(start, end + 1));
}

function normalizeSeverity(v: string): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "UNKNOWN" {
  const s = (v ?? "").toLowerCase();
  if (s === "low") return "LOW";
  if (s === "medium" || s === "moderate") return "MEDIUM";
  if (s === "high") return "HIGH";
  if (s === "critical" || s === "severe") return "CRITICAL";
  return "UNKNOWN";
}

function coerceAnalysis(raw: unknown, model: string, source: CivicAnalysisResult["source"], processingMs: number): CivicAnalysisResult {
  const parsed = AnalysisSchema.parse(raw);
  const categoryKey = CATEGORY_KEYS.includes(parsed.category) ? parsed.category : "other";
  const category = DEFAULT_CATEGORIES.find((c) => c.key === categoryKey)!;
  let departmentKey = DEPARTMENT_KEYS.includes(parsed.department) ? parsed.department : category.departmentKey;
  if (!parsed.is_civic_issue) {
    // unclear image → general municipal for manual triage
    departmentKey = "general";
  }
  return {
    isCivicIssue: parsed.is_civic_issue,
    categoryKey: parsed.is_civic_issue ? categoryKey : "other",
    confidence: Math.round(parsed.confidence * 100) / 100,
    severity: parsed.is_civic_issue ? normalizeSeverity(parsed.severity) : "UNKNOWN",
    severityScore: parsed.is_civic_issue ? Math.round(parsed.severity_score) : 0,
    hazards: parsed.is_civic_issue ? parsed.hazards.slice(0, 6) : [],
    departmentKey,
    description: parsed.description || "Reported civic issue.",
    reasoning: parsed.reasoning || "",
    recommendedAction: parsed.recommended_action || "Site inspection",
    model,
    source,
    processingMs,
  };
}

// ---------- Provider: z-ai-web-dev-sdk vision (default) ----------

const globalForAI = globalThis as unknown as { __civiclens_zai: unknown };

async function analyzeWithZAi(input: AnalyzeImageInput): Promise<CivicAnalysisResult> {
  const started = Date.now();
  const { default: ZAI } = await import("z-ai-web-dev-sdk");
  if (!globalForAI.__civiclens_zai) globalForAI.__civiclens_zai = await ZAI.create();
  const zai = globalForAI.__civiclens_zai as Awaited<ReturnType<typeof ZAI.create>>;

  const base64 = input.imageBuffer.toString("base64");
  const userText = input.description?.trim()
    ? `${ANALYSIS_PROMPT}\n\nCitizen description (may be unreliable): "${input.description.trim()}"`
    : ANALYSIS_PROMPT;

  const response = await withTimeout(
    zai.chat.completions.createVision({
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: userText },
            { type: "image_url", image_url: { url: `data:${input.mimeType};base64,${base64}` } },
          ],
        },
      ],
      thinking: { type: "disabled" },
    }),
    75_000,
    "AI vision request timed out"
  );

  const content = response.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty AI response");
  return coerceAnalysis(extractJson(content), "zai-vision", "VLM_SDK", Date.now() - started);
}

// ---------- Provider: Google Gemini (activated by GEMINI_API_KEY) ----------

async function analyzeWithGemini(input: AnalyzeImageInput): Promise<CivicAnalysisResult> {
  const started = Date.now();
  const key = process.env.GEMINI_API_KEY!;
  const model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
  const userText = input.description?.trim()
    ? `${ANALYSIS_PROMPT}\n\nCitizen description (may be unreliable): "${input.description.trim()}"`
    : ANALYSIS_PROMPT;

  const res = await withTimeout(
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: userText },
              { inline_data: { mime_type: input.mimeType, data: input.imageBuffer.toString("base64") } },
            ],
          },
        ],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
      }),
    }),
    60_000,
    "Gemini request timed out"
  );

  if (!res.ok) {
    throw new Error(`Gemini API error ${res.status}`);
  }
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty Gemini response");
  return coerceAnalysis(extractJson(text), model, "GEMINI", Date.now() - started);
}

// ---------- Precomputed demo results (sample photos) ----------

const PRECOMPUTED: Record<string, Omit<CivicAnalysisResult, "processingMs">> = {
  pothole: {
    isCivicIssue: true, categoryKey: "pothole", confidence: 0.94, severity: "HIGH", severityScore: 8,
    hazards: ["two_wheeler_risk", "traffic_disruption"], departmentKey: "roads",
    description: "Large road-surface deformation filled with water is visible on the carriageway.",
    reasoning: "The image shows a significant depression in the asphalt with crumbling edges — consistent with a deep pothole that poses a two-wheeler and traffic hazard.",
    recommendedAction: "Site inspection and road repair",
    model: "civiclens-demo-vision (precomputed)", source: "DEMO_PRECOMPUTED",
  },
  garbage: {
    isCivicIssue: true, categoryKey: "garbage", confidence: 0.91, severity: "MEDIUM", severityScore: 6,
    hazards: ["health_risk", "pest_infestation", "odour"], departmentKey: "sanitation",
    description: "A mixed solid-waste pile is dumped at a street corner.",
    reasoning: "Household and plastic waste accumulated at the roadside indicates an uncollected garbage point, attracting pests and creating a public health risk.",
    recommendedAction: "Dispatch collection crew and place a bin",
    model: "civiclens-demo-vision (precomputed)", source: "DEMO_PRECOMPUTED",
  },
  water_leakage: {
    isCivicIssue: true, categoryKey: "water_leakage", confidence: 0.89, severity: "MEDIUM", severityScore: 6,
    hazards: ["water_wastage", "slip_hazard", "vehicle_damage_risk"], departmentKey: "water",
    description: "Water is gushing from a pipeline joint and pooling over the road surface.",
    reasoning: "Continuous clean-water discharge on the pavement suggests a distribution-line leak causing water wastage and road-surface damage.",
    recommendedAction: "Shut valve and repair distribution line",
    model: "civiclens-demo-vision (precomputed)", source: "DEMO_PRECOMPUTED",
  },
  broken_streetlight: {
    isCivicIssue: true, categoryKey: "broken_streetlight", confidence: 0.92, severity: "MEDIUM", severityScore: 5,
    hazards: ["night_visibility_risk", "pedestrian_risk"], departmentKey: "electrical",
    description: "A streetlight pole has a damaged, hanging lamp head with exposed wiring.",
    reasoning: "The bent pole and detached fixture indicate a failed street light creating poor night visibility and possible electrical risk.",
    recommendedAction: "Replace fixture and inspect wiring",
    model: "civiclens-demo-vision (precomputed)", source: "DEMO_PRECOMPUTED",
  },
  open_manhole: {
    isCivicIssue: true, categoryKey: "open_manhole", confidence: 0.96, severity: "CRITICAL", severityScore: 10,
    hazards: ["fall_hazard", "child_safety_risk", "livestock_risk"], departmentKey: "public_works",
    description: "An uncovered manhole with a broken rim is open on the street.",
    reasoning: "The exposed deep shaft with damaged concrete ring is a severe fall hazard for pedestrians, children and animals — immediate barricading is required.",
    recommendedAction: "Immediate barricading and cover replacement",
    model: "civiclens-demo-vision (precomputed)", source: "DEMO_PRECOMPUTED",
  },
  sewage_drainage: {
    isCivicIssue: true, categoryKey: "sewage_drainage", confidence: 0.9, severity: "HIGH", severityScore: 7,
    hazards: ["health_risk", "contamination_risk", "odour"], departmentKey: "drainage",
    description: "Black waste water from a clogged drain is overflowing across the road edge.",
    reasoning: "Stagnant sewage on the carriageway indicates a blocked sewer line, creating sanitation and contamination risk in the area.",
    recommendedAction: "De-silt drain and disinfect affected area",
    model: "civiclens-demo-vision (precomputed)", source: "DEMO_PRECOMPUTED",
  },
  illegal_dumping: {
    isCivicIssue: true, categoryKey: "illegal_dumping", confidence: 0.88, severity: "MEDIUM", severityScore: 6,
    hazards: ["environmental_hazard", "pest_infestation"], departmentKey: "sanitation",
    description: "Construction debris and rubble are illegally dumped beside a boundary wall.",
    reasoning: "Bricks, concrete rubble and mixed waste on an empty plot indicate unauthorised debris dumping rather than routine garbage.",
    recommendedAction: "Issue notice and arrange debris removal",
    model: "civiclens-demo-vision (precomputed)", source: "DEMO_PRECOMPUTED",
  },
  road_obstruction: {
    isCivicIssue: true, categoryKey: "road_obstruction", confidence: 0.87, severity: "MEDIUM", severityScore: 5,
    hazards: ["traffic_disruption", "vehicle_damage_risk"], departmentKey: "traffic",
    description: "A fallen tree branch is blocking half of the roadway.",
    reasoning: "The large branch across the lane is forcing vehicles into the opposite carriageway and disrupting traffic flow.",
    recommendedAction: "Clear obstruction and prune tree",
    model: "civiclens-demo-vision (precomputed)", source: "DEMO_PRECOMPUTED",
  },
  damaged_infrastructure: {
    isCivicIssue: true, categoryKey: "damaged_infrastructure", confidence: 0.85, severity: "LOW", severityScore: 4,
    hazards: ["public_injury_risk"], departmentKey: "general",
    description: "A public bus-stop shelter has a broken roof panel and bent bench.",
    reasoning: "Damaged fiberglass roofing and deformed seating at the shelter present minor injury risk to waiting commuters.",
    recommendedAction: "Repair shelter panel and bench",
    model: "civiclens-demo-vision (precomputed)", source: "DEMO_PRECOMPUTED",
  },
};

// ---------- Heuristic fallback (AI unavailable) ----------

const KEYWORD_MAP: [string, RegExp][] = [
  ["open_manhole", /manhole|open drain cover/i],
  ["pothole", /pothole|road crack|crater|road damage|speed breaker broke/i],
  ["garbage", /garbage|trash|waste|kachra|dumpster/i],
  ["water_leakage", /water leak|pipeline|pipe burst|leaking water/i],
  ["broken_streetlight", /streetlight|street light|lamp|light not work/i],
  ["sewage_drainage", /sewage|sewer|drain|nali|overflow/i],
  ["illegal_dumping", /dumping|debris|malba|rubble/i],
  ["road_obstruction", /obstruction|blocked|fallen tree|diversion/i],
  ["damaged_infrastructure", /bus stop|bench|shelter|park equipment|fence broke/i],
];

function fallbackAnalysis(description?: string | null): CivicAnalysisResult {
  const text = (description ?? "").trim();
  let categoryKey = "other";
  for (const [key, re] of KEYWORD_MAP) {
    if (re.test(text)) {
      categoryKey = key;
      break;
    }
  }
  const category = DEFAULT_CATEGORIES.find((c) => c.key === categoryKey)!;
  const severity = categoryKey === "other" ? "UNKNOWN" : categoryKey === "open_manhole" ? "CRITICAL" : "MEDIUM";
  const severityScore = categoryKey === "other" ? 0 : categoryKey === "open_manhole" ? 9 : category.defaultSeverity;
  return {
    isCivicIssue: true,
    categoryKey,
    confidence: 0.3,
    severity,
    severityScore,
    hazards: categoryKey === "open_manhole" ? ["fall_hazard"] : [],
    departmentKey: category.departmentKey,
    description: text ? `Citizen-reported: "${text.slice(0, 140)}"` : "Reported civic issue (pending review).",
    reasoning: "AI analysis was temporarily unavailable, so this report was saved for manual classification.",
    recommendedAction: "Manual verification required.",
    model: "heuristic-fallback",
    source: "FALLBACK_MANUAL",
    processingMs: 0,
  };
}

// ---------- Public API ----------

/** Precomputed demo analysis for a category (used by the demo seed; clearly labelled). */
export function getPrecomputedByCategory(categoryKey: string): CivicAnalysisResult | null {
  const p = PRECOMPUTED[categoryKey];
  return p ? { ...p, processingMs: 1 } : null;
}

function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

export async function analyzeCivicImage(input: AnalyzeImageInput): Promise<CivicAnalysisResult> {
  // 1) Bundled sample photo → precomputed result (zero quota usage, demo-safe)
  if (input.sampleKey && PRECOMPUTED[input.sampleKey]) {
    log.info("ai_success", { source: "DEMO_PRECOMPUTED", sample: input.sampleKey });
    return { ...PRECOMPUTED[input.sampleKey], processingMs: 1 };
  }

  // 2) Live provider (Gemini when configured, else z-ai vision SDK)
  const useGemini = Boolean(process.env.GEMINI_API_KEY);
  try {
    const result = useGemini
      ? await analyzeWithGemini(input)
      : await analyzeWithZAi(input);
    log.info("ai_success", {
      source: result.source,
      model: result.model,
      category: result.categoryKey,
      confidence: result.confidence,
      ms: result.processingMs,
    });
    return result;
  } catch (err) {
    log.warn("ai_failure", {
      provider: useGemini ? "GEMINI" : "VLM_SDK",
      error: String(err).slice(0, 200),
    });
    // 3) Never fail the report — fall back to manual classification
    const fb = fallbackAnalysis(input.description);
    log.info("ai_success", { source: "FALLBACK_MANUAL", category: fb.categoryKey });
    return fb;
  }
}
