"use client";

// CivicLens — global client state (zustand): session, view routing, config, notifications.

import { create } from "zustand";
import type {
  CategoryConfig,
  DepartmentConfig,
  NotificationDTO,
  SessionUser,
} from "@/lib/civiclens/types";
import { DEFAULT_CATEGORIES, DEFAULT_DEPARTMENTS, SAMPLE_PHOTOS } from "@/lib/civiclens/constants";

export type AdminTab = "dashboard" | "incidents" | "map" | "analytics";

export type View =
  | { name: "landing" }
  | { name: "explore"; focus?: string }
  | { name: "report" }
  | { name: "citizen" }
  | { name: "incident"; publicId: string }
  | { name: "admin"; tab: AdminTab };

interface CivicLensState {
  booted: boolean;
  user: SessionUser | null;
  view: View;
  prevView: View | null;
  categories: CategoryConfig[];
  departments: DepartmentConfig[];
  samples: { key: string; path: string; label: string }[];
  duplicateRadiusMeters: number;
  notifications: NotificationDTO[];
  unreadCount: number;
  authOpen: boolean;
  authIntent: "report" | "dashboard" | "admin" | null;

  boot: () => Promise<void>;
  setView: (v: View) => void;
  goBack: () => void;
  openAuth: (intent?: "report" | "dashboard" | "admin") => void;
  closeAuth: () => void;
  login: (role: "CITIZEN" | "ADMIN", name: string, city?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  markNotificationsRead: () => Promise<void>;
  refreshConfig: () => Promise<void>;
}

export const useCivicLens = create<CivicLensState>((set, get) => ({
  booted: false,
  user: null,
  view: { name: "landing" },
  prevView: null,
  categories: DEFAULT_CATEGORIES,
  departments: DEFAULT_DEPARTMENTS,
  samples: SAMPLE_PHOTOS.map((s) => ({ key: s.key, path: s.path, label: s.label })),
  duplicateRadiusMeters: 150,
  notifications: [],
  unreadCount: 0,
  authOpen: false,
  authIntent: null,

  boot: async () => {
    await Promise.all([get().refreshConfig(), get().refreshNotifications()]);
    try {
      const res = await fetch("/api/auth/me");
      const data = (await res.json()) as { user: SessionUser | null };
      set({ user: data.user, booted: true });
    } catch {
      set({ booted: true });
    }
  },

  setView: (v) => set((s) => ({ view: v, prevView: s.view })),

  goBack: () => {
    const prev = get().prevView;
    set({ view: prev ?? { name: "landing" }, prevView: null });
  },

  openAuth: (intent) => set({ authOpen: true, authIntent: intent ?? null }),
  closeAuth: () => set({ authOpen: false, authIntent: null }),

  login: async (role, name, city) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, name, city }),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(err.error ?? "Login failed");
    }
    const data = (await res.json()) as { user: SessionUser };
    const intent = get().authIntent; // capture BEFORE clearing state
    set({ user: data.user, authOpen: false, authIntent: null });
    await get().refreshNotifications();
    if (role === "ADMIN") set({ view: { name: "admin", tab: "dashboard" } });
    else if (intent === "report") set({ view: { name: "report" } });
    else set({ view: { name: "citizen" } });
  },

  logout: async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    set({ user: null, notifications: [], unreadCount: 0, view: { name: "landing" }, prevView: null });
  },

  refreshNotifications: async () => {
    const { user } = get();
    if (!user) return;
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = (await res.json()) as { notifications: NotificationDTO[]; unreadCount: number };
      set({ notifications: data.notifications, unreadCount: data.unreadCount });
    } catch {
      // silent — polling
    }
  },

  markNotificationsRead: async () => {
    const { user } = get();
    if (!user) return;
    await fetch("/api/notifications", { method: "PATCH" }).catch(() => {});
    set((s) => ({
      unreadCount: 0,
      notifications: s.notifications.map((n) => ({ ...n, isRead: true })),
    }));
  },

  refreshConfig: async () => {
    try {
      const res = await fetch("/api/config");
      if (!res.ok) return;
      const data = (await res.json()) as {
        categories: CategoryConfig[];
        departments: DepartmentConfig[];
        samples: { key: string; path: string; label: string }[];
        duplicateRadiusMeters: number;
      };
      set({
        categories: data.categories,
        departments: data.departments,
        samples: data.samples,
        duplicateRadiusMeters: data.duplicateRadiusMeters,
      });
    } catch {
      // keep bundled defaults
    }
  },
}));
