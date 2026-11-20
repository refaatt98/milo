/** Free translation via MyMemory (no key; ~5000 chars/day per user). Text leaves the device. */
export const LANGS: { code: string; label: string }[] = [
  { code: 'ar', label: 'عربي' },
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'he', label: 'עברית' },
  { code: 'zh-CN', label: '中文' },
]

export async function translate(text: string, to: string): Promise<string> {
  const q = text.trim().slice(0, 500)
  if (!q) return ''
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}&langpair=${encodeURIComponent(`autodetect|${to}`)}`
  const res = await fetch(url).catch(() => null)
  if (!res || !res.ok) throw new Error('ما قدرنا نوصل لخدمة الترجمة. تأكد من الإنترنت.')
  const body = (await res.json()) as { responseData?: { translatedText?: string }; quotaFinished?: boolean; responseStatus?: number }
  if (body.quotaFinished) throw new Error('خلصت ترجمات اليوم المجانية. جرّب بكرا.')
  const out = body.responseData?.translatedText
  if (!out || body.responseStatus === 403) throw new Error('ما زبطت الترجمة، جرّب نص ثاني.')
  const t = document.createElement('textarea')
  t.innerHTML = out // decode HTML entities
  return t.value
}
