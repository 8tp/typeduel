import { describe, it, expect } from 'vitest'
import {
  PASSAGES,
  getRandomPassage,
  ABILITY_CONFIGS,
  AbilityId,
  MAX_HP,
  MAX_ENERGY,
} from '../index'

describe('PASSAGES', () => {
  it('has entries for all 3 difficulties', () => {
    const easy = PASSAGES.filter(p => p.difficulty === 'easy')
    const medium = PASSAGES.filter(p => p.difficulty === 'medium')
    const hard = PASSAGES.filter(p => p.difficulty === 'hard')

    expect(easy.length).toBeGreaterThan(0)
    expect(medium.length).toBeGreaterThan(0)
    expect(hard.length).toBeGreaterThan(0)
  })

  it('each passage has non-empty text', () => {
    for (const passage of PASSAGES) {
      expect(passage.text.length).toBeGreaterThan(0)
    }
  })

  it('each passage has a valid difficulty', () => {
    for (const passage of PASSAGES) {
      expect(['easy', 'medium', 'hard']).toContain(passage.difficulty)
    }
  })
})

describe('getRandomPassage', () => {
  it('returns a passage without filter', () => {
    const passage = getRandomPassage()
    expect(passage).toBeDefined()
    expect(passage.text).toBeTruthy()
    expect(passage.difficulty).toBeTruthy()
  })

  it('returns an easy passage when filtered', () => {
    const passage = getRandomPassage('easy')
    expect(passage.difficulty).toBe('easy')
    expect(passage.text.length).toBeGreaterThan(0)
  })

  it('returns a medium passage when filtered', () => {
    const passage = getRandomPassage('medium')
    expect(passage.difficulty).toBe('medium')
  })

  it('returns a hard passage when filtered', () => {
    const passage = getRandomPassage('hard')
    expect(passage.difficulty).toBe('hard')
  })
})

describe('ABILITY_CONFIGS', () => {
  const allAbilities = Object.values(AbilityId)

  it('has all 6 abilities', () => {
    expect(allAbilities.length).toBe(6)
    for (const id of allAbilities) {
      expect(ABILITY_CONFIGS[id]).toBeDefined()
    }
  })

  it('each ability has cost > 0', () => {
    for (const id of allAbilities) {
      expect(ABILITY_CONFIGS[id].cost).toBeGreaterThan(0)
    }
  })

  it('each ability has duration > 0', () => {
    for (const id of allAbilities) {
      expect(ABILITY_CONFIGS[id].duration).toBeGreaterThan(0)
    }
  })

  it('each ability has cooldown > 0', () => {
    for (const id of allAbilities) {
      expect(ABILITY_CONFIGS[id].cooldown).toBeGreaterThan(0)
    }
  })

  it('each ability has a non-empty description', () => {
    for (const id of allAbilities) {
      expect(ABILITY_CONFIGS[id].description.length).toBeGreaterThan(0)
    }
  })
})

describe('Constants', () => {
  it('MAX_HP is 100', () => {
    expect(MAX_HP).toBe(100)
  })

  it('MAX_ENERGY is 100', () => {
    expect(MAX_ENERGY).toBe(100)
  })
})
