/** Placeholder while a screen's code downloads. */
export function ScreenLoader() {
  return (
    <div className="flex min-h-40 items-center justify-center py-16" role="status" aria-label="Cargando">
      <span className="gift-wiggle text-4xl" aria-hidden>🎁</span>
    </div>
  )
}
