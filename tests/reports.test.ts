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
