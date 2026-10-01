// CIVIC INDIA 2.0 — Federated Identity & Government SSO Service
// Pluggable identity abstraction for cross-portal single sign-on.
// Clearly labeled: SIMULATED GOVERNMENT FEDERATED SSO.

import "server-only";
import { db } from "@/lib/db";
import { log } from "./logger";
import { writeAuditLog } from "./audit-service";

export interface FederatedPersona {
  id: string;
  providerCode: string;
  providerName: string;
  subjectId: string;
  name: string;
  email: string;
  role: "CITIZEN" | "OFFICER" | "DEPARTMENT_ADMIN" | "GOVERNMENT_ADMIN" | "SYSTEM_ADMIN";
  department?: string;
  designation: string;
  jurisdiction: string;
  isSimulated: boolean;
}

export const DEMO_FEDERATED_PERSONAS: FederatedPersona[] = [
  {
    id: "fed-citizen-01",
    providerCode: "PARICHAY_SSO",
    providerName: "National Parichay Citizen SSO",
    subjectId: "GOV-IN-UID-882194",
    name: "Aarav Sharma",
    email: "aarav.sharma@demo.in",
    role: "CITIZEN",
    designation: "Verified Citizen Contributor",
    jurisdiction: "Alwar Municipality, Rajasthan",
    isSimulated: true,
  },
  {
    id: "fed-pwd-02",
    providerCode: "PWD_OFFICER_IDP",
    providerName: "State PWD Engineering Directorate SSO",
    subjectId: "PWD-RAJ-EMP-1092",
    name: "Er. Rajesh Gupta",
    email: "rajesh.gupta@pwd.rajasthan.gov.in",
    role: "OFFICER",
    department: "roads",
    designation: "Executive Engineer (PWD Division 2)",
    jurisdiction: "Alwar Highway Sub-Division",
    isSimulated: true,
  },
  {
    id: "fed-muni-03",
    providerCode: "MUNICIPAL_AUTH_IDP",
    providerName: "Municipal Urban Governance SSO",
    subjectId: "MUN-ALW-EMP-4011",
    name: "Sunil Verma",
    email: "sunil.verma@alwar.urban.gov.in",
    role: "DEPARTMENT_ADMIN",
    department: "sanitation",
    designation: "Chief Municipal Health & Sanitation Officer",
    jurisdiction: "Alwar City Central Zone",
    isSimulated: true,
  },
  {
    id: "fed-state-04",
    providerCode: "CENTRAL_GRIEVANCE_SSO",
    providerName: "State Grievance Monitoring Directorate SSO",
    subjectId: "RAJ-IAS-SEC-0091",
    name: "Dr. Meenakshi Sundaram, IAS",
    email: "meenakshi.sundaram@rajasthan.gov.in",
    role: "GOVERNMENT_ADMIN",
    department: "general",
    designation: "Joint Secretary (Public Grievance Oversight)",
    jurisdiction: "State of Rajasthan",
    isSimulated: true,
  },
];

/** Ensure demo federated identities exist in registry */
export async function ensureFederatedIdentities(): Promise<void> {
  for (const p of DEMO_FEDERATED_PERSONAS) {
    await db.federatedIdentity.upsert({
      where: {
        providerCode_subjectId: {
          providerCode: p.providerCode,
          subjectId: p.subjectId,
        },
      },
      update: {},
      create: {
        providerCode: p.providerCode,
        providerName: p.providerName,
        subjectId: p.subjectId,
        email: p.email,
        name: p.name,
        role: p.role,
        department: p.department ?? null,
        jurisdiction: p.jurisdiction,
        claims: JSON.stringify({
          designation: p.designation,
          iss: `https://auth.${p.providerCode.toLowerCase()}.gov.in`,
          aud: "civic-india-interoperability-layer",
          auth_time: Math.floor(Date.now() / 1000),
        }),
        isSimulated: true,
      },
    });
  }
}

/** Simulate a Federated SSO login */
export async function simulateFederatedLogin(subjectId: string) {
  await ensureFederatedIdentities();

  const identity = await db.federatedIdentity.findFirst({
    where: { subjectId },
  });

  if (!identity) {
    return { success: false, error: "Federated persona not found" };
  }

  await db.federatedIdentity.update({
    where: { id: identity.id },
    data: { lastLoginAt: new Date() },
  });

  await writeAuditLog({
    entityType: "SYSTEM",
    entityId: identity.id,
    action: "AUTHENTICATED",
    actorType: identity.role,
    actorName: identity.name,
    summary: `Federated SSO Session initiated via ${identity.providerName} for ${identity.name} (${identity.role}).`,
  });

  log.info("federated_sso_session_established", {
    provider: identity.providerCode,
    subject: identity.subjectId,
  });

  return {
    success: true,
    user: {
      id: identity.id,
      publicId: identity.subjectId,
      name: identity.name,
      email: identity.email,
      role: identity.role === "CITIZEN" ? "CITIZEN" : "ADMIN",
      department: identity.department,
      jurisdiction: identity.jurisdiction,
      providerName: identity.providerName,
    },
  };
}

/** Get list of demo federated personas for judges / review */
export async function getFederatedPersonas(): Promise<FederatedPersona[]> {
  await ensureFederatedIdentities();
  return DEMO_FEDERATED_PERSONAS;
}
