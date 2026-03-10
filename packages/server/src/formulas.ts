/**
 * Extracted formulas from game-room.ts for testability.
 */

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

/**
 * Accuracy multiplier: linearly scales from 0.5 (at 80%) to 1.5 (at 100%).
 * Below 80%, returns 0.5.
 */
export function getAccuracyMultiplier(accuracy: number): number {
  if (accuracy < 80) return 0.5
  // Linear interpolation: 80% → 0.5, 100% → 1.5
  return 0.5 + ((accuracy - 80) / 20) * 1.0
}

/**
 * Calculate base damage per tick.
 * @param wpm - words per minute
 * @param accuracy - accuracy percentage (0-100)
 * @param textExhausted - whether the player finished the passage
 * @param hasSurge - whether SURGE ability is active
 * @param lowHp - whether the player is below 30 HP (comeback mechanic)
 */
export function calculateDamage(
  wpm: number,
  accuracy: number,
  textExhausted: boolean = false,
  hasSurge: boolean = false,
  lowHp: boolean = false,
): number {
  const accuracyMultiplier = getAccuracyMultiplier(accuracy)
  let damage = (wpm / 20) * accuracyMultiplier

  if (textExhausted) damage += 3
  if (hasSurge) damage *= 1.5
  if (lowHp) damage *= 1.25

  return damage
}
