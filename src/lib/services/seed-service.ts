// CivicLens — Demo seed service.
// Seeds configurable categories, departments, demo users, and a realistic India-wide
// set of DEMO incidents (clearly labelled isDemo=true — never presented as real government data).
// Idempotent: skips when demo incidents already exist, unless { reset: true }.

import { db } from "@/lib/db";
import { DEFAULT_CATEGORIES, DEFAULT_DEPARTMENTS } from "@/lib/civiclens/constants";
import { assessPriority, severityBand } from "./priority-service";
import { getPrecomputedByCategory } from "./ai-service";
import { log } from "./logger";
import type { IncidentStatus } from "@/lib/civiclens/types";

const SAMPLE_BY_CATEGORY: Record<string, string> = {
  pothole: "/samples/pothole.png",
  garbage: "/samples/garbage.png",
  water_leakage: "/samples/water-leak.png",
  broken_streetlight: "/samples/streetlight.png",
  open_manhole: "/samples/manhole.png",
  sewage_drainage: "/samples/sewage.png",
  illegal_dumping: "/samples/dumping.png",
  road_obstruction: "/samples/obstruction.png",
  damaged_infrastructure: "/samples/infrastructure.png",
};

const STATUS_CHAIN: Record<IncidentStatus, IncidentStatus[]> = {
  REPORTED: ["REPORTED"],
  VERIFIED: ["REPORTED", "VERIFIED"],
  ASSIGNED: ["REPORTED", "VERIFIED", "ASSIGNED"],
  IN_PROGRESS: ["REPORTED", "VERIFIED", "ASSIGNED", "IN_PROGRESS"],
  RESOLVED: ["REPORTED", "VERIFIED", "ASSIGNED", "IN_PROGRESS", "RESOLVED"],
  REJECTED: ["REPORTED", "REJECTED"],
};

interface ReportSpec {
  user: string; // demo user name
  description: string;
  hoursAgo: number;
}

interface IncidentSpec {
  categoryKey: string;
  near: string; // road / landmark for the title
  lat: number;
  lng: number;
  city: string;
  district: string;
  state: string;
  severityScore: number;
  status: IncidentStatus;
  reports: ReportSpec[];
  team?: string;
  resolutionNote?: string;
  afterPhoto?: string;
}

const INCIDENTS: IncidentSpec[] = [
  // ---- Alwar (primary demo city) ----
  {
    categoryKey: "pothole", near: "Government College Road", lat: 27.5494, lng: 76.6335,
    city: "Alwar", district: "Alwar", state: "Rajasthan", severityScore: 8, status: "IN_PROGRESS",
    reports: [
      { user: "Aarav Sharma", description: "Deep water-filled pothole right in the middle of the lane. Two-wheelers swerve dangerously to avoid it.", hoursAgo: 96 },
      { user: "Priya Verma", description: "Almost fell here yesterday evening. It has grown bigger after the rain.", hoursAgo: 78 },
      { user: "Imran Sheikh", description: "This crater has been here for 3 weeks. Auto drivers refuse this route.", hoursAgo: 52 },
      { user: "Rahul Mehta", description: "Damaged my car suspension here. Please fix urgently.", hoursAgo: 30 },
    ],
    team: "Road Repair Crew A-2",
  },
  {
    categoryKey: "open_manhole", near: "Hope Circus", lat: 27.5555, lng: 76.6306,
    city: "Alwar", district: "Alwar", state: "Rajasthan", severityScore: 10, status: "VERIFIED",
    reports: [
      { user: "Aarav Sharma", description: "Manhole cover missing since last week. Locals placed stones around it but at night it is invisible.", hoursAgo: 40 },
      { user: "Vikram Singh", description: "Extremely dangerous for children walking to school. Needs immediate barricading.", hoursAgo: 26 },
    ],
  },
  {
    categoryKey: "garbage", near: "Alwar Railway Station Road", lat: 27.5548, lng: 76.6165,
    city: "Alwar", district: "Alwar", state: "Rajasthan", severityScore: 6, status: "ASSIGNED",
    reports: [
      { user: "Priya Verma", description: "No bin on this entire stretch. Garbage piles up every 2 days.", hoursAgo: 120 },
      { user: "Aarav Sharma", description: "Stray dogs scatter the waste every night. The whole street smells.", hoursAgo: 70 },
      { user: "Imran Sheikh", description: "Waste not collected for a week now.", hoursAgo: 20 },
    ],
    team: "Sanitation Ward Team 4",
  },
  {
    categoryKey: "broken_streetlight", near: "Shivaji Park", lat: 27.5598, lng: 76.6255,
    city: "Alwar", district: "Alwar", state: "Rajasthan", severityScore: 5, status: "REPORTED",
    reports: [
      { user: "Aarav Sharma", description: "Streetlight pole bent with lamp hanging by wires. Entire park edge is dark after 7pm.", hoursAgo: 14 },
    ],
  },
  {
    categoryKey: "pothole", near: "Delhi Road bypass", lat: 27.5622, lng: 76.605,
    city: "Alwar", district: "Alwar", state: "Rajasthan", severityScore: 6, status: "RESOLVED",
    reports: [
      { user: "Imran Sheikh", description: "Pothole forming near the service lane merge.", hoursAgo: 340 },
      { user: "Rahul Mehta", description: "Getting wider every day.", hoursAgo: 320 },
    ],
    team: "Road Repair Crew A-1",
    resolutionNote: "Carriageway patched with hot-mix asphalt; site inspected and cleared.",
    afterPhoto: "/samples/after-pothole.png",
  },
  // ---- Jaipur ----
  {
    categoryKey: "water_leakage", near: "Vaishali Nagar Sector 5", lat: 26.9158, lng: 75.7405,
    city: "Jaipur", district: "Jaipur", state: "Rajasthan", severityScore: 6, status: "REPORTED",
    reports: [
      { user: "Priya Verma", description: "Pipeline leaking continuously since Monday. Huge water waste.", hoursAgo: 18 },
    ],
  },
  {
    categoryKey: "sewage_drainage", near: "Malviya Nagar main road", lat: 26.8569, lng: 75.8127,
    city: "Jaipur", district: "Jaipur", state: "Rajasthan", severityScore: 7, status: "ASSIGNED",
    reports: [
      { user: "Vikram Singh", description: "Nali is completely blocked, dirty water on the road for 4 days.", hoursAgo: 90 },
      { user: "Priya Verma", description: "Overflow reaching the market entrance now.", hoursAgo: 44 },
    ],
    team: "Drainage Cell Jaipur South",
  },
  {
    categoryKey: "illegal_dumping", near: "Sikar Road bypass plot", lat: 26.941, lng: 75.776,
    city: "Jaipur", district: "Jaipur", state: "Rajasthan", severityScore: 6, status: "REPORTED",
    reports: [
      { user: "Rahul Mehta", description: "Trucks dumping construction malba here every night.", hoursAgo: 60 },
    ],
  },
  {
    categoryKey: "garbage", near: "Hawa Mahal east lane", lat: 26.9239, lng: 75.8267,
    city: "Jaipur", district: "Jaipur", state: "Rajasthan", severityScore: 6, status: "RESOLVED",
    reports: [
      { user: "Priya Verma", description: "Tourist area — garbage bins overflowing near the lane.", hoursAgo: 240 },
    ],
    team: "Sanitation Heritage Ward",
    resolutionNote: "Waste cleared, additional bins installed, area washed and disinfected.",
    afterPhoto: "/samples/after-garbage.png",
  },
  // ---- Delhi ----
  {
    categoryKey: "pothole", near: "RK Puram Sector 8", lat: 28.5646, lng: 77.1871,
    city: "Delhi", district: "New Delhi", state: "Delhi", severityScore: 8, status: "IN_PROGRESS",
    reports: [
      { user: "Rahul Mehta", description: "Crater on the main carriageway near the market turn.", hoursAgo: 100 },
      { user: "Sneha Patil", description: "Traffic bottleneck every morning because of this.", hoursAgo: 64 },
      { user: "Ananya Rao", description: "Reported last month too. Temporary patch washed away.", hoursAgo: 36 },
    ],
    team: "PWD Circle Road Division 2",
  },
  {
    categoryKey: "road_obstruction", near: "Lajpat Nagar Central Market", lat: 28.5677, lng: 77.2432,
    city: "Delhi", district: "New Delhi", state: "Delhi", severityScore: 5, status: "VERIFIED",
    reports: [
      { user: "Sneha Patil", description: "Large branch fell in the storm, blocking half the road.", hoursAgo: 22 },
    ],
  },
  {
    categoryKey: "damaged_infrastructure", near: "Karol Bagh bus stop", lat: 28.6512, lng: 77.1907,
    city: "Delhi", district: "New Delhi", state: "Delhi", severityScore: 4, status: "REPORTED",
    reports: [
      { user: "Rahul Mehta", description: "Bus shelter roof panel broken, bench bent. Waiting passengers exposed.", hoursAgo: 46 },
    ],
  },
  {
    categoryKey: "open_manhole", near: "Rohini Sector 9", lat: 28.7495, lng: 77.0565,
    city: "Delhi", district: "New Delhi", state: "Delhi", severityScore: 9, status: "ASSIGNED",
    reports: [
      { user: "Vikram Singh", description: "Open manhole on the walking route to metro. Very dangerous.", hoursAgo: 58 },
      { user: "Rahul Mehta", description: "Saw a cycle nearly fall in yesterday.", hoursAgo: 28 },
    ],
    team: "Public Safety Unit ND-3",
  },
  // ---- Mumbai ----
  {
    categoryKey: "water_leakage", near: "Andheri West SV Road", lat: 19.1364, lng: 72.8296,
    city: "Mumbai", district: "Mumbai Suburban", state: "Maharashtra", severityScore: 6, status: "REPORTED",
    reports: [
      { user: "Imran Sheikh", description: "Water gushing from below the footpath for 3 days.", hoursAgo: 66 },
    ],
  },
  {
    categoryKey: "garbage", near: "Dharavi 90 Feet Road", lat: 19.0416, lng: 72.8558,
    city: "Mumbai", district: "Mumbai", state: "Maharashtra", severityScore: 7, status: "IN_PROGRESS",
    reports: [
      { user: "Imran Sheikh", description: "Massive daily dumping spot. Needs a permanent solution.", hoursAgo: 130 },
      { user: "Sneha Patil", description: "Health hazard for the whole lane.", hoursAgo: 96 },
      { user: "Rahul Mehta", description: "Burning garbage here every morning.", hoursAgo: 72 },
      { user: "Ananya Rao", description: "Worst during monsoon.", hoursAgo: 40 },
      { user: "Vikram Singh", description: "Please add covered bins and daily pickup.", hoursAgo: 12 },
    ],
    team: "Solid Waste M-East Ward",
  },
  {
    categoryKey: "pothole", near: "Sion circle", lat: 19.033, lng: 72.8626,
    city: "Mumbai", district: "Mumbai", state: "Maharashtra", severityScore: 7, status: "VERIFIED",
    reports: [
      { user: "Sneha Patil", description: "Multiple potholes after last week's rain near the circle.", hoursAgo: 50 },
    ],
  },
  // ---- Bengaluru ----
  {
    categoryKey: "pothole", near: "Outer Ring Road Marathahalli", lat: 12.9352, lng: 77.697,
    city: "Bengaluru", district: "Bengaluru Urban", state: "Karnataka", severityScore: 8, status: "IN_PROGRESS",
    reports: [
      { user: "Ananya Rao", description: "Deep pothole on the IT corridor. Traffic crawls here every evening.", hoursAgo: 110 },
      { user: "Rahul Mehta", description: "Cab drivers know to avoid this lane now.", hoursAgo: 80 },
      { user: "Sneha Patil", description: "Two-wheeler accident spot. Needs urgent repair.", hoursAgo: 48 },
      { user: "Imran Sheikh", description: "Pothole plus water logging = invisible at night.", hoursAgo: 20 },
    ],
    team: "BBMP Road Infra Division 4",
  },
  {
    categoryKey: "broken_streetlight", near: "Koramangala 5th Block", lat: 12.9352, lng: 77.6245,
    city: "Bengaluru", district: "Bengaluru Urban", state: "Karnataka", severityScore: 5, status: "REPORTED",
    reports: [
      { user: "Ananya Rao", description: "Three consecutive poles dark for a week.", hoursAgo: 34 },
      { user: "Vikram Singh", description: "Feels unsafe walking back from the gym.", hoursAgo: 10 },
    ],
  },
  {
    categoryKey: "sewage_drainage", near: "Indiranagar 100 Feet Road", lat: 12.9719, lng: 77.6412,
    city: "Bengaluru", district: "Bengaluru Urban", state: "Karnataka", severityScore: 6, status: "ASSIGNED",
    reports: [
      { user: "Ananya Rao", description: "Drage overflow at the corner again.", hoursAgo: 88 },
    ],
    team: "BWSSB Storm-water Cell",
  },
  {
    categoryKey: "water_leakage", near: "Whitefield Main Road", lat: 12.9698, lng: 77.75,
    city: "Bengaluru", district: "Bengaluru Urban", state: "Karnataka", severityScore: 5, status: "RESOLVED",
    reports: [
      { user: "Ananya Rao", description: "Leak at the valve chamber near the bakery.", hoursAgo: 200 },
    ],
    team: "BWSSB Leakage Squad 2",
    resolutionNote: "Valve gland repacked; chamber sealed; no further discharge observed for 48h.",
    afterPhoto: "/samples/after-garbage.png",
  },
  // ---- Lucknow ----
  {
    categoryKey: "garbage", near: "Hazratganj crossing", lat: 26.85, lng: 80.947,
    city: "Lucknow", district: "Lucknow", state: "Uttar Pradesh", severityScore: 5, status: "REPORTED",
    reports: [
      { user: "Vikram Singh", description: "Vendors' waste not cleared after market hours.", hoursAgo: 28 },
      { user: "Priya Verma", description: "Same corner, every single week.", hoursAgo: 8 },
    ],
  },
  {
    categoryKey: "road_obstruction", near: "Gomti Nagar Vikalp Khand", lat: 26.847, lng: 81.0,
    city: "Lucknow", district: "Lucknow", state: "Uttar Pradesh", severityScore: 5, status: "VERIFIED",
    reports: [
      { user: "Vikram Singh", description: "Hoarding collapsed onto the service lane.", hoursAgo: 42 },
    ],
  },
  {
    categoryKey: "damaged_infrastructure", near: "Alambagh bus terminus", lat: 26.7922, lng: 80.889,
    city: "Lucknow", district: "Lucknow", state: "Uttar Pradesh", severityScore: 4, status: "REPORTED",
    reports: [
      { user: "Sneha Patil", description: "Terminus seating broken, sharp edges exposed.", hoursAgo: 74 },
    ],
  },
  {
    categoryKey: "illegal_dumping", near: "Kanpur Road service lane", lat: 26.8207, lng: 80.8872,
    city: "Lucknow", district: "Lucknow", state: "Uttar Pradesh", severityScore: 5, status: "REJECTED",
    reports: [
      { user: "Vikram Singh", description: "Debris dumped near the flyover pillar.", hoursAgo: 160 },
    ],
  },
  // ---- Pune ----
  {
    categoryKey: "pothole", near: "Kothrud Karve Road", lat: 18.5074, lng: 73.8077,
    city: "Pune", district: "Pune", state: "Maharashtra", severityScore: 7, status: "IN_PROGRESS",
    reports: [
      { user: "Sneha Patil", description: "Pothole cluster near the metro pillar works.", hoursAgo: 92 },
      { user: "Ananya Rao", description: "Hit it on my scooty — real danger.", hoursAgo: 60 },
      { user: "Imran Sheikh", description: "Barriers hide it during the day.", hoursAgo: 34 },
    ],
    team: "PMC Road Dept Ward 12",
  },
  {
    categoryKey: "open_manhole", near: "Hadapsar Bypass", lat: 18.5158, lng: 73.926,
    city: "Pune", district: "Pune", state: "Maharashtra", severityScore: 9, status: "VERIFIED",
    reports: [
      { user: "Sneha Patil", description: "Uncovered manhole on the bypass service road at night.", hoursAgo: 30 },
      { user: "Rahul Mehta", description: "Confirmed — no barricade tape even.", hoursAgo: 16 },
      { user: "Vikram Singh", description: "This is an accident waiting to happen.", hoursAgo: 6 },
    ],
  },
  {
    categoryKey: "illegal_dumping", near: "Viman Nagar back lane", lat: 18.5679, lng: 73.9143,
    city: "Pune", district: "Pune", state: "Maharashtra", severityScore: 5, status: "REPORTED",
    reports: [
      { user: "Sneha Patil", description: "Society renovation malba dumped in the lane.", hoursAgo: 55 },
    ],
  },
];

const DEMO_USERS = [
  { name: "Neha Kulkarni", role: "ADMIN", city: null },
  { name: "Aarav Sharma", role: "CITIZEN", city: "Alwar" },
  { name: "Priya Verma", role: "CITIZEN", city: "Jaipur" },
  { name: "Rahul Mehta", role: "CITIZEN", city: "Delhi" },
  { name: "Sneha Patil", role: "CITIZEN", city: "Pune" },
  { name: "Vikram Singh", role: "CITIZEN", city: "Lucknow" },
  { name: "Ananya Rao", role: "CITIZEN", city: "Bengaluru" },
  { name: "Imran Sheikh", role: "CITIZEN", city: "Mumbai" },
] as const;

async function ensureBaseData() {
  for (const d of DEFAULT_DEPARTMENTS) {
    await db.department.upsert({
      where: { key: d.key },
      create: { key: d.key, name: d.name, description: d.description },
      update: { name: d.name, description: d.description },
    });
  }
  for (const [i, c] of DEFAULT_CATEGORIES.entries()) {
    void i;
    await db.category.upsert({
      where: { key: c.key },
      create: { key: c.key, label: c.label, departmentKey: c.departmentKey, defaultSeverity: c.defaultSeverity, hazardWeight: c.hazardWeight, sortOrder: i },
      update: { label: c.label, departmentKey: c.departmentKey, defaultSeverity: c.defaultSeverity, hazardWeight: c.hazardWeight, sortOrder: i },
    });
  }
}

async function ensureDemoUsers() {
  const map = new Map<string, string>();
  let counter = await db.user.count();
  for (const u of DEMO_USERS) {
    let user = await db.user.findFirst({ where: { name: u.name, role: u.role } });
    if (!user) {
      counter += 1;
      user = await db.user.create({
        data: {
          publicId: `USR-${String(counter).padStart(3, "0")}`,
          name: u.name,
          role: u.role,
          city: u.city,
          isDemo: true,
        },
      });
    }
    map.set(u.name, user.id);
  }
  return map;
}

export async function deleteDemoData() {
  const demoIncidents = await db.incident.findMany({ where: { isDemo: true }, select: { id: true } });
  const ids = demoIncidents.map((i) => i.id);
  if (ids.length > 0) {
    await db.notification.deleteMany({ where: { incidentId: { in: ids } } });
    await db.resolutionEvidence.deleteMany({ where: { incidentId: { in: ids } } });
    await db.assignment.deleteMany({ where: { incidentId: { in: ids } } });
    await db.statusHistory.deleteMany({ where: { incidentId: { in: ids } } });
    await db.incidentReport.deleteMany({ where: { incidentId: { in: ids } } });
    // only demo-labelled reports are removed; real citizen reports are unlinked and preserved
    await db.aiAnalysis.deleteMany({ where: { report: { incidentId: { in: ids }, isDemo: true } } });
    await db.report.deleteMany({ where: { incidentId: { in: ids }, isDemo: true } });
    await db.report.updateMany({ where: { incidentId: { in: ids } }, data: { incidentId: null } });
    await db.incident.deleteMany({ where: { id: { in: ids } } });
  }
}

export async function deleteAllData() {
  // Full wipe (keeps categories & departments — they are re-upserted)
  await db.notification.deleteMany({});
  await db.resolutionEvidence.deleteMany({});
  await db.assignment.deleteMany({});
  await db.statusHistory.deleteMany({});
  await db.incidentReport.deleteMany({});
  await db.aiAnalysis.deleteMany({});
  await db.report.deleteMany({});
  await db.incident.deleteMany({});
  await db.user.deleteMany({});
}

export async function seedDemoData(opts?: { reset?: boolean; hardReset?: boolean }) {
  await ensureBaseData();

  if (opts?.hardReset) {
    await deleteAllData();
  } else {
    const existing = await db.incident.count({ where: { isDemo: true } });
    if (existing > 0 && !opts?.reset) {
      return { seeded: false, reason: "demo data already present", incidents: existing };
    }
    if (opts?.reset) await deleteDemoData();
  }

  const users = await ensureDemoUsers();
  const admin = users.get("Neha Kulkarni")!;
  const categories = await db.category.findMany();
  const catMap = new Map(categories.map((c) => [c.key, c]));

  let incSeq = 1000;
  let repSeq = 0;
  const now = Date.now();
  const hour = 3600e3;

  for (const spec of INCIDENTS) {
    const category = catMap.get(spec.categoryKey);
    if (!category) continue;
    const precomputed = getPrecomputedByCategory(spec.categoryKey);
    incSeq += 1;
    const publicId = `INC-${incSeq}`;
    const createdAt = new Date(now - spec.reports[0].hoursAgo * hour);

    const priority = assessPriority({
      severityScore: spec.severityScore,
      reportCount: spec.reports.length,
      hazards: precomputed?.hazards ?? [],
      categoryHazardWeight: category.hazardWeight,
      categoryLabel: category.label,
    });

    const chain = STATUS_CHAIN[spec.status];
    const resolvedAt =
      spec.status === "RESOLVED" ? new Date(now - 6 * hour) : null;

    const incident = await db.incident.create({
      data: {
        publicId,
        categoryKey: spec.categoryKey,
        title: `${category.label.split(" / ")[0]} near ${spec.near}`,
        severity: severityBand(spec.severityScore),
        severityScore: spec.severityScore,
        priority: priority.priority,
        priorityScore: priority.score,
        priorityReasons: JSON.stringify(priority.reasons),
        aiConfidence: precomputed?.confidence ?? null,
        aiReasoning: precomputed?.reasoning ?? null,
        departmentKey: category.departmentKey,
        latitude: spec.lat,
        longitude: spec.lng,
        address: `${spec.near}, ${spec.city}`,
        city: spec.city,
        district: spec.district,
        state: spec.state,
        status: spec.status,
        reportCount: spec.reports.length,
        isDemo: true,
        resolutionNote: spec.resolutionNote ?? null,
        resolvedAt,
        createdAt,
        updatedAt: resolvedAt ?? new Date(now - 2 * hour),
      },
    });

    // reports + link log + one AI analysis per report (precomputed demo results)
    for (const [idx, r] of spec.reports.entries()) {
      repSeq += 1;
      const repPublicId = `REP-${String(repSeq).padStart(4, "0")}`;
      const repTime = new Date(now - r.hoursAgo * hour);
      const report = await db.report.create({
        data: {
          publicId: repPublicId,
          userId: users.get(r.user)!,
          imagePath: SAMPLE_BY_CATEGORY[spec.categoryKey] ?? null,
          description: r.description,
          latitude: spec.lat + (Math.random() - 0.5) * 0.0006,
          longitude: spec.lng + (Math.random() - 0.5) * 0.0006,
          captureTimestamp: repTime,
          submissionTimestamp: repTime,
          processingState: "COMPLETED",
          isDemo: true,
          incidentId: incident.id,
          createdAt: repTime,
        },
      });
      await db.incidentReport.create({
        data: {
          incidentId: incident.id,
          reportId: report.id,
          linkType: idx === 0 ? "CREATED" : "LINKED",
          createdAt: repTime,
        },
      });
      if (precomputed && idx === 0) {
        await db.aiAnalysis.create({
          data: {
            reportId: report.id,
            model: precomputed.model,
            source: "DEMO_PRECOMPUTED",
            isCivicIssue: precomputed.isCivicIssue,
            categoryKey: precomputed.categoryKey,
            confidence: precomputed.confidence,
            severity: precomputed.severity,
            severityScore: precomputed.severityScore,
            hazards: JSON.stringify(precomputed.hazards),
            departmentKey: precomputed.departmentKey,
            description: precomputed.description,
            reasoning: precomputed.reasoning,
            recommendedAction: precomputed.recommendedAction,
            rawResult: JSON.stringify(precomputed),
            processingMs: 1,
            createdAt: repTime,
          },
        });
      }
    }

    // status history chain
    for (const [idx, status] of chain.entries()) {
      await db.statusHistory.create({
        data: {
          incidentId: incident.id,
          fromStatus: idx === 0 ? null : chain[idx - 1],
          toStatus: status,
          actorId: idx === 0 ? users.get(spec.reports[0].user)! : admin,
          actorRole: idx === 0 ? "CITIZEN" : "ADMIN",
          note:
            idx === 0
              ? `Report ${`REP-${String(repSeq - spec.reports.length + 1).padStart(4, "0")}`} submitted with AI analysis (DEMO_PRECOMPUTED)`
              : status === "ASSIGNED"
                ? `Assigned to ${category.departmentKey}${spec.team ? ` — ${spec.team}` : ""}`
                : status === "RESOLVED"
                  ? spec.resolutionNote ?? "Resolution verified with evidence."
                  : status === "REJECTED"
                    ? "Duplicate of another verified report in the same area."
                    : null,
          createdAt: new Date(createdAt.getTime() + Math.min(idx * 5 + 2, spec.reports[0].hoursAgo - 1) * hour),
        },
      });
    }

    // assignment record
    if (chain.includes("ASSIGNED")) {
      await db.assignment.create({
        data: {
          incidentId: incident.id,
          departmentKey: category.departmentKey,
          team: spec.team ?? null,
          assignedToName: spec.team ?? null,
          assignedById: admin,
          active: spec.status !== "RESOLVED",
          createdAt: new Date(createdAt.getTime() + 7 * hour),
        },
      });
    }

    // resolution evidence (before/after demo)
    if (spec.status === "RESOLVED" && spec.afterPhoto) {
      await db.resolutionEvidence.create({
        data: {
          incidentId: incident.id,
          imagePath: spec.afterPhoto,
          note: spec.resolutionNote ?? "After photo uploaded by field team.",
          uploadedById: admin,
          createdAt: resolvedAt!,
        },
      });
    }

    // a couple of notifications for the primary reporter
    const primaryUser = users.get(spec.reports[0].user)!;
    if (["VERIFIED", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "REJECTED"].includes(spec.status)) {
      await db.notification.create({
        data: {
          userId: primaryUser,
          incidentId: incident.id,
          type: spec.status === "RESOLVED" ? "RESOLVED" : "STATUS_CHANGE",
          title: `${publicId} — ${spec.status === "RESOLVED" ? "resolved" : spec.status === "REJECTED" ? "rejected" : "status update"}`,
          body:
            spec.status === "RESOLVED"
              ? `The ${category.label.toLowerCase()} you reported near ${spec.near} has been resolved. Thank you for improving your city.`
              : `Your report near ${spec.near} is now ${spec.status.replace("_", " ").toLowerCase()}.`,
          isRead: spec.status === "RESOLVED",
          createdAt: resolvedAt ?? new Date(now - 3 * hour),
        },
      });
    }
  }

  log.info("incident_created", { demo: true, count: INCIDENTS.length });
  return { seeded: true, incidents: INCIDENTS.length, reports: repSeq };
}
