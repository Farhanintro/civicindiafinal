// GET /api/incidents — filterable, paginated, searchable incident list (public).
// Used by the map (bounds + lightweight), lists and admin views.

import { db } from "@/lib/db";
import { toIncidentSummary } from "@/lib/services/incident-service";
import type { Prisma } from "@prisma/client";
import { log } from "@/lib/services/logger";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const statusCsv = url.searchParams.get("status") ?? "";
    const categoryCsv = url.searchParams.get("category") ?? "";
    const priorityCsv = url.searchParams.get("priority") ?? "";
    const department = url.searchParams.get("department") ?? "";
    const city = url.searchParams.get("city") ?? "";
    const state = url.searchParams.get("state") ?? "";
    const forMap = url.searchParams.get("forMap") === "1";
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const limit = Math.min(forMap ? 500 : 100, Math.max(1, Number(url.searchParams.get("limit") ?? (forMap ? 300 : 20))));
    const sort = url.searchParams.get("sort") === "priority" ? "priority" : "recent";

    const where: Prisma.IncidentWhereInput = {};
    if (statusCsv) where.status = { in: statusCsv.split(",").filter(Boolean) };
    if (categoryCsv) where.categoryKey = { in: categoryCsv.split(",").filter(Boolean) };
    if (priorityCsv) where.priority = { in: priorityCsv.split(",").filter(Boolean) };
    if (department) where.departmentKey = department;
    if (city) where.city = city;
    if (state) where.state = state;
    if (q) {
      where.OR = [
        { publicId: { contains: q } },
        { title: { contains: q } },
        { address: { contains: q } },
        { city: { contains: q } },
        { state: { contains: q } },
      ];
    }

    const orderBy: Prisma.IncidentOrderByWithRelationInput[] =
      sort === "priority"
        ? [{ priorityScore: "desc" }, { updatedAt: "desc" }]
        : [{ updatedAt: "desc" }];

    const [total, incidents] = await Promise.all([
      db.incident.count({ where }),
      db.incident.findMany({
        where,
        orderBy,
        include: { category: true, department: true },
        skip: forMap ? 0 : (page - 1) * limit,
        take: limit,
      }),
    ]);

    return Response.json({
      incidents: incidents.map(toIncidentSummary),
      total,
      page,
      limit,
      hasMore: forMap ? false : page * limit < total,
    });
  } catch (err) {
    log.error("api_error", { route: "incidents", error: String(err).slice(0, 200) });
    return Response.json({ error: "Could not load incidents." }, { status: 500 });
  }
}
