export const SEVERITY_MODERATE_CM = 20
export const SEVERITY_SEVERE_CM = 50
export const REPORT_TTL_MS = 3 * 60 * 60 * 1000

export type Severity = "minor" | "moderate" | "severe"

/** A citizen report. Deliberately has no ip, clientKey, phone, name, lat or lng (SEC-09 SEC-10). */
export type Report = {
  id: string
  districtId: string
  landmark: string
  depthCm: number
  observedAt: Date
  receivedAt: Date
  expiresAt: Date
}

export type ReportInput = { districtId: string; landmark: string; depthCm: number; observedAt: Date }

export function parseReportInput(body: unknown, now: Date): { ok: true; value: ReportInput } | { ok: false; fields: string[] } {
  // Tracer bullet: trusts the body. Real checks come with RPT-REQ-002 to 006.
  const b = body as ReportInput
  return { ok: true, value: { districtId: b.districtId, landmark: b.landmark, depthCm: b.depthCm, observedAt: now } }
}

export function severityOf(depthCm: number): Severity {
  if (depthCm >= SEVERITY_SEVERE_CM) return "severe"
  if (depthCm >= SEVERITY_MODERATE_CM) return "moderate"
  return "minor"
}
