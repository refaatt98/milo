// Hands out short-lived presigned URLs for Cloudflare R2 so photos upload and
// download straight between the browser and R2. The R2 keys stay server-side
// (Supabase secrets); each user can only touch keys under their own folder.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import { AwsClient } from 'npm:aws4fetch@1.0.20'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const aws = new AwsClient({
  accessKeyId: Deno.env.get('MILONOTE_R2_ACCESS_KEY_ID')!,
  secretAccessKey: Deno.env.get('MILONOTE_R2_SECRET_ACCESS_KEY')!,
  service: 's3',
  region: 'auto',
})
const BASE = `${Deno.env.get('MILONOTE_R2_ENDPOINT')}/${Deno.env.get('MILONOTE_R2_BUCKET')}`
const MAX_BYTES = 25 * 1024 * 1024
const KEY_RE = /^[0-9a-f-]{36}\/[0-9a-zA-Z-]{8,64}\.[a-z0-9]{1,5}$/

async function presign(method: 'GET' | 'PUT', key: string, seconds: number, contentType?: string) {
  const url = new URL(`${BASE}/${key}`)
  url.searchParams.set('X-Amz-Expires', String(seconds))
  const req = await aws.sign(new Request(url, { method, headers: contentType ? { 'Content-Type': contentType } : {} }), {
    aws: { signQuery: true },
  })
  return req.url
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false } })
  const { data: u } = await sb.auth.getUser(token)
  const uid = u.user?.id
  if (!uid) return json({ error: 'auth' }, 401)

  let body: { action?: string; key?: string; keys?: string[]; contentType?: string; size?: number }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'bad_json' }, 400)
  }
  const own = (k: unknown): k is string => typeof k === 'string' && KEY_RE.test(k) && k.startsWith(`${uid}/`)

  if (body.action === 'put') {
    if (!own(body.key)) return json({ error: 'key' }, 403)
    const type = String(body.contentType ?? '')
    if (!/^image\/(jpeg|png|webp|gif|heic)$/.test(type)) return json({ error: 'type' }, 400)
    if (!(Number(body.size) > 0 && Number(body.size) <= MAX_BYTES)) return json({ error: 'size' }, 400)
    return json({ url: await presign('PUT', body.key, 600, type) })
  }
  if (body.action === 'get') {
    if (!own(body.key)) return json({ error: 'key' }, 403)
    return json({ url: await presign('GET', body.key, 3600) })
  }
  if (body.action === 'delete') {
    const keys = (body.keys ?? []).filter(own).slice(0, 100)
    await Promise.all(keys.map((k) => aws.fetch(`${BASE}/${k}`, { method: 'DELETE' })))
    return json({ deleted: keys.length })
  }
  return json({ error: 'action' }, 400)
})
