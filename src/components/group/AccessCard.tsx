import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Copy, Share2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export type Access = { name: string; username: string; pin: string; groupName: string }

/** Sign-in link that pre-fills the username. */
export function signInUrl(username: string): string {
  const base = new URL(import.meta.env.BASE_URL, window.location.origin)
  return `${base.href}#/entrar?u=${encodeURIComponent(username)}`
}

function shareText(a: Access): string {
  return [
    `🎁 Amigo Secreto · ${a.groupName}`,
    `Hola, ${a.name}. Entra aquí: ${signInUrl(a.username)}`,
    `Usuario: ${a.username}`,
    `PIN temporal: ${a.pin}`,
    'Al entrar elegirás tu propio PIN o contraseña.',
  ].join('\n')
}

/**
 * Shown once after creating someone or resetting their PIN. The temporary PIN is never stored
 * in the app, so this is the only moment to share it.
 */
export function AccessCard({ access, onClose }: { access: Access | null; onClose: () => void }) {
  const [qr, setQr] = useState<string>('')

  useEffect(() => {
    if (!access) return
    QRCode.toString(signInUrl(access.username), { type: 'svg', margin: 1, color: { dark: '#7f0d1c', light: '#ffffff' } })
      .then(setQr)
      .catch(() => setQr(''))
  }, [access])

  async function share() {
    if (!access) return
    const text = shareText(access)
    if (navigator.share) {
      try {
        await navigator.share({ text })
        return
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
      }
    }
    await copy()
  }

  async function copy() {
    if (!access) return
    try {
      await navigator.clipboard.writeText(shareText(access))
      toast.success('Copiado. Pégalo en WhatsApp o donde quieras.')
    } catch {
      toast.error('No se pudo copiar.')
    }
  }

  return (
    <Dialog open={Boolean(access)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Acceso de {access?.name}</DialogTitle>
          <DialogDescription>
            Compártelo ahora: el PIN temporal no se vuelve a mostrar. Si se pierde, restablécelo.
          </DialogDescription>
        </DialogHeader>
        {access && (
          <div className="space-y-4">
            <div className="rounded-xl border-2 border-dashed border-gold/60 bg-muted/50 p-4 text-center">
              {qr && (
                <div
                  className="mx-auto mb-3 size-40 overflow-hidden rounded-lg bg-white [&_svg]:size-full"
                  role="img"
                  aria-label="Código QR para entrar a la app"
                  dangerouslySetInnerHTML={{ __html: qr }}
                />
              )}
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-left">
                <dt className="text-sm text-muted-foreground">Usuario</dt>
                <dd className="font-mono text-lg font-semibold">{access.username}</dd>
                <dt className="text-sm text-muted-foreground">PIN</dt>
                <dd className="font-mono text-lg font-semibold tracking-[0.3em]">{access.pin}</dd>
              </dl>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={share} className="h-11">
                <Share2 /> Compartir
              </Button>
              <Button onClick={copy} variant="outline" className="h-11">
                <Copy /> Copiar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
