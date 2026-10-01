import type { Report } from "./reports.ts"

export interface ReportStore {
  add(report: Report, now: Date): void
  /** Every report still in the store; groupReports filters by time. */
  inDistrict(districtId: string): Report[]
}

/** Reports live in memory only: a restart loses them (persistence is out of scope). */
export function createMemoryStore(): ReportStore {
  const reports: Report[] = []
  return {
    add(report) {
      reports.push(report)
    },
    inDistrict(districtId) {
      return reports.filter((r) => r.districtId === districtId)
    }
  }
}
