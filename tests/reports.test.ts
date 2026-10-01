import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest"
import { handle, NOTICE, type Context, type Response } from "../src/app.ts"
import { createMemoryStore } from "../src/store.ts"

const now = new Date("2026-09-30T12:30:00Z")
const clientKey = "203.0.113.7"
const validBody = { districtId: "lat-phrao", landmark: "หน้าเซ็นทรัลลาดพร้าว", depthCm: 30 }
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

let ctx: Context
let consoleSpies: MockInstance[]

beforeEach(() => {
  ctx = { now, reports: createMemoryStore() }
  consoleSpies = (["log", "info", "warn", "error"] as const).map((m) => vi.spyOn(console, m))
})

afterEach(() => {
  // RPT-REQ-015: nothing in this feature may log
  for (const spy of consoleSpies) expect(spy).not.toHaveBeenCalled()
  vi.restoreAllMocks()
})

/** Call handle() and check the response never carries the client's IP (RPT-REQ-015). */
function call(method: string, path: string, body: unknown, at: Date = now): Response {
  const res = handle(method, path, body, { ...ctx, now: at })
  expect(JSON.stringify(res)).not.toContain(clientKey)
  expect(JSON.stringify(res)).not.toContain("::/64")
  return res
}

describe("RPT-REQ-001: POST /reports", () => {
  it("stores a valid report and answers 201 with the notice", () => {
    const res = call("POST", "/reports", validBody)
    expect(res.status).toBe(201)
    const body = res.body as { notice: string; report: Record<string, unknown> }
    expect(body.notice).toBe(NOTICE)
    expect(body.report.id).toMatch(UUID_V4)
    // Intent Q7: the public shape only. receivedAt stays internal.
    expect(body.report).toEqual({
      id: body.report.id,
      landmark: "หน้าเซ็นทรัลลาดพร้าว",
      depthCm: 30,
      seenAt: "2026-09-30T19:30:00+07:00",
      verified: false
    })
  })

  it("answers 500 when no report store is configured", () => {
    const res = handle("POST", "/reports", validBody, { now })
    expect(res).toEqual({ status: 500, body: { error: "reports not configured" } })
  })
})

type DistrictBody = { stations: unknown[]; reports: Record<string, unknown>[] }

const minutes = (n: number) => new Date(now.getTime() + n * 60 * 1000)

function reportsAt(districtId: string, at: Date = now): Record<string, unknown>[] {
  const res = call("GET", `/districts/${districtId}`, undefined, at)
  expect(res.status).toBe(200)
  return (res.body as DistrictBody).reports
}

describe("GET /districts/:id shows reports (plan step 2)", () => {
  it("shows a report right after it is posted", () => {
    const posted = (call("POST", "/reports", validBody).body as { report: Record<string, unknown> }).report
    expect(reportsAt("lat-phrao")).toEqual([posted])
  })

  it("gives an empty list for a district with no reports", () => {
    expect(reportsAt("sai-mai")).toEqual([])
  })

  it("gives an empty list when no report store is configured", () => {
    const res = handle("GET", "/districts/lat-phrao", undefined, { now })
    expect((res.body as DistrictBody).reports).toEqual([])
  })

  it("leaves stations exactly as they were and keeps other districts' reports out", () => {
    const before = (call("GET", "/districts/lat-phrao", undefined).body as DistrictBody).stations
    call("POST", "/reports", validBody)
    call("POST", "/reports", { ...validBody, districtId: "chatuchak" })
    const res = call("GET", "/districts/lat-phrao", undefined).body as DistrictBody
    expect(res.stations).toEqual(before)
    expect(res.reports).toHaveLength(1)
  })

  it("shows only the public fields of each report", () => {
    call("POST", "/reports", validBody)
    expect(Object.keys(reportsAt("lat-phrao")[0] ?? {}).sort()).toEqual(["depthCm", "id", "landmark", "seenAt", "verified"])
  })

  it("hides a report 6 hours after seenAt", () => {
    call("POST", "/reports", validBody)
    expect(reportsAt("lat-phrao", new Date(now.getTime() + 6 * 60 * 60 * 1000 - 1000))).toHaveLength(1)
    expect(reportsAt("lat-phrao", new Date(now.getTime() + 6 * 60 * 60 * 1000))).toEqual([])
  })

  it("does not show a report before it was received", () => {
    call("POST", "/reports", validBody, minutes(10))
    expect(reportsAt("lat-phrao", minutes(9))).toEqual([])
  })

  it("shows at most the 20 newest reports, newest seenAt first", () => {
    for (let i = 0; i < 21; i++) call("POST", "/reports", { ...validBody, landmark: `จุด ${i}` }, minutes(i))
    const shown = reportsAt("lat-phrao", minutes(21))
    expect(shown).toHaveLength(20)
    expect(shown[0]?.landmark).toBe("จุด 20")
    expect(shown[19]?.landmark).toBe("จุด 1")
  })
})
