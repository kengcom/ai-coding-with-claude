import { randomUUID } from "node:crypto"
import { districts } from "./districts.ts"
import { parseReportInput, type Report } from "./reports.ts"
import { latestReading, stationsIn } from "./stations.ts"
import type { ReportStore } from "./store.ts"
import { toBangkokIso } from "./time.ts"

export type Response = { status: number; body: unknown }

export type Context = {
  now: Date
  reports?: ReportStore
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
    return { status: 200, body: { notice: NOTICE, district, stations } }
  }

  if (method === "POST" && path === "/reports") return postReport(body, ctx)

  return { status: 404, body: { error: "not found" } }
}

function postReport(body: unknown, ctx: Context): Response {
  const store = ctx.reports
  if (!store) return { status: 500, body: { error: "reports not configured" } }

  const parsed = parseReportInput(body, ctx.now)
  if (!parsed.ok) return { status: 400, body: { error: "invalid report", fields: parsed.fields } }

  const report: Report = { id: randomUUID(), ...parsed.value, receivedAt: ctx.now }
  store.add(report, ctx.now)
  return { status: 201, body: { notice: NOTICE, report: reportJson(report) } }
}

/** Pick fields one by one so internal fields (receivedAt) never leak into the API. */
function reportJson(r: Report) {
  return {
    id: r.id,
    landmark: r.landmark,
    depthCm: r.depthCm,
    seenAt: toBangkokIso(r.seenAt),
    verified: false
  }
}
