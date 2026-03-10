import { describe, it, expect } from 'vitest'
import { generateRoomCode, getAccuracyMultiplier, calculateDamage } from '../formulas'

describe('generateRoomCode', () => {
  it('returns a 6-character string', () => {
    const code = generateRoomCode()
    expect(code).toHaveLength(6)
  })

  it('only contains safe characters (no O/0/I/1/l)', () => {
    // Run many times to increase confidence
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
    // With 31^6 possibilities, 20 codes should all be unique
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
  it('returns base damage from WPM and accuracy', () => {
    // 60 WPM at 100% accuracy: (60/20) * 1.5 = 4.5
    expect(calculateDamage(60, 100)).toBeCloseTo(4.5)
  })

  it('returns 0 when WPM is 0', () => {
    expect(calculateDamage(0, 100)).toBe(0)
  })

  it('applies text exhaustion bonus (+3)', () => {
    const base = calculateDamage(60, 100)
    const withExhaustion = calculateDamage(60, 100, true)
    expect(withExhaustion).toBeCloseTo(base + 3)
  })

  it('applies SURGE 1.5x multiplier', () => {
    const base = calculateDamage(60, 100)
    const withSurge = calculateDamage(60, 100, false, true)
    expect(withSurge).toBeCloseTo(base * 1.5)
  })

  it('applies low HP 1.25x comeback multiplier', () => {
    const base = calculateDamage(60, 100)
    const withLowHp = calculateDamage(60, 100, false, false, true)
    expect(withLowHp).toBeCloseTo(base * 1.25)
  })

  it('stacks surge and low HP multipliers', () => {
    const base = calculateDamage(60, 100)
    const withBoth = calculateDamage(60, 100, false, true, true)
    expect(withBoth).toBeCloseTo(base * 1.5 * 1.25)
  })

  it('uses low accuracy multiplier for accuracy below 80', () => {
    // 60 WPM at 70% accuracy: (60/20) * 0.5 = 1.5
    expect(calculateDamage(60, 70)).toBeCloseTo(1.5)
  })

  it('uses 90% accuracy correctly', () => {
    // 60 WPM at 90% accuracy: (60/20) * 1.0 = 3.0
    expect(calculateDamage(60, 90)).toBeCloseTo(3.0)
  })
})
