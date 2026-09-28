// CivicLens — lightweight observability.
// Logs AI success/failure, processing time, duplicate detection, report creation, API errors.
// NEVER logs API keys, credentials or personal information.

type Level = "info" | "warn" | "error";
type Event =
  | "ai_success"
  | "ai_failure"
  | "ai_cached"
  | "duplicate_found"
  | "duplicate_none"
  | "report_created"
  | "incident_created"
  | "incident_linked"
  | "status_change"
  | "api_error"
  | "upload_rejected"
  | "geocode_result"
  | string;

const stamp = () => new Date().toISOString();

export const log = {
  info(event: Event, data?: Record<string, unknown>) {
    console.log(`[civiclens:${event}] ${stamp()}`, data ?? {});
  },
  warn(event: Event, data?: Record<string, unknown>) {
    console.warn(`[civiclens:${event}] ${stamp()}`, data ?? {});
  },
  error(event: Event, data?: Record<string, unknown>) {
    console.error(`[civiclens:${event}] ${stamp()}`, data ?? {});
  },
};
