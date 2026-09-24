"use client";

// CivicLens — citizen (mobile-first) header.
// Account menu (avatar dropdown) gives citizens access to their dashboard and sign-out.

import { useCivicLens } from "@/store/civiclens";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronLeft, ScanEye, LayoutDashboard, Camera, LogOut } from "lucide-react";
import { NotificationBellTrigger } from "../notification-bell";

export function CitizenHeader({ title }: { title: string }) {
  const { setView, user, logout, openAuth } = useCivicLens();

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
        <div className="flex items-center gap-1">
          <NotificationBellTrigger />
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-full border p-1 pr-2 transition-colors hover:bg-accent"
                  aria-label="Account menu"
                >
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
                      {user.name.slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-24 truncate text-sm font-medium sm:inline">
                    {user.name.split(" ")[0]}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="text-sm font-semibold">{user.name}</div>
                  <div className="text-xs font-normal text-muted-foreground">
                    Citizen · {user.publicId}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setView({ name: "citizen" })}>
                  <LayoutDashboard className="mr-2 h-4 w-4" /> My dashboard
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setView({ name: "report" })}>
                  <Camera className="mr-2 h-4 w-4" /> Report an issue
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={async () => {
                    await logout();
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button size="sm" onClick={() => openAuth()}>
              Sign in
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
