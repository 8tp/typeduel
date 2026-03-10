import { describe, it, expect } from 'vitest'
import { generateRoomCode, getAccuracyMultiplier, calculateDamage } from '../formulas'

describe('generateRoomCode', () => {
  it('returns a 6-character string', () => {
    const code = generateRoomCode()
    expect(code).toHaveLength(6)
  })

  it('only contains safe characters (no O/0/I/1/l)', () => {
    for (let i = 0; i < 100; i++) {
      const code = generateRoomCode()
      expect(code).not.toMatch(/[O0I1l]/)
    }
  })

  it('only contains uppercase letters and digits', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateRoomCode()
      expect(code).toMatch(/^[A-Z2-9]+$/)
    }
  })

  it('generates different codes', () => {
    const codes = new Set<string>()
    for (let i = 0; i < 20; i++) {
      codes.add(generateRoomCode())
    }
    expect(codes.size).toBe(20)
  })
})

describe('getAccuracyMultiplier', () => {
  it('returns 0.5 for accuracy below 80', () => {
    expect(getAccuracyMultiplier(0)).toBe(0.5)
    expect(getAccuracyMultiplier(50)).toBe(0.5)
    expect(getAccuracyMultiplier(79)).toBe(0.5)
    expect(getAccuracyMultiplier(79.9)).toBe(0.5)
  })

  it('returns 0.5 at exactly 80%', () => {
    expect(getAccuracyMultiplier(80)).toBe(0.5)
  })

  it('returns 1.0 at 90%', () => {
    expect(getAccuracyMultiplier(90)).toBe(1.0)
  })

  it('returns 1.5 at 100%', () => {
    expect(getAccuracyMultiplier(100)).toBe(1.5)
  })

  it('scales linearly between 80 and 100', () => {
    expect(getAccuracyMultiplier(85)).toBeCloseTo(0.75)
    expect(getAccuracyMultiplier(95)).toBeCloseTo(1.25)
  })
})

describe('calculateDamage', () => {
  // Differential model: damage = (baseDrain + max(0, wpm-oppWpm)*diffScale) * accMult
  // Default baseDrain=1.1, diffScale=0.03, exhaustBonus=1

  it('returns baseDrain * accMult when WPMs are equal', () => {
    // Equal 60v60 at 100% accuracy: 1.1 * 1.5 = 1.65
    expect(calculateDamage(60, 60, 100)).toBeCloseTo(1.65)
  })

  it('adds differential bonus when faster than opponent', () => {
    // 80v60 at 100% accuracy: (1.1 + 20*0.03) * 1.5 = 1.7 * 1.5 = 2.55
    expect(calculateDamage(80, 60, 100)).toBeCloseTo(2.55)
  })

  it('does not subtract damage when slower than opponent', () => {
    // 60v80 at 100% accuracy: (1.1 + 0) * 1.5 = 1.65 (same as equal)
    expect(calculateDamage(60, 80, 100)).toBeCloseTo(1.65)
  })

  it('returns baseDrain * accMult when WPM is 0 against 0', () => {
    // 0v0 at 100%: 1.1 * 1.5 = 1.65
    expect(calculateDamage(0, 0, 100)).toBeCloseTo(1.65)
  })

  it('applies text exhaustion bonus (+1)', () => {
    const base = calculateDamage(60, 60, 100)
    const withExhaustion = calculateDamage(60, 60, 100, true)
    expect(withExhaustion).toBeCloseTo(base + 1)
  })

  it('applies SURGE 1.5x multiplier', () => {
    const base = calculateDamage(60, 60, 100)
    const withSurge = calculateDamage(60, 60, 100, false, true)
    expect(withSurge).toBeCloseTo(base * 1.5)
  })

  it('applies low HP 1.25x comeback multiplier', () => {
    const base = calculateDamage(60, 60, 100)
    const withLowHp = calculateDamage(60, 60, 100, false, false, true)
    expect(withLowHp).toBeCloseTo(base * 1.25)
  })

  it('stacks surge and low HP multipliers', () => {
    const base = calculateDamage(60, 60, 100)
    const withBoth = calculateDamage(60, 60, 100, false, true, true)
    expect(withBoth).toBeCloseTo(base * 1.5 * 1.25)
  })

  it('uses low accuracy multiplier for accuracy below 80', () => {
    // Equal 60v60 at 70%: 1.1 * 0.5 = 0.55
    expect(calculateDamage(60, 60, 70)).toBeCloseTo(0.55)
  })

  it('produces ~69s match for equal 80v80 at 95% accuracy', () => {
    const dmgPerTick = calculateDamage(80, 80, 95)
    const ticksToKO = Math.ceil(100 / dmgPerTick)
    expect(ticksToKO).toBeGreaterThan(60)
    expect(ticksToKO).toBeLessThan(80)
  })

  it('produces faster KO with large WPM gap', () => {
    const equalTicks = Math.ceil(100 / calculateDamage(80, 80, 95))
    const gapTicks = Math.ceil(100 / calculateDamage(100, 40, 95))
    expect(gapTicks).toBeLessThan(equalTicks / 2)
  })
})
