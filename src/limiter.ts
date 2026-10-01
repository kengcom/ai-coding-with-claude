/** The only place in the system that holds client keys (SEC-10). */
export interface Limiter {
  /** true = accepted and counted · false = over quota, not counted */
  hit(clientKey: string, now: Date): boolean
  previous(clientKey: string, pointKey: string, now: Date): string | undefined
  remember(clientKey: string, pointKey: string, reportId: string, expiresAt: Date, now: Date): void
}

export function createLimiter(): Limiter {
  const lastReport = new Map<string, { reportId: string; expiresAt: Date }>()
  return {
    // Quota (RPT-REQ-012) comes in plan step 8
    hit: () => true,
    previous(clientKey, pointKey, now) {
      const entry = lastReport.get(clientKey + "\n" + pointKey)
      return entry && now < entry.expiresAt ? entry.reportId : undefined
    },
    remember(clientKey, pointKey, reportId, expiresAt) {
      lastReport.set(clientKey + "\n" + pointKey, { reportId, expiresAt })
    }
  }
}
