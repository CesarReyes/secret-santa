import { Component, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'

type Props = { children: ReactNode }
type State = { failed: boolean }

/** Shows a friendly screen instead of a blank page when something breaks while rendering. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error(error)
  }

  render() {
    if (!this.state.failed) return this.props.children
    // After a new deploy, an old tab may ask for screen files that no longer exist: reloading fixes it.
    return (
      <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="text-5xl" aria-hidden>☃️</span>
        <h1 className="text-2xl font-semibold">Algo se congeló</h1>
        <p className="max-w-xs text-muted-foreground">
          No pudimos mostrar esta pantalla. Puede que haya una versión nueva de la app: recarga para seguir.
        </p>
        <Button size="lg" onClick={() => location.reload()}>
          Recargar
        </Button>
      </div>
    )
  }
}
