// CivicLens — shared domain types (used by both API routes and client UI)

export type Role = "CITIZEN" | "ADMIN";

export type IncidentStatus =
  | "REPORTED"
  | "VERIFIED"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "RESOLVED"
  | "REJECTED";

export type Priority = "P1" | "P2" | "P3" | "P4";
export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "UNKNOWN";
export type ProcessingState = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
export type AiSource = "VLM_SDK" | "GEMINI" | "DEMO_PRECOMPUTED" | "FALLBACK_MANUAL";

export interface SessionUser {
  id: string;
  publicId: string;
  name: string;
  role: Role;
  city: string | null;
}

export interface CategoryConfig {
  key: string;
  label: string;
  departmentKey: string;
  defaultSeverity: number;
  hazardWeight: number;
}

export interface DepartmentConfig {
  key: string;
  name: string;
  description: string;
}

export interface AppUser {
  id: string;
  publicId: string;
  name: string;
  role: Role;
}

/** Structured multimodal AI analysis of a citizen photo (provider-agnostic). */
export interface CivicAnalysis {
  id: string;
  isCivicIssue: boolean;
  categoryKey: string;
  confidence: number; // 0..1
  severity: Severity;
  severityScore: number; // 0..10
  hazards: string[];
  departmentKey: string;
  description: string;
  reasoning: string;
  recommendedAction: string;
  model: string;
  source: AiSource;
  processingMs: number;
  createdAt: string;
}

export interface ReportDTO {
  id: string;
  publicId: string;
  incidentId: string | null;
  incidentPublicId: string | null;
  imagePath: string | null;
  description: string | null;
  latitude: number;
  longitude: number;
  captureTimestamp: string;
  submissionTimestamp: string;
  processingState: ProcessingState;
  isDemo: boolean;
  createdAt: string;
  reporterName?: string; // shown only to admins, never public
  analysis?: CivicAnalysis | null;
}

export interface IncidentSummary {
  id: string;
  publicId: string;
  title: string | null;
  categoryKey: string;
  categoryLabel?: string;
  severity: Severity;
  severityScore: number;
  priority: Priority;
  priorityScore: number;
  priorityReasons: string[];
  aiConfidence: number | null;
  departmentKey: string | null;
  departmentName?: string | null;
  latitude: number;
  longitude: number;
  address: string | null;
  city: string | null;
  district: string | null;
  state: string | null;
  status: IncidentStatus;
  reportCount: number;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  resolutionNote?: string | null;
}

export interface StatusHistoryEntry {
  id: string;
  fromStatus: IncidentStatus | null;
  toStatus: IncidentStatus;
  actorName: string | null;
  actorRole: string | null;
  note: string | null;
  createdAt: string;
}

export interface AssignmentEntry {
  id: string;
  departmentKey: string;
  departmentName: string;
  team: string | null;
  assignedToName: string | null;
  note: string | null;
  createdAt: string;
}

export interface ResolutionEvidenceDTO {
  id: string;
  imagePath: string;
  note: string | null;
  createdAt: string;
}

export interface IncidentDetail extends IncidentSummary {
  aiReasoning: string | null;
  reports: ReportDTO[];
  statusHistory: StatusHistoryEntry[];
  assignments: AssignmentEntry[];
  resolutionEvidences: ResolutionEvidenceDTO[];
}

export interface DuplicateCandidate {
  publicId: string;
  categoryKey: string;
  categoryLabel?: string;
  priority: Priority;
  status: IncidentStatus;
  reportCount: number;
  distanceMeters: number;
  address: string | null;
  city: string | null;
  ageHours: number;
}

export interface NotificationDTO {
  id: string;
  incidentPublicId: string | null;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

export interface ReverseGeocodeResult {
  display: string;
  road?: string;
  suburb?: string;
  city?: string;
  district?: string;
  state?: string;
  country?: string;
  postcode?: string;
}

export interface AnalyticsDTO {
  totals: {
    reports: number;
    incidents: number;
    activeIncidents: number;
    resolvedIncidents: number;
    highPriority: number;
    linkedReports: number;
    avgResolutionHours: number | null;
  };
  byCategory: { key: string; label: string; count: number; open: number }[];
  byCity: { city: string; count: number; open: number }[];
  byState: { state: string; count: number }[];
  byPriority: { priority: Priority; count: number }[];
  byStatus: { status: IncidentStatus; count: number }[];
  departmentWorkload: { departmentKey: string; name: string; open: number; resolved: number }[];
  resolutionTrend: { week: string; resolved: number }[];
}

/** Response of POST /api/reports/analyze */
export interface AnalyzeResponse {
  reportId: string;
  reportPublicId: string;
  analysis: CivicAnalysis;
  duplicateCandidates: DuplicateCandidate[];
  cached: boolean; // true when a stored analysis was returned (no new AI call)
}

export interface SubmitReportRequest {
  reportId: string;
  categoryKey?: string; // manual override when AI unavailable/edited
  description?: string;
  latitude?: number;
  longitude?: number;
  address?: ReverseGeocodeResult | null;
  locationChanged?: boolean;
  decision?: "link" | "new";
  linkToIncidentPublicId?: string;
}

export interface SubmitReportResponse {
  ok: true;
  incident: IncidentSummary;
  linked: boolean;
  duplicateCandidates?: DuplicateCandidate[];
  requiresDecision?: boolean;
}

export interface ApiError {
  error: string;
  details?: string;
}
