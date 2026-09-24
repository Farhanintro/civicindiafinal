"use client";

// CivicLens — admin command center layout: desktop-first sidebar + top bar, responsive.

import { useCivicLens, type AdminTab } from "@/store/civiclens";
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
import { NotificationBellTrigger } from "../notification-bell";
import {
  LayoutDashboard,
  ListFilter,
  Map,
  BarChart3,
  ScanEye,
  LogOut,
  User,
  Home,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV: { tab: AdminTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { tab: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { tab: "incidents", label: "Incidents", icon: ListFilter },
  { tab: "map", label: "India Map", icon: Map },
  { tab: "analytics", label: "Analytics", icon: BarChart3 },
];

export function AdminLayout({ tab, children }: { tab: AdminTab; children: React.ReactNode }) {
  const { user, setView, logout, openAuth } = useCivicLens();

  if (!user || user.role !== "ADMIN") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <ScanEye className="h-10 w-10 text-primary" />
        <div>
          <p className="font-semibold">Authority access required</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in with the Authority / Admin demo role to open the command center.
          </p>
        </div>
        <Button onClick={() => openAuth("admin")}>Sign in as Authority</Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-card lg:flex">
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ScanEye className="h-4.5 w-4.5" />
          </span>
          <div>
            <div className="text-sm font-bold leading-none">CivicLens</div>
            <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              Command Center
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3" aria-label="Admin navigation">
          {NAV.map((n) => (
            <button
              key={n.tab}
              onClick={() => setView({ name: "admin", tab: n.tab })}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                tab === n.tab
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
              aria-current={tab === n.tab ? "page" : undefined}
            >
              <n.icon className="h-4.5 w-4.5" />
              {n.label}
            </button>
          ))}
        </nav>
        <div className="border-t p-3">
          <button
            onClick={() => setView({ name: "landing" })}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Home className="h-4.5 w-4.5" /> Public site
          </button>
        </div>
      </aside>

      {/* main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* top bar */}
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-2 border-b bg-background/95 px-4 backdrop-blur">
          <div className="flex items-center gap-2 lg:hidden">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ScanEye className="h-4.5 w-4.5" />
            </span>
            <span className="text-sm font-bold">CivicLens Command</span>
          </div>
          <div className="hidden lg:block">
            <p className="text-sm font-semibold">{NAV.find((n) => n.tab === tab)?.label}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <NotificationBellTrigger />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full border p-1 pr-2 transition-colors hover:bg-accent" aria-label="Account menu">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
                      {user.name.slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-32 truncate text-sm font-medium sm:inline">
                    {user.name}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="text-sm font-semibold">{user.name}</div>
                  <div className="text-xs font-normal text-muted-foreground">
                    Authority · {user.publicId}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setView({ name: "citizen" })}>
                  <User className="mr-2 h-4 w-4" /> Citizen view
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setView({ name: "landing" })}>
                  <Home className="mr-2 h-4 w-4" /> Public site
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={async () => void logout()}>
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* mobile tab nav */}
        <nav className="flex border-b bg-card lg:hidden" aria-label="Admin sections">
          {NAV.map((n) => (
            <button
              key={n.tab}
              onClick={() => setView({ name: "admin", tab: n.tab })}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
                tab === n.tab ? "text-primary" : "text-muted-foreground"
              )}
              aria-current={tab === n.tab ? "page" : undefined}
            >
              <n.icon className="h-4.5 w-4.5" />
              {n.label}
            </button>
          ))}
        </nav>

        <main className="min-w-0 flex-1 bg-muted/20">{children}</main>
      </div>
    </div>
  );
}
