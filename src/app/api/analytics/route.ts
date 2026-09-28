// GET /api/analytics — lightweight aggregations computed from real database data.
// (Demo-seeded incidents are included and labelled DEMO in the UI.)

import { db } from "@/lib/db";
import type { AnalyticsDTO } from "@/lib/civiclens/types";
import { log } from "@/lib/services/logger";

export async function GET() {
  try {
    const [reports, incidents, linkedLinks] = await Promise.all([
      db.report.count(),
      db.incident.findMany({
        include: { category: true },
      }),
      db.incidentReport.count({ where: { linkType: "LINKED" } }),
    ]);

    const openStatuses = new Set(["REPORTED", "VERIFIED", "ASSIGNED", "IN_PROGRESS"]);
    const activeIncidents = incidents.filter((i) => openStatuses.has(i.status));
    const resolvedIncidents = incidents.filter((i) => i.status === "RESOLVED");
    const highPriority = incidents.filter((i) => i.priority === "P1" || i.priority === "P2");

    const avgResolutionMs = resolvedIncidents
      .filter((i) => i.resolvedAt)
      .map((i) => (i.resolvedAt!.getTime() - i.createdAt.getTime()))
      .reduce((a, b) => a + b, 0);
    const avgResolutionHours = resolvedIncidents.length
      ? Math.round((avgResolutionMs / resolvedIncidents.length / 36e5) * 10) / 10
      : null;

    // group helpers
    const countBy = <T extends string>(items: T[]): { key: string; count: number }[] => {
      const map = new Map<string, number>();
      for (const it of items) map.set(it, (map.get(it) ?? 0) + 1);
      return [...map.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
    };

    const categoryMeta = new Map(incidents.map((i) => [i.categoryKey, i.category?.label ?? i.categoryKey]));

    const byCategory = countBy(incidents.map((i) => i.categoryKey)).map(({ key, count }) => ({
      key,
      label: categoryMeta.get(key) ?? key,
      count,
      open: activeIncidents.filter((i) => i.categoryKey === key).length,
    }));

    const byCity = countBy(incidents.map((i) => i.city ?? "Unknown"))
      .slice(0, 10)
      .map(({ key, count }) => ({
        city: key,
        count,
        open: activeIncidents.filter((i) => (i.city ?? "Unknown") === key).length,
      }));

    const byState = countBy(incidents.map((i) => i.state ?? "Unknown")).map(({ key, count }) => ({
      state: key,
      count,
    }));

    const byPriority = countBy(incidents.map((i) => i.priority)).map(({ key, count }) => ({
      priority: key as AnalyticsDTO["byPriority"][number]["priority"],
      count,
    }));

    const byStatus = countBy(incidents.map((i) => i.status)).map(({ key, count }) => ({
      status: key as AnalyticsDTO["byStatus"][number]["status"],
      count,
    }));

    // department workload
    const departments = await db.department.findMany();
    const departmentWorkload = departments
      .map((d) => ({
        departmentKey: d.key,
        name: d.name,
        open: activeIncidents.filter((i) => i.departmentKey === d.key).length,
        resolved: incidents.filter((i) => i.departmentKey === d.key && i.status === "RESOLVED").length,
      }))
      .sort((a, b) => b.open - a.open || b.resolved - a.resolved);

    // resolution trend (last 6 ISO weeks)
    const now = new Date();
    const weeks: { week: string; resolved: number }[] = [];
    for (let w = 5; w >= 0; w--) {
      const end = new Date(now.getTime() - w * 7 * 864e5);
      const start = new Date(end.getTime() - 7 * 864e5);
      const label = `W${String(Math.ceil((end.getTime() - new Date(end.getFullYear(), 0, 1).getTime()) / 6048e5)).padStart(2, "0")}`;
      const resolved = resolvedIncidents.filter(
        (i) => i.resolvedAt && i.resolvedAt > start && i.resolvedAt <= end
      ).length;
      weeks.push({ week: label, resolved });
    }

    const dto: AnalyticsDTO = {
      totals: {
        reports,
        incidents: incidents.length,
        activeIncidents: activeIncidents.length,
        resolvedIncidents: resolvedIncidents.length,
        highPriority: highPriority.length,
        linkedReports: linkedLinks,
        avgResolutionHours,
      },
      byCategory,
      byCity,
      byState,
      byPriority,
      byStatus,
      departmentWorkload,
      resolutionTrend: weeks,
    };
    return Response.json(dto);
  } catch (err) {
    log.error("api_error", { route: "analytics", error: String(err).slice(0, 200) });
    return Response.json({ error: "Could not load analytics." }, { status: 500 });
  }
}
