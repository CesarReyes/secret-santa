import { registerSW } from 'virtual:pwa-register'

// With registerType 'autoUpdate', registerSW reloads the page as soon as a new version takes
// over, so nobody keeps using an old build (or asks for screen files that no longer exist).
// Installed apps can stay open for days, so we also check for a new version every hour and
// whenever the app comes back to the foreground.
const HOUR = 60 * 60 * 1000

registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) return
    const check = () => {
      if (navigator.onLine) registration.update().catch(() => {})
    }
    setInterval(check, HOUR)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check()
    })
  },
})
