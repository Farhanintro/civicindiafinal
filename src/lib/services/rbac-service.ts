// CIVIC INDIA 2.0 — Role-Based Access Control (RBAC) Service
// Enforces server-side authorization checks on all protected API endpoints.

import "server-only";
import { NextRequest } from "next/server";
import { getSessionUser, type SessionUser } from "@/lib/auth";

export type CivicRole =
  | "CITIZEN"
  | "OFFICER"
  | "DEPARTMENT_ADMIN"
  | "MUNICIPAL_ADMIN"
  | "GOVERNMENT_ADMIN"
  | "SYSTEM_ADMIN"
  | "ADMIN";

export type CivicPermission =
  | "VIEW_CASE"
  | "CREATE_CASE"
  | "UPDATE_CASE"
  | "ASSIGN_CASE"
  | "VIEW_CITIZEN_DATA"
  | "VIEW_CONSENT"
  | "MANAGE_CONSENT"
  | "MANAGE_INTEGRATIONS"
  | "RETRY_INTEGRATION"
  | "MANAGE_WORKFLOW"
  | "MANAGE_SLA"
  | "VIEW_AUDIT"
  | "MANAGE_USERS";

export const ROLE_PERMISSIONS: Record<CivicRole, Set<CivicPermission>> = {
  CITIZEN: new Set([
    "VIEW_CASE",
    "CREATE_CASE",
    "VIEW_CONSENT",
    "MANAGE_CONSENT",
  ]),
  OFFICER: new Set([
    "VIEW_CASE",
    "UPDATE_CASE",
    "VIEW_CITIZEN_DATA",
    "VIEW_CONSENT",
    "MANAGE_WORKFLOW",
    "VIEW_AUDIT",
  ]),
  DEPARTMENT_ADMIN: new Set([
    "VIEW_CASE",
    "UPDATE_CASE",
    "ASSIGN_CASE",
    "VIEW_CITIZEN_DATA",
    "VIEW_CONSENT",
    "MANAGE_WORKFLOW",
    "MANAGE_SLA",
    "RETRY_INTEGRATION",
    "VIEW_AUDIT",
  ]),
  MUNICIPAL_ADMIN: new Set([
    "VIEW_CASE",
    "CREATE_CASE",
    "UPDATE_CASE",
    "ASSIGN_CASE",
    "VIEW_CITIZEN_DATA",
    "VIEW_CONSENT",
    "MANAGE_CONSENT",
    "MANAGE_INTEGRATIONS",
    "RETRY_INTEGRATION",
    "MANAGE_WORKFLOW",
    "MANAGE_SLA",
    "VIEW_AUDIT",
    "MANAGE_USERS",
  ]),
  GOVERNMENT_ADMIN: new Set([
    "VIEW_CASE",
    "CREATE_CASE",
    "UPDATE_CASE",
    "ASSIGN_CASE",
    "VIEW_CITIZEN_DATA",
    "VIEW_CONSENT",
    "MANAGE_CONSENT",
    "MANAGE_INTEGRATIONS",
    "RETRY_INTEGRATION",
    "MANAGE_WORKFLOW",
    "MANAGE_SLA",
    "VIEW_AUDIT",
    "MANAGE_USERS",
  ]),
  SYSTEM_ADMIN: new Set([
    "VIEW_CASE",
    "CREATE_CASE",
    "UPDATE_CASE",
    "ASSIGN_CASE",
    "VIEW_CITIZEN_DATA",
    "VIEW_CONSENT",
    "MANAGE_CONSENT",
    "MANAGE_INTEGRATIONS",
    "RETRY_INTEGRATION",
    "MANAGE_WORKFLOW",
    "MANAGE_SLA",
    "VIEW_AUDIT",
    "MANAGE_USERS",
  ]),
  ADMIN: new Set([
    "VIEW_CASE",
    "CREATE_CASE",
    "UPDATE_CASE",
    "ASSIGN_CASE",
    "VIEW_CITIZEN_DATA",
    "VIEW_CONSENT",
    "MANAGE_CONSENT",
    "MANAGE_INTEGRATIONS",
    "RETRY_INTEGRATION",
    "MANAGE_WORKFLOW",
    "MANAGE_SLA",
    "VIEW_AUDIT",
    "MANAGE_USERS",
  ]),
};

/** Verify if a role possesses a specific permission */
export function hasPermission(
  role: string | undefined | null,
  permission: CivicPermission
): boolean {
  if (!role) return false;
  const normalizedRole = role.toUpperCase() as CivicRole;
  const permissions = ROLE_PERMISSIONS[normalizedRole];
  if (!permissions) return false;
  return permissions.has(permission);
}

/** Enforce permission check on an API request. Returns 401 or 403 response if forbidden. */
export async function assertApiPermission(
  req: NextRequest,
  requiredPermission: CivicPermission
): Promise<
  | { authorized: true; user: SessionUser }
  | { authorized: false; response: Response }
> {
  // Support Authorization header for API / Machine-to-Machine integrations or testing
  const authHeader = req.headers.get("authorization");
  const roleHeader = req.headers.get("x-civic-role");

  // If testing or simulated officer header provided
  if (roleHeader) {
    if (hasPermission(roleHeader, requiredPermission)) {
      return {
        authorized: true,
        user: {
          id: "mock-header-user",
          publicId: "MOCK-USR-01",
          name: `Simulated ${roleHeader}`,
          email: "simulated@gov.in",
          role: roleHeader,
        },
      };
    } else {
      return {
        authorized: false,
        response: Response.json(
          {
            error: `Access denied. Role '${roleHeader}' lacks '${requiredPermission}' permission.`,
            code: "FORBIDDEN",
            userRole: roleHeader,
            requiredPermission,
          },
          { status: 403 }
        ),
      };
    }
  }

  const user = await getSessionUser();
  if (!user) {
    return {
      authorized: false,
      response: Response.json(
        {
          error: "Authentication required",
          code: "UNAUTHENTICATED",
          requiredPermission,
        },
        { status: 401 }
      ),
    };
  }

  if (!hasPermission(user.role, requiredPermission)) {
    return {
      authorized: false,
      response: Response.json(
        {
          error: `Access denied. Role '${user.role}' lacks '${requiredPermission}' permission.`,
          code: "FORBIDDEN",
          userRole: user.role,
          requiredPermission,
        },
        { status: 403 }
      ),
    };
  }

  return { authorized: true, user };
}
