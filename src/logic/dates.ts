// 日付はローカル時刻の YYYY-MM-DD 文字列で扱う（toISOStringはUTCになり日付がずれるため使わない）
export const toDateString = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

export const parseDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

// 2/29の1年後は2/28にそろえる
export function addYears(value: string, years: number) {
  const date = parseDate(value)
  const target = new Date(date.getFullYear() + years, date.getMonth(), 1)
  target.setDate(Math.min(date.getDate(), daysInMonth(target)))
  return toDateString(target)
}

export const addDays = (value: string, days: number) => {
  const date = parseDate(value)
  date.setDate(date.getDate() + days)
  return toDateString(date)
}

export const daysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
