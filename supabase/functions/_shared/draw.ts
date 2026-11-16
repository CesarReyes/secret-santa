// The draw: who gives to whom. Shared by the `draw` Edge Function and the tests.
//
// Rules: nobody draws themselves, and excluded pairs (e.g. couples) never give to each other in
// either direction. We first look for a single chain that goes through everyone (A→B→C→…→A):
// it avoids little closed loops like A↔B. If exclusions make that impossible, any valid
// assignment is accepted.

export type Pair = readonly [string, string]

export type RandomInt = (maxExclusive: number) => number

/** Uniform integer in [0, max) from the platform CSPRNG (rejection sampling, no modulo bias). */
export const cryptoRandomInt: RandomInt = (max) => {
  if (max <= 1) return 0
  const limit = Math.floor(0x1_0000_0000 / max) * max
  const buf = new Uint32Array(1)
  for (;;) {
    globalThis.crypto.getRandomValues(buf)
    if (buf[0] < limit) return buf[0] % max
  }
}

/** Fisher–Yates with the CSPRNG. Also used to write rows in an order unrelated to the pairs. */
export function shuffle<T>(items: readonly T[], rand: RandomInt = cryptoRandomInt): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Search budget; plenty for family-sized groups, and bounds the worst case. */
const MAX_STEPS = 200_000

/**
 * Returns giver → receiver, or null if the exclusions leave no valid assignment.
 * Needs at least 3 people (with 2, each would know who has them).
 */
export function drawAssignments(
  people: readonly string[],
  exclusions: readonly Pair[],
  rand: RandomInt = cryptoRandomInt,
): Map<string, string> | null {
  const ids = [...new Set(people)]
  if (ids.length < 3) return null

  const blocked = new Set<string>()
  for (const [a, b] of exclusions) {
    blocked.add(`${a}|${b}`)
    blocked.add(`${b}|${a}`)
  }
  const allowed = (giver: string, receiver: string) => giver !== receiver && !blocked.has(`${giver}|${receiver}`)

  return singleChain(ids, allowed, rand) ?? anyAssignment(ids, allowed, rand)
}

/** Random Hamiltonian cycle by randomized depth-first search. */
function singleChain(ids: string[], allowed: (g: string, r: string) => boolean, rand: RandomInt) {
  const order = shuffle(ids, rand)
  const start = order[0]
  const path = [start]
  const used = new Set(path)
  let steps = 0

  const extend = (): boolean => {
    if (++steps > MAX_STEPS) return false
    const last = path[path.length - 1]
    if (path.length === ids.length) return allowed(last, start)
    for (const next of shuffle(ids, rand)) {
      if (used.has(next) || !allowed(last, next)) continue
      path.push(next)
      used.add(next)
      if (extend()) return true
      path.pop()
      used.delete(next)
    }
    return false
  }

  if (!extend()) return null
  const result = new Map<string, string>()
  path.forEach((giver, i) => result.set(giver, path[(i + 1) % path.length]))
  return result
}

/** Any permutation that respects the rules (several smaller loops allowed). */
function anyAssignment(ids: string[], allowed: (g: string, r: string) => boolean, rand: RandomInt) {
  // Most constrained givers first prunes the search early.
  const givers = shuffle(ids, rand).sort(
    (a, b) => ids.filter((r) => allowed(a, r)).length - ids.filter((r) => allowed(b, r)).length,
  )
  const taken = new Set<string>()
  const result = new Map<string, string>()
  let steps = 0

  const assign = (i: number): boolean => {
    if (++steps > MAX_STEPS) return false
    if (i === givers.length) return true
    const giver = givers[i]
    for (const receiver of shuffle(ids, rand)) {
      if (taken.has(receiver) || !allowed(giver, receiver)) continue
      taken.add(receiver)
      result.set(giver, receiver)
      if (assign(i + 1)) return true
      taken.delete(receiver)
      result.delete(giver)
    }
    return false
  }

  return assign(0) ? result : null
}
