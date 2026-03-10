import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createInitialState, PracticeEngine, getPbKey, type PracticeConfig } from '../practice/engine'

describe('createInitialState', () => {
  it('returns countdown status', () => {
    const config: PracticeConfig = { mode: 'free', difficulty: 'medium', duration: 60, botDifficulty: 'medium' }
    const state = createInitialState(config)
    expect(state.status).toBe('countdown')
  })

  it('starts with cursor at 0', () => {
    const config: PracticeConfig = { mode: 'free', difficulty: 'easy', duration: 60, botDifficulty: 'medium' }
    const state = createInitialState(config)
    expect(state.cursor).toBe(0)
  })

  it('starts with 100% accuracy', () => {
    const config: PracticeConfig = { mode: 'free', difficulty: 'easy', duration: 60, botDifficulty: 'medium' }
    const state = createInitialState(config)
    expect(state.accuracy).toBe(100)
  })

  it('starts with 0 WPM', () => {
    const config: PracticeConfig = { mode: 'timed', difficulty: 'medium', duration: 30, botDifficulty: 'medium' }
    const state = createInitialState(config)
    expect(state.wpm).toBe(0)
  })

  it('sets timeLeft for timed mode', () => {
    const config: PracticeConfig = { mode: 'timed', difficulty: 'easy', duration: 30, botDifficulty: 'medium' }
    const state = createInitialState(config)
    expect(state.timeLeft).toBe(30)
  })

  it('sets timeLeft to 0 for free mode', () => {
    const config: PracticeConfig = { mode: 'free', difficulty: 'easy', duration: 60, botDifficulty: 'medium' }
    const state = createInitialState(config)
    expect(state.timeLeft).toBe(0)
  })

  it('sets bot HP for bot mode', () => {
    const config: PracticeConfig = { mode: 'bot', difficulty: 'medium', duration: 60, botDifficulty: 'hard' }
    const state = createInitialState(config)
    expect(state.botHp).toBe(100)
    expect(state.playerHp).toBe(100)
    expect(state.botWpm).toBe(100) // hard bot is 100 WPM
  })

  it('generates non-empty text', () => {
    const config: PracticeConfig = { mode: 'free', difficulty: 'easy', duration: 60, botDifficulty: 'medium' }
    const state = createInitialState(config)
    expect(state.text.length).toBeGreaterThan(0)
  })

  it('sets countdownSeconds to 3', () => {
    const config: PracticeConfig = { mode: 'free', difficulty: 'easy', duration: 60, botDifficulty: 'medium' }
    const state = createInitialState(config)
    expect(state.countdownSeconds).toBe(3)
  })
})

describe('getPbKey', () => {
  it('returns correct key for free mode', () => {
    const config: PracticeConfig = { mode: 'free', difficulty: 'easy', duration: 60, botDifficulty: 'medium' }
    expect(getPbKey(config)).toBe('free_easy')
  })

  it('returns correct key for timed mode', () => {
    const config: PracticeConfig = { mode: 'timed', difficulty: 'medium', duration: 30, botDifficulty: 'medium' }
    expect(getPbKey(config)).toBe('timed_medium_30')
  })

  it('returns correct key for accuracy mode', () => {
    const config: PracticeConfig = { mode: 'accuracy', difficulty: 'hard', duration: 60, botDifficulty: 'medium' }
    expect(getPbKey(config)).toBe('accuracy_hard')
  })

  it('returns correct key for bot mode', () => {
    const config: PracticeConfig = { mode: 'bot', difficulty: 'medium', duration: 60, botDifficulty: 'hard' }
    expect(getPbKey(config)).toBe('bot_medium_hard')
  })
})

describe('PracticeEngine keystroke handling', () => {
  let engine: PracticeEngine
  let lastState: ReturnType<typeof createInitialState>

  beforeEach(() => {
    vi.useFakeTimers()
    const config: PracticeConfig = { mode: 'free', difficulty: 'easy', duration: 60, botDifficulty: 'medium' }
    engine = new PracticeEngine(config, (state) => { lastState = state })
    // Manually force the state to active so we can test keystrokes
    engine.state.status = 'active'
    engine.state.startTime = Date.now()
  })

  it('correct char advances cursor', () => {
    const firstChar = engine.state.text[0]
    engine.handleKeystroke(firstChar)
    expect(engine.state.cursor).toBe(1)
  })

  it('wrong char does not advance cursor', () => {
    const firstChar = engine.state.text[0]
    // Type a wrong character (pick something that is definitely not the first char)
    const wrongChar = firstChar === 'a' ? 'b' : 'a'
    engine.handleKeystroke(wrongChar)
    expect(engine.state.cursor).toBe(0)
  })

  it('backspace moves cursor back', () => {
    const firstChar = engine.state.text[0]
    engine.handleKeystroke(firstChar)
    expect(engine.state.cursor).toBe(1)
    engine.handleKeystroke('BACKSPACE')
    expect(engine.state.cursor).toBe(0)
  })

  it('backspace does not go below 0', () => {
    engine.handleKeystroke('BACKSPACE')
    expect(engine.state.cursor).toBe(0)
  })

  it('tracks accuracy correctly', () => {
    const first = engine.state.text[0]
    engine.handleKeystroke(first) // correct — advances cursor to 1

    // Now we're at position 1, pick a char that does NOT match text[1]
    const secondExpected = engine.state.text[1]
    const wrongChars = 'qzxw!@#'
    const wrong = [...wrongChars].find(c => c !== secondExpected) ?? '~'

    engine.handleKeystroke(wrong) // incorrect

    expect(engine.state.totalCorrect).toBe(1)
    expect(engine.state.totalKeystrokes).toBe(2)
    expect(engine.state.accuracy).toBe(50)
  })

  it('tracks streak correctly', () => {
    const text = engine.state.text
    // Type first 3 chars correctly
    for (let i = 0; i < 3; i++) {
      engine.handleKeystroke(text[i])
    }
    expect(engine.state.streak).toBe(3)
    expect(engine.state.maxStreak).toBe(3)

    // Type wrong char to break streak
    const wrong = text[3] === 'a' ? 'b' : 'a'
    engine.handleKeystroke(wrong)
    expect(engine.state.streak).toBe(0)
    expect(engine.state.maxStreak).toBe(3) // max preserved
  })

  it('accuracy mode ends on wrong keystroke', () => {
    engine.cleanup()
    const config: PracticeConfig = { mode: 'accuracy', difficulty: 'easy', duration: 60, botDifficulty: 'medium' }
    engine = new PracticeEngine(config, (state) => { lastState = state })
    engine.state.status = 'active'
    engine.state.startTime = Date.now()

    const firstChar = engine.state.text[0]
    const wrongChar = firstChar === 'a' ? 'b' : 'a'
    engine.handleKeystroke(wrongChar)
    expect(engine.state.status).toBe('finished')
  })

  afterEach(() => {
    engine.cleanup()
    vi.useRealTimers()
  })
})
