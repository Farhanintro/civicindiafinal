// CIVIC INDIA 2.0 — End-to-End Ingestion Pipeline
// Coordinates the full lifecycle: Receive → Validate → Data Quality → Normalize
// → Master Data / Entity Resolution → Consent Check → AI Duplicate Linking
// → Unified Case Creation → Workflow → Routing → SLA → Audit & Events.

import "server-only";
import { db } from "@/lib/db";
import { log } from "./logger";
import { normalizeToCanonical, type CanonicalCivicRecord } from "./canonical-model";
import { evaluatePayloadQuality, recordDataQualityCheck } from "./data-quality-service";
import { resolveMasterRoad, resolveMasterCitizen } from "./master-data-service";
import { checkConsent } from "./consent-service";
import { determineDepartmentRouting } from "./routing-service";
import { initializeCaseWorkflow, transitionCaseWorkflow } from "./workflow-service";
import { createSlaTracker } from "./sla-service";
import { writeAuditLog } from "./audit-service";
import { publishCivicEvent, generateCorrelationId } from "./event-service";
import { queueForRetry } from "./retry-service";
import { createUnifiedCase, linkComplaintToCase } from "./unified-case-service";
import { haversineMeters } from "@/lib/civiclens/geo";

export interface IngestionResult {
  success: boolean;
  correlationId: string;
  sourceSystemCode: string;
  sourceRecordId: string;
  dataQualityScore: number;
  dataQualityStatus: string;
  isDuplicate: boolean;
  unifiedCaseId?: string;
  unifiedCasePublicId?: string;
  assignedDepartment?: string;
  routingReason?: string;
  matchReasons?: string[];
  matchConfidence?: number;
  error?: string;
}

/** The Core Interoperability Ingestion Pipeline */
export async function runIngestionPipeline(opts: {
  systemCode: string;
  rawData: Record<string, unknown>;
  correlationId?: string;
}): Promise<IngestionResult> {
  const correlationId = opts.correlationId || generateCorrelationId();
  const startedAt = Date.now();

  // 1. Identify System
  const system = await db.governmentSystem.findUnique({
    where: { code: opts.systemCode },
  });

  // 2. Normalize to Canonical Model
  const normalized: CanonicalCivicRecord = normalizeToCanonical(
    opts.systemCode,
    opts.rawData,
    correlationId
  );

  const sourceRecordId = normalized.sourceRecordId;

  // 3. Publish Event: RECORD_RECEIVED
  await publishCivicEvent({
    eventType: "RECORD_RECEIVED",
    correlationId,
    sourceSystem: opts.systemCode,
    entityType: "CANONICAL_RECORD",
    entityId: sourceRecordId,
    summary: `Inbound record received from ${system?.name ?? opts.systemCode}: ${sourceRecordId}`,
    payload: { raw: opts.rawData, normalized },
  });

  // 4. Data Quality Evaluation
  const dqResult = evaluatePayloadQuality(opts.systemCode, opts.rawData, normalized);

  await recordDataQualityCheck({
    systemId: system?.id,
    sourceRecordId,
    correlationId,
    rawPayload: opts.rawData,
    normalized,
    evaluation: dqResult,
  });

  await publishCivicEvent({
    eventType: "DATA_QUALITY_EVALUATED",
    correlationId,
    sourceSystem: opts.systemCode,
    entityType: "DATA_QUALITY",
    entityId: sourceRecordId,
    summary: `Data Quality Score: ${dqResult.score}/100 [Status: ${dqResult.status}]`,
    payload: { evaluation: dqResult },
  });

  // If rejected due to fatal errors, queue for retry or record failure
  if (dqResult.status === "REJECTED") {
    await queueForRetry({
      systemId: system?.id,
      sourceSystemCode: opts.systemCode,
      sourceRecordId,
      correlationId,
      endpoint: `/api/integrations/${opts.systemCode}/ingest`,
      payload: opts.rawData,
      error: `Data Quality Validation Failed: ${dqResult.errors.join("; ")}`,
    });

    return {
      success: false,
      correlationId,
      sourceSystemCode: opts.systemCode,
      sourceRecordId,
      dataQualityScore: dqResult.score,
      dataQualityStatus: dqResult.status,
      isDuplicate: false,
      error: `Data Quality Rejected: ${dqResult.errors.join("; ")}`,
    };
  }

  // 5. Master Data / Entity Resolution
  const resolvedRoad = await resolveMasterRoad({
    address: normalized.address,
    sourceSystemCode: opts.systemCode,
    latitude: normalized.latitude,
    longitude: normalized.longitude,
  });

  const resolvedCitizen = await resolveMasterCitizen({
    citizenName: normalized.citizenName,
    contact: normalized.contact,
    sourceSystemCode: opts.systemCode,
  });

  await publishCivicEvent({
    eventType: "MASTER_ENTITY_RESOLVED",
    correlationId,
    sourceSystem: opts.systemCode,
    entityType: "MASTER_DATA",
    entityId: resolvedRoad?.masterCode,
    summary: `Entity Resolution: Road=${resolvedRoad?.canonicalName ?? "Unknown"} (${Math.round((resolvedRoad?.confidence ?? 0) * 100)}%), Citizen=${resolvedCitizen?.canonicalName ?? "Unknown"}`,
    payload: { road: resolvedRoad, citizen: resolvedCitizen },
  });

  // 6. Consent & Access Governance Check
  const citizenId = resolvedCitizen?.masterCode || normalized.citizenId || "CIT-ANONYMOUS";
  const consent = await checkConsent({
    citizenId,
    requestingSystem: opts.systemCode,
    receivingSystem: normalized.department || "PWD_SYSTEM",
    requestedFields: ["location", "description", "evidence", "phone", "email"],
  });

  await publishCivicEvent({
    eventType: "CONSENT_VERIFIED",
    correlationId,
    sourceSystem: opts.systemCode,
    entityType: "CONSENT",
    entityId: citizenId,
    summary: `Consent Check: ${consent.status} — ${consent.reason}`,
    payload: { consent },
  });

  // 7. Duplicate / Unified Case Matching Engine
  const activeCases = await db.unifiedCase.findMany({
    where: {
      status: { in: ["OPEN", "INVESTIGATING", "IN_PROGRESS"] },
    },
    include: { links: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  let matchedCase: any = null;
  let matchConfidence = 0;
  const matchReasons: string[] = [];

  for (const uc of activeCases) {
    if (uc.latitude && uc.longitude) {
      const dist = haversineMeters(normalized.latitude, normalized.longitude, uc.latitude, uc.longitude);
      
      const isSameCategory = uc.categoryKey === normalized.category;
      const isCompatibleDomain =
        isSameCategory ||
        (["pothole", "damaged_infrastructure", "road_obstruction"].includes(uc.categoryKey ?? "") &&
         ["pothole", "damaged_infrastructure", "road_obstruction"].includes(normalized.category));

      // Match criteria: within 250m and compatible category domain
      if (dist <= 250 && isCompatibleDomain) {
        matchedCase = uc;
        let conf = Math.max(0.75, 1 - dist / 500);
        matchReasons.push(`Geospatial proximity: ${Math.round(dist)}m apart on the same physical corridor`);
        if (isSameCategory) {
          matchReasons.push(`Exact category match: ${normalized.category}`);
          conf += 0.1;
        } else {
          matchReasons.push(`Compatible civic domain: ${uc.categoryKey} ~ ${normalized.category}`);
        }
        if (resolvedRoad?.masterCode && (uc.title?.includes(resolvedRoad.canonicalName) || uc.address?.includes(resolvedRoad.canonicalName))) {
          matchReasons.push(`Correlated to identical Master Road: ${resolvedRoad.canonicalName} (${resolvedRoad.masterCode})`);
          conf += 0.15;
        }
        matchConfidence = Math.min(0.98, Math.round(conf * 100) / 100);
        break;
      }
    }
  }

  // 8. Department Routing Determination
  const routing = await determineDepartmentRouting({
    categoryKey: normalized.category,
    severity: normalized.severity,
    address: normalized.address,
    masterRoad: resolvedRoad,
  });

  let finalCase: any = null;

  if (matchedCase && matchConfidence >= 0.70) {
    // ── LINK TO EXISTING UNIFIED CASE ──
    const maskedCitizenName = (!consent.isPermitted || consent.restrictedFields.includes("name") || consent.restrictedFields.includes("citizenName"))
      ? "[Masked Citizen — DPDP Restricted]"
      : (resolvedCitizen?.canonicalName || normalized.citizenName);
    const maskedCitizenContact = (!consent.isPermitted || consent.restrictedFields.includes("phone") || consent.restrictedFields.includes("contact"))
      ? undefined
      : normalized.contact;

    await linkComplaintToCase({
      unifiedCaseId: matchedCase.id,
      sourceSystemCode: opts.systemCode,
      sourceComplaintId: sourceRecordId,
      linkType: "DUPLICATE",
      matchConfidence: Math.round(matchConfidence * 100) / 100,
      matchReasons,
      citizenName: maskedCitizenName,
      citizenContact: maskedCitizenContact,
      originalData: opts.rawData,
    });

    finalCase = matchedCase;

    await publishCivicEvent({
      eventType: "DUPLICATE_CLUSTERED",
      correlationId,
      sourceSystem: opts.systemCode,
      entityType: "UNIFIED_CASE",
      entityId: matchedCase.id,
      summary: `Cross-system record ${sourceRecordId} clustered into existing Unified Case ${matchedCase.caseId} (${Math.round(matchConfidence * 100)}% confidence)`,
      payload: { matchConfidence, matchReasons },
    });

    await writeAuditLog({
      correlationId,
      entityType: "UNIFIED_CASE",
      entityId: matchedCase.id,
      unifiedCaseId: matchedCase.id,
      action: "LINKED",
      actorType: "AI",
      summary: `Aggregated complaint ${sourceRecordId} from ${opts.systemCode} into case ${matchedCase.caseId}. Multi-platform confirmations: ${matchedCase.complaintCount + 1}.`,
    });
  } else {
    // ── CREATE NEW UNIFIED CASE ──
    const maskedCitizenName = (!consent.isPermitted || consent.restrictedFields.includes("name") || consent.restrictedFields.includes("citizenName"))
      ? "[Masked Citizen — DPDP Restricted]"
      : (resolvedCitizen?.canonicalName || normalized.citizenName);
    const maskedCitizenContact = (!consent.isPermitted || consent.restrictedFields.includes("phone") || consent.restrictedFields.includes("contact"))
      ? undefined
      : normalized.contact;

    finalCase = await createUnifiedCase({
      title: `${normalized.category.toUpperCase().replace("_", " ")} — ${resolvedRoad?.canonicalName ?? normalized.address}`,
      description: normalized.description,
      categoryKey: normalized.category,
      severity: normalized.severity,
      departmentKey: routing.departmentKey,
      departmentReason: routing.reason,
      latitude: normalized.latitude,
      longitude: normalized.longitude,
      address: normalized.address,
      city: "Alwar",
      district: "Alwar",
      state: "Rajasthan",
      sourceComplaints: [
        {
          sourceSystemCode: opts.systemCode,
          sourceComplaintId: sourceRecordId,
          linkType: "PRIMARY",
          matchConfidence: 1.0,
          matchReasons: ["First reported instance across integrated digital portals"],
          citizenName: maskedCitizenName,
          citizenContact: maskedCitizenContact,
          originalData: opts.rawData,
        },
      ],
    });

    // Save correlationId on the unified case
    await db.unifiedCase.update({
      where: { id: finalCase.id },
      data: { correlationId },
    });

    // Initialize SLA Tracker
    await createSlaTracker({
      unifiedCaseId: finalCase.id,
      priority: finalCase.priority,
    });

    // Initialize Workflow State Machine
    await initializeCaseWorkflow({
      unifiedCaseId: finalCase.id,
      departmentKey: routing.departmentKey,
      correlationId,
    });

    await publishCivicEvent({
      eventType: "UNIFIED_CASE_CREATED",
      correlationId,
      sourceSystem: opts.systemCode,
      entityType: "UNIFIED_CASE",
      entityId: finalCase.id,
      summary: `Created Unified Civic Case ${finalCase.caseId} [Priority: ${finalCase.priority}]`,
      payload: { caseId: finalCase.caseId, routing },
    });

    await publishCivicEvent({
      eventType: "CASE_ROUTED",
      correlationId,
      sourceSystem: opts.systemCode,
      entityType: "UNIFIED_CASE",
      entityId: finalCase.id,
      summary: `Routed to ${routing.departmentName}. Reason: ${routing.reason}`,
      payload: { routing },
    });

    await publishCivicEvent({
      eventType: "SLA_STARTED",
      correlationId,
      sourceSystem: opts.systemCode,
      entityType: "UNIFIED_CASE",
      entityId: finalCase.id,
      summary: `SLA timer initialized for ${finalCase.priority} tier.`,
    });
  }

  // 9. Update Government System Metrics & Log
  if (system) {
    await db.governmentSystem.update({
      where: { id: system.id },
      data: {
        requestCount: { increment: 1 },
        lastSyncAt: new Date(),
      },
    });

    await db.integrationLog.create({
      data: {
        systemId: system.id,
        direction: "INBOUND",
        method: "POST",
        endpoint: `/api/integrations/${opts.systemCode}/ingest`,
        requestPayload: JSON.stringify(opts.rawData).slice(0, 1500),
        responsePayload: JSON.stringify({ caseId: finalCase.caseId, correlationId }),
        statusCode: 200,
        success: true,
        latencyMs: Date.now() - startedAt,
      },
    });
  }

  log.info("ingestion_pipeline_complete", {
    correlationId,
    system: opts.systemCode,
    record: sourceRecordId,
    caseId: finalCase?.caseId,
  });

  return {
    success: true,
    correlationId,
    sourceSystemCode: opts.systemCode,
    sourceRecordId,
    dataQualityScore: dqResult.score,
    dataQualityStatus: dqResult.status,
    isDuplicate: Boolean(matchedCase),
    unifiedCaseId: finalCase.id,
    unifiedCasePublicId: finalCase.caseId,
    assignedDepartment: routing.departmentKey,
    routingReason: routing.reason,
    matchReasons,
    matchConfidence,
  };
}
