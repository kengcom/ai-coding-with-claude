import { randomUUID } from "node:crypto"
import { districts } from "./districts.ts"
import type { Limiter } from "./limiter.ts"
import { expiresAtOf, parseReportInput, pointKeyOf, REPORTS_LABEL, visibleReports, type Report } from "./reports.ts"
import { latestReading, stationsIn } from "./stations.ts"
import type { ReportStore } from "./store.ts"
import { toBangkokIso } from "./time.ts"

export type Response = { status: number; body: unknown }

export type Context = {
  now: Date
  reports?: ReportStore
  limiter?: Limiter
  clientKey?: string // from clientKeyOf(req) only
}

export const NOTICE = "ตัวอย่างเพื่อการเรียนเท่านั้น ไม่ใช่ประกาศเตือนภัยทางการ ข้อมูลเป็นข้อมูลสมมติ"

/** Route one request. Kept free of node:http so it is easy to test. */
export function handle(method: string, path: string, body: unknown, ctx: Context = { now: new Date() }): Response {
  if (method === "GET" && path === "/districts") {
    return { status: 200, body: { notice: NOTICE, districts: [...districts.values()] } }
  }

  const districtMatch = path.match(/^\/districts\/([a-z-]+)$/)
  if (method === "GET" && districtMatch) {
    const district = districts.get(districtMatch[1] ?? "")
    if (!district) return { status: 404, body: { error: "unknown district" } }
    const stations = stationsIn(district.id).map((s) => {
      const latest = latestReading(s, ctx.now)
      return {
        id: s.id,
        nameTh: s.nameTh,
        latest: latest ? { at: toBangkokIso(latest.at), levelCm: latest.levelCm } : null
      }
    })
    const items = visibleReports(ctx.reports?.inDistrict(district.id) ?? [], ctx.now).map(reportJson)
    const reports = { verified: false, label: REPORTS_LABEL, items }
    return { status: 200, body: { notice: NOTICE, district, stations, reports } }
  }

  if (method === "POST" && path === "/reports") return postReport(body, ctx)

  return { status: 404, body: { error: "not found" } }
}

function postReport(body: unknown, ctx: Context): Response {
  const { reports: store, limiter, now } = ctx
  if (!store || !limiter) return { status: 500, body: { error: "reports not configured" } }
  const clientKey = ctx.clientKey ?? "unknown"
  if (!limiter.hit(clientKey, now)) return { status: 429, body: { error: "too many reports" } }

  const input = parseReportInput(body, now)
  if (!input.ok) return { status: 400, body: { error: "invalid report", fields: input.fields } }

  const { districtId, landmark, depthCm, seenAt } = input.value
  const pointKey = pointKeyOf(districtId, landmark)
  const report: Report = { id: randomUUID(), districtId, landmark, pointKey, depthCm, seenAt, receivedAt: now }

  const previousId = limiter.previous(clientKey, pointKey, now)
  if (previousId !== undefined) store.remove(previousId)
  store.add(report, now)
  limiter.remember(clientKey, pointKey, report.id, expiresAtOf(report), now)

  return { status: 201, body: { notice: NOTICE, report: reportJson(report) } }
}

/** The one place a report becomes JSON. Picks fields one by one so internal ones never leak. */
function reportJson(r: Report) {
  return { id: r.id, landmark: r.landmark, depthCm: r.depthCm, seenAt: toBangkokIso(r.seenAt), verified: false }
}
