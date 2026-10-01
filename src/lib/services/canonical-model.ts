// CIVIC INDIA 2.0 — Canonical Common Civic Data Model
// Standardizes fragmented inputs from disparate government systems into a single schema.

export interface CanonicalCivicRecord {
  sourceSystem: string;
  sourceRecordId: string;
  citizenId?: string;
  citizenName?: string;
  contact?: string;
  category: string; // canonical category key
  description: string;
  latitude: number;
  longitude: number;
  address: string;
  timestamp: Date;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  evidence: string[];
  department?: string;
  serviceType?: string;
  infrastructureId?: string;
  status: string;
  metadata: Record<string, unknown>;
  correlationId: string;
}

// Canonical category mapper
export function mapToCanonicalCategory(input: string | undefined | null): string {
  if (!input) return "other";
  const clean = input.toLowerCase().trim();

  if (
    clean.includes("pothole") ||
    clean.includes("crater") ||
    (clean.includes("road") && (clean.includes("damage") || clean.includes("defect") || clean.includes("repair"))) ||
    clean.includes("asphalt") ||
    clean.includes("tar") ||
    clean.includes("pavement") ||
    clean.includes("carriageway")
  ) {
    return "pothole";
  }
  if (clean.includes("garbage") || clean.includes("waste") || clean.includes("trash") || clean.includes("litter") || clean.includes("dump")) {
    return "garbage";
  }
  if (clean.includes("water leak") || clean.includes("pipeline") || clean.includes("pipe burst") || clean.includes("contamination")) {
    return "water_leakage";
  }
  if (clean.includes("streetlight") || clean.includes("light") || clean.includes("lamp") || clean.includes("dark")) {
    return "broken_streetlight";
  }
  if (clean.includes("manhole") || clean.includes("sewer cover") || clean.includes("open drain pit")) {
    return "open_manhole";
  }
  if (clean.includes("sewage") || clean.includes("drainage") || clean.includes("overflow") || clean.includes("gutter")) {
    return "sewage_drainage";
  }
  if (clean.includes("obstruction") || clean.includes("fallen tree") || clean.includes("blockage") || clean.includes("debris")) {
    return "road_obstruction";
  }
  if (clean.includes("infrastructure") || clean.includes("divider") || clean.includes("railing") || clean.includes("signboard")) {
    return "damaged_infrastructure";
  }
  return "other";
}

// Canonical severity mapper
export function mapToCanonicalSeverity(input: string | number | undefined | null): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  if (!input) return "MEDIUM";
  if (typeof input === "number") {
    if (input >= 9) return "CRITICAL";
    if (input >= 7) return "HIGH";
    if (input >= 4) return "MEDIUM";
    return "LOW";
  }
  const str = String(input).toUpperCase();
  if (str.includes("CRIT") || str.includes("EMERGENCY") || str === "10" || str === "P1") return "CRITICAL";
  if (str.includes("HIGH") || str.includes("URGENT") || str === "P2") return "HIGH";
  if (str.includes("LOW") || str.includes("MINOR") || str === "P4") return "LOW";
  return "MEDIUM";
}

/** Normalize input from any known or simulated government platform */
export function normalizeToCanonical(
  systemCode: string,
  raw: Record<string, unknown>,
  correlationId: string
): CanonicalCivicRecord {
  switch (systemCode) {
    case "MUN_PORTAL":
      return {
        sourceSystem: "MUN_PORTAL",
        sourceRecordId: String(raw.complaintId || raw.complaint_id || raw.id || `MUN-${Date.now()}`),
        citizenName: String(raw.citizenName || raw.complainant || "Anonymous Citizen"),
        contact: raw.contact ? String(raw.contact) : raw.phone ? String(raw.phone) : undefined,
        category: mapToCanonicalCategory(String(raw.type || raw.category || raw.issue)),
        description: String(raw.issue || raw.description || "Reported civic issue via Municipal Portal"),
        latitude: Number(raw.lat || raw.latitude || 27.5548),
        longitude: Number(raw.lon || raw.longitude || 76.6165),
        address: String(raw.area || raw.address || raw.locality || "Municipal Ward Area, Alwar"),
        timestamp: raw.dateReported ? new Date(String(raw.dateReported)) : new Date(),
        severity: mapToCanonicalSeverity(raw.severity as any),
        evidence: raw.evidenceUrl ? [String(raw.evidenceUrl)] : raw.photo ? [String(raw.photo)] : [],
        department: "Municipal Corporation",
        serviceType: "Citizen Grievance Redressal",
        infrastructureId: raw.assetId ? String(raw.assetId) : undefined,
        status: "RECEIVED",
        metadata: { ...raw },
        correlationId,
      };

    case "STATE_GRIEVANCE":
      return {
        sourceSystem: "STATE_GRIEVANCE",
        sourceRecordId: String(raw.grievanceNo || raw.grievance_id || raw.id || `STATE-${Date.now()}`),
        citizenName: String(raw.petitionerName || raw.petitioner || "State Citizen"),
        contact: raw.contactNumber ? String(raw.contactNumber) : undefined,
        category: mapToCanonicalCategory(String(raw.category || raw.grievanceType || raw.grievanceDescription)),
        description: String(raw.grievanceDescription || raw.description || "Grievance lodged on State Portal"),
        latitude: Number(raw.latitude || raw.lat || 27.5555),
        longitude: Number(raw.longitude || raw.lon || 76.6306),
        address: String(raw.location || raw.address || "District Jurisdiction, Alwar"),
        timestamp: raw.filingDate ? new Date(String(raw.filingDate)) : new Date(),
        severity: mapToCanonicalSeverity(raw.urgencyLevel as any || raw.priority),
        evidence: raw.attachmentUrl ? [String(raw.attachmentUrl)] : [],
        department: "State Grievance Directorate",
        serviceType: "CM Helpline Escalation",
        infrastructureId: raw.infraCode ? String(raw.infraCode) : undefined,
        status: "RECEIVED",
        metadata: { ...raw },
        correlationId,
      };

    case "PWD_SYSTEM":
      return {
        sourceSystem: "PWD_SYSTEM",
        sourceRecordId: String(raw.workOrderId || raw.ticket_no || raw.id || `PWD-${Date.now()}`),
        citizenName: String(raw.reporterName || raw.engineerName || "Field Inspector"),
        contact: raw.mobile ? String(raw.mobile) : undefined,
        category: mapToCanonicalCategory(String(raw.issueType || raw.problem_type || raw.issueDescription)),
        description: String(raw.issueDescription || raw.description || "PWD Work Order Inspection Record"),
        latitude: Number(raw.gpsLat || raw.latitude || 27.5494),
        longitude: Number(raw.gpsLng || raw.longitude || 76.6335),
        address: String(raw.siteLocation || raw.roadName || raw.address || "PWD State Roadway, Alwar"),
        timestamp: raw.reportDate ? new Date(String(raw.reportDate)) : new Date(),
        severity: mapToCanonicalSeverity(raw.hazardScore as any || "HIGH"),
        evidence: raw.sitePhoto ? [String(raw.sitePhoto)] : [],
        department: "Public Works Department",
        serviceType: "Infrastructure Maintenance",
        infrastructureId: raw.roadAssetId ? String(raw.roadAssetId) : "INFRA-ALW-PWD-019",
        status: "RECEIVED",
        metadata: { ...raw },
        correlationId,
      };

    case "SANITATION_DEPT":
      return {
        sourceSystem: "SANITATION_DEPT",
        sourceRecordId: String(raw.ticketId || raw.id || `SAN-${Date.now()}`),
        citizenName: String(raw.complainant || "Resident"),
        contact: raw.phone ? String(raw.phone) : undefined,
        category: "garbage",
        description: String(raw.details || raw.description || "Sanitation collection issue"),
        latitude: Number(raw.lat || 27.5548),
        longitude: Number(raw.lng || 76.6165),
        address: String(raw.ward || "Sanitation Ward 4, Alwar"),
        timestamp: raw.loggedAt ? new Date(String(raw.loggedAt)) : new Date(),
        severity: mapToCanonicalSeverity(raw.severity as any),
        evidence: raw.photoUrl ? [String(raw.photoUrl)] : [],
        department: "Sanitation Department",
        serviceType: "Waste Management",
        status: "RECEIVED",
        metadata: { ...raw },
        correlationId,
      };

    case "WATER_DEPT":
      return {
        sourceSystem: "WATER_DEPT",
        sourceRecordId: String(raw.referenceNo || raw.id || `WTR-${Date.now()}`),
        citizenName: String(raw.consumerName || "Water Consumer"),
        contact: raw.consumerPhone ? String(raw.consumerPhone) : undefined,
        category: "water_leakage",
        description: String(raw.complaint || raw.description || "Water supply pipe defect"),
        latitude: Number(raw.latitude || 27.5501),
        longitude: Number(raw.longitude || 76.634),
        address: String(raw.area || "Pipeline Sector, Alwar"),
        timestamp: raw.dateLogged ? new Date(String(raw.dateLogged)) : new Date(),
        severity: mapToCanonicalSeverity(raw.urgency as any),
        evidence: raw.defectPhoto ? [String(raw.defectPhoto)] : [],
        department: "Water Supply Department",
        serviceType: "Potable Water Distribution",
        status: "RECEIVED",
        metadata: { ...raw },
        correlationId,
      };

    default:
      // Generic normalizer
      return {
        sourceSystem: systemCode,
        sourceRecordId: String(raw.recordId || raw.id || raw.complaintId || `GEN-${Date.now()}`),
        citizenName: String(raw.citizenName || raw.name || "Citizen"),
        contact: raw.contact ? String(raw.contact) : undefined,
        category: mapToCanonicalCategory(String(raw.category || raw.type || raw.issue)),
        description: String(raw.description || raw.issue || raw.details || "Civic report received"),
        latitude: Number(raw.latitude || raw.lat || 27.55),
        longitude: Number(raw.longitude || raw.lng || raw.lon || 76.62),
        address: String(raw.address || raw.location || "Alwar, Rajasthan"),
        timestamp: raw.timestamp ? new Date(String(raw.timestamp)) : new Date(),
        severity: mapToCanonicalSeverity(raw.severity as any),
        evidence: Array.isArray(raw.evidence) ? raw.evidence.map(String) : [],
        department: String(raw.department || "General Administration"),
        serviceType: "General Public Service",
        status: "RECEIVED",
        metadata: { ...raw },
        correlationId,
      };
  }
}
