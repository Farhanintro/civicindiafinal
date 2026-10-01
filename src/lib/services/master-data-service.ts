// CIVIC INDIA 2.0 — Master Data Management & Entity Resolution Service
// Maps fragmented identifiers and source aliases to canonical master government entities.

import "server-only";
import { db } from "@/lib/db";
import { log } from "./logger";

export interface MasterMatchResult {
  entityType: "ROAD" | "INFRASTRUCTURE" | "CITIZEN";
  masterCode: string;
  canonicalName: string;
  confidence: number;
  status: "AUTO_MATCH" | "REVIEW_REQUIRED" | "NO_MATCH";
  signals: string[];
}

export const DEFAULT_MASTER_ROADS = [
  {
    masterCode: "ROAD-MASTER-001",
    canonicalName: "Station Road",
    aliases: JSON.stringify([
      "Station Marg",
      "Railway Station Rd",
      "Station Street",
      "Station Road Bypass",
      "Alwar Railway Station Road",
    ]),
    sourceIds: JSON.stringify({
      MUN_PORTAL: "MUN-R102",
      PWD_SYSTEM: "PWD-R778",
      STATE_GRIEVANCE: "STATE-R45",
      SANITATION_DEPT: "SAN-W4-STATION",
      WATER_DEPT: "WTR-PIPE-STN",
    }),
    city: "Alwar",
    ward: "Ward 4",
    district: "Alwar",
    state: "Rajasthan",
    owningDepartment: "PWD",
    confidence: 1.0,
  },
  {
    masterCode: "ROAD-MASTER-002",
    canonicalName: "Government College Road",
    aliases: JSON.stringify([
      "Govt College Marg",
      "College Circle Rd",
      "Arts College Lane",
    ]),
    sourceIds: JSON.stringify({
      MUN_PORTAL: "MUN-R204",
      PWD_SYSTEM: "PWD-R112",
    }),
    city: "Alwar",
    ward: "Ward 2",
    district: "Alwar",
    state: "Rajasthan",
    owningDepartment: "PWD",
    confidence: 1.0,
  },
  {
    masterCode: "ROAD-MASTER-003",
    canonicalName: "Hope Circus Circle",
    aliases: JSON.stringify([
      "Hope Circus Square",
      "Circus Chowk",
      "Central Market Road",
    ]),
    sourceIds: JSON.stringify({
      MUN_PORTAL: "MUN-R309",
      SANITATION_DEPT: "SAN-W1-CIRCUS",
    }),
    city: "Alwar",
    ward: "Ward 1",
    district: "Alwar",
    state: "Rajasthan",
    owningDepartment: "Municipal",
    confidence: 1.0,
  },
];

export const DEFAULT_MASTER_INFRASTRUCTURE = [
  {
    infraCode: "INFRA-ALW-PWD-019",
    name: "Station Road Storm Water Culvert & Drainage Grid",
    type: "DRAINAGE",
    roadCode: "ROAD-MASTER-001",
    owningDepartment: "PWD",
    maintenanceCrew: "PWD Drainage Team Alpha",
    latitude: 27.5548,
    longitude: 76.6165,
    confidence: 0.98,
  },
  {
    infraCode: "INFRA-ALW-PWD-022",
    name: "Government College Junction Asphalt Carriageway",
    type: "ROAD",
    roadCode: "ROAD-MASTER-002",
    owningDepartment: "PWD",
    maintenanceCrew: "PWD Road Maintenance Crew A-2",
    latitude: 27.5494,
    longitude: 76.6335,
    confidence: 0.99,
  },
];

export const DEFAULT_MASTER_CITIZENS = [
  {
    citizenCode: "MCIT-ALW-0042",
    canonicalName: "Aarav Sharma",
    phoneMasked: "+91 98*** **421",
    emailMasked: "aarav.sharma@demo.in",
    sourceIds: JSON.stringify({
      MUN_PORTAL: "CIT-MUN-991",
      STATE_GRIEVANCE: "PET-STATE-228",
      PWD_SYSTEM: "REP-PWD-771",
    }),
    city: "Alwar",
    isVerified: true,
    confidence: 0.98,
  },
  {
    citizenCode: "MCIT-ALW-0089",
    canonicalName: "Priya Verma",
    phoneMasked: "+91 94*** **812",
    emailMasked: "priya.verma@demo.in",
    sourceIds: JSON.stringify({
      MUN_PORTAL: "CIT-MUN-402",
      STATE_GRIEVANCE: "PET-STATE-661",
    }),
    city: "Alwar",
    isVerified: true,
    confidence: 0.96,
  },
];

/** Pre-seed Master Data entities */
export async function ensureMasterData(): Promise<void> {
  for (const road of DEFAULT_MASTER_ROADS) {
    await db.masterRoad.upsert({
      where: { masterCode: road.masterCode },
      update: {},
      create: road,
    });
  }

  for (const infra of DEFAULT_MASTER_INFRASTRUCTURE) {
    await db.masterInfrastructure.upsert({
      where: { infraCode: infra.infraCode },
      update: {},
      create: infra,
    });
  }

  for (const citizen of DEFAULT_MASTER_CITIZENS) {
    await db.masterCitizen.upsert({
      where: { citizenCode: citizen.citizenCode },
      update: {},
      create: citizen,
    });
  }

  log.info("master_data_ensured");
}

/** Resolve Road / Location entity from incoming address and coordinates */
export async function resolveMasterRoad(opts: {
  address?: string;
  sourceSystemCode?: string;
  sourceRoadId?: string;
  latitude?: number;
  longitude?: number;
}): Promise<MasterMatchResult | null> {
  await ensureMasterData();
  const roads = await db.masterRoad.findMany();

  let bestMatch: any = null;
  let bestConfidence = 0;
  let matchSignals: string[] = [];

  const searchTarget = (opts.address || "").toLowerCase();

  for (const road of roads) {
    let confidence = 0;
    const signals: string[] = [];

    // 1. Direct Source ID match
    let sourceIdMap: Record<string, string> = {};
    try { sourceIdMap = JSON.parse(road.sourceIds); } catch {}
    if (opts.sourceSystemCode && opts.sourceRoadId && sourceIdMap[opts.sourceSystemCode] === opts.sourceRoadId) {
      confidence = 1.0;
      signals.push(`Exact system ID match: ${opts.sourceSystemCode} [${opts.sourceRoadId}]`);
    }

    // 2. Canonical Name match
    if (searchTarget.includes(road.canonicalName.toLowerCase())) {
      confidence = Math.max(confidence, 0.95);
      signals.push(`Canonical road name matched: "${road.canonicalName}"`);
    }

    // 3. Alias matches
    let aliases: string[] = [];
    try { aliases = JSON.parse(road.aliases); } catch {}
    for (const alias of aliases) {
      if (searchTarget.includes(alias.toLowerCase())) {
        confidence = Math.max(confidence, 0.90);
        signals.push(`Matched known alias: "${alias}"`);
        break;
      }
    }

    // 4. Proximity Match (within 200m of Station Road coords 27.5548, 76.6165)
    if (opts.latitude && opts.longitude && road.masterCode === "ROAD-MASTER-001") {
      const dist = haversineDistance(opts.latitude, opts.longitude, 27.5548, 76.6165);
      if (dist < 300) {
        confidence = Math.max(confidence, 0.85);
        signals.push(`Spatial proximity: ${Math.round(dist)}m from center of ${road.canonicalName}`);
      }
    }

    if (confidence > bestConfidence) {
      bestConfidence = confidence;
      bestMatch = road;
      matchSignals = signals;
    }
  }

  if (!bestMatch || bestConfidence < 0.4) {
    return {
      entityType: "ROAD",
      masterCode: "ROAD-UNRESOLVED",
      canonicalName: opts.address || "Unresolved Location",
      confidence: 0,
      status: "NO_MATCH",
      signals: ["No matching Master Road entity found"],
    };
  }

  return {
    entityType: "ROAD",
    masterCode: bestMatch.masterCode,
    canonicalName: bestMatch.canonicalName,
    confidence: Math.round(bestConfidence * 100) / 100,
    status: bestConfidence >= 0.8 ? "AUTO_MATCH" : "REVIEW_REQUIRED",
    signals: matchSignals,
  };
}

/** Resolve Citizen entity from incoming source contact / name */
export async function resolveMasterCitizen(opts: {
  citizenName?: string;
  contact?: string;
  sourceSystemCode?: string;
  sourceCitizenId?: string;
}): Promise<MasterMatchResult | null> {
  await ensureMasterData();
  const citizens = await db.masterCitizen.findMany();

  let bestMatch: any = null;
  let bestConfidence = 0;
  let matchSignals: string[] = [];

  const targetName = (opts.citizenName || "").toLowerCase().trim();

  for (const cit of citizens) {
    let confidence = 0;
    const signals: string[] = [];

    if (targetName && targetName === cit.canonicalName.toLowerCase()) {
      confidence = 0.95;
      signals.push(`Full citizen name match: ${cit.canonicalName}`);
    } else if (targetName && cit.canonicalName.toLowerCase().includes(targetName)) {
      confidence = 0.75;
      signals.push(`Partial citizen name match: ${cit.canonicalName}`);
    }

    if (confidence > bestConfidence) {
      bestConfidence = confidence;
      bestMatch = cit;
      matchSignals = signals;
    }
  }

  if (!bestMatch || bestConfidence < 0.5) {
    return null;
  }

  return {
    entityType: "CITIZEN",
    masterCode: bestMatch.citizenCode,
    canonicalName: bestMatch.canonicalName,
    confidence: bestConfidence,
    status: bestConfidence >= 0.8 ? "AUTO_MATCH" : "REVIEW_REQUIRED",
    signals: matchSignals,
  };
}

/** Get all master data overview */
export async function getMasterDataSummary() {
  await ensureMasterData();
  const [roads, infrastructure, citizens] = await Promise.all([
    db.masterRoad.findMany({ orderBy: { masterCode: "asc" } }),
    db.masterInfrastructure.findMany({ orderBy: { infraCode: "asc" } }),
    db.masterCitizen.findMany({ orderBy: { citizenCode: "asc" } }),
  ]);

  return {
    totalEntities: roads.length + infrastructure.length + citizens.length,
    roads: roads.map((r) => ({
      ...r,
      aliases: safeJsonParse(r.aliases, []),
      sourceIds: safeJsonParse(r.sourceIds, {}),
    })),
    infrastructure,
    citizens: citizens.map((c) => ({
      ...c,
      sourceIds: safeJsonParse(c.sourceIds, {}),
    })),
  };
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function safeJsonParse(val: string, fallback: any) {
  try { return JSON.parse(val); } catch { return fallback; }
}
