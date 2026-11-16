import { Download, Share, SquarePlus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { isIOS, useInstall } from '@/lib/install'

/** Invites to add the app to the home screen. Hidden once installed or dismissed. */
export function InstallCard() {
  const { promptEvent, installed, dismissed, dismiss, install } = useInstall()
  const ios = isIOS()
  if (installed || dismissed || (!promptEvent && !ios)) return null

  return (
    <section aria-label="Instalar la app" className="relative rounded-xl border border-gold/40 bg-gold/10 p-4 pr-10">
      <Button variant="ghost" size="icon" className="absolute top-1.5 right-1.5 size-8" onClick={dismiss} aria-label="Ocultar">
        <X className="size-4" />
      </Button>
      <h2 className="font-semibold">Ten la app a mano 📲</h2>
      {promptEvent ? (
        <>
          <p className="mt-1 text-sm text-muted-foreground">Instálala en tu móvil y ábrela como cualquier otra app.</p>
          <Button className="mt-3" onClick={install}>
            <Download /> Instalar
          </Button>
        </>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">
          En Safari toca <Share className="inline size-4 align-text-bottom" aria-label="Compartir" /> y luego{' '}
          <span className="whitespace-nowrap font-medium text-foreground">
            <SquarePlus className="inline size-4 align-text-bottom" aria-hidden /> Añadir a pantalla de inicio
          </span>
          .
        </p>
      )}
    </section>
  )
}
