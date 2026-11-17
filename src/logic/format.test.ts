import { describe, expect, it } from 'vitest'
import { formatDate, formatDateTime, formatDateWithWeekday, formatMonth, formatNumber, formatQuantity, formatShortDate, formatTime } from './format'

const today = new Date(2026, 9, 28, 15, 0)

describe('format', () => {
  it('数値は桁区切りあり・小数は最大2桁、単位は数値に続けて書く', () => {
    expect(formatNumber(2000)).toBe('2,000')
    expect(formatNumber(0.3)).toBe('0.3')
    expect(formatNumber(12.345)).toBe('12.35')
    expect(formatQuantity(49.5, 'kW')).toBe('49.5kW')
    expect(formatQuantity(1532, 'V')).toBe('1,532V')
    expect(formatNumber(20, 1)).toBe('20.0')
    expect(formatQuantity(49.5, 'kW', 1)).toBe('49.5kW')
  })
  it('日付', () => {
    expect(formatDate('2026-10-28')).toBe('2026年10月28日')
    expect(formatDateWithWeekday('2026-10-28')).toBe('2026年10月28日（水）')
    expect(formatMonth('2026-10-28')).toBe('2026年10月')
  })
  it('一覧の日付は今年なら年を省き、ほかの年は年を付ける', () => {
    expect(formatShortDate('2026-10-28', today)).toBe('10/28（水）')
    expect(formatShortDate('2027-10-23', today)).toBe('2027/10/23（土）')
  })
  it('時刻と日時', () => {
    const at = new Date(2026, 9, 28, 9, 5)
    expect(formatTime(at)).toBe('09:05')
    expect(formatDateTime(at, today)).toBe('10/28（水）09:05')
    expect(formatDateTime(at.toISOString(), today)).toBe('10/28（水）09:05')
  })
  it('YYYY-MM-DDはローカル日付として読む（UTCでずれない）', () => {
    expect(formatShortDate('2026-01-01', today)).toBe('1/1（木）')
  })
})
