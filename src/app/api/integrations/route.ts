// CIVIC INDIA 2.0 — Government Integration Hub & Interoperability API
import { NextRequest } from "next/server";
import {
  ensureGovernmentSystems,
  getIntegrationHealth,
  getIntegrationLogs,
  ingestExternalComplaint,
  runHealthChecks,
} from "@/lib/services/integration-service";
import { executeInteroperabilityDemo } from "@/lib/services/interoperability-demo-service";
import { getIntegrationFailures, quarantineRecord, executeManualRetry } from "@/lib/services/retry-service";

export async function GET(req: NextRequest) {
  try {
    await ensureGovernmentSystems();
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    if (action === "health-check") {
      await runHealthChecks();
      return Response.json({ ok: true, message: "Health checks completed" });
    }

    if (action === "logs") {
      const systemId = searchParams.get("systemId") ?? undefined;
      const success = searchParams.get("success");
      const logs = await getIntegrationLogs({
        systemId,
        success: success === "true" ? true : success === "false" ? false : undefined,
        limit: Number(searchParams.get("limit") ?? 50),
      });
      return Response.json({ logs });
    }

    if (action === "failures") {
      const status = searchParams.get("status") ?? undefined;
      const failures = await getIntegrationFailures({ status, limit: 50 });
      return Response.json(failures);
    }

    const health = await getIntegrationHealth();
    return Response.json(health);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    // Action 1: Execute One-Click 15-Step Interoperability Demo
    if (action === "demo") {
      const demoResult = await executeInteroperabilityDemo();
      return Response.json({ ok: true, demo: demoResult });
    }

    // Action 2: Quarantine a failed toxic record
    if (action === "quarantine") {
      const body = await req.json();
      const { id, reason } = body;
      if (!id) return Response.json({ error: "id is required" }, { status: 400 });
      const record = await quarantineRecord(id, reason || "Manual Quarantine by Authority");
      return Response.json({ ok: true, record });
    }

    // Action 2b: Manual Retry for an item in the failed queue
    if (action === "retry") {
      const body = await req.json();
      const { id } = body;
      if (!id) return Response.json({ error: "id is required" }, { status: 400 });
      const retryResult = await executeManualRetry(id);
      return Response.json({ ok: retryResult.success, ...retryResult }, { status: retryResult.success ? 200 : 400 });
    }

    // Action 3: Send Test Record or Ingest
    const body = await req.json();
    const { systemCode, complaintId, data } = body;

    if (!systemCode) {
      return Response.json(
        { error: "systemCode is required" },
        { status: 400 }
      );
    }

    // Default sample test records if data is omitted (for "Send Test Record" button)
    let payload = data;
    if (!payload || Object.keys(payload).length === 0) {
      if (systemCode === "MUN_PORTAL") {
        payload = {
          complaintId: `MUN-${Math.floor(1000 + Math.random() * 9000)}`,
          citizenName: "Aarav Sharma",
          issue: "Deep pothole filled with water near Railway Station Road, Alwar.",
          lat: 27.5548,
          lon: 76.6165,
          area: "Station Road, Alwar",
          type: "pothole",
          dateReported: new Date().toISOString(),
          contact: "9829012345",
        };
      } else if (systemCode === "STATE_GRIEVANCE") {
        payload = {
          grievanceNo: `STATE-${Math.floor(5000 + Math.random() * 5000)}`,
          petitionerName: "Aarav Sharma",
          grievanceDescription: "Severe crater causing road block on Station Marg, Alwar district.",
          latitude: 27.5552,
          longitude: 76.6169,
          location: "Station Marg, Alwar",
          category: "Road Damage",
          filingDate: new Date().toISOString(),
        };
      } else if (systemCode === "PWD_SYSTEM") {
        payload = {
          workOrderId: `PWD-${Math.floor(3000 + Math.random() * 7000)}`,
          reporterName: "Field Team PWD",
          issueDescription: "Asphalt failure on Railway Station Rd section.",
          gpsLat: 27.5545,
          gpsLng: 76.6162,
          siteLocation: "Railway Station Rd, Highway Division",
          issueType: "Pavement Breakdown",
          reportDate: new Date().toISOString(),
        };
      } else if (systemCode === "SANITATION_DEPT") {
        payload = {
          ticketId: `SAN-${Math.floor(2000 + Math.random() * 8000)}`,
          complainant: "Resident",
          details: "Overflowing commercial garbage pile on main market road.",
          lat: 27.5548,
          lng: 76.6165,
          ward: "Ward 4, Alwar",
          loggedAt: new Date().toISOString(),
        };
      } else {
        payload = {
          referenceNo: `WTR-${Math.floor(1000 + Math.random() * 9000)}`,
          consumerName: "Local Resident",
          complaint: "Underground water pipeline leak flooding road edge.",
          latitude: 27.5548,
          longitude: 76.6165,
          area: "Station Road, Alwar",
          dateLogged: new Date().toISOString(),
        };
      }
    }

    const result = await ingestExternalComplaint({
      systemCode,
      complaintId: complaintId || payload.complaintId || payload.grievanceNo || payload.workOrderId || payload.ticketId || payload.referenceNo,
      data: payload,
    });

    if (!result.success) {
      return Response.json({ error: result.error, result: result.result }, { status: 400 });
    }

    return Response.json({
      ok: true,
      message: "Complaint ingested and processed successfully through interoperability pipeline",
      result: result.result,
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
