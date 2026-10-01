import type { Report } from "./reports.ts"

export interface ReportStore {
  add(report: Report, now: Date): void
  remove(id: string): void
  /** Every report still held, in add order. visibleReports does the time filtering. */
  inDistrict(districtId: string): Report[]
}

export function createMemoryStore(): ReportStore {
  let reports: Report[] = []
  return {
    add(report) {
      reports.push(report)
    },
    remove(id) {
      reports = reports.filter((r) => r.id !== id)
    },
    inDistrict(districtId) {
      return reports.filter((r) => r.districtId === districtId)
    }
  }
}
