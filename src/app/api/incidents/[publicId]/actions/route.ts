// POST /api/incidents/[publicId]/actions — admin workflow:
// verify | reject | assign | start | resolve | reopen  (validated transitions + history + notifications)
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { transitionStatus, StatusTransitionError } from "@/lib/services/incident-service";
import { log } from "@/lib/services/logger";

const BodySchema = z.object({
  action: z.enum(["verify", "reject", "assign", "start", "resolve", "reopen"]),
  note: z.string().max(600).optional(),
  departmentKey: z.string().optional(),
  team: z.string().max(80).optional(),
  assignedToName: z.string().max(80).optional(),
  resolutionNote: z.string().max(600).optional(),
});

const ACTION_TO_STATUS: Record<string, "VERIFIED" | "REJECTED" | "ASSIGNED" | "IN_PROGRESS" | "RESOLVED"> = {
  verify: "VERIFIED",
  reject: "REJECTED",
  assign: "ASSIGNED",
  start: "IN_PROGRESS",
  resolve: "RESOLVED",
  reopen: "IN_PROGRESS",
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ publicId: string }> }
) {
  const guard = await requireRole("ADMIN");
  if ("error" in guard) return guard.error;
  const admin = guard.user;

  try {
    const { publicId } = await params;
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json({ error: "Invalid request.", details: String(parsed.error) }, { status: 400 });
    }
    const body = parsed.data;

    const incident = await db.incident.findUnique({ where: { publicId } });
    if (!incident) {
      return Response.json({ error: "Incident not found." }, { status: 404 });
    }

    if (body.action === "assign" && !body.departmentKey) {
      return Response.json({ error: "A department is required to assign an incident." }, { status: 400 });
    }
    if (body.action === "assign" && body.departmentKey) {
      const dept = await db.department.findUnique({ where: { key: body.departmentKey } });
      if (!dept) return Response.json({ error: "Unknown department." }, { status: 400 });
    }
    if (body.action === "resolve") {
      const evidenceCount = await db.resolutionEvidence.count({ where: { incidentId: incident.id } });
      if (evidenceCount === 0) {
        return Response.json(
          { error: "Please upload resolution evidence (an after photo) before resolving." },
          { status: 400 }
        );
      }
    }

    const summary = await transitionStatus({
      incidentId: incident.id,
      toStatus: ACTION_TO_STATUS[body.action],
      actorId: admin.id,
      actorName: admin.name,
      actorRole: "ADMIN",
      note: body.note ?? body.resolutionNote ?? null,
      extra: {
        departmentKey: body.departmentKey,
        team: body.team,
        assignedToName: body.assignedToName,
        resolutionNote: body.resolutionNote,
      },
    });

    return Response.json({ incident: summary });
  } catch (err) {
    if (err instanceof StatusTransitionError) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    log.error("api_error", { route: "incidents/actions", error: String(err).slice(0, 200) });
    return Response.json({ error: "Action failed. Please try again." }, { status: 500 });
  }
}
