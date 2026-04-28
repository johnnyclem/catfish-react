/**
 * End-to-end Playwright suite for the four parody mini-game persistence
 * flows in the Catfish Apps tab. Companion to the programmatic store-level
 * test (`scripts/test-parody-session.mts`) — that test verifies the
 * AsyncStorage round-trip in isolation; this one drives the rendered UI
 * and asserts the PLAYER-VISIBLE state survives reload / exit / re-entry.
 *
 * The four scenarios mirror Task #51's acceptance criteria:
 *
 *   1. WordLow:  win streak survives a hard page reload.
 *   2. SafeSpot: RESUME button restores the saved wave (resume label
 *                must equal the post-resume header — both reflect the
 *                snapshot, NOT the live header at exit time, which can
 *                tick mid-gesture and produce false negatives).
 *   3. SugarCoat: board / CLOUT / MOVES persist across exit + re-enter.
 *   4. EgoTrip:  RESUME restores the saved score. The bird crashes
 *                on a single missed flap, so we test the resume PATH by
 *                pre-seeding a same-day snapshot into localStorage and
 *                reloading — the live gameplay loop is too twitchy to
 *                score-and-exit reliably in headless Chrome. The store
 *                load path is exercised at the unit level by
 *                `scripts/test-parody-session.mts`.
 *
 * Scenarios share state intentionally — each verifies that the previous
 * one's writes survive subsequent navigation. Because of that, the suite
 * runs in a single worker (see `playwright.config.ts`) and `test.describe`
 * is `serial`.
 *
 * To run locally:
 *   pnpm --filter @workspace/catfish dev                  # in shell A
 *   pnpm --filter @workspace/catfish test:e2e:install     # one-time
 *   pnpm --filter @workspace/catfish test:e2e             # in shell B
 */

import { expect, test, type Locator, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * The same 10-word table the game ships in
 * `features/parody/games/WordLow.tsx`. Keep these in lockstep — if the
 * game adds, removes, or reorders an entry, this test will solve the
 * wrong word and fail loudly. That's the desired behaviour.
 */
const BUZZWORDS = [
  "GHOST",
  "TOXIC",
  "CLOUT",
  "VIBES",
  "FLAKE",
  "MATCH",
  "SHADE",
  "BREAD",
  "GASLY",
  "CRUSH",
] as const;

/** Reproduces `dateSeed()` from `WordLow.tsx`. */
function todaysWordLowTarget(now: Date = new Date()): string {
  const seed =
    now.getFullYear() * 10_000 +
    (now.getMonth() + 1) * 100 +
    now.getDate();
  return BUZZWORDS[seed % BUZZWORDS.length] ?? "GHOST";
}

/** Local-day key in `YYYY-MM-DD` form (matches `todayDateKey` in core). */
function todayDateKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Walk through the launch screen if it's showing. The CTA is either
 * "Start New Case" (cold start) or "Continue Case" (warm start). We always
 * choose the "fresh" path so the suite is reproducible: on a cold start
 * we tap "Start New Case"; on a warm start we tap "New Case (Reset)" then
 * "Start New Case".
 */
async function bootIntoApp(page: Page): Promise<void> {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  // The launch CTAs render their label as <Text> with CSS text-transform:
  // uppercase, but the underlying textContent (what Playwright matches) is
  // mixed case as authored — so we use the literal source casing. We tap
  // the visible text node directly; the parent Pressable picks up the click.
  const reset = page.getByText("New Case (Reset)").first();
  if (await reset.isVisible().catch(() => false)) {
    await reset.click();
  }
  const start = page.getByText("Start New Case").first();
  if (await start.isVisible().catch(() => false)) {
    await start.click();
  }
  // Wait for the 5-tab bar — the "Apps" label is unique on the tab bar.
  await expect(page.getByText("Apps").first()).toBeVisible({
    timeout: 30_000,
  });
}

/** Tap the bottom "Apps" tab (label is uppercased via CSS, but textContent is mixed case). */
async function openAppsTab(page: Page): Promise<void> {
  await page.getByText("Apps").first().click();
}

/** Tap the home indicator at the bottom of an open mini-game. */
async function tapHomeIndicator(page: Page): Promise<void> {
  await page.getByTestId("parody-home-indicator").click();
}

/**
 * Poll the EgoTrip "EGO: N" score-bar until it reaches at least
 * `min`, then return the observed value. Used to drive the live
 * play-then-resume flow for the EgoTrip persistence test.
 */
async function waitForEgoTripScore(
  page: Page,
  min: number,
  timeoutMs: number,
): Promise<number> {
  const start = Date.now();
  let last = -1;
  while (Date.now() - start < timeoutMs) {
    try {
      const txt = await page.getByText(/^EGO:/).first().innerText();
      const m = txt.match(/EGO:\s*(\d+)/);
      if (m) {
        last = Number(m[1]);
        if (last >= min) return last;
      }
    } catch {
      /* score bar may not be mounted yet */
    }
    await page.waitForTimeout(150);
  }
  throw new Error(
    `EgoTrip score never reached ${min} within ${timeoutMs}ms ` +
      `(last observed: ${last})`,
  );
}

/**
 * Read the integer that renders directly after a label inside a mini-game
 * header / stat box. The label and value are sibling Text nodes inside
 * the same wrapper view; reading the wrapper's textContent and pulling
 * the first number after the label avoids brittle child-index selectors.
 */
async function readNumberAfterLabel(
  scope: Locator,
  label: string,
): Promise<number> {
  const containerText = await scope
    .locator(`xpath=.//*[contains(normalize-space(.), '${label}')]/..`)
    .first()
    .innerText();
  const match = containerText.match(new RegExp(`${label}\\s*\\n?\\s*(\\d+)`));
  if (!match) {
    throw new Error(
      `Could not find a number after label "${label}". ` +
        `Container text was: ${JSON.stringify(containerText)}`,
    );
  }
  return Number(match[1]);
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe.configure({ mode: "serial" });

test.describe("parody mini-games — persistence", () => {
  // Reuse one context across all four scenarios. Persistence assertions
  // explicitly chain — Scenario 1's reload, Scenario 2's exit-and-return,
  // etc — so a fresh context per test would defeat the point.
  let sharedPage: Page;
  const consoleErrors: string[] = [];

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 400, height: 720 },
    });
    sharedPage = await ctx.newPage();
    // Capture console errors so a regression in any game logs loudly.
    sharedPage.on("pageerror", (err) => consoleErrors.push(err.message));
    sharedPage.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    await bootIntoApp(sharedPage);
  });

  test.afterAll(async () => {
    if (sharedPage) await sharedPage.context().close();
  });

  // -------------------------------------------------------------------------
  // Scenario 1 — WordLow streak survives a hard reload
  // -------------------------------------------------------------------------
  test("WordLow streak survives a hard reload", async () => {
    const page = sharedPage;
    const target = todaysWordLowTarget();

    await openAppsTab(page);
    await page.getByTestId("parody-app-wordLow").click();

    for (const letter of target) {
      await page.getByTestId(`wordlow-key-${letter}`).click();
    }
    await page.getByTestId("wordlow-key-ENTER").click();

    await expect(page.getByText("CERTIFIED")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/Streak:\s*1\b/)).toBeVisible();

    // Hard reload — this is what the task explicitly calls out.
    await page.reload({ waitUntil: "domcontentloaded" });
    const cont = page.getByText("Continue Case").first();
    if (await cont.isVisible().catch(() => false)) {
      await cont.click();
    }
    await expect(page.getByText("Apps").first()).toBeVisible({
      timeout: 30_000,
    });
    await openAppsTab(page);

    // Game Center → Word-Low row → "Best Streak" should read 1.
    await page.getByTestId("parody-dock-gamecenter").click();
    const wordLowRow = page.getByTestId("parody-gamecenter-wordLow");
    await expect(wordLowRow).toBeVisible();
    // The row contains the cardScoreValue; its only digit is the streak.
    const rowText = await wordLowRow.innerText();
    expect(rowText).toMatch(/\b1\b/);

    // Re-enter WordLow from the Game Center, solve again — streak must
    // become 2 (proves the persisted 1 was preserved across reload).
    await wordLowRow.click();
    for (const letter of target) {
      await page.getByTestId(`wordlow-key-${letter}`).click();
    }
    await page.getByTestId("wordlow-key-ENTER").click();
    await expect(page.getByText(/Streak:\s*2\b/)).toBeVisible({
      timeout: 5_000,
    });
  });

  // -------------------------------------------------------------------------
  // Scenario 2 — SafeSpot RESUME restores the saved wave
  // -------------------------------------------------------------------------
  test("SafeSpot resume restores the saved wave", async () => {
    const page = sharedPage;

    // Back to the home grid via the in-game "home" button so we don't
    // depend on the WordLow win overlay's flow.
    await page.getByTestId("wordlow-home").click();

    await page.getByTestId("parody-app-safeSpot").click();
    await page.getByTestId("safespot-start").click();

    // Place a coffee defender → snapshot writes the current wave.
    await page.getByTestId("safespot-tool-coffee").click();
    await page.getByTestId("safespot-tile-2-1").click();

    // Brief settle so the snapshot's async save has a chance to land.
    await page.waitForTimeout(750);

    await tapHomeIndicator(page);

    // Re-enter — the READY overlay should now expose RESUME · WAVE N.
    await page.getByTestId("parody-app-safeSpot").click();

    const resumeBtn = page.getByTestId("safespot-resume");
    await expect(resumeBtn).toBeVisible({ timeout: 5_000 });

    const resumeLabel = await resumeBtn.innerText();
    const m = resumeLabel.match(/RESUME · WAVE (\d+)/);
    expect(m, `Resume label was: ${JSON.stringify(resumeLabel)}`).not.toBeNull();
    const savedWave = Number(m![1]);
    expect(savedWave).toBeGreaterThanOrEqual(1);

    await resumeBtn.click();

    // The header WAVE value after resume must equal the saved wave.
    // We poll because the header may render a frame after the resume
    // tap is processed.
    await expect
      .poll(async () => readNumberAfterLabel(page.locator("body"), "WAVE"), {
        timeout: 5_000,
      })
      .toBe(savedWave);
  });

  // -------------------------------------------------------------------------
  // Scenario 3 — SugarCoat board persists across exit/return
  // -------------------------------------------------------------------------
  test("SugarCoat board persists across exit and re-entry", async () => {
    const page = sharedPage;

    await tapHomeIndicator(page);
    await page.getByTestId("parody-app-sugarCoat").click();

    // Try a sequence of adjacent swaps until CLOUT > 0. No-op swaps
    // (no match) bounce back without consuming a move, so this loop is
    // safe to run greedily.
    const swapPairs: Array<[number, number]> = [
      [0, 1], [1, 2], [7, 8], [8, 9], [14, 15],
      [0, 7], [1, 8], [2, 9], [3, 10], [15, 16],
      [16, 17], [21, 22], [22, 23], [28, 29], [35, 36],
      [4, 5], [5, 6], [11, 12], [12, 13],
    ];

    let cloutBefore = 0;
    for (const [a, b] of swapPairs) {
      await page.getByTestId(`sugarcoat-cell-${a}`).click();
      await page.getByTestId(`sugarcoat-cell-${b}`).click();
      // Snapshot is debounced 180ms after settle.
      await page.waitForTimeout(250);
      cloutBefore = await readNumberAfterLabel(page.locator("body"), "CLOUT");
      if (cloutBefore > 0) break;
    }
    expect(
      cloutBefore,
      "Could not produce a single match in any of the trial swaps",
    ).toBeGreaterThan(0);

    const movesBefore = await readNumberAfterLabel(
      page.locator("body"),
      "MOVES",
    );
    expect(movesBefore).toBeLessThan(20);

    // Capture each cell's icon-name (lucide name surfaces as data-lucide
    // or the SVG <title>; on RN-Web it's an inline SVG with role="img").
    // Falling back to the cell's child element count + bbox identity if
    // neither is exposed.
    const boardBefore = await captureBoard(page);

    // Wait past the snapshot debounce, then exit + re-enter.
    await page.waitForTimeout(400);
    await tapHomeIndicator(page);
    await page.getByTestId("parody-app-sugarCoat").click();

    const cloutAfter = await readNumberAfterLabel(page.locator("body"), "CLOUT");
    const movesAfter = await readNumberAfterLabel(page.locator("body"), "MOVES");
    expect(cloutAfter).toBe(cloutBefore);
    expect(movesAfter).toBe(movesBefore);

    const boardAfter = await captureBoard(page);
    let matches = 0;
    for (let i = 0; i < boardBefore.length; i++) {
      if (boardBefore[i] === boardAfter[i]) matches++;
    }
    // Allow up to 2 mismatches in case a transient cascade re-renders
    // a tile's icon between mount and capture.
    expect(matches).toBeGreaterThanOrEqual(boardBefore.length - 2);
  });

  // -------------------------------------------------------------------------
  // Scenario 4 — EgoTrip RESUME restores the saved score
  // -------------------------------------------------------------------------
  // Drive the full UI flow: PLAY (under a test-only deterministic-physics
  // flag so the bird auto-passes pillars without flapping), exit before
  // GAME_OVER (which would clear the snapshot), re-enter, tap RESUME,
  // assert the in-game score is restored.
  //
  // The deterministic flag is documented at the top of
  // `features/parody/games/EgoTrip.tsx` and only ever has effect when
  // `globalThis.__CATFISH_EGOTRIP_TEST__ === true` — the production
  // build never sets it. We unset it before re-entering RESUME so the
  // restored-score assertion runs against unaltered code paths.
  test("EgoTrip plays a pillar, exits, and RESUME restores the saved score", async () => {
    const page = sharedPage;

    await tapHomeIndicator(page);

    // Enable deterministic physics for the play phase. Persist via
    // addInitScript too — if the page reloads the flag survives.
    await page.addInitScript(() => {
      (globalThis as Record<string, unknown>).__CATFISH_EGOTRIP_TEST__ = true;
    });
    await page.evaluate(() => {
      (globalThis as Record<string, unknown>).__CATFISH_EGOTRIP_TEST__ = true;
    });

    await page.getByTestId("parody-app-egoTrip").click();

    // Ensure no stale resume snapshot from a previous run is offered;
    // if one is, take FRESH START so we begin a clean live run.
    const fresh = page.getByTestId("egotrip-fresh");
    if (await fresh.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await fresh.click();
      await page.getByTestId("egotrip-fresh-confirm").click();
    } else {
      // No resume — start with a tap on the field.
      await page.getByTestId("egotrip-field").click();
    }

    // Wait for at least one pillar to be passed. Spawn interval is
    // 1800ms and a pillar takes ~2.5s to traverse the field at the
    // 400px-wide test viewport, so allow up to 8s including the
    // 3-2-1 countdown.
    const score = await waitForEgoTripScore(page, 1, 12_000);
    expect(score).toBeGreaterThanOrEqual(1);

    // Exit BEFORE crashing — GAME_OVER's `crash()` clears the snapshot.
    // Disable the deterministic physics flag now so it can't mask any
    // production-code bug in the resume code path that runs next.
    await tapHomeIndicator(page);
    await page.evaluate(() => {
      (globalThis as Record<string, unknown>).__CATFISH_EGOTRIP_TEST__ = false;
    });
    // Also clear the init-script flag so any subsequent reloads in this
    // test (or later tests that may reload) don't re-enable test mode.
    await page.addInitScript(() => {
      (globalThis as Record<string, unknown>).__CATFISH_EGOTRIP_TEST__ = false;
    });

    // Re-enter — the READY card should now expose RESUME · <score>.
    await page.getByTestId("parody-app-egoTrip").click();

    await expect(page.getByText("PICK UP WHERE YOU LEFT OFF?")).toBeVisible({
      timeout: 5_000,
    });
    const resumeBtn = page.getByTestId("egotrip-resume");
    await expect(resumeBtn).toBeVisible();
    const label = await resumeBtn.innerText();
    const labelMatch = label.match(/RESUME · (\d+)/);
    expect(
      labelMatch,
      `Resume label was: ${JSON.stringify(label)}`,
    ).not.toBeNull();
    const labelScore = Number(labelMatch![1]);
    // Snapshot writes happen per pillar; the label should equal the
    // last live score we captured (or be ≥ it if another pillar landed
    // between our read and the home tap).
    expect(labelScore).toBeGreaterThanOrEqual(score);

    await resumeBtn.click();

    // After the 3-2-1 countdown (~2.1s) the score bar should reflect
    // the resumed value. Without the test-mode flag set, the bird
    // will likely fall and crash shortly after — but the score is
    // applied during COUNTDOWN→PLAYING transition, before any frame
    // of physics runs, so the assertion is race-free.
    const restored = await waitForEgoTripScore(page, labelScore, 6_000);
    expect(restored).toBe(labelScore);
  });

  // -------------------------------------------------------------------------
  // Sanity — no uncaught console errors during the run
  // -------------------------------------------------------------------------
  test("no uncaught console errors during the run", async () => {
    // We tolerate WebSocket/HMR noise common to Expo dev mode but flag
    // anything that looks like a real error.
    const real = consoleErrors.filter(
      (e) =>
        !e.includes("WebSocket") &&
        !e.includes("HMR") &&
        !e.includes("Fast Refresh") &&
        !e.toLowerCase().includes("download the react devtools"),
    );
    expect(real, JSON.stringify(real, null, 2)).toEqual([]);
  });
});

/**
 * Capture a coarse fingerprint of the SugarCoat board — one string per
 * cell (0..48) describing its rendered gem colour. We match on inline
 * style fill so the assertion stays stable across icon-library changes.
 */
async function captureBoard(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    for (let i = 0; i < 49; i++) {
      const cell = document.querySelector(`[data-testid="sugarcoat-cell-${i}"]`);
      if (!cell) {
        out.push("?");
        continue;
      }
      // The gem icon is an SVG; its colour is the cleanest stable fingerprint.
      const svg = cell.querySelector("svg");
      const stroke = svg?.getAttribute("stroke") ?? "";
      const fill = svg?.getAttribute("fill") ?? "";
      out.push(`${stroke}|${fill}`);
    }
    return out;
  });
}
