import { describe, expect, it } from 'vitest'
import { drawAssignments, type Pair } from '@shared/draw'

const people = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`)

function checkValid(ids: string[], result: Map<string, string>, exclusions: Pair[] = []) {
  expect([...result.keys()].sort()).toEqual([...ids].sort())
  expect([...result.values()].sort()).toEqual([...ids].sort()) // everyone receives exactly once
  for (const [giver, receiver] of result) {
    expect(receiver).not.toBe(giver)
    for (const [a, b] of exclusions) {
      expect(giver === a && receiver === b).toBe(false)
      expect(giver === b && receiver === a).toBe(false)
    }
  }
}

function cycleLength(result: Map<string, string>, start: string) {
  let n = 0
  let cur = start
  do {
    cur = result.get(cur)!
    n++
  } while (cur !== start)
  return n
}

describe('drawAssignments', () => {
  it('needs at least 3 people', () => {
    expect(drawAssignments(people(2), [])).toBeNull()
  })

  it('always gives a valid single chain when there are no exclusions', () => {
    for (let n = 3; n <= 25; n++) {
      const ids = people(n)
      const result = drawAssignments(ids, [])!
      checkValid(ids, result)
      expect(cycleLength(result, ids[0])).toBe(n)
    }
  })

  it('respects couples in both directions', () => {
    const ids = people(8)
    const couples: Pair[] = [['p0', 'p1'], ['p2', 'p3'], ['p4', 'p5'], ['p6', 'p7']]
    for (let i = 0; i < 200; i++) checkValid(ids, drawAssignments(ids, couples)!, couples)
  })

  it('falls back to several loops when a single chain is impossible', () => {
    // p0 can only give to p1 and p1 only to p0 → must be a 2-loop, the rest loop among themselves.
    const ids = people(5)
    const ex: Pair[] = [['p0', 'p2'], ['p0', 'p3'], ['p0', 'p4'], ['p1', 'p2'], ['p1', 'p3'], ['p1', 'p4']]
    const result = drawAssignments(ids, ex)!
    checkValid(ids, result, ex)
    expect(result.get('p0')).toBe('p1')
    expect(result.get('p1')).toBe('p0')
  })

  it('returns null when exclusions leave no option', () => {
    const ids = people(3)
    expect(drawAssignments(ids, [['p0', 'p1'], ['p0', 'p2']])).toBeNull()
  })

  it('is not predictable: different runs give different chains', () => {
    const ids = people(10)
    const seen = new Set<string>()
    for (let i = 0; i < 30; i++) seen.add(JSON.stringify([...drawAssignments(ids, [])!.entries()].sort()))
    expect(seen.size).toBeGreaterThan(20)
  })

  it('reaches every possible receiver for a given giver', () => {
    const ids = people(5)
    const receivers = new Set<string>()
    for (let i = 0; i < 300; i++) receivers.add(drawAssignments(ids, [])!.get('p0')!)
    expect([...receivers].sort()).toEqual(['p1', 'p2', 'p3', 'p4'])
  })
})
