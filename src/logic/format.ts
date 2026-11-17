import { parseDate } from './dates'

// 表示用の書式はここに集約する（DESIGN.md「表記」）。画面で toLocaleString を直接呼ばない。
const weekdays = ['日', '月', '火', '水', '木', '金', '土']
const toDate = (value: string | Date) => typeof value === 'string' ? (/^\d{4}-\d{2}-\d{2}$/.test(value) ? parseDate(value) : new Date(value)) : value
const pad = (value: number) => String(value).padStart(2, '0')

// 桁区切りあり。既定は小数最大2桁（末尾の0は出さない）。列で桁をそろえたいときは fractionDigits で固定する。
export const formatNumber = (value: number, fractionDigits?: number) => value.toLocaleString('ja-JP', fractionDigits === undefined ? { maximumFractionDigits: 2 } : { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })

// 数値と単位の間は空けない（例：49.5kW、0.3MΩ、101V）
export const formatQuantity = (value: number, unit: string, fractionDigits?: number) => `${formatNumber(value, fractionDigits)}${unit}`

export const weekday = (value: string | Date) => `（${weekdays[toDate(value).getDay()]}）`

// 2026年10月28日
export const formatDate = (value: string | Date) => {
  const date = toDate(value)
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

// 2026年10月28日（水）
export const formatDateWithWeekday = (value: string | Date) => `${formatDate(value)}${weekday(value)}`

// 2026年10月
export const formatMonth = (value: string | Date) => {
  const date = toDate(value)
  return `${date.getFullYear()}年${date.getMonth() + 1}月`
}

// 表や一覧の日付：今年は「10/28（水）」、ほかの年は「2027/10/23（土）」
export const formatShortDate = (value: string | Date, today = new Date()) => {
  const date = toDate(value)
  const year = date.getFullYear() === today.getFullYear() ? '' : `${date.getFullYear()}/`
  return `${year}${date.getMonth() + 1}/${date.getDate()}${weekday(date)}`
}

// 14:35
export const formatTime = (value: string | Date) => {
  const date = toDate(value)
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// 10/28（水）14:35
export const formatDateTime = (value: string | Date, today = new Date()) => `${formatShortDate(value, today)}${formatTime(value)}`
