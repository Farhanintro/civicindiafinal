// GET  /api/notifications — latest notifications for the signed-in user
// PATCH /api/notifications — mark all as read
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ notifications: [], unreadCount: 0 });

  const [notifications, unreadCount] = await Promise.all([
    db.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { incident: { select: { publicId: true } } },
    }),
    db.notification.count({ where: { userId: user.id, isRead: false } }),
  ]);

  return Response.json({
    notifications: notifications.map((n) => ({
      id: n.id,
      incidentPublicId: n.incident?.publicId ?? null,
      type: n.type,
      title: n.title,
      body: n.body,
      isRead: n.isRead,
      createdAt: n.createdAt.toISOString(),
    })),
    unreadCount,
  });
}

export async function PATCH() {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: true });
  await db.notification.updateMany({
    where: { userId: user.id, isRead: false },
    data: { isRead: true },
  });
  return Response.json({ ok: true });
}
