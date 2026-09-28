"use client";

// Civic India — application shell: session bootstrap, client-side view routing,
// headers per experience (public / citizen mobile-first / admin desktop-first),
// notifications, theme, and the sticky footer.

import { useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { ThemeProvider } from "next-themes";
import { useCivicLens } from "@/store/civiclens";
import { AuthDialog } from "./auth-dialog";
import { Landing } from "./landing";
import { Explore } from "./explore";
import { ReportWizard } from "./citizen/wizard";
import { CitizenDashboard } from "./citizen/dashboard";
import { IncidentView } from "./incident-view";
import { AdminDashboard } from "./admin/dashboard";
import { AdminIncidents } from "./admin/incidents";
import { AdminAnalytics } from "./admin/analytics";
import { AdminLayout } from "./admin/layout";
import { SiteHeader } from "./site-header";
import { CitizenHeader } from "./citizen/header";
import { Button } from "@/components/ui/button";
import { Camera, MapPinned, ScanEye } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// Leaflet must never render on the server.
const AdminMapSafe = dynamic(() => import("./admin/map").then((m) => m.AdminMap), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

function MapSkeleton() {
  return <Skeleton className="h-full w-full rounded-none" />;
}

function Splash() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <div className="flex items-center gap-2">
        <ScanEye className="h-8 w-8 text-primary" />
        <span className="text-2xl font-bold tracking-tight">Civic India</span>
      </div>
      <Skeleton className="h-1 w-40" />
      <p className="text-sm text-muted-foreground">Loading civic intelligence…</p>
    </div>
  );
}

function Footer() {
  return (
    <footer className="mt-auto border-t bg-muted/40">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
          <div>
            <div className="flex items-center gap-2">
              <ScanEye className="h-4 w-4 text-primary" />
              <span className="font-semibold">Civic India</span>
            </div>
            <p className="mt-2 max-w-md text-xs leading-relaxed text-muted-foreground">
              AI-assisted civic intelligence for Indian cities. Citizen identity is never shown publicly; location is used only to place reports on the map.
            </p>
          </div>
          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
            <span>Civic platform · Made for Indian cities</span>
            <span>AI-assisted priority assessment</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

function CivicLensInner() {
  const { booted, view, user, boot, refreshNotifications, setView } = useCivicLens();

  useEffect(() => {
    void boot();
  }, [boot]);

  useEffect(() => {
    if (!user) return;
    const timer = setInterval(() => void refreshNotifications(), 30000);
    return () => clearInterval(timer);
  }, [user, refreshNotifications]);

  const body = useMemo(() => {
    switch (view.name) {
      case "landing":
        return <Landing />;
      case "explore":
        return (
          <>
            <SiteHeader />
            <main className="flex-1">
              <Explore focus={view.focus} />
            </main>
          </>
        );
      case "report":
        return <CitizenHeader title="Report an issue" />;
      case "citizen":
        return (
          <>
            <CitizenHeader title="My Civic India" />
            <main className="flex-1">
              <CitizenDashboard />
            </main>
          </>
        );
      case "incident":
        return (
          <>
            <SiteHeader />
            <main className="flex-1">
              <IncidentView publicId={view.publicId} />
            </main>
          </>
        );
      case "admin": {
        const tab = view.tab;
        return (
          <AdminLayout tab={tab}>
            {tab === "dashboard" ? <AdminDashboard /> : null}
            {tab === "incidents" ? <AdminIncidents /> : null}
            {tab === "map" ? <AdminMapSafe /> : null}
            {tab === "analytics" ? <AdminAnalytics /> : null}
          </AdminLayout>
        );
      }
      default:
        return <Landing />;
    }
  }, [view, setView]);

  if (!booted) return <Splash />;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {body}
      {/* The wizard stays mounted (hidden) so an in-progress report survives
          navigation — e.g. viewing an incident from the duplicate-check step. */}
      {user && user.role !== "ADMIN" ? (
        <div className={view.name === "report" ? "flex-1" : "hidden"}>
          <ReportWizard />
        </div>
      ) : null}
      {view.name !== "admin" ? <Footer /> : null}
      <AuthDialog />
      {view.name === "landing" && user ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center lg:hidden">
          <div className="pointer-events-auto flex gap-2 rounded-full border bg-background/95 p-1.5 shadow-lg backdrop-blur">
            <Button size="sm" className="rounded-full" onClick={() => setView({ name: "report" })}>
              <Camera className="mr-1 h-4 w-4" /> Report
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={() =>
                setView(
                  user.role === "ADMIN"
                    ? { name: "admin", tab: "dashboard" }
                    : { name: "citizen" }
                )
              }
            >
              <MapPinned className="mr-1 h-4 w-4" /> Dashboard
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function CivicLensApp() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      <CivicLensInner />
    </ThemeProvider>
  );
}