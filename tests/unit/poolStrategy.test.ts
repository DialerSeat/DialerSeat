import { describe, it, expect } from 'vitest'
import { chooseStrategy, normalizeStrategy, DEFAULT_POOL_STRATEGY } from '@/lib/poolStrategy'

// =============================================================================
// THE DEFAULT HAS TO BE UNTOUCHABLE
// =============================================================================
// This decides which caller ID logic runs on a live dial. The requirement it
// was built under was explicit: keep today's behaviour as the default, and make
// the alternatives opt-in. Most of these tests exist to prove that a broken,
// blank, hostile or half-written config still produces exactly what runs today.

const OFF = { pct: 0, arm: 'rotate', defaultStrategy: 'locality' }

describe('with no experiment configured, nothing changes', () => {
  it('returns the default strategy at 0 percent', () => {
    const r = chooseStrategy(OFF, 0.01)
    expect(r.strategy).toBe('locality')
    expect(r.inExperiment).toBe(false)
  })

  it('returns the default even on a roll that would have qualified', () => {
    // The roll is irrelevant when the experiment is off. A 0.0 roll passes
    // every percentage test there is, so this is the one that would catch an
    // ordering mistake in the guard.
    expect(chooseStrategy(OFF, 0).strategy).toBe('locality')
  })

  it('treats a negative or nonsense percentage as off', () => {
    expect(chooseStrategy({ ...OFF, pct: -20 }, 0).inExperiment).toBe(false)
    expect(chooseStrategy({ ...OFF, pct: NaN }, 0).inExperiment).toBe(false)
    expect(chooseStrategy({ ...OFF, pct: Infinity }, 0).strategy).toBe('locality')
  })

  it('falls back to locality when the default itself is garbage', () => {
    // A typo in the settings table must not be able to change dialing.
    const r = chooseStrategy({ pct: 0, arm: 'rotate', defaultStrategy: 'lcoality' }, 0.5)
    expect(r.strategy).toBe(DEFAULT_POOL_STRATEGY)
  })
})

describe('the split honours the percentage', () => {
  const cfg = { pct: 20, arm: 'rotate', defaultStrategy: 'locality' }

  it('sends a roll under the threshold to the experiment arm', () => {
    expect(chooseStrategy(cfg, 0.10).strategy).toBe('rotate')
    expect(chooseStrategy(cfg, 0.199).strategy).toBe('rotate')
  })

  it('sends a roll on or over the threshold to the default', () => {
    expect(chooseStrategy(cfg, 0.20).strategy).toBe('locality')
    expect(chooseStrategy(cfg, 0.99).strategy).toBe('locality')
  })

  it('marks BOTH sides as part of the experiment', () => {
    // The control group is only a control group if it is labelled. A dial that
    // took locality because the split sent it there is data; one that took
    // locality because no experiment was running is not, and mixing them
    // silently pollutes the comparison.
    expect(chooseStrategy(cfg, 0.10).inExperiment).toBe(true)
    expect(chooseStrategy(cfg, 0.90).inExperiment).toBe(true)
  })

  it('sends everything to the arm at 100', () => {
    const all = { ...cfg, pct: 100 }
    expect(chooseStrategy(all, 0).strategy).toBe('rotate')
    expect(chooseStrategy(all, 0.999).strategy).toBe('rotate')
  })

  it('clamps a percentage above 100 rather than refusing it', () => {
    expect(chooseStrategy({ ...cfg, pct: 150 }, 0.99).strategy).toBe('rotate')
  })
})

describe('an arm equal to the default is not an experiment', () => {
  it('reports it as off rather than splitting identical traffic', () => {
    // Otherwise identical dials land on both sides of a comparison and any
    // real difference is buried in noise around zero.
    const r = chooseStrategy({ pct: 50, arm: 'locality', defaultStrategy: 'locality' }, 0.1)
    expect(r.strategy).toBe('locality')
    expect(r.inExperiment).toBe(false)
  })

  it('also catches it when the arm is a typo that normalises to the default', () => {
    const r = chooseStrategy({ pct: 50, arm: 'rotatte', defaultStrategy: 'locality' }, 0.1)
    expect(r.inExperiment).toBe(false)
  })
})

describe('the distribution is actually the configured one', () => {
  it('lands near 20 percent over many rolls', () => {
    const cfg = { pct: 20, arm: 'rotate', defaultStrategy: 'locality' }
    let armed = 0
    const N = 10000
    for (let i = 0; i < N; i++) {
      if (chooseStrategy(cfg, i / N).strategy === 'rotate') armed++
    }
    // Deterministic sweep rather than random, so this can assert exactly.
    expect(armed).toBe(2000)
  })
})

describe('normalizeStrategy', () => {
  it('accepts the three real strategies', () => {
    expect(normalizeStrategy('locality')).toBe('locality')
    expect(normalizeStrategy('balanced')).toBe('balanced')
    expect(normalizeStrategy('rotate')).toBe('rotate')
  })

  it('rejects everything else back to the default', () => {
    for (const bad of ['', '  ', 'LOCALITY', 'random', null, undefined]) {
      expect(normalizeStrategy(bad as string)).toBe(DEFAULT_POOL_STRATEGY)
    }
  })
})
