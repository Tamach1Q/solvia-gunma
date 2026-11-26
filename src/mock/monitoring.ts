// MOCK: 監視システムとの連携はない。出力は時刻から作る晴天時の発電カーブ、アラームは固定の筋書き。
import type { MonitoringDetection, MonitoringStatus, Site } from '../types'
import { seededRandom } from './seed'

const detections: Record<string, Omit<MonitoringDetection, 'detectedAt'> & { minutesAgo: number; outputRatio: number }> = {
  'S-05': { source: '監視アラーム', text: 'PCS-4 停止（系統過電圧）', needsReview: false, minutesAgo: 42, outputRatio: 8 / 9 },
  'S-08': { source: '発電データ', text: '発電量低下の兆候（前日同時刻比 −18%）', needsReview: true, minutesAgo: 190, outputRatio: 0.82 },
}

const operatingStates: Record<string, MonitoringStatus['state']> = { 'S-05': '異常停止中' }

// 6時〜18時の正弦カーブ。夜間は0kW。
const daylightRatio = (now: Date) => {
  const hour = now.getHours() + now.getMinutes() / 60
  return hour <= 6 || hour >= 18 ? 0 : Math.sin(Math.PI * (hour - 6) / 12)
}

export function monitoringSnapshot(sites: Site[], now = new Date()): MonitoringStatus[] {
  const daylight = daylightRatio(now)
  return sites.map(site => {
    const scripted = detections[site.siteId]
    const variation = 0.78 + seededRandom(site.siteId)() * 0.1
    const outputKw = Math.round(site.capacityKw * daylight * variation * (scripted?.outputRatio ?? 1) * 10) / 10
    const detection = scripted && { source: scripted.source, text: scripted.text, needsReview: scripted.needsReview, detectedAt: new Date(now.getTime() - scripted.minutesAgo * 60_000).toISOString() }
    return { siteId: site.siteId, outputKw, state: operatingStates[site.siteId], detection }
  })
}
