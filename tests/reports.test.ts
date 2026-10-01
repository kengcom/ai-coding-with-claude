import { beforeEach, describe, expect, it } from "vitest"
import { handle } from "../src/app.ts"
import { createLimiter, type Limiter } from "../src/limiter.ts"
import { createMemoryStore, type ReportStore } from "../src/store.ts"

const now = new Date("2026-09-30T12:30:00Z")
const A = "203.0.113.7"
const B = "198.51.100.1"

const SEC = 1000
const HOUR = 60 * 60 * SEC
const at = (ms: number) => new Date(now.getTime() + ms)

type Item = { id: string; landmark: string; depthCm: number; seenAt: string; verified: boolean }

let reports: ReportStore
let limiter: Limiter

beforeEach(() => {
  reports = createMemoryStore()
  limiter = createLimiter()
})

function post(body: Record<string, unknown>, opts: { at?: Date; clientKey?: string } = {}) {
  const ctx = { now: opts.at ?? now, reports, limiter, clientKey: opts.clientKey ?? A }
  return handle("POST", "/reports", { districtId: "lat-phrao", landmark: "หน้าเซ็นทรัล", depthCm: 30, ...body }, ctx)
}

function items(when: Date, districtId = "lat-phrao"): Item[] {
  const res = handle("GET", `/districts/${districtId}`, undefined, { now: when, reports, limiter })
  return (res.body as { reports: { items: Item[] } }).reports.items
}

describe("RPT-REQ-013: คนเดิมส่งจุดเดิมซ้ำ ขณะรายงานเดิมยังไม่หมดอายุ", () => {
  it("รวมเป็นรายงานเดียว ความลึกเป็นค่าล่าสุด", () => {
    expect(post({ depthCm: 30 }).status).toBe(201)
    expect(post({ depthCm: 60 }).status).toBe(201)

    const got = items(now)
    expect(got).toHaveLength(1)
    expect(got[0]?.depthCm).toBe(60)
  })

  it("ส่งซ้ำตอน 5:59:59 หลังรายงานแรก ยังรวมเป็นรายงานเดิม", () => {
    post({ depthCm: 30 })
    post({ depthCm: 60 }, { at: at(6 * HOUR - SEC) })

    const got = items(at(6 * HOUR - SEC))
    expect(got).toHaveLength(1)
    expect(got[0]?.depthCm).toBe(60)
  })

  it("รายงานที่ส่งทีหลังชนะ แม้ seenAt เก่ากว่า และหายตาม seenAt ของรายงานใหม่", () => {
    post({ depthCm: 30, seenAt: "2026-09-30T12:20:00Z" })
    post({ depthCm: 10, seenAt: "2026-09-30T12:00:00Z" })

    const got = items(now)
    expect(got).toHaveLength(1)
    expect(got[0]?.depthCm).toBe(10)
    expect(items(new Date("2026-09-30T17:59:59Z"))).toHaveLength(1)
    expect(items(new Date("2026-09-30T18:00:00Z"))).toEqual([])
  })

  it("จุดสังเกตเขียนต่างกันแค่ตัวพิมพ์และช่องว่าง นับเป็นจุดเดียวกัน", () => {
    post({ landmark: "Central Ladprao" })
    post({ landmark: "  central   LADPRAO " })

    const got = items(now)
    expect(got).toHaveLength(1)
    expect(got[0]?.landmark).toBe("central   LADPRAO")
  })

  // ผลลบที่ถูกต้อง: spec ไม่รวมรายงานจากคนละ client key และไม่รวมข้ามเขต
  it("คนละคนส่งจุดเดียวกัน ไม่รวม", () => {
    post({ depthCm: 30 }, { clientKey: A })
    post({ depthCm: 60 }, { clientKey: B })

    expect(items(now)).toHaveLength(2)
  })

  it("คนเดิมส่งจุดเดียวกันคนละเขต ได้เขตละ 1 รายงาน", () => {
    post({ districtId: "lat-phrao" })
    post({ districtId: "chatuchak" })

    expect(items(now, "lat-phrao")).toHaveLength(1)
    expect(items(now, "chatuchak")).toHaveLength(1)
  })
})

describe("RPT-REQ-013: ส่งซ้ำตอนรายงานเดิมหมดอายุแล้ว เป็นรายงานใหม่", () => {
  it("ตัวจำกัดจำรายงานเดิมได้ถึงก่อนหมดอายุ 1 วินาที และลืมตั้งแต่วินาทีที่หมดอายุ", () => {
    const expiresAt = at(6 * HOUR)
    limiter.remember(A, "lat-phrao\nหน้าเซ็นทรัล", "report-1", expiresAt, now)

    expect(limiter.previous(A, "lat-phrao\nหน้าเซ็นทรัล", at(6 * HOUR - SEC))).toBe("report-1")
    expect(limiter.previous(A, "lat-phrao\nหน้าเซ็นทรัล", expiresAt)).toBeUndefined()
    expect(limiter.previous(A, "lat-phrao\nหน้าเซ็นทรัล", at(6 * HOUR + SEC))).toBeUndefined()
  })

  it("ส่งซ้ำตอน 6:00:01 ได้รายงานใหม่ id ใหม่ 1 รายงาน", () => {
    const first = post({ depthCm: 30 }).body as { report: Item }
    const second = post({ depthCm: 60 }, { at: at(6 * HOUR + SEC) }).body as { report: Item }

    expect(second.report.id).not.toBe(first.report.id)
    const got = items(at(6 * HOUR + SEC))
    expect(got).toHaveLength(1)
    expect(got[0]).toEqual(second.report)
  })
})

describe("RPT-REQ-011: รายงานหายเมื่อพ้น seenAt ล่าสุด + 6 ชั่วโมง", () => {
  it("ส่งตอน now เห็นที่ +5:59:59 ไม่เห็นที่ +6:00:00", () => {
    post({})

    expect(items(at(6 * HOUR - SEC))).toHaveLength(1)
    expect(items(at(6 * HOUR))).toEqual([])
  })

  it("นับจาก seenAt ไม่ใช่เวลาที่ได้รับ: seenAt = now − 1 ชม. เห็นที่ +4:59:59 ไม่เห็นที่ +5:00:00", () => {
    post({ seenAt: "2026-09-30T11:30:00Z" })

    expect(items(at(5 * HOUR - SEC))).toHaveLength(1)
    expect(items(at(5 * HOUR))).toEqual([])
  })

  it("คนเดิมยืนยันซ้ำตอน +3 ชม. อายุนับใหม่จากครั้งล่าสุด", () => {
    post({ depthCm: 30 })
    post({ depthCm: 40 }, { at: at(3 * HOUR) })

    expect(items(at(6 * HOUR))).toHaveLength(1)
    expect(items(at(9 * HOUR - SEC))).toHaveLength(1)
    expect(items(at(9 * HOUR))).toEqual([])
  })
})
