/** How long a report stays visible, counted from seenAt (intent Q2). */
export const REPORT_TTL_MS = 6 * 60 * 60 * 1000

/** At most this many reports per district, newest seenAt first (intent Q3). */
export const MAX_REPORTS_SHOWN = 20

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
  // Tracer bullet: trusts the body and uses now as seenAt. Real checks come in plan steps 4 to 6.
  const b = body as ReportInput
  return { ok: true, value: { districtId: b.districtId, landmark: b.landmark, depthCm: b.depthCm, seenAt: now } }
}

/** Reports received by now and not yet expired, newest seenAt first, capped at MAX_REPORTS_SHOWN. */
export function visibleReports(reports: Report[], now: Date): Report[] {
  const t = now.getTime()
  return reports
    .filter((r) => r.receivedAt.getTime() <= t && t < r.seenAt.getTime() + REPORT_TTL_MS)
    .sort((a, b) => b.seenAt.getTime() - a.seenAt.getTime())
    .slice(0, MAX_REPORTS_SHOWN)
}
