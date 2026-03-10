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
 * Calculate damage per tick using differential model.
 *
 * Damage scales with the WPM *advantage* over the opponent, not raw WPM.
 * Equal-speed players barely damage each other (baseDrain only), while
 * large skill gaps produce fast KOs.
 *
 * Target match lengths:
 *   Equal 80v80 → ~53s    |  80v60 → ~30s
 *   Equal 100v100 → ~53s  |  100v40 → ~16s
 */
export function calculateDamage(
  wpm: number,
  opponentWpm: number,
  accuracy: number,
  textExhausted: boolean = false,
  hasSurge: boolean = false,
  lowHp: boolean = false,
  baseDrain: number = 1.1,
  diffScale: number = 0.03,
  exhaustBonus: number = 1,
): number {
  const accuracyMultiplier = getAccuracyMultiplier(accuracy)
  const wpmAdvantage = Math.max(0, wpm - opponentWpm)
  let damage = (baseDrain + wpmAdvantage * diffScale) * accuracyMultiplier

  if (textExhausted) damage += exhaustBonus
  if (hasSurge) damage *= 1.5
  if (lowHp) damage *= 1.25

  return damage
}
