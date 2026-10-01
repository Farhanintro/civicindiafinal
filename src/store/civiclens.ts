"use client";

import { create } from "zustand";
import { signIn, signOut } from "next-auth/react";

import type {
  CategoryConfig,
  DepartmentConfig,
  NotificationDTO,
  SessionUser,
} from "@/lib/civiclens/types";

import {
  DEFAULT_CATEGORIES,
  DEFAULT_DEPARTMENTS,
  SAMPLE_PHOTOS,
} from "@/lib/civiclens/constants";

export type AdminTab =
  | "dashboard"
  | "incidents"
  | "map"
  | "analytics"
  | "integrations"
  | "cases"
  | "data-quality"
  | "consent"
  | "master-data"
  | "failures"
  | "graph"
  | "insights"
  | "sla"
  | "audit";


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

  samples: {
    key: string;
    path: string;
    label: string;
  }[];

  duplicateRadiusMeters: number;

  notifications: NotificationDTO[];

  unreadCount: number;

  authOpen: boolean;

  authIntent:
    | "report"
    | "dashboard"
    | "admin"
    | null;

  boot: () => Promise<void>;

  setView: (v: View) => void;

  goBack: () => void;

  openAuth: (
    intent?: "report" | "dashboard" | "admin"
  ) => void;

  closeAuth: () => void;

  signin: (
    email: string,
    password: string
  ) => Promise<void>;

  signup: (
    name: string,
    email: string,
    password: string
  ) => Promise<void>;

  logout: () => Promise<void>;

  refreshNotifications: () => Promise<void>;

  markNotificationsRead: () => Promise<void>;

  refreshConfig: () => Promise<void>;
}

export const useCivicLens =
  create<CivicLensState>((set, get) => ({
    booted: false,

    user: null,

    view: {
      name: "landing",
    },

    prevView: null,

    categories: DEFAULT_CATEGORIES,

    departments: DEFAULT_DEPARTMENTS,

    samples: SAMPLE_PHOTOS.map((sample) => ({
      key: sample.key,
      path: sample.path,
      label: sample.label,
    })),

    duplicateRadiusMeters: 150,

    notifications: [],

    unreadCount: 0,

    authOpen: false,

    authIntent: null,

    /* =====================================================
       BOOT
    ===================================================== */

    boot: async () => {
      await Promise.all([
        get().refreshConfig(),
        get().refreshNotifications(),
      ]);

      try {
        const response =
          await fetch("/api/auth/me");

        const data =
          (await response.json()) as {
            user: SessionUser | null;
          };

        set({
          user: data.user,
          booted: true,
        });
      } catch {
        set({
          booted: true,
          user: null,
        });
      }
    },

    /* =====================================================
       NAVIGATION
    ===================================================== */

    setView: (view) =>
      set((state) => ({
        view,
        prevView: state.view,
      })),

    goBack: () => {
      const previous = get().prevView;

      set({
        view:
          previous ?? {
            name: "landing",
          },

        prevView: null,
      });
    },

    /* =====================================================
       AUTH UI
    ===================================================== */

    openAuth: (intent) =>
      set({
        authOpen: true,
        authIntent: intent ?? null,
      }),

    closeAuth: () =>
      set({
        authOpen: false,
        authIntent: null,
      }),

    /* =====================================================
       SIGN IN
    ===================================================== */

    signin: async (email, password) => {
      const result = await signIn(
        "credentials",
        {
          email: email
            .trim()
            .toLowerCase(),

          password,

          redirect: false,
        }
      );

      if (!result || result.error) {
        /*
         * NextAuth may return the provider error
         * or a generic CredentialsSignin error.
         */
        const errorMessage =
          result?.error ?? "";

        if (
          errorMessage.toLowerCase().includes(
            "verify"
          )
        ) {
          throw new Error(
            "Please verify your email address before signing in."
          );
        }

        throw new Error(
          "Invalid email or password."
        );
      }

      /*
       * Make sure the server actually sees
       * a valid authenticated session.
       */
      const meResponse =
        await fetch("/api/auth/me");

      if (!meResponse.ok) {
        throw new Error(
          "Could not load your account."
        );
      }

      const data =
        (await meResponse.json()) as {
          user: SessionUser | null;
        };

      if (!data.user) {
        throw new Error(
          "Your account could not be authenticated."
        );
      }

      const intent =
        get().authIntent;

      set({
        user: data.user,
        authOpen: false,
        authIntent: null,
      });

      await get().refreshNotifications();

      if (data.user.role === "ADMIN") {
        set({
          view: {
            name: "admin",
            tab: "dashboard",
          },
        });
      } else if (intent === "report") {
        set({
          view: {
            name: "report",
          },
        });
      } else {
        set({
          view: {
            name: "citizen",
          },
        });
      }
    },

    /* =====================================================
       SIGN UP
    ===================================================== */

    signup: async (
      name,
      email,
      password
    ) => {
      const response =
        await fetch(
          "/api/auth/register",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              name: name.trim(),

              email: email
                .trim()
                .toLowerCase(),

              password,
            }),
          }
        );

      const data =
        (await response
          .json()
          .catch(() => ({}))) as {
          error?: string;
          requiresVerification?: boolean;
        };

      if (!response.ok) {
        throw new Error(
          data.error ??
            "Sign up failed. Please try again."
        );
      }

      /*
       * IMPORTANT:
       *
       * Registration does NOT sign the user in.
       *
       * The user must click the verification
       * link first and then sign in.
       */
      if (data.requiresVerification) {
        return;
      }
    },

    /* =====================================================
       LOGOUT
    ===================================================== */

    logout: async () => {
      await signOut({
        redirect: false,
      });

      set({
        user: null,
        notifications: [],
        unreadCount: 0,

        view: {
          name: "landing",
        },

        prevView: null,
      });
    },

    /* =====================================================
       NOTIFICATIONS
    ===================================================== */

    refreshNotifications: async () => {
      const { user } = get();

      if (!user) {
        return;
      }

      try {
        const response =
          await fetch(
            "/api/notifications"
          );

        if (!response.ok) {
          return;
        }

        const data =
          (await response.json()) as {
            notifications: NotificationDTO[];
            unreadCount: number;
          };

        set({
          notifications:
            data.notifications,

          unreadCount:
            data.unreadCount,
        });
      } catch {
        // Silent polling failure.
      }
    },

    markNotificationsRead:
      async () => {
        const { user } = get();

        if (!user) {
          return;
        }

        await fetch(
          "/api/notifications",
          {
            method: "PATCH",
          }
        ).catch(() => {});

        set((state) => ({
          unreadCount: 0,

          notifications:
            state.notifications.map(
              (notification) => ({
                ...notification,
                isRead: true,
              })
            ),
        }));
      },

    /* =====================================================
       CONFIG
    ===================================================== */

    refreshConfig: async () => {
      try {
        const response =
          await fetch("/api/config");

        if (!response.ok) {
          return;
        }

        const data =
          (await response.json()) as {
            categories: CategoryConfig[];
            departments: DepartmentConfig[];

            samples: {
              key: string;
              path: string;
              label: string;
            }[];

            duplicateRadiusMeters: number;
          };

        set({
          categories:
            data.categories,

          departments:
            data.departments,

          samples:
            data.samples,

          duplicateRadiusMeters:
            data.duplicateRadiusMeters,
        });
      } catch {
        // Keep bundled defaults.
      }
    },
  }));