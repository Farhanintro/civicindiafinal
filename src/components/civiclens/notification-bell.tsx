"use client";

// CivicLens — in-app notifications (polled every 30s; bell with unread count + panel).

import { useState } from "react";
import { useCivicLens } from "@/store/civiclens";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Bell, CheckCircle2, Link2, ShieldCheck, Wrench, XCircle } from "lucide-react";
import { timeAgo } from "@/lib/civiclens/format";
import { cn } from "@/lib/utils";

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  REPORT_SUBMITTED: CheckCircle2,
  LINKED: Link2,
  STATUS_CHANGE: ShieldCheck,
  ASSIGNED: ShieldCheck,
  RESOLVED: Wrench,
  SYSTEM: Bell,
};

export function NotificationBellTrigger() {
  const { notifications, unreadCount, markNotificationsRead, setView } = useCivicLens();
  const [open, setOpen] = useState(false);

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) void markNotificationsRead();
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 sm:w-96">
        <div className="border-b px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
        </div>
        <div className="cl-scroll max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No notifications yet. Updates about your reports will appear here.
            </p>
          ) : (
            <ul className="divide-y">
              {notifications.map((n) => {
                const Icon = TYPE_ICONS[n.type] ?? Bell;
                return (
                  <li key={n.id}>
                    <button
                      className={cn(
                        "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent",
                        !n.isRead && "bg-primary/5"
                      )}
                      onClick={() => {
                        if (n.incidentPublicId) {
                          setOpen(false);
                          setView({ name: "incident", publicId: n.incidentPublicId });
                        }
                      }}
                    >
                      <span className="mt-0.5 rounded-full bg-muted p-1.5">
                        <Icon className="h-4 w-4 text-primary" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{n.title}</span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                          {n.body}
                        </span>
                        <span className="mt-1 block text-[11px] text-muted-foreground/70">
                          {timeAgo(n.createdAt)}
                        </span>
                      </span>
                      {!n.isRead ? (
                        <XCircle className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Floating variant for pages where the header already hosts the trigger.
export function NotificationBell() {
  return null;
}
