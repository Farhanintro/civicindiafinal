"use client";

// CivicLens — landing page: vision, how it works, incident clustering differentiator,
// categories, and demo stats (clearly labelled DEMO DATA).

import { useEffect, useState } from "react";
import { useCivicLens } from "@/store/civiclens";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SiteHeader } from "./site-header";
import { Photo } from "./photo";
import { fetchAnalytics } from "@/lib/civiclens/api";
import type { AnalyticsDTO } from "@/lib/civiclens/types";
import { CategoryIcon } from "./badges";
import {
  Camera,
  MapPinned,
  ScanEye,
  ShieldCheck,
  Sparkles,
  Workflow,
  Users,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

const STEPS = [
  {
    icon: Camera,
    title: "1 · Capture evidence",
    body: "Snap a photo of the problem. CivicLens grabs your GPS location and compresses the image instantly.",
  },
  {
    icon: Sparkles,
    title: "2 · AI analysis",
    body: "A multimodal AI identifies the issue, estimates severity, spots hazards and recommends the responsible department — once per report.",
  },
  {
    icon: Workflow,
    title: "3 · Priority & routing",
    body: "Reports are clustered into incidents. An explainable priority score routes each incident to the right municipal department.",
  },
  {
    icon: CheckCircle2,
    title: "4 · Track resolution",
    body: "Authorities verify, assign and resolve with photo evidence. Citizens watch the entire lifecycle in real time.",
  },
];

export function Landing() {
  const { setView, user, openAuth, categories } = useCivicLens();
  const [stats, setStats] = useState<AnalyticsDTO | null>(null);

  useEffect(() => {
    fetchAnalytics().then(setStats).catch(() => setStats(null));
  }, []);

  const goReport = () => {
    if (!user) return openAuth("report");
    setView(user.role === "ADMIN" ? { name: "admin", tab: "dashboard" } : { name: "report" });
  };
  const goExplore = () => setView({ name: "explore" });

  return (
    <>
      <SiteHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="border-b bg-gradient-to-b from-primary/5 via-background to-background">
          <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:py-20">
            <div className="flex flex-col justify-center gap-5">
              <Badge variant="outline" className="w-fit gap-1.5 border-primary/40 bg-primary/5 text-primary">
                <Sparkles className="h-3.5 w-3.5" /> AI-powered civic intelligence
              </Badge>
              <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
                CivicLens
              </h1>
              <p className="text-xl font-semibold text-primary">{`“See a problem. Report it. Track the action.”`}</p>
              <p className="max-w-lg text-muted-foreground">
                AI-powered civic intelligence that transforms scattered, geo-tagged citizen
                evidence into actionable infrastructure incidents — anywhere in India.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button size="lg" onClick={goReport} className="h-12 px-6 text-base">
                  <Camera className="mr-2 h-5 w-5" /> Report an issue
                </Button>
                <Button size="lg" variant="outline" onClick={goExplore} className="h-12 px-6 text-base">
                  <MapPinned className="mr-2 h-5 w-5" /> Explore issues
                </Button>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Users className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  One physical problem · many citizen reports · <span className="font-semibold text-foreground">one tracked incident</span>
                </p>
              </div>
            </div>
            <div className="relative hidden min-h-72 overflow-hidden rounded-2xl border shadow-lg lg:block">
              <Photo
                src="/samples/hero.png"
                alt="Aerial view of an Indian city neighbourhood at golden hour"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
                priority
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                <p className="text-sm font-medium text-white">
                  Every street, every city — evidence becomes action.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Demo stats strip */}
        <section className="border-b bg-muted/30">
          <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
            <div className="mb-3 flex items-center justify-center gap-2">
              <Badge variant="outline" className="border-dashed border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                DEMO DATA
              </Badge>
              <span className="text-xs text-muted-foreground">
                Illustration only — not real government statistics
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: "Citizen reports", value: stats?.totals.reports ?? "—" },
                { label: "Tracked incidents", value: stats?.totals.incidents ?? "—" },
                { label: "Active now", value: stats?.totals.activeIncidents ?? "—" },
                { label: "Resolved", value: stats?.totals.resolvedIncidents ?? "—" },
              ].map((s) => (
                <Card key={s.label} className="border bg-background">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-primary sm:text-3xl">{s.value}</div>
                    <div className="mt-1 text-xs text-muted-foreground sm:text-sm">{s.label}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6">
          <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
            From citizen evidence to municipal action
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-muted-foreground">
            Not just “AI detects potholes” — a complete civic intelligence layer.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <Card key={s.title} className="transition-shadow hover:shadow-md">
                <CardContent className="flex h-full flex-col gap-3 p-5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <s.icon className="h-5 w-5" />
                  </span>
                  <h3 className="font-semibold">{s.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Differentiator: incident clustering */}
        <section className="border-y bg-muted/30">
          <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2">
            <div>
              <Badge variant="outline" className="border-primary/40 bg-primary/5 text-primary">
                Core differentiator
              </Badge>
              <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
                One physical problem. Many citizen reports. One incident.
              </h2>
              <p className="mt-3 text-muted-foreground">
                If ten citizens report the same pothole, CivicLens doesn&apos;t create ten
                problems. Nearby reports of the same issue are clustered into a single
                incident — each confirmation strengthens its priority.
              </p>
              <ul className="mt-4 space-y-2 text-sm">
                {[
                  "Geographic + category + time-window duplicate detection",
                  "Citizens choose: link to the existing incident or create a new one",
                  "More confirmations → higher explainable priority",
                  "Agencies see one actionable ticket, not noise",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
            <Card className="border-2 shadow-md">
              <CardContent className="p-6 font-mono text-sm">
                <div className="flex items-center justify-between">
                  <span className="rounded bg-primary/10 px-2 py-0.5 font-bold text-primary">INCIDENT #CL-1024</span>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    IN PROGRESS
                  </span>
                </div>
                <dl className="mt-4 space-y-2">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Issue</dt>
                    <dd className="font-semibold">Pothole</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Location</dt>
                    <dd className="text-right">Government College Road, Alwar</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Citizen reports</dt>
                    <dd className="font-semibold">4 linked reports</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Priority</dt>
                    <dd>
                      <span className="rounded bg-orange-100 px-2 py-0.5 font-bold text-orange-800 dark:bg-orange-950 dark:text-orange-300">
                        P2 · HIGH
                      </span>
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Routed to</dt>
                    <dd>Roads / PWD</dd>
                  </div>
                </dl>
                <p className="mt-4 rounded-lg bg-muted p-3 font-sans text-xs text-muted-foreground">
                  Why this priority: AI-assessed visual severity 8/10 · 4 citizen confirmations ·
                  two-wheeler risk + traffic disruption hazards.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Categories */}
        <section className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6">
          <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
            Every kind of civic issue
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-muted-foreground">
            Configurable categories, each routed to the responsible department.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {categories.map((c) => (
              <button
                key={c.key}
                onClick={goExplore}
                className="group flex flex-col items-center gap-2 rounded-xl border bg-card p-4 text-center transition-all hover:border-primary/50 hover:shadow-sm"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary transition-transform group-hover:scale-110">
                  <CategoryIcon categoryKey={c.key} className="h-5 w-5" />
                </span>
                <span className="text-xs font-medium leading-tight sm:text-sm">{c.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="border-t bg-primary text-primary-foreground">
          <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-4 px-4 py-12 text-center sm:px-6">
            <ScanEye className="h-10 w-10" />
            <h2 className="text-2xl font-bold sm:text-3xl">
              Spotted something broken? Make it count.
            </h2>
            <p className="max-w-xl text-primary-foreground/80">
              One photo, one GPS pin, one AI analysis — your report becomes a tracked,
              prioritized, routed municipal incident.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button size="lg" variant="secondary" onClick={goReport} className="h-12 px-6 text-base">
                <Camera className="mr-2 h-5 w-5" /> Report an issue
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={goExplore}
                className="h-12 border-primary-foreground/40 bg-transparent px-6 text-base text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              >
                Explore issues <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
