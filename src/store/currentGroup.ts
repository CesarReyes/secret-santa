import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

type CurrentGroup = { groupId: string | null; select: (id: string) => void }

// Remembers the selected group per device. Storage can be unavailable (private mode); then it
// just falls back to the first group.
const safeStorage = createJSONStorage(() => {
  try {
    localStorage.setItem('__probe', '1')
    localStorage.removeItem('__probe')
    return localStorage
  } catch {
    return { getItem: () => null, setItem: () => {}, removeItem: () => {} }
  }
})

export const useCurrentGroupId = create<CurrentGroup>()(
  persist((set) => ({ groupId: null, select: (groupId) => set({ groupId }) }), {
    name: 'amigo-secreto:grupo',
    storage: safeStorage,
  }),
)
