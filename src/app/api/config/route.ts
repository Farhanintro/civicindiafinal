// GET /api/config — public app configuration (categories, departments, sample photos)
import { db } from "@/lib/db";
import {
  DEFAULT_CATEGORIES,
  DEFAULT_DEPARTMENTS,
  DUPLICATE_RADIUS_METERS,
  SAMPLE_PHOTOS,
} from "@/lib/civiclens/constants";

export async function GET() {
  let categories = DEFAULT_CATEGORIES;
  let departments = DEFAULT_DEPARTMENTS;
  try {
    const [cats, deps] = await Promise.all([
      db.category.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
      db.department.findMany({ orderBy: { key: "asc" } }),
    ]);
    if (cats.length > 0) {
      categories = cats.map((c) => ({
        key: c.key,
        label: c.label,
        departmentKey: c.departmentKey,
        defaultSeverity: c.defaultSeverity,
        hazardWeight: c.hazardWeight,
      }));
    }
    if (deps.length > 0) {
      departments = deps.map((d) => ({ key: d.key, name: d.name, description: d.description }));
    }
  } catch {
    // fall back to bundled defaults (DB not seeded yet)
  }

  return Response.json({
    categories,
    departments,
    samples: SAMPLE_PHOTOS,
    duplicateRadiusMeters: DUPLICATE_RADIUS_METERS,
  });
}
