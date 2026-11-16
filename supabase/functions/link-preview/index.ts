// Link previews for wishlist items: fetches a public page server-side and returns its title,
// description, image and site name. Signed-in users only, so it can't be used as an open proxy.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { isFetchableUrl, parsePreview } from '../_shared/og.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const MAX_BYTES = 1_000_000
const MAX_REDIRECTS = 3

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token || (await admin.auth.getUser(token)).error) return json(401, { error: 'Inicia sesión.' })

  const { url } = await req.json().catch(() => ({}))
  if (typeof url !== 'string' || !isFetchableUrl(url)) return json(400, { error: 'Enlace no válido.' })

  try {
    // Follow redirects by hand so every hop is checked.
    let current = url
    let res: Response | null = null
    for (let i = 0; i <= MAX_REDIRECTS; i++) {
      res = await fetch(current, {
        redirect: 'manual',
        signal: AbortSignal.timeout(6000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AmigoSecretoBot/1.0; link preview)',
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'es-ES,es;q=0.9',
        },
      })
      const next = res.headers.get('location')
      if (res.status >= 300 && res.status < 400 && next) {
        current = new URL(next, current).href
        if (!isFetchableUrl(current)) return json(200, { preview: null })
        continue
      }
      break
    }
    if (!res || !res.ok || !(res.headers.get('content-type') ?? '').includes('html')) return json(200, { preview: null })

    // Read at most MAX_BYTES; the <head> is all we need.
    const reader = res.body!.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    while (size < MAX_BYTES) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      size += value.length
    }
    await reader.cancel().catch(() => {})
    const html = new TextDecoder().decode(chunks.reduce((acc, c) => {
      const out = new Uint8Array(acc.length + c.length)
      out.set(acc)
      out.set(c, acc.length)
      return out
    }, new Uint8Array()))
    return json(200, { preview: parsePreview(html, current) })
  } catch {
    return json(200, { preview: null }) // unreachable or slow sites just get no preview
  }
})
