"use client";

// CivicLens — Leaflet maps (OpenStreetMap):
//  • IncidentMap: priority-coloured markers, lightweight grid clustering, rich popups
//  • LocationPicker: draggable/clickable pin for manual location adjustment
// Tiles degrade gracefully — if tiles fail, incident data still renders in lists.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { IncidentSummary } from "@/lib/civiclens/types";
import { PRIORITY_COLORS, PRIORITY_LABELS, STATUS_LABELS } from "@/lib/civiclens/constants";
import { Button } from "@/components/ui/button";

// ---------- marker helpers ----------

const PRIORITY_ORDER: Record<string, number> = { P1: 0, P2: 1, P3: 2, P4: 3 };

function pinIcon(color: string, label: string, pulse = false): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div class="cl-marker ${pulse ? "cl-marker-pulse" : ""}" style="--pin:${color};width:26px;height:26px"><span>${label}</span></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    popupAnchor: [0, -24],
  });
}

function clusterIcon(color: string, count: number, size: number): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div class="cl-cluster" style="--pin:${color};width:${size}px;height:${size}px">${count}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// ---------- clustering ----------

interface Cluster {
  lat: number;
  lng: number;
  incidents: IncidentSummary[];
}

function clusterIncidents(incidents: IncidentSummary[], zoom: number): Cluster[] {
  const cell = Math.min(3, Math.max(0.0015, Math.pow(2, 8 - zoom) * 0.5));
  const grid = new Map<string, Cluster>();
  for (const inc of incidents) {
    const key = `${Math.floor(inc.latitude / cell)}:${Math.floor(inc.longitude / cell)}`;
    const existing = grid.get(key);
    if (existing) {
      existing.incidents.push(inc);
      existing.lat = existing.incidents.reduce((s, i) => s + i.latitude, 0) / existing.incidents.length;
      existing.lng = existing.incidents.reduce((s, i) => s + i.longitude, 0) / existing.incidents.length;
    } else {
      grid.set(key, { lat: inc.latitude, lng: inc.longitude, incidents: [inc] });
    }
  }
  return [...grid.values()];
}

// ---------- map event bridges ----------

function ZoomTracker({ onZoom }: { onZoom: (z: number) => void }) {
  const map = useMapEvents({
    zoomend: () => onZoom(map.getZoom()),
  });
  return null;
}

function FlyToFocus({ focus, onArrived }: { focus: { lat: number; lng: number } | null; onArrived: () => void }) {
  const map = useMap();
  useEffect(() => {
    if (focus) {
      map.flyTo([focus.lat, focus.lng], Math.max(map.getZoom(), 16), { duration: 0.8 });
      onArrived();
    }
  }, [focus, map, onArrived]);
  return null;
}

function ClickCapture({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapBridge({ onReady }: { onReady: (map: L.Map) => void }) {
  const map = useMap();
  useEffect(() => {
    onReady(map);
  }, [map, onReady]);
  return null;
}

// ---------- incident popup ----------

function IncidentPopupContent({
  incident,
  onView,
}: {
  incident: IncidentSummary;
  onView: (publicId: string) => void;
}) {
  return (
    <div className="min-w-56 max-w-64">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs font-bold">{incident.publicId}</span>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
          style={{ backgroundColor: PRIORITY_COLORS[incident.priority] }}
        >
          {PRIORITY_LABELS[incident.priority]}
        </span>
      </div>
      <p className="mt-1 text-sm font-semibold leading-tight">
        {incident.title ?? incident.categoryLabel ?? "Civic issue"}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {STATUS_LABELS[incident.status]} · {incident.reportCount} report
        {incident.reportCount > 1 ? "s" : ""}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {incident.address ?? incident.city ?? "Location unavailable"}
      </p>
      <Button size="sm" className="mt-2 h-7 w-full text-xs" onClick={() => onView(incident.publicId)}>
        View details
      </Button>
    </div>
  );
}

// ---------- IncidentMap ----------

export interface IncidentMapProps {
  incidents: IncidentSummary[];
  onViewIncident?: (publicId: string) => void;
  focusPublicId?: string | null;
  center?: [number, number];
  zoom?: number;
  className?: string;
  cluster?: boolean;
}

export default function IncidentMap({
  incidents,
  onViewIncident,
  focusPublicId,
  center = [22.8, 79.6],
  zoom = 5,
  className = "h-full w-full",
  cluster = true,
}: IncidentMapProps) {
  const [currentZoom, setCurrentZoom] = useState(zoom);
  const [focus, setFocus] = useState<{ lat: number; lng: number } | null>(null);
  const [openPopup, setOpenPopup] = useState<string | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRefs = useRef<Record<string, L.Marker | null>>({});

  useEffect(() => {
    if (!focusPublicId) return;
    const inc = incidents.find((i) => i.publicId === focusPublicId);
    if (inc) {
      setFocus({ lat: inc.latitude, lng: inc.longitude });
      setOpenPopup(inc.publicId);
    }
  }, [focusPublicId, incidents]);

  useEffect(() => {
    if (openPopup) {
      window.setTimeout(() => markerRefs.current[openPopup]?.openPopup(), 850);
      setOpenPopup(null);
    }
  }, [openPopup]);

  const useClustering = cluster && currentZoom < 13;
  const clusters = useMemo(
    () => (useClustering ? clusterIncidents(incidents, currentZoom) : []),
    [incidents, currentZoom, useClustering]
  );

  const view = (publicId: string) => onViewIncident?.(publicId);

  return (
    <div className={className} role="application" aria-label="Incident map">
      <MapContainer center={center} zoom={zoom} className="h-full w-full" scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <ZoomTracker onZoom={setCurrentZoom} />
        <FlyToFocus focus={focus} onArrived={() => setFocus(null)} />
        <MapBridge onReady={(m) => (mapRef.current = m)} />

        {useClustering
          ? clusters.map((c, idx) => {
              const worst = [...c.incidents].sort(
                (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
              )[0];
              const size = Math.min(52, 34 + c.incidents.length * 2);
              return (
                <Marker
                  key={`c-${idx}-${c.lat.toFixed(4)}-${c.lng.toFixed(4)}`}
                  position={[c.lat, c.lng]}
                  icon={clusterIcon(PRIORITY_COLORS[worst.priority], c.incidents.length, size)}
                  eventHandlers={{
                    click: () => {
                      mapRef.current?.flyTo([c.lat, c.lng], Math.min(18, currentZoom + 3), { duration: 0.6 });
                    },
                  }}
                >
                  <Popup>
                    <div className="min-w-44">
                      <p className="text-sm font-semibold">{c.incidents.length} incidents in this area</p>
                      <p className="mt-1 text-xs text-muted-foreground">Zoom in to see individual reports.</p>
                    </div>
                  </Popup>
                </Marker>
              );
            })
          : incidents.map((inc) => (
              <Marker
                key={inc.id}
                position={[inc.latitude, inc.longitude]}
                icon={pinIcon(PRIORITY_COLORS[inc.priority], inc.reportCount > 1 ? String(inc.reportCount) : "")}
                ref={(m) => {
                  markerRefs.current[inc.publicId] = m;
                }}
              >
                <Popup autoPan>
                  <IncidentPopupContent incident={inc} onView={view} />
                </Popup>
              </Marker>
            ))}
      </MapContainer>
    </div>
  );
}

// ---------- LocationPicker (report wizard) ----------

export interface LocationPickerProps {
  latitude: number;
  longitude: number;
  onPick: (lat: number, lng: number) => void;
  className?: string;
}

export function LocationPicker({ latitude, longitude, onPick, className }: LocationPickerProps) {
  const icon = useMemo(
    () => pinIcon("#0f766e", "", true),
    []
  );
  return (
    <div className={className ?? "h-64 w-full"} role="application" aria-label="Choose report location">
      <MapContainer
        center={[latitude, longitude]}
        zoom={16}
        className="h-full w-full rounded-xl border"
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <ClickCapture onPick={onPick} />
        <Marker
          position={[latitude, longitude]}
          icon={icon}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const m = e.target as L.Marker;
              const pos = m.getLatLng();
              onPick(pos.lat, pos.lng);
            },
          }}
        >
          <Popup>
            <div className="text-xs">
              <p className="font-semibold">Report location</p>
              <p className="mt-0.5 text-muted-foreground">
                Drag the pin or tap the map to fine-tune.
              </p>
              <p className="mt-1 font-mono">
                {latitude.toFixed(5)}, {longitude.toFixed(5)}
              </p>
            </div>
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
