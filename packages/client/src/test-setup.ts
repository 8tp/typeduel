import '@testing-library/jest-dom'

// Mock audio module
vi.mock('./audio', () => ({
  sfx: {
    keystroke: vi.fn(),
    keystrokeError: vi.fn(),
    damage: vi.fn(),
    abilityUse: vi.fn(),
    countdown: vi.fn(),
    countdownGo: vi.fn(),
    victory: vi.fn(),
    defeat: vi.fn(),
    ko: vi.fn(),
    freeze: vi.fn(),
    surge: vi.fn(),
    heartbeat: vi.fn(),
    taunt: vi.fn(),
  }
}))
