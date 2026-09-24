"use client";

// CivicLens — citizen (mobile-first) header.

import { useCivicLens } from "@/store/civiclens";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ScanEye } from "lucide-react";
import { NotificationBellTrigger } from "../notification-bell";

export function CitizenHeader({ title }: { title: string }) {
  const { setView, user } = useCivicLens();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between gap-2 px-4">
        <div className="flex min-w-0 items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setView(user?.role === "ADMIN" ? { name: "admin", tab: "dashboard" } : { name: "citizen" })}
            aria-label="Go back"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex min-w-0 items-center gap-2">
            <ScanEye className="h-5 w-5 shrink-0 text-primary" />
            <span className="truncate font-semibold">{title}</span>
          </div>
        </div>
        <NotificationBellTrigger />
      </div>
    </header>
  );
}
