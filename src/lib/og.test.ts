import { describe, expect, it } from 'vitest'
import { isFetchableUrl, parsePreview } from '@shared/og'

describe('parsePreview', () => {
  it('prefers Open Graph and resolves relative images', () => {
    const html = `<html><head><title>Fallback</title>
      <meta property="og:title" content="Auriculares &amp; estuche">
      <meta name="description" content="Cancelación de ruido">
      <meta property="og:image" content="/img/a.jpg">
      <meta property="og:site_name" content="Tienda"></head></html>`
    expect(parsePreview(html, 'https://tienda.es/p/1')).toEqual({
      title: 'Auriculares & estuche',
      description: 'Cancelación de ruido',
      image: 'https://tienda.es/img/a.jpg',
      site: 'Tienda',
    })
  })

  it('falls back to <title> and the hostname, and drops non-https images', () => {
    const html = `<title>Libro  de cocina</title><meta content='http://x.com/a.png' property='og:image'>`
    expect(parsePreview(html, 'https://www.libros.com/x')).toEqual({ title: 'Libro de cocina', description: undefined, image: undefined, site: 'libros.com' })
  })
})

describe('isFetchableUrl', () => {
  it('allows public http(s) sites', () => {
    expect(isFetchableUrl('https://www.amazon.es/dp/B0')).toBe(true)
    expect(isFetchableUrl('http://example.com')).toBe(true)
  })

  it('blocks local, private and odd targets', () => {
    for (const u of [
      'http://localhost:3000',
      'http://127.0.0.1',
      'http://10.0.0.5/admin',
      'http://192.168.1.1',
      'http://172.20.0.1',
      'http://169.254.169.254/latest/meta-data',
      'http://2130706433',
      'http://[::1]/',
      'ftp://example.com',
      'javascript:alert(1)',
      'https://user:pw@example.com',
      'http://intranet',
    ]) {
      expect(isFetchableUrl(u), u).toBe(false)
    }
  })
})
