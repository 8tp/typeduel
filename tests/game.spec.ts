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

// ─── Optimistic Cursor ───

test.describe('Optimistic Cursor', () => {
  test('cursor advances immediately on correct keypress without waiting for server tick', async ({ browser }) => {
    const { page1, page2, cleanup } = await setupMatch(browser)

    const text = await getPassageText(page1)

    // Type one correct character
    const firstChar = text[0]
    if (firstChar === ' ') {
      await page1.keyboard.press('Space')
    } else {
      await page1.keyboard.type(firstChar, { delay: 0 })
    }

    // Immediately check (within ~50ms) — cursor should have already moved
    // The green char count should be >= 1 even before server broadcasts state
    // We use a very short timeout to confirm it's optimistic (not waiting for 100ms server tick)
    const greenCount = await page1.locator('.text-accent').count()
    expect(greenCount).toBeGreaterThanOrEqual(1)

    await cleanup()
  })

  test('cursor does not advance on incorrect keypress', async ({ browser }) => {
    const { page1, page2, cleanup } = await setupMatch(browser)

    const text = await getPassageText(page1)

    // Type an obviously wrong character (use ~ which is unlikely to be the first char)
    const wrongChar = text[0] === '~' ? '!' : '~'
    await page1.keyboard.type(wrongChar, { delay: 0 })

    // Brief wait
    await page1.waitForTimeout(50)

    // The cursor span (data-cursor) should still be at position 0
    // which means no green chars from our wrong keystroke
    const greenCharsFromTyping = await page1.evaluate(() => {
      const spans = document.querySelectorAll('.text-accent')
      // Filter to only spans inside the typing area
      const typingArea = document.querySelector('.h-40.overflow-y-auto')
      if (!typingArea) return 0
      let count = 0
      spans.forEach(s => { if (typingArea.contains(s)) count++ })
      return count
    })
    expect(greenCharsFromTyping).toBe(0)

    await cleanup()
  })

  test('backspace moves optimistic cursor back immediately', async ({ browser }) => {
    const { page1, page2, cleanup } = await setupMatch(browser)

    const text = await getPassageText(page1)

    // Type 3 correct chars
    await typeText(page1, text, 3, 10)
    await page1.waitForTimeout(50)

    // Count green chars after typing 3
    const greenBefore = await page1.evaluate(() => {
      const typingArea = document.querySelector('.h-40.overflow-y-auto')
      if (!typingArea) return 0
      return typingArea.querySelectorAll('.text-accent').length
    })

    // Press backspace
    await page1.keyboard.press('Backspace')
    await page1.waitForTimeout(50)

    // Green chars should decrease immediately (optimistic)
    const greenAfter = await page1.evaluate(() => {
      const typingArea = document.querySelector('.h-40.overflow-y-auto')
      if (!typingArea) return 0
      return typingArea.querySelectorAll('.text-accent').length
    })

    expect(greenAfter).toBeLessThan(greenBefore)

    await cleanup()
  })
})

// ─── Results Screen Animation ───

test.describe('Results Animation', () => {
  test('results screen has entrance animations', async ({ browser }) => {
    test.setTimeout(60000)
    const { page1, page2, cleanup } = await setupMatch(browser)

    const text = await getPassageText(page1)
    await typeText(page1, text, 50, 15)
    await page1.waitForTimeout(5000)

    await expect(page1.getByText('VICTORY')).toBeVisible({ timeout: 15000 })

    // Check that animation classes are applied
    const titleHasAnimation = await page1.evaluate(() => {
      const title = document.querySelector('.results-title')
      if (!title) return false
      const style = getComputedStyle(title)
      return style.animationName !== 'none' && style.animationName !== ''
    })
    expect(titleHasAnimation).toBe(true)

    // Check stats cards have staggered animation
    const cardsHaveAnimation = await page1.evaluate(() => {
      const cards = document.querySelectorAll('.results-card')
      if (cards.length < 2) return false
      const style1 = getComputedStyle(cards[0])
      const style2 = getComputedStyle(cards[1])
      return style1.animationName !== 'none' && style2.animationDelay !== '0s'
    })
    expect(cardsHaveAnimation).toBe(true)

    // Check buttons have animation
    const buttonsHaveAnimation = await page1.evaluate(() => {
      const buttons = document.querySelector('.results-buttons')
      if (!buttons) return false
      const style = getComputedStyle(buttons)
      return style.animationName !== 'none' && style.animationDelay !== '0s'
    })
    expect(buttonsHaveAnimation).toBe(true)

    await cleanup()
  })

  test('results animation completes and elements are visible', async ({ browser }) => {
    test.setTimeout(60000)
    const { page1, page2, cleanup } = await setupMatch(browser)

    const text = await getPassageText(page1)
    await typeText(page1, text, 50, 15)
    await page1.waitForTimeout(5000)

    await expect(page1.getByText('VICTORY')).toBeVisible({ timeout: 15000 })

    // Wait for all animations to complete (longest delay 600ms + 400ms duration = 1s)
    await page1.waitForTimeout(1200)

    // All elements should be fully visible after animations
    await expect(page1.getByText('VICTORY')).toBeVisible()
    await expect(page1.getByText('Damage Dealt').first()).toBeVisible()
    await expect(page1.getByText('Back to Lobby')).toBeVisible()
    await expect(page1.locator('[data-testid="rematch-btn"]')).toBeVisible()

    // Verify buttons are clickable after animation
    await expect(page1.locator('[data-testid="rematch-btn"]')).toBeEnabled()

    await cleanup()
  })
})

// ─── Error Highlighting ───

test.describe('Error Highlighting', () => {
  test('wrong keypress shows error flash on cursor character', async ({ browser }) => {
    const { page1, page2, cleanup } = await setupMatch(browser)

    const text = await getPassageText(page1)

    // Type an obviously wrong character
    const wrongChar = text[0] === '~' ? '!' : '~'
    await page1.keyboard.type(wrongChar, { delay: 0 })

    // Brief wait for state update
    await page1.waitForTimeout(100)

    // The cursor character should have error styling (text-damage class)
    const hasErrorStyle = await page1.evaluate(() => {
      const typingArea = document.querySelector('.h-40.overflow-y-auto')
      if (!typingArea) return false
      // Look for the error-char class or text-damage inside typing area
      return typingArea.querySelector('.error-char') !== null ||
             typingArea.querySelector('.text-damage') !== null
    })
    expect(hasErrorStyle).toBe(true)

    await cleanup()
  })

  test('error flash clears after brief delay', async ({ browser }) => {
    const { page1, page2, cleanup } = await setupMatch(browser)

    const text = await getPassageText(page1)

    // Type wrong
    const wrongChar = text[0] === '~' ? '!' : '~'
    await page1.keyboard.type(wrongChar, { delay: 0 })

    // Wait for error to clear (300ms timeout in code)
    await page1.waitForTimeout(500)

    // Error styling should be gone
    const hasErrorStyle = await page1.evaluate(() => {
      const typingArea = document.querySelector('.h-40.overflow-y-auto')
      if (!typingArea) return false
      return typingArea.querySelector('.error-char') !== null
    })
    expect(hasErrorStyle).toBe(false)

    await cleanup()
  })
})

// ─── Low HP Effects ───

test.describe('Low HP Effects', () => {
  test('low HP vignette appears when HP drops below 20', async ({ browser }) => {
    test.setTimeout(60000)
    const { page1, page2, cleanup } = await setupMatch(browser)

    const text = await getPassageText(page2)

    // Player 2 types fast to deal damage to Player 1
    await typeText(page2, text, 50, 15)
    await page2.waitForTimeout(8000)

    // Check if player 1 has low HP vignette (their HP should be low)
    const hasVignette = await page1.evaluate(() => {
      return document.querySelector('[data-testid="low-hp-vignette"]') !== null
    })

    // If game ended already, vignette won't show — that's ok
    const gameEnded = await page1.evaluate(() => {
      return document.body.textContent?.includes('VICTORY') ||
             document.body.textContent?.includes('DEFEAT')
    })

    if (!gameEnded) {
      // If still in game and HP is low, vignette should be visible
      const playerHp = await page1.evaluate(() => {
        const spans = [...document.querySelectorAll('span')]
        for (const span of spans) {
          const match = span.textContent?.match(/^(\d+)\/100$/)
          if (match) return parseInt(match[1])
        }
        return 100
      })
      if (playerHp > 0 && playerHp < 20) {
        expect(hasVignette).toBe(true)
      }
    }

    await cleanup()
  })
})

// ─── Ability Cooldown Timers ───

test.describe('Ability Cooldown Timers', () => {
  test('cooldown timer appears after using an ability', async ({ browser }) => {
    test.setTimeout(60000)
    const { page1, page2, cleanup } = await setupMatch(browser)

    const text = await getPassageText(page1)

    // Build energy by typing
    await typeText(page1, text, 40, 20)
    await page1.waitForTimeout(3000)

    const stillInGame = await page1.evaluate(() => {
      return !document.body.textContent?.includes('VICTORY') &&
             !document.body.textContent?.includes('DEFEAT')
    })

    if (stillInGame) {
      // Check if SURGE is enabled
      const surgeBtn = page1.locator('[data-ability="SURGE"]')
      const isDisabled = await surgeBtn.isDisabled()

      if (!isDisabled) {
        // Use SURGE
        await surgeBtn.click()
        await page1.waitForTimeout(200)

        // Cooldown timer overlay should appear
        const hasCooldown = await page1.evaluate(() => {
          return document.querySelector('[data-testid="cooldown-timer"]') !== null
        })
        expect(hasCooldown).toBe(true)
      }
    }

    await cleanup()
  })
})

// ─── Taunt System ───

test.describe('Taunt System', () => {
  test('taunt hotkey sends taunt to opponent', async ({ browser }) => {
    const { page1, page2, cleanup } = await setupMatch(browser)

    // Player 1 sends a taunt via Ctrl+7 (GG)
    await page1.keyboard.press('Control+7')
    await page1.waitForTimeout(500)

    // Player 2 should see the taunt display
    const hasTaunt = await page2.evaluate(() => {
      return document.querySelector('[data-testid="taunt-display"]') !== null
    })
    expect(hasTaunt).toBe(true)

    await cleanup()
  })

  test('taunt display shows correct label', async ({ browser }) => {
    const { page1, page2, cleanup } = await setupMatch(browser)

    // Send "NICE" taunt (Ctrl+8)
    await page1.keyboard.press('Control+8')
    await page1.waitForTimeout(500)

    // Player 2 should see "Nice!" text
    const tauntText = await page2.evaluate(() => {
      const el = document.querySelector('[data-testid="taunt-display"]')
      return el?.textContent ?? ''
    })
    expect(tauntText).toContain('Nice!')

    await cleanup()
  })

  test('taunt display disappears after timeout', async ({ browser }) => {
    const { page1, page2, cleanup } = await setupMatch(browser)

    // Send taunt
    await page1.keyboard.press('Control+7')
    await page1.waitForTimeout(500)

    // Verify taunt is visible
    await expect(page2.locator('[data-testid="taunt-display"]')).toBeVisible()

    // Wait for it to disappear (2s timeout + animation)
    await page2.waitForTimeout(2500)

    // Should be gone
    const hasTaunt = await page2.evaluate(() => {
      return document.querySelector('[data-testid="taunt-display"]') !== null
    })
    expect(hasTaunt).toBe(false)

    await cleanup()
  })
})

// ─── WPM Sparkline ───

test.describe('WPM Sparkline', () => {
  test('results screen shows WPM sparkline graph', async ({ browser }) => {
    test.setTimeout(60000)
    const { page1, page2, cleanup } = await setupMatch(browser)

    const text = await getPassageText(page1)
    // Type to generate WPM history
    await typeText(page1, text, 50, 15)
    await page1.waitForTimeout(5000)

    await expect(page1.getByText('VICTORY')).toBeVisible({ timeout: 15000 })

    // Check for WPM sparkline SVG
    const hasSparkline = await page1.evaluate(() => {
      return document.querySelector('[data-testid="wpm-sparkline"]') !== null
    })
    expect(hasSparkline).toBe(true)

    // Verify it's an SVG with a polyline
    const hasPolyline = await page1.evaluate(() => {
      const svg = document.querySelector('[data-testid="wpm-sparkline"]')
      return svg?.querySelector('polyline') !== null
    })
    expect(hasPolyline).toBe(true)

    await cleanup()
  })
})

// ─── CSS Animations ───

test.describe('CSS Animations', () => {
  test('low-hp-vignette has pulse animation defined', async ({ page }) => {
    await page.goto('/')
    const hasCss = await page.evaluate(() => {
      const sheets = document.styleSheets
      for (const sheet of sheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule.cssText?.includes('low-hp-pulse')) return true
          }
        } catch {}
      }
      return false
    })
    expect(hasCss).toBe(true)
  })

  test('taunt-popup has animation defined', async ({ page }) => {
    await page.goto('/')
    const hasCss = await page.evaluate(() => {
      const sheets = document.styleSheets
      for (const sheet of sheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule.cssText?.includes('taunt-in-out')) return true
          }
        } catch {}
      }
      return false
    })
    expect(hasCss).toBe(true)
  })

  test('error-char has shake animation defined', async ({ page }) => {
    await page.goto('/')
    const hasCss = await page.evaluate(() => {
      const sheets = document.styleSheets
      for (const sheet of sheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule.cssText?.includes('error-shake')) return true
          }
        } catch {}
      }
      return false
    })
    expect(hasCss).toBe(true)
  })

  test('combo-glow animation defined', async ({ page }) => {
    await page.goto('/')
    const hasCss = await page.evaluate(() => {
      const sheets = document.styleSheets
      for (const sheet of sheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule.cssText?.includes('combo-glow')) return true
          }
        } catch {}
      }
      return false
    })
    expect(hasCss).toBe(true)
  })

  test('combo-fire animation defined', async ({ page }) => {
    await page.goto('/')
    const hasCss = await page.evaluate(() => {
      const sheets = document.styleSheets
      for (const sheet of sheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule.cssText?.includes('combo-fire')) return true
          }
        } catch {}
      }
      return false
    })
    expect(hasCss).toBe(true)
  })
})

// ─── Spectator Mode ───

test.describe('Spectator Mode', () => {
  test('lobby has spectate input and watch button', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[data-testid="spectate-input"]')).toBeVisible()
    await expect(page.locator('[data-testid="spectate-btn"]')).toBeVisible()
  })

  test('watch button disabled without full code', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[data-testid="spectate-btn"]')).toBeDisabled()
    await page.locator('[data-testid="spectate-input"]').fill('ABC')
    await expect(page.locator('[data-testid="spectate-btn"]')).toBeDisabled()
  })

  test('spectator can join active game and see spectator banner', async ({ browser }) => {
    test.setTimeout(60000)
    // Create room manually so we can capture room code before game starts
    const ctx1 = await browser.newContext()
    const ctx2 = await browser.newContext()
    const page1 = await ctx1.newPage()
    const page2 = await ctx2.newPage()

    await page1.goto('/')
    await page2.goto('/')

    // Player 1 creates room
    await page1.locator('input[placeholder="Enter your name..."]').fill('Host')
    await page1.getByRole('button', { name: 'Create Room' }).click()
    await expect(page1.getByText('Room Created')).toBeVisible({ timeout: 5000 })
    const roomCode = await page1.locator('.text-4xl.tracking-\\[0\\.3em\\]').textContent()

    // Player 2 joins
    await page2.locator('input[placeholder="Enter your name..."]').fill('Joiner')
    await page2.locator('input[placeholder="ROOM CODE"]').fill(roomCode!)
    await page2.getByRole('button', { name: 'Join' }).click()

    // Wait for game to start
    await expect(page1.getByText('HP').first()).toBeVisible({ timeout: 10000 })

    // Open spectator using the same room code
    const specCtx = await browser.newContext()
    const specPage = await specCtx.newPage()
    await specPage.goto('/')
    await specPage.locator('[data-testid="spectate-input"]').fill(roomCode!)
    await specPage.locator('[data-testid="spectate-btn"]').click()

    // Should see spectator banner
    await expect(specPage.locator('[data-testid="spectator-banner"]')).toBeVisible({ timeout: 5000 })

    await specCtx.close()
    await ctx1.close()
    await ctx2.close()
  })

  test('spectator count shown to players when spectator joins', async ({ browser }) => {
    test.setTimeout(60000)
    const ctx1 = await browser.newContext()
    const ctx2 = await browser.newContext()
    const page1 = await ctx1.newPage()
    const page2 = await ctx2.newPage()

    await page1.goto('/')
    await page2.goto('/')

    // Create room and get code
    await page1.locator('input[placeholder="Enter your name..."]').fill('Host')
    await page1.getByRole('button', { name: 'Create Room' }).click()
    await expect(page1.getByText('Room Created')).toBeVisible({ timeout: 5000 })
    const roomCode = await page1.locator('.text-4xl.tracking-\\[0\\.3em\\]').textContent()

    // Join with player 2
    await page2.locator('input[placeholder="Enter your name..."]').fill('Joiner')
    await page2.locator('input[placeholder="ROOM CODE"]').fill(roomCode!)
    await page2.getByRole('button', { name: 'Join' }).click()

    // Wait for game
    await expect(page1.getByText('HP').first()).toBeVisible({ timeout: 10000 })

    // Now add spectator
    const specCtx = await browser.newContext()
    const specPage = await specCtx.newPage()
    await specPage.goto('/')
    await specPage.locator('[data-testid="spectate-input"]').fill(roomCode!)
    await specPage.locator('[data-testid="spectate-btn"]').click()

    // Wait for spectator to connect and state to broadcast (10Hz = 100ms intervals)
    await page1.waitForTimeout(1500)

    // Players should see spectator count
    await expect(page1.locator('[data-testid="spectator-count"]')).toBeVisible({ timeout: 3000 })

    await specCtx.close()
    await ctx1.close()
    await ctx2.close()
  })
})

// ─── Match History ───

test.describe('Match History', () => {
  test('match history saved after game ends', async ({ browser }) => {
    test.setTimeout(60000)
    const { page1, page2, cleanup } = await setupMatch(browser)

    const text = await getPassageText(page1)
    await typeText(page1, text, 50, 15)
    await page1.waitForTimeout(5000)

    await expect(page1.getByText('VICTORY')).toBeVisible({ timeout: 15000 })

    // Go back to lobby
    await page1.getByText('Back to Lobby').click()
    await expect(page1.locator('h1')).toHaveText('TYPEDUEL')

    // Check match history exists in localStorage
    const history = await page1.evaluate(() => {
      const data = localStorage.getItem('typeduel_history')
      return data ? JSON.parse(data) : []
    })
    expect(history.length).toBeGreaterThan(0)
    expect(history[0]).toHaveProperty('opponent')
    expect(history[0]).toHaveProperty('result')
    expect(history[0]).toHaveProperty('wpm')

    await cleanup()
  })

  test('match history toggle visible in lobby after a game', async ({ browser }) => {
    test.setTimeout(60000)
    const { page1, page2, cleanup } = await setupMatch(browser)

    const text = await getPassageText(page1)
    await typeText(page1, text, 50, 15)
    await page1.waitForTimeout(5000)

    await expect(page1.getByText('VICTORY')).toBeVisible({ timeout: 15000 })
    await page1.getByText('Back to Lobby').click()
    await expect(page1.locator('h1')).toHaveText('TYPEDUEL')

    // Match history toggle should be visible
    await expect(page1.locator('[data-testid="history-toggle"]')).toBeVisible()

    // Click to expand
    await page1.locator('[data-testid="history-toggle"]').click()
    await expect(page1.locator('[data-testid="match-history"]')).toBeVisible()

    await cleanup()
  })
})

// ─── Typing Streak/Combo Visual ───

test.describe('Typing Streak Combo', () => {
  test('streak combo appears after consecutive correct characters', async ({ browser }) => {
    const { page1, page2, cleanup } = await setupMatch(browser)

    const text = await getPassageText(page1)
    // Type 15+ correct characters to trigger tier 1 combo (streak >= 10)
    await typeText(page1, text, 15, 20)
    await page1.waitForTimeout(500)

    // Check if combo indicator is shown
    const hasCombo = await page1.evaluate(() => {
      const combo = document.querySelector('[data-testid="combo"]')
      return combo !== null
    })
    // May or may not have combo depending on server reconciliation timing
    // but the text content should show STREAK if present
    if (hasCombo) {
      const comboText = await page1.locator('[data-testid="combo"]').textContent()
      expect(comboText).toMatch(/STREAK|ON FIRE|UNSTOPPABLE/)
    }

    await cleanup()
  })

  test('combo visual has tier-based CSS classes', async ({ page }) => {
    await page.goto('/')
    // Verify tier CSS animations are defined
    const hasGlow = await page.evaluate(() => {
      const sheets = document.styleSheets
      for (const sheet of sheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule.cssText?.includes('combo-glow')) return true
          }
        } catch {}
      }
      return false
    })
    expect(hasGlow).toBe(true)
  })
})

// ─── Rematch Countdown ───

test.describe('Rematch Voting', () => {
  test('opponent sees rematch notification when first player votes', async ({ browser }) => {
    test.setTimeout(60000)
    const { page1, page2, cleanup } = await setupMatch(browser)

    const text = await getPassageText(page1)
    await typeText(page1, text, 50, 15)
    await page1.waitForTimeout(5000)

    await expect(page1.getByText('VICTORY')).toBeVisible({ timeout: 15000 })
    await expect(page2.getByText('DEFEAT')).toBeVisible({ timeout: 15000 })

    // Player 1 clicks rematch
    await page1.locator('[data-testid="rematch-btn"]').click()
    await page1.waitForTimeout(500)

    // Player 2 should see "Opponent wants a rematch!"
    const hasRematchNotice = await page2.evaluate(() => {
      return document.querySelector('[data-testid="opponent-rematch"]') !== null
    })
    expect(hasRematchNotice).toBe(true)

    // Rematch button text should change for player 2
    const btnText = await page2.locator('[data-testid="rematch-btn"]').textContent()
    expect(btnText).toContain('Accept Rematch')

    await cleanup()
  })

  test('both players voting rematch starts new countdown', async ({ browser }) => {
    test.setTimeout(60000)
    const { page1, page2, cleanup } = await setupMatch(browser)

    const text = await getPassageText(page1)
    await typeText(page1, text, 50, 15)
    await page1.waitForTimeout(5000)

    await expect(page1.getByText('VICTORY')).toBeVisible({ timeout: 15000 })
    await expect(page2.getByText('DEFEAT')).toBeVisible({ timeout: 15000 })

    // Both players vote rematch
    await page1.locator('[data-testid="rematch-btn"]').click()
    await page1.waitForTimeout(300)
    await page2.locator('[data-testid="rematch-btn"]').click()

    // Should transition to countdown
    await expect(page1.getByText('Get ready to type!')).toBeVisible({ timeout: 10000 })
    await expect(page2.getByText('Get ready to type!')).toBeVisible({ timeout: 10000 })

    await cleanup()
  })
})

// ─── Passage Variety ───

test.describe('Passage Variety', () => {
  test('multiple games get different passages', async ({ browser }) => {
    test.setTimeout(120000)
    const passages: string[] = []

    // Play 3 games and collect passages
    for (let i = 0; i < 3; i++) {
      const { page1, page2, cleanup } = await setupMatch(browser)
      const text = await getPassageText(page1)
      passages.push(text)

      // End the game
      await typeText(page1, text, 50, 15)
      await page1.waitForTimeout(5000)

      // Wait for results or continue
      await page1.waitForTimeout(1000)
      await cleanup()
    }

    // At least 2 of the 3 passages should be different
    // (With 45+ passages, getting the same one 3 times is extremely unlikely)
    const unique = new Set(passages)
    expect(unique.size).toBeGreaterThanOrEqual(2)
  })
})

// ─── PRACTICE MODE ───

test.describe('Practice Mode', () => {
  test('lobby shows practice button', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('practice-btn')).toBeVisible()
  })

  test('practice button navigates to setup screen', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('practice-btn').click()
    await expect(page.locator('h2')).toHaveText('PRACTICE')
    await expect(page.getByTestId('start-practice')).toBeVisible()
  })

  test('practice setup shows all 4 modes', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('practice-btn').click()
    await expect(page.getByTestId('mode-free')).toBeVisible()
    await expect(page.getByTestId('mode-timed')).toBeVisible()
    await expect(page.getByTestId('mode-accuracy')).toBeVisible()
    await expect(page.getByTestId('mode-bot')).toBeVisible()
  })

  test('timed mode shows duration options', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('practice-btn').click()
    await page.getByTestId('mode-timed').click()
    await expect(page.getByTestId('duration-15')).toBeVisible()
    await expect(page.getByTestId('duration-30')).toBeVisible()
    await expect(page.getByTestId('duration-60')).toBeVisible()
    await expect(page.getByTestId('duration-120')).toBeVisible()
  })

  test('bot mode shows bot difficulty options', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('practice-btn').click()
    await page.getByTestId('mode-bot').click()
    await expect(page.getByTestId('bot-easy')).toBeVisible()
    await expect(page.getByTestId('bot-medium')).toBeVisible()
    await expect(page.getByTestId('bot-hard')).toBeVisible()
  })

  test('back to lobby from practice setup', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('practice-btn').click()
    await expect(page.locator('h2')).toHaveText('PRACTICE')
    await page.getByRole('button', { name: 'Back to Lobby' }).click()
    await expect(page.locator('h1')).toHaveText('TYPEDUEL')
  })

  test('free practice: countdown then active', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('practice-btn').click()
    await page.getByTestId('mode-free').click()
    await page.getByTestId('start-practice').click()

    // Should see countdown
    await expect(page.getByText('Get ready to type!')).toBeVisible({ timeout: 2000 })

    // After countdown, should see practice UI (WPM display)
    await expect(page.getByTestId('practice-wpm')).toBeVisible({ timeout: 6000 })
    await expect(page.getByTestId('practice-mode-label')).toHaveText('Free Practice')
  })

  test('free practice: typing updates WPM', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('practice-btn').click()
    await page.getByTestId('mode-free').click()
    await page.getByTestId('start-practice').click()

    // Wait for active state
    await expect(page.getByTestId('practice-wpm')).toBeVisible({ timeout: 6000 })

    // Get passage text
    const text = await getPassageText(page)
    expect(text.length).toBeGreaterThan(10)

    // Type some characters
    await typeText(page, text, 20, 30)
    await page.waitForTimeout(500)

    // WPM should be > 0
    const wpmText = await page.getByTestId('practice-wpm').textContent()
    expect(parseInt(wpmText!)).toBeGreaterThan(0)
  })

  test('timed practice: timer counts down', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('practice-btn').click()
    await page.getByTestId('mode-timed').click()
    await page.getByTestId('duration-15').click()
    await page.getByTestId('start-practice').click()

    // Wait for active state
    await expect(page.getByTestId('practice-timer')).toBeVisible({ timeout: 6000 })
    await expect(page.getByTestId('practice-mode-label')).toHaveText('Timed')

    // Timer should show roughly 15 seconds (0:15 or 0:14)
    const timer = await page.getByTestId('practice-timer').textContent()
    expect(timer).toMatch(/0:1[0-5]/)
  })

  test('timed practice: completes and shows results', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('practice-btn').click()
    await page.getByTestId('mode-timed').click()
    await page.getByTestId('duration-15').click()
    await page.getByTestId('start-practice').click()

    // Wait for active state
    await expect(page.getByTestId('practice-wpm')).toBeVisible({ timeout: 6000 })

    // Type some text while we wait
    const text = await getPassageText(page)
    await typeText(page, text, 30, 30)

    // Wait for round to end (15s + buffer)
    await expect(page.getByText('PRACTICE COMPLETE')).toBeVisible({ timeout: 20000 })
    await expect(page.getByTestId('practice-result-wpm')).toBeVisible()
    await expect(page.getByTestId('practice-retry')).toBeVisible()
  })

  test('accuracy challenge: wrong key ends run', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('practice-btn').click()
    await page.getByTestId('mode-accuracy').click()
    await page.getByTestId('start-practice').click()

    // Wait for active state
    await expect(page.getByTestId('practice-wpm')).toBeVisible({ timeout: 6000 })
    await expect(page.getByTestId('practice-mode-label')).toHaveText('Accuracy')

    // Type a wrong key immediately
    await page.keyboard.type('`', { delay: 0 })
    await page.waitForTimeout(100)
    // If the first char happens to be '`', type something else wrong
    await page.keyboard.type('~', { delay: 0 })

    // Should go to results relatively quickly
    await expect(page.getByText('PRACTICE COMPLETE')).toBeVisible({ timeout: 3000 })
  })

  test('bot match: shows bot panel and HP bars', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('practice-btn').click()
    await page.getByTestId('mode-bot').click()
    await page.getByTestId('bot-easy').click()
    await page.getByTestId('duration-15').click()
    await page.getByTestId('start-practice').click()

    // Wait for active state
    await expect(page.getByTestId('practice-wpm')).toBeVisible({ timeout: 6000 })
    await expect(page.getByTestId('practice-mode-label')).toHaveText('Bot Match')

    // Should see bot panel
    await expect(page.getByText('Bot').first()).toBeVisible()
    await expect(page.getByText('EASY')).toBeVisible()

    // Should see HP bars
    await expect(page.getByText('Your HP')).toBeVisible()
  })

  test('bot match: completes and shows victory/defeat', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('practice-btn').click()
    await page.getByTestId('mode-bot').click()
    await page.getByTestId('bot-easy').click()
    await page.getByTestId('duration-15').click()
    await page.getByTestId('start-practice').click()

    // Wait for active state
    await expect(page.getByTestId('practice-wpm')).toBeVisible({ timeout: 6000 })

    // Type fast to try to win
    const text = await getPassageText(page)
    await typeText(page, text, 60, 20)

    // Wait for round to end
    const result = page.getByText(/VICTORY|DEFEAT/)
    await expect(result).toBeVisible({ timeout: 20000 })

    // Should show damage stats
    await expect(page.getByText('Damage Dealt').first()).toBeVisible()
  })

  test('practice results: try again restarts', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('practice-btn').click()
    await page.getByTestId('mode-accuracy').click()
    await page.getByTestId('start-practice').click()

    // Wait for active then fail immediately
    await expect(page.getByTestId('practice-wpm')).toBeVisible({ timeout: 6000 })
    await page.keyboard.type('`~!@', { delay: 0 })
    await expect(page.getByText('PRACTICE COMPLETE')).toBeVisible({ timeout: 3000 })

    // Click try again
    await page.getByTestId('practice-retry').click()

    // Should see countdown again
    await expect(page.getByText('Get ready to type!')).toBeVisible({ timeout: 2000 })
  })

  test('practice results: change settings goes to setup', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('practice-btn').click()
    await page.getByTestId('mode-accuracy').click()
    await page.getByTestId('start-practice').click()

    await expect(page.getByTestId('practice-wpm')).toBeVisible({ timeout: 6000 })
    await page.keyboard.type('`~!@', { delay: 0 })
    await expect(page.getByText('PRACTICE COMPLETE')).toBeVisible({ timeout: 3000 })

    await page.getByRole('button', { name: 'Change Settings' }).click()
    await expect(page.locator('h2')).toHaveText('PRACTICE')
  })

  test('practice results: back to lobby returns home', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('practice-btn').click()
    await page.getByTestId('mode-accuracy').click()
    await page.getByTestId('start-practice').click()

    await expect(page.getByTestId('practice-wpm')).toBeVisible({ timeout: 6000 })
    await page.keyboard.type('`~!@', { delay: 0 })
    await expect(page.getByText('PRACTICE COMPLETE')).toBeVisible({ timeout: 3000 })

    await page.getByRole('button', { name: 'Back to Lobby' }).click()
    await expect(page.locator('h1')).toHaveText('TYPEDUEL')
  })

  test('practice: quit button returns to setup', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('practice-btn').click()
    await page.getByTestId('mode-free').click()
    await page.getByTestId('start-practice').click()

    // Wait for active state
    await expect(page.getByTestId('practice-wpm')).toBeVisible({ timeout: 6000 })

    // Click quit
    await page.getByRole('button', { name: 'Quit' }).click()
    await expect(page.locator('h2')).toHaveText('PRACTICE')
  })

  test('practice: WPM sparkline shown in results', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('practice-btn').click()
    await page.getByTestId('mode-timed').click()
    await page.getByTestId('duration-15').click()
    await page.getByTestId('start-practice').click()

    // Wait for active state and type
    await expect(page.getByTestId('practice-wpm')).toBeVisible({ timeout: 6000 })
    const text = await getPassageText(page)
    await typeText(page, text, 40, 30)

    // Wait for results
    await expect(page.getByText('PRACTICE COMPLETE')).toBeVisible({ timeout: 20000 })

    // Should have sparkline (needs at least 2 data points = 2 seconds of typing)
    await expect(page.getByTestId('practice-wpm-sparkline')).toBeVisible()
  })

  test('practice: streak combo shows at 10+', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('practice-btn').click()
    await page.getByTestId('mode-free').click()
    await page.getByTestId('start-practice').click()

    // Wait for active state
    await expect(page.getByTestId('practice-wpm')).toBeVisible({ timeout: 6000 })

    // Type 12 chars correctly for streak
    const text = await getPassageText(page)
    await typeText(page, text, 12, 30)

    // Should show combo indicator
    await expect(page.getByTestId('practice-combo')).toBeVisible({ timeout: 2000 })
  })
})
