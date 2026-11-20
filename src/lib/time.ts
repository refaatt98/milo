/**
 * Time helpers. Every "day" in milo. is a calendar day in Asia/Hebron,
 * regardless of the device's own time zone.
 */
export const TZ = 'Asia/Hebron'

const partsFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

interface LocalParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

export function localParts(ts: number): LocalParts {
  const p: Record<string, string> = {}
  for (const part of partsFmt.formatToParts(new Date(ts))) p[part.type] = part.value
  return {
    year: +p.year,
    month: +p.month,
    day: +p.day,
    hour: +p.hour % 24,
    minute: +p.minute,
    second: +p.second,
  }
}

/** YYYY-MM-DD in Asia/Hebron */
export function dayKey(ts: number = Date.now()): string {
  const p = localParts(ts)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

function msSinceLocalMidnight(ts: number): number {
  const p = localParts(ts)
  return ((p.hour * 60 + p.minute) * 60 + p.second) * 1000 + (ts % 1000 + 1000) % 1000
}

/** UTC timestamp of the local (Hebron) midnight that starts the day containing ts. */
export function startOfLocalDay(ts: number): number {
  let s = ts - msSinceLocalMidnight(ts)
  // Correct once for a DST transition inside the day.
  const drift = msSinceLocalMidnight(s)
  if (drift !== 0) s = drift > 12 * 3600e3 ? s + (86400e3 - drift) : s - drift
  return s
}

/** UTC timestamp of the next local midnight after ts. */
export function nextLocalMidnight(ts: number): number {
  return startOfLocalDay(startOfLocalDay(ts) + 26 * 3600e3)
}

/** UTC timestamp for a local wall-clock time on a given dayKey. */
export function localTimeOn(key: string, hh = 0, mm = 0): number {
  const [y, m, d] = key.split('-').map(Number)
  // start with the UTC guess, then correct for offset
  let guess = Date.UTC(y, m - 1, d, hh, mm)
  for (let i = 0; i < 2; i++) {
    const p = localParts(guess)
    const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
    guess += Date.UTC(y, m - 1, d, hh, mm) - asUTC
  }
  return guess
}

export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return dt.toISOString().slice(0, 10)
}

export function daysBetween(a: string, b: string): number {
  const [y1, m1, d1] = a.split('-').map(Number)
  const [y2, m2, d2] = b.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400e3)
}

/** Minutes since local midnight (Hebron) */
export function localMinutes(ts: number = Date.now()): number {
  const p = localParts(ts)
  return p.hour * 60 + p.minute
}

const AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
const AR_WEEKDAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

export function formatDayLong(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return `${AR_WEEKDAYS[wd]} ${d} ${AR_MONTHS[m - 1]}`
}

export function formatDayShort(key: string): string {
  const [, m, d] = key.split('-').map(Number)
  return `${d} ${AR_MONTHS[m - 1]}`
}

export function weekdayName(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  return AR_WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
}

export function formatClock(ts: number): string {
  const p = localParts(ts)
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`
}

/** 01:23:45 */
export function formatHMS(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function arHours(h: number) {
  if (h === 1) return 'ساعة'
  if (h === 2) return 'ساعتين'
  if (h <= 10) return `${h} ساعات`
  return `${h} ساعة`
}
function arMinutes(m: number) {
  if (m === 1) return 'دقيقة'
  if (m === 2) return 'دقيقتين'
  if (m <= 10) return `${m} دقايق`
  return `${m} دقيقة`
}

/**
 * "3 ساعات و39 دقيقة". Wrapped in Unicode right-to-left isolates so it reads
 * correctly even inside left-to-right number styling (which used to scramble it).
 */
export function formatDuration(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60000))
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  let text: string
  if (h === 0) text = m === 0 ? 'أقل من دقيقة' : arMinutes(m)
  else if (m === 0) text = arHours(h)
  else text = `${arHours(h)} و${arMinutes(m)}`
  return `\u2067${text}\u2069`
}

export function hours(ms: number, digits = 1): string {
  return (ms / 3600e3).toFixed(digits)
}

export function parseHHMM(s: string): number {
  const [h, m] = s.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}
