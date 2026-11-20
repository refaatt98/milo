import { createClient } from '@supabase/supabase-js'

/*
 * Public client config. The anon key is designed to ship in browsers:
 * every table is protected by row-level security (see supabase/migrations).
 * Override with VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY if you move projects.
 */
export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? 'https://utnwueefzsbfjfidmyou.supabase.co'
export const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0bnd1ZWVmenNiZmpmaWRteW91Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNjYxMDksImV4cCI6MjA4OTg0MjEwOX0.N2nzlSkoCTEHEDd3SsH4dxzycNOffQUlU7gcnX8l2HA'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  db: { schema: 'milonote' },
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'milonote-auth' },
})

export interface Profile {
  id: string
  email: string
  name: string
  role: 'user' | 'admin'
  ui_mode: 'playful' | 'serious'
  created_at: string
  last_seen_at: string
}

const SIGNUP_ERRORS: Record<string, string> = {
  invalid_email: 'الإيميل مش صحيح.',
  weak_password: 'كلمة السر لازم تكون 8 أحرف على الأقل.',
  name_required: 'اكتب اسمك.',
  email_exists: 'في حساب بهاد الإيميل. جرّب تسجّل دخول.',
}

export async function signUp(name: string, email: string, password: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/milonote-signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify({ name, email, password }),
  }).catch(() => null)
  if (!res) throw new Error('ما قدرنا نوصل للسيرفر. تأكد من الإنترنت.')
  const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
  if (!res.ok || !body.ok) throw new Error(SIGNUP_ERRORS[body.error ?? ''] ?? 'صار خطأ بالتسجيل، جرّب كمان مرة.')
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error('انعمل الحساب بس ما قدرنا نسجّل دخول. جرّب من صفحة الدخول.')
}

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
  if (error) throw new Error(/invalid/i.test(error.message) ? 'الإيميل أو كلمة السر غلط.' : 'ما قدرنا نسجّل دخول. تأكد من الإنترنت.')
}
