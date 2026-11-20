// Creates a confirmed MiloNote account + profile without changing the
// project's shared email-confirmation settings.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  let body: { email?: string; password?: string; name?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'bad_json' }, 400)
  }
  const email = String(body.email ?? '').trim().toLowerCase()
  const password = String(body.password ?? '')
  const name = String(body.name ?? '').trim().slice(0, 60)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json({ error: 'invalid_email' }, 400)
  if (password.length < 8 || password.length > 72) return json({ error: 'weak_password' }, 400)
  if (!name) return json({ error: 'name_required' }, 400)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
    db: { schema: 'milonote' },
  })
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, app: 'milonote' },
  })
  if (error) {
    const exists = /already|registered|exists/i.test(error.message)
    return json({ error: exists ? 'email_exists' : 'signup_failed' }, exists ? 409 : 400)
  }
  const { error: pErr } = await admin.from('profiles').insert({ id: data.user.id, email, name })
  if (pErr) return json({ error: 'profile_failed' }, 500)
  return json({ ok: true })
})
