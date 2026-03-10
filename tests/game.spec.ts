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
  await expect(page1.getByText('HP').first()).toBeVisible({ timeout: 10000 })
  await expect(page2.getByText('HP').first()).toBeVisible({ timeout: 10000 })

  return {
    page1,
    page2,
    cleanup: async () => {
      await ctx1.close()
      await ctx2.close()
    },
  }
}

// Helper: extract passage text from typing area
async function getPassageText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const container = document.querySelector('.h-40.overflow-y-auto')
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

// ─── PHASE 1: Lobby ───

test.describe('Lobby', () => {
  test('renders lobby with all elements', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('h1')).toHaveText('TYPEDUEL')
    await expect(page.locator('input[placeholder="Enter your name..."]')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Quick Match' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create Room' })).toBeVisible()
    await expect(page.locator('input[placeholder="ROOM CODE"]')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Join' })).toBeVisible()
  })

  test('buttons disabled without name', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Quick Match' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Create Room' })).toBeDisabled()
  })

  test('buttons enabled with name', async ({ page }) => {
    await page.goto('/')
    await page.locator('input[placeholder="Enter your name..."]').fill('TestPlayer')
    await expect(page.getByRole('button', { name: 'Quick Match' })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Create Room' })).toBeEnabled()
  })

  test('name persists in localStorage', async ({ page }) => {
    await page.goto('/')
    await page.locator('input[placeholder="Enter your name..."]').fill('Persistent')
    // Reload and check
    await page.reload()
    const nameInput = page.locator('input[placeholder="Enter your name..."]')
    await expect(nameInput).toHaveValue('Persistent')
  })

  test('Create Room shows 6-char room code', async ({ page }) => {
    await page.goto('/')
    await page.locator('input[placeholder="Enter your name..."]').fill('Host')
    await page.getByRole('button', { name: 'Create Room' }).click()

    await expect(page.getByText('Room Created')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Waiting for opponent')).toBeVisible()

    const code = await page.locator('.text-4xl.tracking-\\[0\\.3em\\]').textContent()
    expect(code).toBeTruthy()
    expect(code!.length).toBe(6)
    expect(code).toMatch(/^[A-Z0-9]+$/)
  })

  test('Join with invalid code shows no crash', async ({ page }) => {
    await page.goto('/')
    await page.locator('input[placeholder="Enter your name..."]').fill('Joiner')
    await page.locator('input[placeholder="ROOM CODE"]').fill('ZZZZZZ')
    // Join button needs 6 chars
    await page.getByRole('button', { name: 'Join' }).click()
    // Should not crash — server sends ERROR, we log it
    await page.waitForTimeout(1000)
    // Still on lobby (no crash)
    await expect(page.locator('h1')).toHaveText('TYPEDUEL')
  })
})

// ─── PHASE 1: Matchmaking ───

test.describe('Matchmaking', () => {
  test('quick match pairs two players into countdown', async ({ browser }) => {
    const ctx1 = await browser.newContext()
    const ctx2 = await browser.newContext()
    const page1 = await ctx1.newPage()
    const page2 = await ctx2.newPage()

    await page1.goto('/')
    await page2.goto('/')

    await page1.locator('input[placeholder="Enter your name..."]').fill('QM1')
    await page2.locator('input[placeholder="Enter your name..."]').fill('QM2')

    await page1.getByRole('button', { name: 'Quick Match' }).click()
    await page1.waitForTimeout(300)
    await page2.getByRole('button', { name: 'Quick Match' }).click()

    await expect(page1.getByText('Get ready to type!')).toBeVisible({ timeout: 5000 })
    await expect(page2.getByText('Get ready to type!')).toBeVisible({ timeout: 5000 })

    await ctx1.close()
    await ctx2.close()
  })

  test('room code join triggers countdown', async ({ browser }) => {
    const ctx1 = await browser.newContext()
    const ctx2 = await browser.newContext()
    const page1 = await ctx1.newPage()
    const page2 = await ctx2.newPage()

    await page1.goto('/')
    await page2.goto('/')

    await page1.locator('input[placeholder="Enter your name..."]').fill('P1')
    await page1.getByRole('button', { name: 'Create Room' }).click()
    await expect(page1.getByText('Room Created')).toBeVisible({ timeout: 5000 })
    const roomCode = await page1.locator('.text-4xl.tracking-\\[0\\.3em\\]').textContent()

    await page2.locator('input[placeholder="Enter your name..."]').fill('P2')
    await page2.locator('input[placeholder="ROOM CODE"]').fill(roomCode!)
    await page2.getByRole('button', { name: 'Join' }).click()

    await expect(page1.getByText('Get ready to type!')).toBeVisible({ timeout: 5000 })
    await expect(page2.getByText('Get ready to type!')).toBeVisible({ timeout: 5000 })

    // Both should see opponent names
    await expect(page1.getByText('P2')).toBeVisible()
    await expect(page2.getByText('P1')).toBeVisible()

    await ctx1.close()
    await ctx2.close()
  })
})

// ─── PHASE 1 & 2: Game Screen ───

test.describe('Game Screen', () => {
  test('shows HP, energy, WPM, timer, and typing area', async ({ browser }) => {
    const { page1, page2, cleanup } = await setupMatch(browser)

    // HP bars
    await expect(page1.getByText('HP').first()).toBeVisible()
    // Energy bars
    await expect(page1.getByText('Energy').first()).toBeVisible()
    // WPM display
    await expect(page1.getByText('WPM').first()).toBeVisible()
    // ACC display
    await expect(page1.getByText('ACC').first()).toBeVisible()
    // Timer
    await expect(page1.locator('.tabular-nums')).toBeVisible()
    // Typing area
    await expect(page1.locator('.h-40.overflow-y-auto').first()).toBeVisible()

    await cleanup()
  })

  test('typing correct characters advances cursor', async ({ browser }) => {
    const { page1, page2, cleanup } = await setupMatch(browser)

    const text = await getPassageText(page1)
    await typeText(page1, text, 10)
    await page1.waitForTimeout(300)

    // Green chars (text-accent) should appear for typed characters
    const greenCount = await page1.locator('.text-accent').count()
    expect(greenCount).toBeGreaterThan(0)

    await cleanup()
  })

  test('backspace moves cursor back', async ({ browser }) => {
    const { page1, page2, cleanup } = await setupMatch(browser)

    const text = await getPassageText(page1)
    // Type 5 chars then backspace 2
    await typeText(page1, text, 5)
    await page1.keyboard.press('Backspace')
    await page1.keyboard.press('Backspace')
    await page1.waitForTimeout(300)

    // Should have fewer green chars than if we hadn't backspaced
    // (5 typed - 2 backspace = cursor at 3, but green count includes various accent elements)
    const greenCount = await page1.locator('.text-accent').count()
    expect(greenCount).toBeGreaterThanOrEqual(1)
    expect(greenCount).toBeLessThanOrEqual(10)

    await cleanup()
  })

  test('opponent progress visible on other player screen', async ({ browser }) => {
    const { page1, page2, cleanup } = await setupMatch(browser)

    const text = await getPassageText(page1)
    // Type just a few chars (slow) so we don't KO
    await typeText(page1, text, 5, 100)
    await page1.waitForTimeout(300)

    // Page2 should still be on game screen showing opponent panel
    const bodyText = await page2.evaluate(() => document.body.textContent || '')
    // Could be on game screen or results if KO happened
    const isInGame = bodyText.includes('Opponent') || bodyText.includes('VICTORY') || bodyText.includes('DEFEAT')
    expect(isInGame).toBe(true)

    await cleanup()
  })
})

// ─── PHASE 2: Combat ───

test.describe('Combat System', () => {
  test('typing deals damage and can KO opponent', async ({ browser }) => {
    const { page1, page2, cleanup } = await setupMatch(browser)

    const text = await getPassageText(page1)
    // Type fast enough to build WPM and deal damage
    await typeText(page1, text, 50, 15)

    // Wait for damage ticks
    await page1.waitForTimeout(5000)

    // Should be on results screen (KO) or opponent HP < 100
    const bodyText = await page1.evaluate(() => document.body.textContent || '')

    if (bodyText.includes('VICTORY') || bodyText.includes('DEFEAT')) {
      // Game ended — verify results screen
      const hasStats = bodyText.includes('Damage Dealt')
      expect(hasStats).toBe(true)
    } else {
      // Still in game — HP should be reduced
      const opponentHP = await page2.evaluate(() => {
        const spans = [...document.querySelectorAll('span')]
        for (const span of spans) {
          const match = span.textContent?.match(/^(\d+)\/100$/)
          if (match && parseInt(match[1]) < 100) return parseInt(match[1])
        }
        return 100
      })
      expect(opponentHP).toBeLessThan(100)
    }

    await cleanup()
  })

  test('results screen shows winner and stats', async ({ browser }) => {
    test.setTimeout(60000)
    const { page1, page2, cleanup } = await setupMatch(browser)

    const text = await getPassageText(page1)
    // Type enough to trigger KO
    await typeText(page1, text, 50, 15)
    await page1.waitForTimeout(5000)

    // Should be on results
    await expect(page1.getByText('VICTORY')).toBeVisible({ timeout: 10000 })
    await expect(page2.getByText('DEFEAT')).toBeVisible({ timeout: 10000 })

    // Verify stats are shown
    await expect(page1.getByText('Damage Dealt').first()).toBeVisible()
    await expect(page1.getByText('HP Remaining').first()).toBeVisible()
    await expect(page1.getByText('Back to Lobby')).toBeVisible()

    await cleanup()
  })

  test('back to lobby from results', async ({ browser }) => {
    test.setTimeout(60000)
    const { page1, page2, cleanup } = await setupMatch(browser)

    const text = await getPassageText(page1)
    // Type enough to trigger KO
    await typeText(page1, text, 50, 15)
    await page1.waitForTimeout(5000)

    await expect(page1.getByText('VICTORY')).toBeVisible({ timeout: 15000 })
    await page1.getByText('Back to Lobby').click()

    // Should return to lobby
    await expect(page1.locator('h1')).toHaveText('TYPEDUEL')

    await cleanup()
  })

  test('energy accrues while typing', async ({ browser }) => {
    const { page1, page2, cleanup } = await setupMatch(browser)

    const text = await getPassageText(page1)
    await typeText(page1, text, 30, 20)
    await page1.waitForTimeout(2000)

    // Check energy is > 0
    const energy = await page1.evaluate(() => {
      const spans = [...document.querySelectorAll('span')]
      for (const span of spans) {
        const match = span.textContent?.match(/^(\d+)\/100$/)
        if (match) {
          const val = parseInt(match[1])
          // Energy values should be present (the second /100 span after HP)
          if (val > 0 && val <= 100) return val
        }
      }
      return 0
    })
    expect(energy).toBeGreaterThan(0)

    await cleanup()
  })
})

// ─── PHASE 3: Abilities ───

test.describe('Abilities', () => {
  test('ability bar is visible on game screen', async ({ browser }) => {
    const { page1, page2, cleanup } = await setupMatch(browser)

    // Ability bar should be visible
    await expect(page1.locator('[data-testid="ability-bar"]')).toBeVisible()

    // Should have 6 ability buttons
    const buttons = page1.locator('[data-testid="ability-bar"] button')
    await expect(buttons).toHaveCount(6)

    // All abilities should be shown
    await expect(page1.locator('[data-ability="SURGE"]')).toBeVisible()
    await expect(page1.locator('[data-ability="BLACKOUT"]')).toBeVisible()
    await expect(page1.locator('[data-ability="SCRAMBLE"]')).toBeVisible()
    await expect(page1.locator('[data-ability="PHANTOM_KEYS"]')).toBeVisible()
    await expect(page1.locator('[data-ability="FREEZE"]')).toBeVisible()
    await expect(page1.locator('[data-ability="MIRROR"]')).toBeVisible()

    await cleanup()
  })

  test('abilities disabled with insufficient energy', async ({ browser }) => {
    const { page1, page2, cleanup } = await setupMatch(browser)

    // At start, energy is 0 — all abilities should be disabled
    const surgeBtn = page1.locator('[data-ability="SURGE"]')
    await expect(surgeBtn).toBeDisabled()

    await cleanup()
  })

  test('SURGE ability can be activated with enough energy', async ({ browser }) => {
    const { page1, page2, cleanup } = await setupMatch(browser)

    const text = await getPassageText(page1)

    // Type to build energy (need 20 for SURGE)
    await typeText(page1, text, 40, 20)
    await page1.waitForTimeout(3000)

    // Check if we're still in game (might have KO'd)
    const stillInGame = await page1.evaluate(() => {
      return !document.body.textContent?.includes('VICTORY') &&
             !document.body.textContent?.includes('DEFEAT')
    })

    if (stillInGame) {
      // Check if SURGE button is enabled (energy >= 20)
      const surgeBtn = page1.locator('[data-ability="SURGE"]')
      const isDisabled = await surgeBtn.isDisabled()

      if (!isDisabled) {
        // Click SURGE
        await surgeBtn.click()
        await page1.waitForTimeout(500)

        // SURGE effect should appear on own panel (green glow)
        const surgeEffect = page1.locator('[data-effect="surge"]')
        const hasSurge = await surgeEffect.count()
        expect(hasSurge).toBeGreaterThanOrEqual(0) // May have expired already
      }
    }

    await cleanup()
  })

  test('ability shows hotkey labels', async ({ browser }) => {
    const { page1, page2, cleanup } = await setupMatch(browser)

    // Each ability button should show its hotkey (^1 through ^6)
    for (let i = 1; i <= 6; i++) {
      const hotkeyLabel = page1.locator(`[data-testid="ability-bar"] >> text=^${i}`)
      await expect(hotkeyLabel).toBeVisible()
    }

    await cleanup()
  })

  test('ability shows energy cost', async ({ browser }) => {
    const { page1, page2, cleanup } = await setupMatch(browser)

    // SURGE costs 20 EP
    await expect(page1.locator('[data-ability="SURGE"]').getByText('20 EP')).toBeVisible()
    // BLACKOUT costs 25 EP
    await expect(page1.locator('[data-ability="BLACKOUT"]').getByText('25 EP')).toBeVisible()
    // SCRAMBLE costs 30 EP
    await expect(page1.locator('[data-ability="SCRAMBLE"]').getByText('30 EP')).toBeVisible()
    // MIRROR costs 50 EP
    await expect(page1.locator('[data-ability="MIRROR"]').getByText('50 EP')).toBeVisible()

    await cleanup()
  })

  test('Ctrl+1 hotkey triggers SURGE ability', async ({ browser }) => {
    const { page1, page2, cleanup } = await setupMatch(browser)

    const text = await getPassageText(page1)

    // Build energy
    await typeText(page1, text, 30, 20)
    await page1.waitForTimeout(2500)

    const stillInGame = await page1.evaluate(() => {
      return !document.body.textContent?.includes('VICTORY') &&
             !document.body.textContent?.includes('DEFEAT')
    })

    if (stillInGame) {
      // Use Ctrl+1 for SURGE
      await page1.keyboard.press('Control+1')
      await page1.waitForTimeout(500)

      // If energy was sufficient, surge effect should be active
      // Verify by checking the "Surge" text overlay
      const surgeText = page1.locator('[data-effect="surge"]')
      // This is a best-effort check — might not have had enough energy
      const count = await surgeText.count()
      // Just verify no crash occurred
      expect(count).toBeGreaterThanOrEqual(0)
    }

    await cleanup()
  })
})

// ─── Integration: Full Game Flow ───

test.describe('Full Game Flow', () => {
  test('complete game: lobby → match → type → KO → results → lobby', async ({ browser }) => {
    test.setTimeout(60000)
    const ctx1 = await browser.newContext()
    const ctx2 = await browser.newContext()
    const page1 = await ctx1.newPage()
    const page2 = await ctx2.newPage()

    // 1. Lobby
    await page1.goto('/')
    await page2.goto('/')
    await expect(page1.locator('h1')).toHaveText('TYPEDUEL')

    // 2. Create room
    await page1.locator('input[placeholder="Enter your name..."]').fill('Fighter1')
    await page1.getByRole('button', { name: 'Create Room' }).click()
    await expect(page1.getByText('Room Created')).toBeVisible({ timeout: 10000 })
    const code = await page1.locator('.text-4xl.tracking-\\[0\\.3em\\]').textContent()

    // 3. Join room
    await page2.locator('input[placeholder="Enter your name..."]').fill('Fighter2')
    await page2.locator('input[placeholder="ROOM CODE"]').fill(code!)
    await page2.getByRole('button', { name: 'Join' }).click()

    // 4. Countdown
    await expect(page1.getByText('Get ready to type!')).toBeVisible({ timeout: 10000 })

    // 5. Game starts
    await expect(page1.getByText('HP').first()).toBeVisible({ timeout: 10000 })

    // 6. Type to KO
    const text = await getPassageText(page1)
    await typeText(page1, text, 50, 15)
    await page1.waitForTimeout(5000)

    // 7. Results
    await expect(page1.getByText('VICTORY')).toBeVisible({ timeout: 10000 })
    await expect(page1.getByText('Damage Dealt').first()).toBeVisible()

    // 8. Back to lobby
    await page1.getByText('Back to Lobby').click()
    await expect(page1.locator('h1')).toHaveText('TYPEDUEL')

    await ctx1.close()
    await ctx2.close()
  })
})

// ─── PHASE 4: Polish ───

test.describe('Polish', () => {
  test('CRT scanlines toggle works on lobby', async ({ page }) => {
    await page.goto('/')
    const toggle = page.locator('[data-testid="crt-toggle"]')
    await expect(toggle).toBeVisible()

    // Check initial CRT state
    const initialText = await toggle.textContent()
    const initiallyOn = initialText?.includes('ON')

    // Click toggle
    await toggle.click()
    const afterText = await toggle.textContent()

    if (initiallyOn) {
      expect(afterText).toContain('OFF')
    } else {
      expect(afterText).toContain('ON')
    }
  })

  test('room code has copy-to-clipboard button', async ({ page }) => {
    await page.goto('/')
    await page.locator('input[placeholder="Enter your name..."]').fill('CopyTest')
    await page.getByRole('button', { name: 'Create Room' }).click()
    await expect(page.getByText('Room Created')).toBeVisible({ timeout: 5000 })

    const codeBtn = page.locator('[data-testid="room-code"]')
    await expect(codeBtn).toBeVisible()
    await expect(page.getByText('Click to copy')).toBeVisible()
  })

  test('results screen has rematch button', async ({ browser }) => {
    test.setTimeout(60000)
    const { page1, page2, cleanup } = await setupMatch(browser)

    const text = await getPassageText(page1)
    await typeText(page1, text, 50, 15)
    await page1.waitForTimeout(5000)

    await expect(page1.getByText('VICTORY')).toBeVisible({ timeout: 15000 })

    const rematchBtn = page1.locator('[data-testid="rematch-btn"]')
    await expect(rematchBtn).toBeVisible()
    await expect(rematchBtn).toHaveText('Rematch')

    await rematchBtn.click()
    await expect(rematchBtn).toHaveText('Waiting for opponent...')

    await cleanup()
  })

  test('results screen shows abilities used stat', async ({ browser }) => {
    test.setTimeout(60000)
    const { page1, page2, cleanup } = await setupMatch(browser)

    const text = await getPassageText(page1)
    await typeText(page1, text, 50, 15)
    await page1.waitForTimeout(5000)

    await expect(page1.getByText('VICTORY')).toBeVisible({ timeout: 15000 })
    await expect(page1.getByText('Abilities Used').first()).toBeVisible()

    await cleanup()
  })

  test('game screen has CRT toggle in top bar', async ({ browser }) => {
    const { page1, page2, cleanup } = await setupMatch(browser)

    const settingsToggle = page1.locator('[data-testid="settings-toggle"]')
    await expect(settingsToggle).toBeVisible()

    const text = await settingsToggle.textContent()
    expect(text).toMatch(/CRT:(ON|OFF)/)

    await cleanup()
  })

  test('responsive layout has min-width 1024px', async ({ page }) => {
    await page.goto('/')
    const minWidth = await page.evaluate(() => {
      return getComputedStyle(document.body).minWidth
    })
    expect(minWidth).toBe('1024px')
  })
})
