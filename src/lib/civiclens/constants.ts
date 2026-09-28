// CivicLens — configurable domain constants.
// Category routing & duplicate rules live in config, NOT scattered through the app.

import type { CategoryConfig, DepartmentConfig, IncidentStatus, Priority, Severity } from "./types";

export const APP_NAME = "CivicLens";
export const APP_TAGLINE = "See a problem. Report it. Track the action.";
export const APP_DESCRIPTION =
  "AI-powered civic intelligence that transforms citizen evidence into actionable infrastructure incidents.";

/** Departments (category-based routing for MVP; jurisdiction-aware routing is future work). */
export const DEFAULT_DEPARTMENTS: DepartmentConfig[] = [
  { key: "roads", name: "Roads / PWD", description: "Road surface, carriageway repairs" },
  { key: "sanitation", name: "Sanitation", description: "Solid waste, garbage collection" },
  { key: "water", name: "Water Supply", description: "Pipelines, leaks, water infrastructure" },
  { key: "electrical", name: "Electrical", description: "Street lighting and public electrical" },
  { key: "drainage", name: "Drainage", description: "Sewer and storm-water drains" },
  { key: "public_works", name: "Public Works / Safety", description: "Manholes, public structures" },
  { key: "traffic", name: "Traffic / Municipal", description: "Obstructions, signage, enforcement" },
  { key: "general", name: "General Municipal", description: "Escalation and manual triage" },
];

/** Civic issue categories — seeded into DB so they stay configurable. */
export const DEFAULT_CATEGORIES: CategoryConfig[] = [
  { key: "pothole", label: "Pothole / Road Damage", departmentKey: "roads", defaultSeverity: 6, hazardWeight: 1.1 },
  { key: "garbage", label: "Garbage / Waste", departmentKey: "sanitation", defaultSeverity: 5, hazardWeight: 1.0 },
  { key: "water_leakage", label: "Water Leakage", departmentKey: "water", defaultSeverity: 5, hazardWeight: 1.05 },
  { key: "broken_streetlight", label: "Broken Streetlight", departmentKey: "electrical", defaultSeverity: 4, hazardWeight: 0.95 },
  { key: "open_manhole", label: "Open Manhole", departmentKey: "public_works", defaultSeverity: 9, hazardWeight: 1.3 },
  { key: "sewage_drainage", label: "Sewage / Drainage", departmentKey: "drainage", defaultSeverity: 7, hazardWeight: 1.15 },
  { key: "illegal_dumping", label: "Illegal Dumping", departmentKey: "sanitation", defaultSeverity: 5, hazardWeight: 1.0 },
  { key: "road_obstruction", label: "Road Obstruction", departmentKey: "traffic", defaultSeverity: 5, hazardWeight: 1.05 },
  { key: "damaged_infrastructure", label: "Damaged Public Infrastructure", departmentKey: "general", defaultSeverity: 4, hazardWeight: 0.95 },
  { key: "other", label: "Other Civic Issue", departmentKey: "general", defaultSeverity: 4, hazardWeight: 1.0 },
];

/** Categories treated as "similar" during duplicate detection. */
export const RELATED_CATEGORIES: Record<string, string[]> = {
  garbage: ["illegal_dumping"],
  illegal_dumping: ["garbage"],
};

/** Duplicate detection thresholds (env-overridable). */
export const DUPLICATE_RADIUS_METERS = Number(process.env.DUPLICATE_RADIUS_METERS ?? 150);
export const DUPLICATE_TIME_WINDOW_DAYS = Number(process.env.DUPLICATE_TIME_WINDOW_DAYS ?? 60);

/** Upload validation. */
export const MAX_UPLOAD_BYTES = 6 * 1024 * 1024; // 6 MB after client-side compression
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Known sample photos (demo fallback so the SIH demo never depends on live quota). */
export const SAMPLE_PHOTOS = [
  { key: "pothole", path: "/samples/pothole.png", label: "Pothole" },
  { key: "garbage", path: "/samples/garbage.png", label: "Garbage" },
  { key: "water_leakage", path: "/samples/water-leak.png", label: "Water leak" },
  { key: "broken_streetlight", path: "/samples/streetlight.png", label: "Streetlight" },
  { key: "open_manhole", path: "/samples/manhole.png", label: "Open manhole" },
  { key: "sewage_drainage", path: "/samples/sewage.png", label: "Sewage" },
  { key: "illegal_dumping", path: "/samples/dumping.png", label: "Dumping" },
  { key: "road_obstruction", path: "/samples/obstruction.png", label: "Obstruction" },
  { key: "damaged_infrastructure", path: "/samples/infrastructure.png", label: "Bus stop" },
] as const;

/** Validated status transitions. */
export const STATUS_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  REPORTED: ["VERIFIED", "REJECTED"],
  VERIFIED: ["ASSIGNED", "REJECTED"],
  ASSIGNED: ["IN_PROGRESS", "REJECTED"],
  IN_PROGRESS: ["RESOLVED"],
  RESOLVED: ["IN_PROGRESS"], // reopened
  REJECTED: [],
};

export const STATUS_LABELS: Record<IncidentStatus, string> = {
  REPORTED: "Reported",
  VERIFIED: "Verified",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
  REJECTED: "Rejected",
};

export const STATUS_CLASSES: Record<IncidentStatus, string> = {
  REPORTED: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600",
  VERIFIED: "bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800",
  ASSIGNED: "bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800",
  IN_PROGRESS: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
  RESOLVED: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
  REJECTED: "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  P1: "P1 · Critical",
  P2: "P2 · High",
  P3: "P3 · Medium",
  P4: "P4 · Low",
};

export const PRIORITY_CLASSES: Record<Priority, string> = {
  P1: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
  P2: "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800",
  P3: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
  P4: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
};

/** Map marker colours by priority (hex — used by Leaflet DivIcon). */
export const PRIORITY_COLORS: Record<Priority, string> = {
  P1: "#dc2626",
  P2: "#ea580c",
  P3: "#d97706",
  P4: "#16a34a",
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
  UNKNOWN: "Unknown",
};

export const SEVERITY_CLASSES: Record<Severity, string> = {
  LOW: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
  MEDIUM: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
  HIGH: "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800",
  CRITICAL: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
  UNKNOWN: "bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-600",
};

/** Human-readable hazard labels. */
export const HAZARD_LABELS: Record<string, string> = {
  two_wheeler_risk: "Two-wheeler risk",
  traffic_disruption: "Traffic disruption",
  pedestrian_risk: "Pedestrian risk",
  child_safety_risk: "Child safety risk",
  fall_hazard: "Fall hazard",
  health_risk: "Public health risk",
  water_wastage: "Water wastage",
  slip_hazard: "Slip hazard",
  night_visibility_risk: "Night visibility risk",
  contamination_risk: "Contamination risk",
  environmental_hazard: "Environmental hazard",
  pest_infestation: "Pest infestation",
  flooding_risk: "Flooding risk",
  electrical_hazard: "Electrical hazard",
  public_injury_risk: "Injury risk",
  vehicle_damage_risk: "Vehicle damage risk",
  odour: "Odour",
  livestock_risk: "Livestock / animal risk",
};

export function hazardLabel(key: string): string {
  return HAZARD_LABELS[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Fallback city list for manual location selection when geocoding/GPS unavailable. */
export const INDIAN_CITIES: { city: string; state: string; lat: number; lng: number }[] = [
  { city: "Alwar", state: "Rajasthan", lat: 27.553, lng: 76.634 },
  { city: "Jaipur", state: "Rajasthan", lat: 26.9124, lng: 75.7873 },
  { city: "Delhi", state: "Delhi", lat: 28.6139, lng: 77.209 },
  { city: "Mumbai", state: "Maharashtra", lat: 19.076, lng: 72.8777 },
  { city: "Bengaluru", state: "Karnataka", lat: 12.9716, lng: 77.5946 },
  { city: "Lucknow", state: "Uttar Pradesh", lat: 26.8467, lng: 80.9462 },
  { city: "Pune", state: "Maharashtra", lat: 18.5204, lng: 73.8567 },
];

export const SESSION_COOKIE = "civiclens_session";
