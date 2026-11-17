// MOCK: 監視システムとの連携はない。出力は時刻から作る晴天時の発電カーブ、アラームは固定の筋書き。
import type { MonitoringStatus, Site } from '../types'
import { seededRandom } from './seed'

const alerts: Record<string, { level: MonitoringStatus['level']; alert: string; minutesAgo: number; outputRatio: number }> = {
  'S-05': { level: '要対応', alert: 'PCS-4 停止（系統過電圧）', minutesAgo: 42, outputRatio: 8 / 9 },
  'S-08': { level: '要確認', alert: '発電量低下（前日同時刻比 −18%）', minutesAgo: 190, outputRatio: 0.82 },
}

// 6時〜18時の正弦カーブ。夜間は0kW。
const daylightRatio = (now: Date) => {
  const hour = now.getHours() + now.getMinutes() / 60
  return hour <= 6 || hour >= 18 ? 0 : Math.sin(Math.PI * (hour - 6) / 12)
}

export function monitoringSnapshot(sites: Site[], now = new Date()): MonitoringStatus[] {
  const daylight = daylightRatio(now)
  return sites.map(site => {
    const scripted = alerts[site.siteId]
    const variation = 0.78 + seededRandom(site.siteId)() * 0.1
    const outputKw = Math.round(site.capacityKw * daylight * variation * (scripted?.outputRatio ?? 1) * 10) / 10
    return { siteId: site.siteId, outputKw, level: scripted?.level ?? '正常', alert: scripted?.alert ?? null, alertAt: scripted ? new Date(now.getTime() - scripted.minutesAgo * 60_000).toISOString() : null }
  })
}
