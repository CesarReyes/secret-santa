import { create } from 'zustand'

// "Add to home screen". Android/Chrome fire `beforeinstallprompt`, which we keep so a button can
// show the native dialog later. iOS has no such event: the card explains the Share menu instead.

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

const DISMISSED_KEY = 'amigo-secreto:instalar-oculto'

function read(key: string) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Private mode: the card just comes back next time.
  }
}

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

export const isIOS = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1)

type InstallState = {
  promptEvent: InstallPromptEvent | null
  installed: boolean
  dismissed: boolean
  dismiss: () => void
  install: () => Promise<void>
}

export const useInstall = create<InstallState>()((set, get) => ({
  promptEvent: null,
  installed: isStandalone(),
  dismissed: read(DISMISSED_KEY) === '1',
  dismiss: () => {
    write(DISMISSED_KEY, '1')
    set({ dismissed: true })
  },
  install: async () => {
    const event = get().promptEvent
    if (!event) return
    await event.prompt()
    const { outcome } = await event.userChoice
    set({ promptEvent: null, installed: outcome === 'accepted' })
  },
}))

// Registered at import time (from main.tsx): the event can fire before any screen mounts.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  useInstall.setState({ promptEvent: e as InstallPromptEvent })
})
window.addEventListener('appinstalled', () => useInstall.setState({ installed: true, promptEvent: null }))
