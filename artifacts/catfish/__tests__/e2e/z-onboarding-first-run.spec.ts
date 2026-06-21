/**
 * End-to-end smoke test for the first-run onboarding overlay.
 *
 * Onboarding (Phase 11) renders a full-screen overlay (zIndex 9999) on
 * top of the title screen for fresh installs — no active run, no
 * archived runs, onboarding not yet completed. The overlay intercepts
 * all pointer events, so the ONLY way forward is its own advance button
 * ("Continue" on steps 1–7, "Let's Go!" on the final step). Every other
 * e2e suite seeds `catfish/onboarding/v1` as completed to skip this; THIS
 * suite is the one that actually drives the tutorial to completion so the
 * first-run path can't silently rot.
 *
 * What it pins:
 *   - The overlay appears on a genuinely fresh install.
 *   - Tapping the advance button walks all 8 steps without soft-locking
 *     (the swipe/chat/capture auto-advance steps must not trap the player
 *     — they each still expose a working "Continue").
 *   - Onboarding auto-starts a run by the swipe step, so completing the
 *     flow lands on a title screen offering "Continue Case", and that
 *     route reaches the actual game (Lots 'o Fish).
 *
 * To run locally:
 *   pnpm --filter @workspace/catfish dev        # shell A
 *   pnpm --filter @workspace/catfish test:e2e   # shell B
 */

import { expect, test, type Page } from "@playwright/test";

const ONBOARDING_KEY = "catfish/onboarding/v1";
const TOTAL_STEPS = 8;

async function bootFreshInstall(page: Page): Promise<void> {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    try {
      // A genuinely fresh install: no run, no archive, no onboarding
      // record. This is the exact state that triggers the overlay.
      window.localStorage.clear();
    } catch {
      /* best effort */
    }
  });
  await page.reload({ waitUntil: "domcontentloaded" });
}

test.describe("onboarding — first run", () => {
  let page: Page;
  const consoleErrors: string[] = [];

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 400, height: 900 },
    });
    page = await ctx.newPage();
    page.on("pageerror", (err) => consoleErrors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
  });

  test.afterAll(async () => {
    if (page) {
      await page.evaluate(() => window.localStorage.clear()).catch(() => {});
      await page.context().close();
    }
  });

  test.setTimeout(120_000);

  test("fresh install walks the 8-step tutorial and reaches the game", async () => {
    await bootFreshInstall(page);

    // The overlay's step indicator confirms onboarding is up.
    await expect(page.getByText(/Step 1 of 8/i)).toBeVisible({
      timeout: 30_000,
    });

    // Walk every step via its advance button. Steps 1–7 read "Continue";
    // the final step reads "Let's Go!". Drive off the visible step
    // indicator so we don't over- or under-tap if a step auto-advances.
    for (let i = 0; i < TOTAL_STEPS; i++) {
      const indicator = page.getByText(new RegExp(`Step ${i + 1} of 8`, "i"));
      await expect(indicator).toBeVisible({ timeout: 10_000 });

      // Exact match: once onboarding auto-starts a run (swipe step), the
      // title screen behind the overlay shows "Continue Case", which a
      // substring "Continue" match would wrongly grab (and the overlay
      // would then intercept the click).
      const advance =
        i === TOTAL_STEPS - 1
          ? page.getByText("Let's Go!", { exact: true }).first()
          : page.getByText("Continue", { exact: true }).first();
      await expect(advance).toBeVisible({ timeout: 10_000 });
      await advance.click();
      await page.waitForTimeout(150);
    }

    // Onboarding complete — the overlay (and its step indicator) is gone.
    await expect(page.getByText(/Step \d of 8/i)).toHaveCount(0, {
      timeout: 10_000,
    });

    // Onboarding auto-started a run by the swipe step, so the title now
    // offers "Continue Case". Following it reaches the phone shell.
    const continueCase = page.getByText("Continue Case").first();
    await expect(continueCase).toBeVisible({ timeout: 10_000 });
    await continueCase.click();

    // We land inside the phone shell — the last onboarding step left the
    // shell pointed at the Journal, so assert the always-present home
    // indicator rather than a specific app, then tap home to confirm the
    // home grid (and Lots 'o Fish tile) are reachable.
    const homeIndicator = page.getByTestId("parody-home-indicator");
    await expect(homeIndicator).toBeVisible({ timeout: 30_000 });
    await homeIndicator.click();
    await expect(page.getByTestId("parody-app-lotsOfFish")).toBeVisible({
      timeout: 30_000,
    });

    // The persisted onboarding record should now read completed so the
    // overlay never returns on subsequent boots.
    const onboarding = await page.evaluate((key) => {
      const blob = window.localStorage.getItem(key);
      return blob ? (JSON.parse(blob) as { completed?: boolean }) : null;
    }, ONBOARDING_KEY);
    expect(onboarding?.completed).toBe(true);
  });

  test("no uncaught console errors during onboarding", async () => {
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
