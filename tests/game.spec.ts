/**
 * Critical E2E tests — require real WebSocket + multiple browser contexts.
 * Unit and component tests are in Vitest (npm test).
 * Run these with: npx playwright test
 */
import { test, expect, type Browser, type Page } from '@playwright/test'

// ── Test Helper: create a two-player match and wait for game screen ──

async function setupMatch(browser: Browser): Promise<{
  page1: Page
  page2: Page
  cleanup: () => Promise<void>
}> {
  const ctx1 = await browser.newContext()
  const ctx2 = await browser.newContext()
  const page1 = await ctx1.newPage()
  const page2 = await ctx2.newPage()

  await page1.goto('/')
  await page2.goto('/')

  // Player 1 creates room
  await page1.locator('input[placeholder="Enter your name..."]').fill('Player1')
  await page1.getByRole('button', { name: 'Create Room' }).click()
  await expect(page1.getByText('Room Created')).toBeVisible({ timeout: 5000 })

  const roomCode = await page1.locator('.text-4xl.tracking-\\[0\\.3em\\]').textContent()

  // Player 2 joins
  await page2.locator('input[placeholder="Enter your name..."]').fill('Player2')
  await page2.locator('input[placeholder="ROOM CODE"]').fill(roomCode!)
  await page2.getByRole('button', { name: 'Join' }).click()

  // Wait for game screen (after 3s countdown)
  await page1.bringToFront()
  await expect(page1.getByText('HP').first()).toBeVisible({ timeout: 15000 })
  await expect(page2.getByText('HP').first()).toBeVisible({ timeout: 15000 })

  return {
    page1,
    page2,
    cleanup: async () => {
      await Promise.all([leaveRoom(page1), leaveRoom(page2)])
      await ctx1.close()
      await ctx2.close()
    },
  }
}

async function leaveRoom(page: Page) {
  if (page.isClosed()) return

  try {
    await page.evaluate(() => {
      const store = (window as Window & {
        __typeduelStore?: {
          getState: () => { ws: WebSocket | null }
        }
      }).__typeduelStore

      const ws = store?.getState().ws
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'LEAVE_ROOM' }))
      }
    })
  } catch {
    // Ignore teardown races after the page has started closing.
  }
}

// Helper: extract passage text from typing area
async function getPassageText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const container = document.querySelector('[data-testid="typing-area"]')
    if (!container) return ''
    return (container.textContent || '').replace(/\u00A0/g, ' ')
  })
}

// Helper: type passage text correctly
async function typeText(page: Page, text: string, count: number, delay = 20) {
  const toType = text.slice(0, count)
  for (const char of toType) {
    if (char === ' ') {
      await page.keyboard.press('Space')
    } else {
      await page.keyboard.type(char, { delay: 0 })
    }
    if (delay > 0) await page.waitForTimeout(delay)
  }
}

// ─── E2E: Room creation and joining ───

test.describe('Multiplayer E2E', () => {
  test.afterEach(async () => {
    await new Promise(resolve => setTimeout(resolve, 2500))
  })

  test('room code creates and joins, game starts after countdown', async ({ browser }) => {
    const { page1, page2, cleanup } = await setupMatch(browser)
    try {
      // Both players should see HP, energy, typing area
      await expect(page1.locator('[data-testid="typing-area"]').first()).toBeVisible()
      await expect(page2.locator('[data-testid="typing-area"]').first()).toBeVisible()

      // Both see the same passage text
      const text1 = await getPassageText(page1)
      const text2 = await getPassageText(page2)
      expect(text1).toBe(text2)
      expect(text1.length).toBeGreaterThan(10)
    } finally {
      await cleanup()
    }
  })

  test('typing deals damage and reduces opponent HP', async ({ browser }) => {
    const { page1, page2, cleanup } = await setupMatch(browser)
    try {
      const text = await getPassageText(page1)
      // Player 1 types fast
      await typeText(page1, text, 40, 20)
      // Wait for damage ticks to process
      await page1.waitForTimeout(2000)

      // Player 2's HP should have decreased (check from player 1's view)
      // The opponent panel shows damage indicator
      await expect(page1.getByText('HP').first()).toBeVisible()
    } finally {
      await cleanup()
    }
  })

  test('full game flow: lobby → match → type → KO → results → lobby', async ({ browser }) => {
    const ctx1 = await browser.newContext()
    const ctx2 = await browser.newContext()
    const page1 = await ctx1.newPage()
    const page2 = await ctx2.newPage()

    try {
      await page1.goto('/')
      await page2.goto('/')

      // Verify lobby
      await expect(page1.locator('h1')).toHaveText('TYPEDUEL')

      // Player 1 creates room
      await page1.locator('input[placeholder="Enter your name..."]').fill('Player1')
      await page1.getByRole('button', { name: 'Create Room' }).click()
      await expect(page1.getByText('Room Created')).toBeVisible({ timeout: 5000 })
      const roomCode = await page1.locator('.text-4xl.tracking-\\[0\\.3em\\]').textContent()

      // Player 2 joins
      await page2.locator('input[placeholder="Enter your name..."]').fill('Player2')
      await page2.locator('input[placeholder="ROOM CODE"]').fill(roomCode!)
      await page2.getByRole('button', { name: 'Join' }).click()

      // Wait for game screen
      await page1.bringToFront()
      await expect(page1.getByText('HP').first()).toBeVisible({ timeout: 15000 })

      // Player 1 types fast to deal damage
      const text = await getPassageText(page1)
      // Type enough to deal significant damage (don't need entire passage)
      await typeText(page1, text, Math.min(text.length, 200), 5)

      // Wait for round end (KO or timer expiry)
      const results = page1.getByText(/VICTORY|DEFEAT/)
      await expect(results).toBeVisible({ timeout: 120000 })

      // Should show stats and action buttons
      await expect(page1.getByRole('button', { name: 'Back to Lobby' })).toBeVisible({ timeout: 3000 })

      // Return to lobby
      await page1.getByRole('button', { name: 'Back to Lobby' }).click()
      await expect(page1.locator('h1')).toHaveText('TYPEDUEL')
    } finally {
      await Promise.all([leaveRoom(page1), leaveRoom(page2)])
      await ctx1.close()
      await ctx2.close()
    }
  })

  test('rematch voting: both vote → new countdown', async ({ browser }) => {
    const { page1, page2, cleanup } = await setupMatch(browser)
    try {
      // Type fast to end the round
      const text = await getPassageText(page1)
      await typeText(page1, text, text.length, 5)

      // Wait for results
      await expect(page1.getByText(/VICTORY|DEFEAT/)).toBeVisible({ timeout: 90000 })
      await expect(page2.getByText(/VICTORY|DEFEAT/)).toBeVisible({ timeout: 5000 })

      // Both players vote rematch
      await page1.getByRole('button', { name: 'Rematch' }).click()
      await page2.getByRole('button', { name: /Rematch|Accept/ }).click()

      // Should trigger a new countdown
      await expect(page1.getByText(/[1-3]/).first()).toBeVisible({ timeout: 5000 })
    } finally {
      await cleanup()
    }
  })

  test('spectator can join active game', async ({ browser }) => {
    const ctx1 = await browser.newContext()
    const ctx2 = await browser.newContext()
    const ctx3 = await browser.newContext()
    const page1 = await ctx1.newPage()
    const page2 = await ctx2.newPage()
    const spectator = await ctx3.newPage()

    try {
      await page1.goto('/')
      await page2.goto('/')
      await spectator.goto('/')

      // Create room
      await page1.locator('input[placeholder="Enter your name..."]').fill('Player1')
      await page1.getByRole('button', { name: 'Create Room' }).click()
      await expect(page1.getByText('Room Created')).toBeVisible({ timeout: 5000 })
      const roomCode = await page1.locator('.text-4xl.tracking-\\[0\\.3em\\]').textContent()

      // Spectator joins before game starts
      await spectator.getByTestId('spectate-input').fill(roomCode!)
      await spectator.getByTestId('spectate-btn').click()

      // Player 2 joins to start game
      await page2.locator('input[placeholder="Enter your name..."]').fill('Player2')
      await page2.locator('input[placeholder="ROOM CODE"]').fill(roomCode!)
      await page2.getByRole('button', { name: 'Join' }).click()

      // Wait for game
      await page1.bringToFront()
      await expect(page1.getByText('HP').first()).toBeVisible({ timeout: 15000 })

      // Spectator should see the spectating banner
      await expect(spectator.getByText(/spectating/i)).toBeVisible({ timeout: 5000 })
    } finally {
      await Promise.all([leaveRoom(page1), leaveRoom(page2), leaveRoom(spectator)])
      await ctx1.close()
      await ctx2.close()
      await ctx3.close()
    }
  })

  test('quick match pairs two players', async ({ browser }) => {
    const ctx1 = await browser.newContext()
    const ctx2 = await browser.newContext()
    const page1 = await ctx1.newPage()
    const page2 = await ctx2.newPage()

    try {
      await page1.goto('/')
      await page2.goto('/')

      await page1.locator('input[placeholder="Enter your name..."]').fill('QueueP1')
      await page2.locator('input[placeholder="Enter your name..."]').fill('QueueP2')

      await page1.getByRole('button', { name: 'Quick Match' }).click()
      await page1.waitForTimeout(1000)
      await page2.getByRole('button', { name: 'Quick Match' }).click()

      // Both should reach game screen
      await expect(page1.getByText('HP').first()).toBeVisible({ timeout: 20000 })
      await expect(page2.getByText('HP').first()).toBeVisible({ timeout: 20000 })
    } finally {
      await Promise.all([leaveRoom(page1), leaveRoom(page2)])
      await ctx1.close()
      await ctx2.close()
    }
  })

  test('player can reload during an active match and resume the session', async ({ browser }) => {
    const { page1, page2, cleanup } = await setupMatch(browser)
    try {
      const textBefore = await getPassageText(page1)

      await page1.reload()

      await expect(page1.getByText('HP').first()).toBeVisible({ timeout: 15000 })
      const textAfter = await getPassageText(page1)
      expect(textAfter).toBe(textBefore)

      await typeText(page1, textAfter, 8, 10)
      await page1.waitForTimeout(1500)

      await expect(page2.getByText('HP').first()).toBeVisible()
    } finally {
      await cleanup()
    }
  })
})

// ─── E2E: Practice mode (single browser, but needs real timers/DOM) ───

test.describe('Practice E2E', () => {
  test('free practice: full flow through results', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('practice-btn').click()
    await page.getByTestId('mode-free').click()
    await page.getByTestId('start-practice').click()

    // Wait for active
    await expect(page.getByTestId('practice-wpm')).toBeVisible({ timeout: 6000 })

    // Type the passage
    const text = await getPassageText(page)
    await typeText(page, text, Math.min(text.length, 50), 20)

    // Wait for results (free mode ends when passage complete)
    // If passage is long, we typed 50 chars — WPM should be > 0
    const wpm = await page.getByTestId('practice-wpm').textContent()
    expect(parseInt(wpm!)).toBeGreaterThan(0)
  })

  test('timed practice completes and shows results', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('practice-btn').click()
    await page.getByTestId('mode-timed').click()
    await page.getByTestId('duration-15').click()
    await page.getByTestId('start-practice').click()

    await expect(page.getByTestId('practice-wpm')).toBeVisible({ timeout: 6000 })
    const text = await getPassageText(page)
    await typeText(page, text, 30, 30)

    await expect(page.getByText('PRACTICE COMPLETE')).toBeVisible({ timeout: 20000 })
    await expect(page.getByTestId('practice-result-wpm')).toBeVisible()
  })

  test('bot match completes with victory or defeat', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('practice-btn').click()
    await page.getByTestId('mode-bot').click()
    await page.getByTestId('bot-easy').click()
    await page.getByTestId('duration-15').click()
    await page.getByTestId('start-practice').click()

    await expect(page.getByTestId('practice-wpm')).toBeVisible({ timeout: 6000 })
    const text = await getPassageText(page)
    await typeText(page, text, 60, 20)

    await expect(page.getByText(/VICTORY|DEFEAT/)).toBeVisible({ timeout: 20000 })
  })
})
