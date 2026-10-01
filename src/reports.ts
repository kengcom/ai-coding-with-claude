/** How long a report stays visible, counted from seenAt (RPT-REQ-008). */
export const REPORT_TTL_MS = 6 * 60 * 60 * 1000

/** A citizen report. Deliberately has no ip, clientKey, phone, name, lat or lng (SEC-09 SEC-10). */
export type Report = {
  id: string
  districtId: string
  landmark: string
  depthCm: number
  seenAt: Date
  receivedAt: Date
}

export type ReportInput = { districtId: string; landmark: string; depthCm: number; seenAt: Date }

export function parseReportInput(body: unknown, now: Date): { ok: true; value: ReportInput } | { ok: false; fields: string[] } {
  // Tracer bullet: trusts the body and uses now as seenAt. Real checks come in plan steps 5 to 7.
  const b = body as ReportInput
  return { ok: true, value: { districtId: b.districtId, landmark: b.landmark, depthCm: b.depthCm, seenAt: now } }
}
