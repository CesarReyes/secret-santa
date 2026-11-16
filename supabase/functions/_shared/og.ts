// Open Graph / meta tag extraction for link previews. Shared so it can be tested with Vitest.

export type LinkPreview = { title?: string; description?: string; image?: string; site?: string }

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

function decode(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim()
}

function attr(tag: string, name: string): string | undefined {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))
  return m ? (m[2] ?? m[3] ?? m[4]) : undefined
}

/** Reads og:/twitter:/standard meta tags and <title>. Relative image URLs resolve against `pageUrl`. */
export function parsePreview(html: string, pageUrl: string): LinkPreview {
  const head = html.slice(0, 300_000)
  const meta = new Map<string, string>()
  for (const tag of head.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = (attr(tag, 'property') ?? attr(tag, 'name'))?.toLowerCase()
    const content = attr(tag, 'content')
    if (key && content && !meta.has(key)) meta.set(key, decode(content))
  }
  const title = meta.get('og:title') ?? meta.get('twitter:title') ?? decode(head.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? '')
  const description = meta.get('og:description') ?? meta.get('twitter:description') ?? meta.get('description')
  let image = meta.get('og:image') ?? meta.get('og:image:url') ?? meta.get('twitter:image')
  if (image) {
    try {
      image = new URL(image, pageUrl).href
      if (!/^https:\/\//.test(image)) image = undefined
    } catch {
      image = undefined
    }
  }
  const site = meta.get('og:site_name') ?? new URL(pageUrl).hostname.replace(/^www\./, '')
  const clip = (s: string | undefined, n: number) => (s ? (s.length > n ? `${s.slice(0, n - 1)}…` : s) : undefined)
  return { title: clip(title || undefined, 140), description: clip(description, 300), image, site: clip(site, 60) }
}

/** Only public http(s) hosts: no localhost, no private or link-local IP literals. */
export function isFetchableUrl(raw: string): boolean {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false
  if (url.username || url.password) return false
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return false
  if (/^\d+$/.test(host)) return false // decimal-encoded IPs
  const v4 = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])]
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224) return false
  }
  if (host.includes(':')) return false // IPv6 literals: not worth the risk
  return host.includes('.')
}
