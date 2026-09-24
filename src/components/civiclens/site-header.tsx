"use client";

// CivicLens — public site header (landing / explore / incident views).

import { useTheme } from "next-themes";
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
import { LogOut, Moon, ScanEye, Sun, Map, Camera, LayoutDashboard, ShieldCheck } from "lucide-react";
import { NotificationBellTrigger } from "./notification-bell";

export function SiteHeader() {
  const { user, setView, logout, openAuth } = useCivicLens();
  const { theme, setTheme } = useTheme();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
        <button
          className="flex items-center gap-2"
          onClick={() => setView({ name: "landing" })}
          aria-label="CivicLens home"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ScanEye className="h-4.5 w-4.5" />
          </span>
          <span className="text-lg font-bold tracking-tight">CivicLens</span>
        </button>

        <nav className="flex items-center gap-1 sm:gap-2" aria-label="Main navigation">
          <Button variant="ghost" size="sm" onClick={() => setView({ name: "explore" })}>
            <Map className="mr-1 h-4 w-4" />
            <span className="hidden sm:inline">Explore issues</span>
            <span className="sm:hidden">Explore</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle dark mode"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          {user ? <NotificationBellTrigger /> : null}

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-2 rounded-full border p-1 pr-2 transition-colors hover:bg-accent"
                  aria-label="Account menu"
                >
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
                      {user.name.slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-28 truncate text-sm font-medium sm:inline">
                    {user.name.split(" ")[0]}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="text-sm font-semibold">{user.name}</div>
                  <div className="text-xs font-normal text-muted-foreground">
                    {user.role === "ADMIN" ? "Authority / Admin" : "Citizen"} · {user.publicId}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {user.role === "ADMIN" ? (
                  <DropdownMenuItem onClick={() => setView({ name: "admin", tab: "dashboard" })}>
                    <ShieldCheck className="mr-2 h-4 w-4" /> Admin command center
                  </DropdownMenuItem>
                ) : (
                  <>
                    <DropdownMenuItem onClick={() => setView({ name: "citizen" })}>
                      <LayoutDashboard className="mr-2 h-4 w-4" /> My dashboard
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setView({ name: "report" })}>
                      <Camera className="mr-2 h-4 w-4" /> Report an issue
                    </DropdownMenuItem>
                  </>
                )}
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
        </nav>
      </div>
    </header>
  );
}
