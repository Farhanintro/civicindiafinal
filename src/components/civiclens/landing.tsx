"use client";

// Civic India — landing page: vision, architecture, intelligent clustering differentiator,
// categories, live metrics, and municipal accountability.

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
  TrendingUp,
  Clock,
  Layers,
  Building2,
  FileCheck,
  Activity,
  Check,
  HelpCircle,
  ChevronRight,
  MapPin,
  Flame,
  Zap,
} from "lucide-react";

const WORKFLOW_STEPS = [
  {
    step: "01",
    icon: Camera,
    title: "Capture & Geotag",
    tagline: "Point, snap, and confirm",
    body: "Take a photo of any civic defect. Civic India captures high-precision GPS coordinates, strips unneeded EXIF metadata, and compresses the image by up to 95% on-device for instantaneous mobile uploads.",
  },
  {
    step: "02",
    icon: Sparkles,
    title: "Multimodal AI Inspection",
    tagline: "Computer vision triage",
    body: "Our multimodal Vision AI classifies the issue category, gauges visual severity on a 1–10 scale, checks for public safety hazards (live wires, traffic obstruction, pedestrian falls), and suggests the responsible municipal department.",
  },
  {
    step: "03",
    icon: Layers,
    title: "Spatial Clustering & Deduplication",
    tagline: "Eliminating ticket clutter",
    body: "Incoming reports within 50–100 meters of an active issue are grouped together. Multiple citizen submissions reinforce a single incident's urgency rather than spamming municipal inboxes with duplicate tickets.",
  },
  {
    step: "04",
    icon: ShieldCheck,
    title: "Verified Action & Resolution",
    tagline: "Accountability with photo proof",
    body: "Municipal crews receive prioritized work orders. Tickets cannot be closed without uploading verified 'after' photos, providing citizens with complete transparency through public resolution timelines.",
  },
];

const FAQS = [
  {
    q: "How does Civic India prevent duplicate complaints?",
    a: "When a citizen submits a photo, our spatial engine scans for active issues of the same category within a 50–100 meter radius using great-circle Haversine calculations. If a match is found, the citizen can link their confirmation to the existing ticket, boosting its priority score instead of spawning duplicates.",
  },
  {
    q: "Are my personal details displayed publicly?",
    a: "No. Citizen privacy is strictly protected. Only the photo evidence, category, GPS position, and timestamp are visible to the public. Citizen names and emails are never exposed publicly and are accessible only to authorized municipal officers for verification.",
  },
  {
    q: "How is the priority score (P1 to P4) calculated?",
    a: "Priority is computed by an explainable scoring formula (0–100) combining AI visual severity (1–10), category hazard weights (e.g. open manholes rank higher than litter), specific detected risk factors (water contamination, two-wheeler skids), and confirmation counts from multiple citizens.",
  },
  {
    q: "Can municipal officers close tickets without proof?",
    a: "No. The Civic India workflow enforces resolution integrity: the system blocks transitioning any incident to RESOLVED status unless the municipal officer uploads an 'after' photo and notes documenting the completed repair.",
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
        {/* =========================================================================
            HERO SECTION
        ========================================================================= */}
        <section className="relative overflow-hidden border-b bg-gradient-to-b from-primary/10 via-background to-background pt-6 pb-8 lg:py-12">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(15,118,110,0.18),rgba(255,255,255,0))] dark:bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(15,118,110,0.3),rgba(0,0,0,0))]" />

          <div className="mx-auto grid w-full max-w-7xl items-center gap-8 px-4 sm:px-6 lg:grid-cols-12">
            {/* Left Copy */}
            <div className="flex flex-col justify-center gap-4 lg:col-span-7">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="gap-1.5 border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Next-Gen Municipal Intelligence
                </Badge>
                <Badge variant="secondary" className="gap-1 px-2.5 py-0.5 text-xs text-muted-foreground">
                  <Activity className="h-3 w-3 text-emerald-600" />
                  Live Across Indian Cities
                </Badge>
              </div>

              <div className="space-y-2">
                <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl lg:text-5xl">
                  Empowering Citizens. <br />
                  <span className="bg-gradient-to-r from-primary to-teal-700 bg-clip-text text-transparent dark:to-teal-300">
                    Transforming Cities.
                  </span>
                </h1>
                <p className="text-base font-semibold text-primary sm:text-lg">
                  “See a problem. Report it. Track the action.”
                </p>
                <p className="max-w-xl text-sm text-muted-foreground sm:text-base sm:leading-relaxed">
                  Civic India converts scattered, geo-tagged citizen photos into verified, deduplicated municipal work orders — bringing AI-driven triage and accountability to urban governance.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Button size="lg" onClick={goReport} className="h-11 px-6 text-sm font-semibold shadow-md transition-all hover:shadow-lg sm:text-base">
                  <Camera className="mr-2 h-4 w-4" /> Report an Issue
                </Button>
                <Button size="lg" variant="outline" onClick={goExplore} className="h-11 border-primary/30 px-5 text-sm font-medium hover:bg-accent sm:text-base">
                  <MapPinned className="mr-2 h-4 w-4 text-primary" /> Explore City Map
                </Button>
              </div>

              {/* Trust Indicators */}
              <div className="grid grid-cols-3 gap-3 border-t border-border/60 pt-4">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <CheckCircle2 className="h-4 w-4 text-primary" /> 100% Transparent
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">Open timelines & proof</p>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <Layers className="h-4 w-4 text-primary" /> Zero Clutter
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">Deduplication engine</p>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <ShieldCheck className="h-4 w-4 text-primary" /> Verified Closure
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">Mandatory after-photos</p>
                </div>
              </div>
            </div>

            {/* Right Visual Card Showcase */}
            <div className="relative lg:col-span-5">
              <div className="relative mx-auto aspect-[4/3] w-full max-w-lg overflow-hidden rounded-2xl border-2 border-border/80 shadow-2xl">
                <Photo
                  src="/samples/hero.png"
                  alt="Aerial view of an Indian city neighbourhood at golden hour"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 45vw"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-4 text-white sm:p-5">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-emerald-300">Live Infrastructure Grid</span>
                  </div>
                  <p className="mt-1 text-xs font-medium leading-snug sm:text-sm">
                    Real-time citizen reporting driving direct municipal dispatch and verifiable public accountability.
                  </p>
                </div>
              </div>

              {/* Floating Live Badge */}
              <div className="absolute -bottom-4 -left-3 hidden rounded-xl border bg-card/95 p-3 shadow-xl backdrop-blur sm:flex sm:items-center sm:gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                  <FileCheck className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold">Road Repair Completed</div>
                  <div className="text-[10px] text-muted-foreground">After-evidence verified • PWD Crew A-2</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            LIVE IMPACT METRICS
        ========================================================================= */}
        <section className="border-b bg-card">
          <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6">
            <div className="grid grid-cols-2 gap-3 divide-y divide-border/60 sm:grid-cols-4 sm:divide-x sm:divide-y-0">
              <div className="p-2 text-center sm:p-3">
                <div className="flex items-center justify-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <Users className="h-3.5 w-3.5 text-primary" /> Reports Submitted
                </div>
                <div className="mt-1 text-2xl font-extrabold text-foreground sm:text-3xl">
                  {stats?.totals.reports ?? "—"}
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Citizen field contributions</p>
              </div>

              <div className="p-2 text-center sm:p-3">
                <div className="flex items-center justify-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <Activity className="h-3.5 w-3.5 text-amber-600" /> Active Incidents
                </div>
                <div className="mt-1 text-2xl font-extrabold text-amber-600 dark:text-amber-400 sm:text-3xl">
                  {stats?.totals.activeIncidents ?? "—"}
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Tracked in municipal pipelines</p>
              </div>

              <div className="p-2 text-center sm:p-3">
                <div className="flex items-center justify-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Issues Resolved
                </div>
                <div className="mt-1 text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 sm:text-3xl">
                  {stats?.totals.resolvedIncidents ?? "—"}
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Verified with after-photos</p>
              </div>

              <div className="p-2 text-center sm:p-3">
                <div className="flex items-center justify-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <Clock className="h-3.5 w-3.5 text-primary" /> Avg. Turnaround
                </div>
                <div className="mt-1 text-2xl font-extrabold text-foreground sm:text-3xl">
                  {stats?.totals.avgResolutionHours ? `${stats.totals.avgResolutionHours}h` : "—"}
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">From dispatch to closure</p>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            HOW IT WORKS — STEP-BY-STEP LIFECYCLE
        ========================================================================= */}
        <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
          <div className="mx-auto max-w-2xl text-center">
            <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
              Lifecycle Transparency
            </Badge>
            <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              From Citizen Evidence to Municipal Action
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Not just an AI photo scanner — an end-to-end urban infrastructure management platform designed for speed, accuracy, and public trust.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {WORKFLOW_STEPS.map((s) => (
              <Card key={s.step} className="relative overflow-hidden border border-border/80 transition-all duration-200 hover:-translate-y-1 hover:border-primary/50 hover:shadow-md">
                <CardContent className="flex h-full flex-col p-5">
                  <div className="flex items-center justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <s.icon className="h-5 w-5" />
                    </span>
                    <span className="font-mono text-xl font-black text-muted-foreground/30">
                      {s.step}
                    </span>
                  </div>

                  <h3 className="mt-4 text-base font-bold">{s.title}</h3>
                  <div className="text-[11px] font-semibold text-primary">{s.tagline}</div>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{s.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* =========================================================================
            CORE DIFFERENTIATOR — INCIDENT CLUSTERING SHOWCASE
        ========================================================================= */}
        <section className="border-y bg-muted/30 py-8 lg:py-12">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
            <div className="grid items-center gap-8 lg:grid-cols-12">
              {/* Left Explainer */}
              <div className="space-y-4 lg:col-span-7">
                <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                  Core Architectural Breakthrough
                </Badge>
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  One Physical Problem. Many Citizen Reports. One Actionable Incident.
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Traditional civic grievance apps create ten different grievance tickets when ten commuters photograph the same broken road. This overwhelms departments and stalls municipal machinery.
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Civic India introduces <strong>Intelligent Spatial Deduplication</strong>: reports of the same category within a 100-meter window are clustered together. Each additional report acts as an upvote, automatically raising the incident's explainable priority.
                </p>

                <div className="grid gap-3 pt-1 sm:grid-cols-2">
                  <div className="rounded-xl border bg-background p-3.5 shadow-sm">
                    <div className="font-semibold text-rose-600 dark:text-rose-400 text-sm">Traditional Portals</div>
                    <ul className="mt-1.5 space-y-1 text-xs text-muted-foreground">
                      <li>• Duplicate tickets choke municipal officers</li>
                      <li>• No real-time spatial deduplication</li>
                      <li>• Citizens left without resolution updates</li>
                    </ul>
                  </div>

                  <div className="rounded-xl border-2 border-primary/50 bg-primary/5 p-3.5 shadow-sm">
                    <div className="font-semibold text-primary text-sm">Civic India Engine</div>
                    <ul className="mt-1.5 space-y-1 text-xs text-foreground">
                      <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-primary" /> Clustered tickets with multi-citizen backing</li>
                      <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-primary" /> Explainable P1–P4 automated priority score</li>
                      <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-primary" /> Clean, actionable work orders for departments</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Right Ticket Mockup */}
              <div className="lg:col-span-5">
                <Card className="border-2 border-border/80 shadow-xl">
                  <CardContent className="space-y-3.5 p-5 font-mono text-xs">
                    <div className="flex items-center justify-between border-b pb-2.5 font-sans">
                      <div>
                        <span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-xs font-bold text-primary">
                          INCIDENT #CI-1048
                        </span>
                        <h4 className="mt-1 text-sm font-bold">Deep Rainwater Pothole</h4>
                      </div>
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        IN PROGRESS
                      </span>
                    </div>

                    <div className="space-y-1.5 font-sans text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Assigned Department:</span>
                        <span className="font-semibold">Roads & Public Works (PWD)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Citizen Confirmations:</span>
                        <span className="font-semibold text-primary">5 linked reports (Clustered)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Priority Rating:</span>
                        <span className="rounded bg-rose-100 px-1.5 py-0.5 font-bold text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                          P1 · HIGH (Score 84/100)
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Location Pin:</span>
                        <span className="truncate max-w-[200px]">Station Road, Alwar, Rajasthan</span>
                      </div>
                    </div>

                    <div className="rounded-lg bg-muted p-2.5 font-sans text-xs text-muted-foreground">
                      <span className="font-bold text-foreground">Explainable AI Scoring:</span> Visual damage 8/10 • 5 citizen validations (+20pts) • High-risk hazard: two-wheeler skidding risk at night.
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            CATEGORIES COVERED
        ========================================================================= */}
        <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
          <div className="mx-auto max-w-2xl text-center">
            <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
              Broad Municipal Scope
            </Badge>
            <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              Issues Handled by Civic India
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Every category is mapped to its corresponding municipal department for immediate, seamless dispatch.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {categories.map((c) => (
              <button
                key={c.key}
                onClick={goExplore}
                className="group flex flex-col items-center gap-2.5 rounded-2xl border bg-card p-4 text-center transition-all duration-200 hover:-translate-y-1 hover:border-primary/50 hover:shadow-md"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
                  <CategoryIcon categoryKey={c.key} className="h-6 w-6" />
                </span>
                <div>
                  <h4 className="text-xs font-semibold text-foreground group-hover:text-primary sm:text-sm">{c.label}</h4>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">Auto-routed</p>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* =========================================================================
            TWO PILLARS: CITIZENS & AUTHORITIES
        ========================================================================= */}
        <section className="border-t bg-muted/20 py-8 lg:py-12">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Pillar 1: Citizens */}
              <div className="rounded-2xl border bg-card p-6 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Users className="h-5 w-5" />
                </div>
                <h3 className="mt-3 text-xl font-bold">For Citizens</h3>
                <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed sm:text-sm">
                  Civic India gives every resident the power to champion their neighborhood infrastructure without bureaucratic barriers.
                </p>
                <ul className="mt-4 space-y-2.5 text-xs sm:text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span><strong>Frictionless Reporting:</strong> No lengthy paperwork — a single photo and GPS pin does the job.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span><strong>Live Incident Timeline:</strong> Real-time in-app notifications whenever authorities review or dispatch crews.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span><strong>Privacy by Design:</strong> Your identity is never publicized. Only defect evidence is mapped.</span>
                  </li>
                </ul>
              </div>

              {/* Pillar 2: Municipal Authorities */}
              <div className="rounded-2xl border bg-card p-6 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Building2 className="h-5 w-5" />
                </div>
                <h3 className="mt-3 text-xl font-bold">For Municipal Authorities</h3>
                <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed sm:text-sm">
                  A high-efficiency Command Center that turns scattered citizen feedback into structured, deduplicated work orders.
                </p>
                <ul className="mt-4 space-y-2.5 text-xs sm:text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span><strong>Priority Queue:</strong> AI sorts issues by actual visual severity and safety risk rather than complaint volume.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span><strong>Single Unified Tickets:</strong> Eliminate 80% of duplicate calls through automatic geo-spatial clustering.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span><strong>Resolution Audits:</strong> Require mandatory proof photos before tickets can be signed off.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            FAQS
        ========================================================================= */}
        <section className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:py-12">
          <div className="text-center">
            <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
              Got Questions?
            </Badge>
            <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="mt-6 divide-y rounded-2xl border bg-card">
            {FAQS.map((faq, idx) => (
              <div key={idx} className="p-4 sm:p-5">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground sm:text-base">
                  <HelpCircle className="h-4 w-4 text-primary shrink-0" />
                  {faq.q}
                </h4>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground pl-6 sm:text-sm">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* =========================================================================
            BOTTOM CALL TO ACTION (CTA)
        ========================================================================= */}
        <section className="border-t bg-primary text-primary-foreground">
          <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-4 px-4 py-10 text-center sm:px-6 lg:py-12">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-foreground/10 text-primary-foreground">
              <ScanEye className="h-7 w-7" />
            </span>
            <div className="space-y-1.5">
              <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                Ready to improve your neighborhood?
              </h2>
              <p className="mx-auto max-w-xl text-sm text-primary-foreground/80 sm:text-base">
                Join thousands of citizens making Indian cities safer, cleaner, and better managed. One photo is all it takes.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3 pt-1">
              <Button size="lg" variant="secondary" onClick={goReport} className="h-11 px-7 text-sm font-bold shadow-md sm:text-base">
                <Camera className="mr-2 h-4 w-4" /> Report an Issue Now
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={goExplore}
                className="h-11 border-primary-foreground/40 bg-transparent px-7 text-sm font-medium text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground sm:text-base"
              >
                View Live Map <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}