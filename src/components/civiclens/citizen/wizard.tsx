"use client";

// Civic India — citizen report wizard:
// PHOTO → LOCATION → DETAILS → AI ANALYSIS → REVIEW → DUPLICATE CHECK → SUCCESS
// Blocks non-civic/fake image submissions when AI analysis returns isCivicIssue: false.

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useCivicLens } from "@/store/civiclens";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  analyzeReport,
  compressImage,
  reverseGeocode,
  searchLocations,
  submitReport,
  ApiError,
} from "@/lib/civiclens/api";
import type {
  CivicAnalysis,
  DuplicateCandidate,
  IncidentSummary,
  ReverseGeocodeResult,
} from "@/lib/civiclens/types";
import { formatDistance, haversineMeters } from "@/lib/civiclens/geo";
import { INDIAN_CITIES } from "@/lib/civiclens/constants";
import { Photo } from "../photo";
import { CategoryIcon, HazardChip, PriorityBadge, SeverityBadge, DemoBadge } from "../badges";
import { locationLine } from "@/lib/civiclens/format";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  CircleAlert,
  ImagePlus,
  Loader2,
  LocateFixed,
  MapPin,
  MapPinned,
  Pencil,
  Plus,
  RefreshCcw,
  ScanSearch,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";

const LocationPicker = dynamic(
  () => import("../map").then((m) => m.LocationPicker),
  { ssr: false, loading: () => <div className="h-64 w-full animate-pulse rounded-xl bg-muted" /> }
);

type Step = "photo" | "location" | "details" | "analyzing" | "review" | "duplicate" | "success";

const ANALYSIS_STAGES = [
  "Uploading & optimizing image…",
  "Analyzing image with AI…",
  "Checking authenticity & civic context…",
  "Assessing severity & hazards…",
  "Verifying incident validity…",
  "Preparing intelligence report…",
];

export function ReportWizard() {
  const { user, openAuth, samples, categories, departments, setView } = useCivicLens();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("photo");
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [sampleKey, setSampleKey] = useState<string | null>(null);
  const [samplePath, setSamplePath] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  const [gpsState, setGpsState] = useState<"idle" | "locating" | "ok" | "denied">("idle");
  const [captureLat, setCaptureLat] = useState<number | null>(null);
  const [captureLng, setCaptureLng] = useState<number | null>(null);
  const [finalLat, setFinalLat] = useState<number | null>(null);
  const [finalLng, setFinalLng] = useState<number | null>(null);
  const [captureTimestamp, setCaptureTimestamp] = useState<string | null>(null);
  const [geo, setGeo] = useState<ReverseGeocodeResult | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchHits, setSearchHits] = useState<{ display: string; lat: number; lng: number }[]>([]);

  const [description, setDescription] = useState("");

  const [analysis, setAnalysis] = useState<CivicAnalysis | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [reportPublicId, setReportPublicId] = useState<string | null>(null);
  const [stageIndex, setStageIndex] = useState(0);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [categoryOverride, setCategoryOverride] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [candidates, setCandidates] = useState<DuplicateCandidate[]>([]);
  const [result, setResult] = useState<{ incident: IncidentSummary; linked: boolean } | null>(null);
  const retryCountRef = useRef(0);
  const runAnalysisRef = useRef<() => void>(() => {});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) openAuth("report");
  }, [user, openAuth]);

  const onPhotoChosen = useCallback(async (f: File) => {
    setAnalyzeError(null);
    const compressed = await compressImage(f);
    setFile(compressed);
    setSampleKey(null);
    setSamplePath(null);
    setFileUrl(URL.createObjectURL(compressed));
    setIdempotencyKey(crypto.randomUUID());
    setAnalysis(null);
    setReportId(null);
    setReportPublicId(null);
  }, []);

  const pickSample = useCallback((key: string, path: string) => {
    setAnalyzeError(null);
    setFile(null);
    setFileUrl(null);
    setSampleKey(key);
    setSamplePath(path);
    setIdempotencyKey(crypto.randomUUID());
    setAnalysis(null);
    setReportId(null);
    setReportPublicId(null);
  }, []);

  const applyGeocode = useCallback(async (lat: number, lng: number) => {
    setGeoLoading(true);
    const res = await reverseGeocode(lat, lng);
    setGeo(res);
    setGeoLoading(false);
  }, []);

  const requestGps = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setGpsState("denied");
      return;
    }
    setGpsState("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setGpsState("ok");
        setCaptureLat(latitude);
        setCaptureLng(longitude);
        setFinalLat(latitude);
        setFinalLng(longitude);
        setCaptureTimestamp(new Date(pos.timestamp || Date.now()).toISOString());
        void applyGeocode(latitude, longitude);
      },
      () => setGpsState("denied"),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  }, [applyGeocode]);

  useEffect(() => {
    if (step === "location" && gpsState === "idle") requestGps();
  }, [step, gpsState, requestGps]);

  const onManualLocation = useCallback(
    (lat: number, lng: number) => {
      setFinalLat(lat);
      setFinalLng(lng);
      void applyGeocode(lat, lng);
    },
    [applyGeocode]
  );

  const locationChanged =
    captureLat != null &&
    captureLng != null &&
    finalLat != null &&
    finalLng != null &&
    haversineMeters(captureLat, captureLng, finalLat, finalLng) > 50;

  const runAnalysis = useCallback(async () => {
    if (finalLat == null || finalLng == null) return;
    setStep("analyzing");
    setStageIndex(0);
    setAnalyzeError(null);
    const timer = setInterval(() => {
      setStageIndex((i) => Math.min(i + 1, ANALYSIS_STAGES.length - 1));
    }, 2200);
    try {
      const res = await analyzeReport({
        file,
        sampleKey,
        idempotencyKey,
        latitude: finalLat,
        longitude: finalLng,
        captureTimestamp: captureTimestamp ?? new Date().toISOString(),
        description: description.trim() || undefined,
      });
      clearInterval(timer);
      setStageIndex(ANALYSIS_STAGES.length - 1);
      setAnalysis(res.analysis);
      setReportId(res.reportId);
      setReportPublicId(res.reportPublicId);
      setCandidates(res.duplicateCandidates ?? []);
      setCategoryOverride(res.analysis.source === "FALLBACK_MANUAL" ? null : res.analysis.categoryKey);
      setEditing(false);
      setTimeout(() => setStep("review"), 450);
    } catch (err) {
      clearInterval(timer);
      const message = err instanceof ApiError ? err.message : "Analysis failed. Please try again.";
      if (err instanceof ApiError && err.status === 409) {
        retryCountRef.current += 1;
        if (retryCountRef.current <= 5) {
          setTimeout(() => void runAnalysisRef.current(), 2500);
          return;
        }
      }
      setAnalyzeError(message);
      setStep("details");
      toast({
        title: "AI analysis unavailable",
        description: message,
        variant: "destructive",
      });
    }
  }, [file, sampleKey, idempotencyKey, finalLat, finalLng, captureTimestamp, description, toast]);
  useEffect(() => {
    runAnalysisRef.current = runAnalysis;
  }, [runAnalysis]);

  const doSubmit = useCallback(
    async (decision?: "link" | "new", linkToIncidentPublicId?: string) => {
      if (!analysis?.isCivicIssue) {
        toast({
          title: "Submission Blocked",
          description: "Cannot submit: The AI verified that this image is not a genuine civic infrastructure issue.",
          variant: "destructive",
        });
        return;
      }

      if (!reportId) return;
      setSubmitting(true);
      try {
        const res = await submitReport({
          reportId,
          categoryKey: categoryOverride ?? analysis?.categoryKey,
          description: description.trim() || undefined,
          latitude: finalLat ?? undefined,
          longitude: finalLng ?? undefined,
          address: geo,
          locationChanged,
          decision,
          linkToIncidentPublicId,
        });
        if (res.requiresDecision) {
          setCandidates(res.duplicateCandidates ?? []);
          setStep("duplicate");
          return;
        }
        setResult({ incident: res.incident, linked: res.linked });
        setStep("success");
      } catch (err) {
        toast({
          title: "Submission failed",
          description: err instanceof ApiError ? err.message : "Please try again.",
          variant: "destructive",
        });
      } finally {
        setSubmitting(false);
      }
    },
    [analysis, reportId, categoryOverride, description, finalLat, finalLng, geo, locationChanged, toast]
  );

  const resetWizard = useCallback(() => {
    setStep("photo");
    setFile(null);
    setFileUrl(null);
    setSampleKey(null);
    setSamplePath(null);
    setIdempotencyKey(crypto.randomUUID());
    setGpsState("idle");
    setCaptureLat(null);
    setCaptureLng(null);
    setFinalLat(null);
    setFinalLng(null);
    setGeo(null);
    setDescription("");
    setAnalysis(null);
    setReportId(null);
    setReportPublicId(null);
    setCategoryOverride(null);
    setEditing(false);
    setCandidates([]);
    setResult(null);
  }, []);

  const hasPhoto = Boolean(file || samplePath);
  const activeCategoryKey = categoryOverride ?? analysis?.categoryKey ?? "other";
  const activeCategory = categories.find((c) => c.key === activeCategoryKey);
  const activeDepartment = departments.find((d) => d.key === (analysis?.departmentKey ?? activeCategory?.departmentKey));

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (searchQ.trim().length < 3) {
      setSearchHits([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      const hits = await searchLocations(searchQ.trim());
      setSearchHits(hits);
    }, 500);
  }, [searchQ]);

  if (!user) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
        <ScanSearch className="h-10 w-10 text-primary" />
        <p className="font-medium">Sign in to report an issue</p>
        <Button onClick={() => openAuth("report")}>Sign in</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-16 pt-6">
      {step !== "analyzing" && step !== "success" ? (
        <div className="mb-5">
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium uppercase tracking-wide">
              {step === "photo" && "Step 1 of 4 · Evidence"}
              {step === "location" && "Step 2 of 4 · Location"}
              {step === "details" && "Step 3 of 4 · Details"}
              {step === "review" && "Step 4 of 4 · AI review & verification"}
              {step === "duplicate" && "Duplicate check"}
            </span>
            {reportPublicId ? <span className="font-mono">{reportPublicId}</span> : null}
          </div>
          <Progress
            value={
              step === "photo" ? 8 : step === "location" ? 30 : step === "details" ? 52 : step === "review" ? 78 : 90
            }
            className="h-1.5"
          />
        </div>
      ) : null}

      {/* ---------------- STEP 1: PHOTO ---------------- */}
      {step === "photo" ? (
        <div className="space-y-5">
          <div>
            <h1 className="text-xl font-bold">What did you see?</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              A clear photo is all Civic India needs — our AI identifies genuine civic issues and rejects non-issues.
            </p>
          </div>

          {hasPhoto ? (
            <Card className="overflow-hidden">
              <div className="relative aspect-video bg-muted">
                {fileUrl ? (
                  <Photo src={fileUrl} alt="Your report photo preview" fill className="object-cover" />
                ) : samplePath ? (
                  <Photo src={samplePath} alt="Sample civic issue photo" fill className="object-cover" />
                ) : null}
                {sampleKey ? (
                  <span className="absolute left-2 top-2">
                    <DemoBadge />
                  </span>
                ) : null}
              </div>
              <CardContent className="flex items-center justify-between gap-2 p-3">
                <p className="text-xs text-muted-foreground">
                  {sampleKey
                    ? "Sample photo selected."
                    : `Photo ready · ${(file ? file.size / 1024 : 0).toFixed(0)} KB after compression`}
                </p>
                <Button variant="outline" size="sm" onClick={() => { setFile(null); setFileUrl(null); setSampleKey(null); setSamplePath(null); }}>
                  <RefreshCcw className="mr-1 h-3.5 w-3.5" /> Change
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors hover:border-primary/60 hover:bg-primary/5"
              >
                <Camera className="h-7 w-7 text-primary" />
                <span className="text-sm font-semibold">Take a photo</span>
                <span className="text-xs text-muted-foreground">Opens your camera</span>
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors hover:border-primary/60 hover:bg-primary/5"
              >
                <Upload className="h-7 w-7 text-primary" />
                <span className="text-sm font-semibold">Upload photo</span>
                <span className="text-xs text-muted-foreground">JPEG / PNG / WebP</span>
              </button>
            </div>
          )}

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            aria-label="Take a photo with camera"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onPhotoChosen(f);
              e.target.value = "";
            }}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            aria-label="Upload a photo"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onPhotoChosen(f);
              e.target.value = "";
            }}
          />

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <ImagePlus className="h-3.5 w-3.5" /> Demo options:
            </p>
            <div className="cl-scroll -mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
              {samples.map((s) => (
                <button
                  key={s.key}
                  onClick={() => pickSample(s.key, s.path)}
                  className={cn(
                    "group relative w-24 shrink-0 overflow-hidden rounded-lg border-2 transition-all",
                    sampleKey === s.key ? "border-primary ring-2 ring-primary/30" : "border-transparent hover:border-primary/50"
                  )}
                  aria-label={`Use sample photo: ${s.label}`}
                >
                  <span className="block aspect-square">
                    <Photo src={s.path} alt={`${s.label} sample`} width={96} height={96} className="h-full w-full object-cover" />
                  </span>
                  <span className="block bg-background/90 px-1 py-1 text-[11px] font-medium leading-tight">{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          {analyzeError ? (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{analyzeError}</span>
            </div>
          ) : null}

          <Button className="h-12 w-full text-base" size="lg" disabled={!hasPhoto} onClick={() => setStep("location")}>
            Next: Location <ChevronDown className="ml-1 h-4 w-4 -rotate-90" />
          </Button>
        </div>
      ) : null}

      {/* ---------------- STEP 2: LOCATION ---------------- */}
      {step === "location" ? (
        <div className="space-y-5">
          <div>
            <h1 className="text-xl font-bold">Where is the issue?</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Location is used only to place this report and route it to the right authority.
            </p>
          </div>

          {gpsState === "locating" ? (
            <div className="flex items-center gap-3 rounded-xl border p-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <div className="text-sm">
                <p className="font-medium">Capturing GPS location…</p>
                <p className="text-muted-foreground">Allow location access when prompted.</p>
              </div>
            </div>
          ) : null}

          {gpsState === "ok" ? (
            <div className="flex items-start gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              <div className="min-w-0 text-sm">
                <p className="font-semibold text-emerald-800 dark:text-emerald-300">GPS location captured</p>
                {geoLoading ? (
                  <p className="text-emerald-700 dark:text-emerald-400">Looking up address…</p>
                ) : geo ? (
                  <p className="text-emerald-700 dark:text-emerald-400">{geo.display}</p>
                ) : (
                  <p className="text-emerald-700 dark:text-emerald-400">
                    Coordinates: {finalLat?.toFixed(5)}, {finalLng?.toFixed(5)}
                  </p>
                )}
              </div>
            </div>
          ) : null}

          {gpsState === "denied" ? (
            <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
              <div className="flex items-start gap-2 text-sm">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div>
                  <p className="font-semibold text-amber-800 dark:text-amber-300">Location permission unavailable</p>
                  <p className="text-amber-700 dark:text-amber-400">
                    Search for a place or tap the map to position manually.
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={requestGps}>
                <LocateFixed className="mr-1 h-3.5 w-3.5" /> Try GPS again
              </Button>
            </div>
          ) : null}

          {finalLat != null && finalLng != null ? (
            <div className="space-y-2">
              <LocationPicker latitude={finalLat} longitude={finalLng} onPick={onManualLocation} />
              <p className="text-center text-xs text-muted-foreground">
                <MapPin className="mr-1 inline h-3 w-3" />
                Drag pin or tap map to adjust · {finalLat.toFixed(5)}, {finalLng.toFixed(5)}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  className="h-11 w-full rounded-xl border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Search a place…"
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                />
              </div>
              {searchHits.length > 0 ? (
                <ul className="cl-scroll max-h-48 divide-y overflow-y-auto rounded-xl border">
                  {searchHits.map((h, i) => (
                    <li key={i}>
                      <button
                        className="w-full px-3 py-2.5 text-left text-sm hover:bg-accent"
                        onClick={() => {
                          setFinalLat(h.lat);
                          setFinalLng(h.lng);
                          setCaptureLat(h.lat);
                          setCaptureLng(h.lng);
                          setCaptureTimestamp(new Date().toISOString());
                          void applyGeocode(h.lat, h.lng);
                        }}
                      >
                        {h.display}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {INDIAN_CITIES.map((c) => (
                  <Button
                    key={c.city}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFinalLat(c.lat);
                      setFinalLng(c.lng);
                      setCaptureLat(c.lat);
                      setCaptureLng(c.lng);
                      setCaptureTimestamp(new Date().toISOString());
                      setGeo({ display: `${c.city}, ${c.state}`, city: c.city, state: c.state });
                    }}
                  >
                    {c.city}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" className="h-12 flex-1" onClick={() => setStep("photo")}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Back
            </Button>
            <Button className="h-12 flex-[2] text-base" size="lg" disabled={finalLat == null} onClick={() => setStep("details")}>
              Next: Details
            </Button>
          </div>
        </div>
      ) : null}

      {/* ---------------- STEP 3: DETAILS ---------------- */}
      {step === "details" ? (
        <div className="space-y-5">
          <div>
            <h1 className="text-xl font-bold">Anything to add?</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Optional description to help authorities inspect and verify.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cl-desc">Description (optional)</Label>
            <Textarea
              id="cl-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Deep pothole right before the traffic turn, hazardous for two-wheelers…"
              rows={4}
              maxLength={600}
            />
            <p className="text-right text-xs text-muted-foreground">{description.length}/600</p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="h-12 flex-1" onClick={() => setStep("location")}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Back
            </Button>
            <Button className="h-12 flex-[2] text-base" size="lg" disabled={submitting} onClick={() => void runAnalysis()}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Analyze with AI
            </Button>
          </div>
        </div>
      ) : null}

      {/* ---------------- ANALYZING ---------------- */}
      {step === "analyzing" ? (
        <div className="flex flex-col items-center gap-6 py-10">
          <div className="relative">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="h-10 w-10 animate-pulse text-primary" />
            </div>
            <span className="absolute inset-0 animate-ping rounded-full border border-primary/30" aria-hidden />
          </div>
          <div className="w-full max-w-sm space-y-3">
            {ANALYSIS_STAGES.map((stage, i) => (
              <div
                key={stage}
                className={cn(
                  "flex items-center gap-3 text-sm transition-opacity",
                  i < stageIndex ? "opacity-70" : i === stageIndex ? "opacity-100" : "opacity-30"
                )}
              >
                {i < stageIndex ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                ) : i === stageIndex ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                ) : (
                  <span className="h-4 w-4 shrink-0 rounded-full border-2 border-dashed" />
                )}
                <span className={cn(i === stageIndex && "cl-stage-active font-medium")}>{stage}</span>
              </div>
            ))}
          </div>
          <p className="max-w-xs text-center text-xs text-muted-foreground">
            Verifying image legitimacy and safety hazards...
          </p>
        </div>
      ) : null}

      {/* ---------------- STEP 4: REVIEW & STRICT VERIFICATION ---------------- */}
      {step === "review" && analysis ? (
        <div className="space-y-5">
          {/* CASE A: AI REJECTED (NON-CIVIC) */}
          {!analysis.isCivicIssue ? (
            <div className="space-y-4">
              <div className="rounded-2xl border-2 border-destructive/40 bg-destructive/10 p-5 text-destructive dark:bg-destructive/20">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="mt-0.5 h-7 w-7 shrink-0 text-destructive" />
                  <div>
                    <h2 className="text-lg font-bold text-destructive">Submission Blocked: Non-Civic Image Detected</h2>
                    <p className="mt-1 text-sm leading-relaxed text-destructive/90">
                      Our Vision AI verified that this image does not depict a genuine civic infrastructure defect (e.g. pothole, garbage dump, broken streetlight, or water leakage).
                    </p>
                  </div>
                </div>
                {analysis.reasoning ? (
                  <div className="mt-3 rounded-lg border border-destructive/20 bg-background/80 p-3 text-xs text-foreground">
                    <span className="font-semibold">AI Inspection Verdict: </span>
                    {analysis.reasoning}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <Button className="h-12 w-full text-base font-semibold" onClick={resetWizard}>
                  <Camera className="mr-2 h-4 w-4" /> Take a Photo of a Real Civic Issue
                </Button>
                <Button variant="outline" className="h-10 w-full" onClick={() => setStep("photo")}>
                  <ChevronLeft className="mr-1 h-4 w-4" /> Go Back to Upload Step
                </Button>
              </div>
            </div>
          ) : (
            /* CASE B: GENUINE CIVIC ISSUE */
            <>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="gap-1 border-emerald-500/40 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      <CheckCircle2 className="h-3 w-3" /> VERIFIED CIVIC DEFECT
                    </Badge>
                  </div>
                  <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold">
                    <CategoryIcon categoryKey={activeCategoryKey} className="h-6 w-6 text-primary" />
                    {activeCategory?.label ?? "Civic issue"}
                  </h1>
                </div>
                <SeverityBadge severity={analysis.severity} />
              </div>

              <Card>
                <CardContent className="space-y-4 p-5">
                  <div>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">AI Confidence</span>
                      <span className="font-bold">{Math.round(analysis.confidence * 100)}%</span>
                    </div>
                    <Progress value={analysis.confidence * 100} className="h-2" />
                  </div>

                  {analysis.hazards.length > 0 ? (
                    <div>
                      <p className="mb-2 text-sm font-medium">Detected hazards</p>
                      <div className="flex flex-wrap gap-1.5">
                        {analysis.hazards.map((h) => (
                          <HazardChip key={h} hazard={h} />
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="grid gap-3 text-sm sm:grid-cols-2">
                    <div className="rounded-lg bg-muted/60 p-3">
                      <p className="text-xs text-muted-foreground">Target Department</p>
                      <p className="mt-0.5 font-semibold">{activeDepartment?.name ?? "General Municipal"}</p>
                    </div>
                    <div className="rounded-lg bg-muted/60 p-3">
                      <p className="text-xs text-muted-foreground">Action Recommended</p>
                      <p className="mt-0.5 font-semibold">{analysis.recommendedAction}</p>
                    </div>
                  </div>

                  <p className="text-sm leading-relaxed">
                    <span className="font-medium">AI Analysis: </span>
                    {analysis.description}
                  </p>

                  {analysis.reasoning ? (
                    <Collapsible>
                      <CollapsibleTrigger className="flex items-center gap-1 text-xs font-medium text-primary">
                        <ChevronDown className="h-3.5 w-3.5" /> Technical reasoning
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2 rounded-lg bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
                        {analysis.reasoning}
                      </CollapsibleContent>
                    </Collapsible>
                  ) : null}
                </CardContent>
              </Card>

              {editing ? (
                <Card className="border-primary/40">
                  <CardContent className="space-y-3 p-4">
                    <p className="flex items-center gap-1.5 text-sm font-semibold">
                      <Pencil className="h-4 w-4 text-primary" /> Edit category
                    </p>
                    <div>
                      <Select value={activeCategoryKey} onValueChange={setCategoryOverride}>
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="Choose category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((c) => (
                            <SelectItem key={c.key} value={c.key}>
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Button variant="ghost" size="sm" className="text-primary" onClick={() => setEditing(true)}>
                  <Pencil className="mr-1 h-3.5 w-3.5" /> Change category
                </Button>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="h-12 flex-1"
                  onClick={() => setStep("details")}
                  disabled={submitting}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" /> Back
                </Button>
                <Button className="h-12 flex-[2] text-base font-semibold" size="lg" disabled={submitting} onClick={() => void doSubmit()}>
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                  Submit Verified Report
                </Button>
              </div>
            </>
          )}
        </div>
      ) : null}

      {/* ---------------- DUPLICATE DECISION ---------------- */}
      {step === "duplicate" ? (
        <div className="space-y-5">
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
            <p className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
              <MapPinned className="h-4 w-4" /> POSSIBLE EXISTING INCIDENT
            </p>
            <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
              Nearby citizens have already reported what looks like the same problem. Link your report to
              strengthen the existing incident, or create a separate one if this is a different spot.
            </p>
          </div>

          <div className="space-y-3">
            {candidates.map((c) => (
              <Card key={c.publicId} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-bold">{c.publicId}</span>
                    <Badge variant="outline">{c.categoryLabel ?? c.categoryKey}</Badge>
                    <PriorityBadge priority={c.priority} />
                    <Badge variant="secondary">{c.status.replace("_", " ")}</Badge>
                  </div>
                  <div className="mt-2 grid gap-x-4 gap-y-1 text-sm text-muted-foreground sm:grid-cols-2">
                    <p>
                      <MapPin className="mr-1 inline h-3.5 w-3.5" />
                      {formatDistance(c.distanceMeters)} away · {c.city ?? "your area"}
                    </p>
                    <p>{c.reportCount} citizen report{c.reportCount > 1 ? "s" : ""}</p>
                    <p className="sm:col-span-2">{c.address ?? "Location unavailable"}</p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" disabled={submitting} onClick={() => void doSubmit("link", c.publicId)}>
                      <Plus className="mr-1 h-3.5 w-3.5" /> Link my report
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setView({ name: "incident", publicId: c.publicId })}>
                      View incident
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Button variant="outline" className="h-11 w-full" disabled={submitting} onClick={() => void doSubmit("new")}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            This is a different problem — create a new incident
          </Button>
        </div>
      ) : null}

      {/* ---------------- SUCCESS ---------------- */}
      {step === "success" && result ? (
        <div className="space-y-6 py-4">
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950">
              <CheckCircle2 className="h-9 w-9 text-emerald-600" />
            </span>
            <h1 className="text-2xl font-bold">Report submitted</h1>
            <p className="max-w-sm text-sm text-muted-foreground">
              {result.linked
                ? "Your report was linked to an existing incident — you are now one of its citizen confirmations."
                : "A new incident was created, prioritized and routed to the responsible department."}
            </p>
          </div>

          <Card className="border-2">
            <CardContent className="space-y-4 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-lg font-bold">{result.incident.publicId}</span>
                <div className="flex items-center gap-2">
                  <PriorityBadge priority={result.incident.priority} />
                </div>
              </div>
              <p className="font-semibold">{result.incident.title ?? result.incident.categoryLabel}</p>
              <div className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
                <p>
                  <span className="text-muted-foreground">Issue: </span>
                  {result.incident.categoryLabel ?? result.incident.categoryKey}
                </p>
                <p>
                  <span className="text-muted-foreground">Location: </span>
                  {locationLine(result.incident)}
                </p>
                <p>
                  <span className="text-muted-foreground">Department: </span>
                  {result.incident.departmentName ?? "General Municipal"}
                </p>
                <p>
                  <span className="text-muted-foreground">Citizen reports: </span>
                  {result.incident.reportCount}
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-2 sm:grid-cols-3">
            <Button className="h-11" onClick={() => setView({ name: "incident", publicId: result.incident.publicId })}>
              Track Report
            </Button>
            <Button variant="outline" className="h-11" onClick={() => setView({ name: "explore", focus: result.incident.publicId })}>
              <MapPinned className="mr-1 h-4 w-4" /> View on Map
            </Button>
            <Button variant="outline" className="h-11" onClick={resetWizard}>
              <Camera className="mr-1 h-4 w-4" /> Report Another
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}