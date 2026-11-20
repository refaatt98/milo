import { supabase } from './supabase'

/*
 * Photos live in Cloudflare R2. The browser never sees the R2 keys: the
 * `milonote-r2` edge function signs short-lived URLs, only for the signed-in
 * user's own folder, and the bytes go directly between the browser and R2.
 */
async function sign(body: Record<string, unknown>): Promise<string> {
  const { data, error } = await supabase.functions.invoke('milonote-r2', { body })
  if (error || !data?.url) throw new Error('r2-sign')
  return data.url as string
}

export async function r2Upload(key: string, blob: Blob, contentType: string) {
  const url = await sign({ action: 'put', key, contentType, size: blob.size })
  const res = await fetch(url, { method: 'PUT', body: blob, headers: { 'Content-Type': contentType } })
  if (!res.ok) throw new Error(`r2-put ${res.status}`)
}

export async function r2Download(key: string): Promise<Blob | null> {
  try {
    const url = await sign({ action: 'get', key })
    const res = await fetch(url)
    return res.ok ? await res.blob() : null
  } catch {
    return null
  }
}

export async function r2Delete(keys: string[]) {
  if (!keys.length) return
  await supabase.functions.invoke('milonote-r2', { body: { action: 'delete', keys } }).catch(() => {})
}
