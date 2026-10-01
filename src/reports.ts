export const REPORT_TTL_MS = 6 * 60 * 60 * 1000
export const MAX_REPORTS_SHOWN = 20
export const REPORTS_LABEL = "รายงานจากประชาชน ยังไม่ยืนยัน"

export type Report = {
  id: string
  districtId: string
  landmark: string // after trim, used for display
  pointKey: string // pointKeyOf(districtId, landmark), never sent out
  depthCm: number
  seenAt: Date // clamped, never after receivedAt
  receivedAt: Date // internal only
}
// No ip, clientKey, phone, name, lat, lng on purpose (SEC-09 SEC-10)
// No expiresAt: expiresAtOf() derives it so it can never disagree with seenAt

export type ReportInput = { districtId: string; landmark: string; depthCm: number; seenAt: Date }

const SEEN_AT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/

/**
 * Thin version: still trusts districtId and depthCm.
 * Full checks (RPT-REQ-002 to 006) come in plan steps 5 to 7.
 */
export function parseReportInput(
  body: unknown,
  now: Date
): { ok: true; value: ReportInput } | { ok: false; fields: string[] } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return { ok: false, fields: ["body"] }
  const b = body as Record<string, unknown>
  const districtId = b.districtId
  const landmark = typeof b.landmark === "string" ? b.landmark.normalize("NFC").trim() : b.landmark
  const depthCm = b.depthCm
  const seenAt = b.seenAt === undefined ? now : parseSeenAt(b.seenAt)

  const fields: string[] = []
  if (typeof districtId !== "string") fields.push("districtId")
  if (typeof landmark !== "string") fields.push("landmark")
  if (typeof depthCm !== "number") fields.push("depthCm")
  if (seenAt === undefined) fields.push("seenAt")
  if (fields.length > 0) return { ok: false, fields }

  return {
    ok: true,
    value: {
      districtId: districtId as string,
      landmark: landmark as string,
      depthCm: depthCm as number,
      seenAt: new Date(Math.min(seenAt!.getTime(), now.getTime()))
    }
  }
}

function parseSeenAt(value: unknown): Date | undefined {
  if (typeof value !== "string" || !SEEN_AT_PATTERN.test(value)) return undefined
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? undefined : d
}

export function landmarkKey(landmark: string): string {
  return landmark
    .replace(/[​-‍﻿]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

export function pointKeyOf(districtId: string, landmark: string): string {
  return districtId + "\n" + landmarkKey(landmark)
}

export function expiresAtOf(report: Report): Date {
  return new Date(report.seenAt.getTime() + REPORT_TTL_MS)
}

/** RPT-REQ-011: filter by time, newest seenAt first, then cap. */
export function visibleReports(reports: Report[], now: Date): Report[] {
  const t = now.getTime()
  return reports
    .map((r, addOrder) => ({ r, addOrder }))
    .filter(({ r }) => r.receivedAt.getTime() <= t && t < expiresAtOf(r).getTime())
    .sort(
      (a, b) =>
        b.r.seenAt.getTime() - a.r.seenAt.getTime() ||
        b.r.receivedAt.getTime() - a.r.receivedAt.getTime() ||
        b.addOrder - a.addOrder
    )
    .slice(0, MAX_REPORTS_SHOWN)
    .map(({ r }) => r)
}
