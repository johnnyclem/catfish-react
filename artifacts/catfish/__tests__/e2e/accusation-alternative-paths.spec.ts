/**
 * End-to-end Playwright suite for alternative accusation paths.
 *
 * Covers the non-happy-path routes through the accusation system:
 *
 *   1. Skip Town       — open AccusationSheet, choose "Skip Town",
 *                       verify "they got away" ending.
 *   2. Wrongful accusation — swipe everyone, accuse a DECOY, verify
 *                       "wrong call" ending + the two-portrait layout.
 *   3. Zero-facts accusation — accuse without filing any captured
 *                       facts; verifies the sheet works with an empty
 *                       evidence locker.
 *   4. Face-to-face    — swipe some profiles, sleep to Day 7 WITHOUT
 *                       accusing, verify the auto-resolution ending.
 *
 * Companion to the happy-path suite (`z-accusation-happy-path.spec.ts`)
 * and the recovery suite (`z-closed-run-recovery.spec.ts`).
 *
 * Runs serially (single worker) because all scenarios write to the
 * same localStorage active-run blob and each scenario's boot wipes it
 * first — but a fresh context per describe block keeps suites isolated.
 *
 * To run locally:
 *   pnpm --filter @workspace/catfish dev        # shell A
 *   pnpm --filter @workspace/catfish test:e2e   # shell B
 */

import { expect, test, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Shared helpers (duplicated from z-accusation-happy-path.spec.ts so this
// file is self-contained and resilient to that file's internal refactors)
// ---------------------------------------------------------------------------

const ACTIVE_RUN_KEY = "catfish/active_run/v1";

interface PersistedCandidate {
  id: string;
  displayName: string;
  isKillerCandidate: boolean;
}
interface PersistedMatch {
  id: string;
  candidateId: string;
  threadId: string;
  unmatched?: boolean;
}
interface PersistedThread {
  id: string;
  candidateId: string;
  messages: { id: string; sender: "suspect" | "player"; text: string }[];
}
interface PersistedRun {
  killer: string;
  deck: PersistedCandidate[];
  deckCursor: number;
  matches?: PersistedMatch[];
  threads?: PersistedThread[];
  facts?: { id: string; committed: boolean; capturedFromCandidateId?: string }[];
}

async function bootIntoFreshRun(page: Page): Promise<void> {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    try { window.localStorage.clear(); } catch { /* best effort */ }
  });
  await page.reload({ waitUntil: "domcontentloaded" });

  const reset = page.getByText("New Case (Reset)").first();
  if (await reset.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await reset.click();
  }
  const start = page.getByText("Start New Case").first();
  await expect(start).toBeVisible({ timeout: 30_000 });
  await start.click();

  await expect(page.getByTestId("parody-app-lotsOfFish")).toBeVisible({
    timeout: 30_000,
  });
}

async function readActiveRun(page: Page): Promise<PersistedRun> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const blob = await page.evaluate(
      (key) => window.localStorage.getItem(key),
      ACTIVE_RUN_KEY,
    );
    if (blob) {
      try {
        const parsed = JSON.parse(blob) as PersistedRun;
        if (parsed.deck && parsed.deck.length > 0) return parsed;
      } catch { /* keep polling */ }
    }
    await page.waitForTimeout(150);
  }
  throw new Error(`Active run never appeared under "${ACTIVE_RUN_KEY}"`);
}

async function swipeAllCandidates(page: Page, deckSize: number): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const cursor = await page.evaluate((key) => {
      const blob = window.localStorage.getItem(key);
      if (!blob) return -1;
      try {
        return (JSON.parse(blob) as { deckCursor?: number }).deckCursor ?? 0;
      } catch { return -1; }
    }, ACTIVE_RUN_KEY);
    if (cursor >= deckSize) break;
    const likeBtn = page.getByText("♥ Like").first();
    if (!(await likeBtn.isVisible({ timeout: 2_000 }).catch(() => false))) {
      await page.waitForTimeout(150);
      continue;
    }
    await likeBtn.click();
    await page.waitForTimeout(120);
  }
}

async function tapHomeIndicator(page: Page): Promise<void> {
  await page.getByTestId("parody-home-indicator").click();
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe("accusation — alternative paths", () => {
  let page: Page;
  const consoleErrors: string[] = [];

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 400, height: 900 } });
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

  test.setTimeout(180_000);

  // -------------------------------------------------------------------------
  // Scenario 1 — Skip Town
  // -------------------------------------------------------------------------
  test("Skip Town yields 'they got away' ending", async () => {
    await bootIntoFreshRun(page);
    const run = await readActiveRun(page);

    // Swipe at least one card so we have someone to potentially accuse.
    await page.getByTestId("parody-app-lotsOfFish").click();
    const enter = page.getByTestId("parody-lotsofish-open");
    if (await enter.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await enter.click();
    }

    const firstLike = page.getByText("♥ Like").first();
    await expect(firstLike).toBeVisible({ timeout: 5_000 });
    await firstLike.click();
    await page.waitForTimeout(200);

    // Navigate to Journal and open AccusationSheet.
    await tapHomeIndicator(page);
    await page.getByTestId("parody-app-journal").click();

    await page.getByText("Accuse A Suspect").first().click();
    const sheet = page.getByText("file an accusation");
    await expect(sheet).toBeVisible({ timeout: 5_000 });

    // Tap "Skip Town" — no candidate selection required.
    const skipTown = page.getByText("Skip Town").first();
    await expect(skipTown).toBeVisible();
    await skipTown.click();

    // EndOfRunCard should show "they got away".
    const endCard = page.getByTestId("end-of-run-card");
    await expect(endCard).toBeVisible({ timeout: 10_000 });
    await expect(endCard.getByText(/they got away/i)).toBeVisible();
    // "Back To Title" is the only sane exit since Start New Case would
    // be confusing after an escape.
    const backToTitle = endCard.getByText("Back To Title").first();
    await expect(backToTitle).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Scenario 2 — Wrongful accusation (accuse a decoy, not the killer)
  // -------------------------------------------------------------------------
  test("accusing a decoy yields 'wrong call' with two-portrait layout", async () => {
    await bootIntoFreshRun(page);
    const run = await readActiveRun(page);

    const killerCandidate = run.deck.find((c) => c.isKillerCandidate);
    expect(killerCandidate).toBeDefined();
    const decoyCandidate = run.deck.find((c) => !c.isKillerCandidate);
    expect(decoyCandidate).toBeDefined();
    const decoyRowTestId = `accuse-row-${decoyCandidate!.id}`;

    // Right-swipe every candidate so everyone appears on the AccusationSheet.
    await page.getByTestId("parody-app-lotsOfFish").click();
    const enter = page.getByTestId("parody-lotsofish-open");
    if (await enter.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await enter.click();
    }
    await swipeAllCandidates(page, run.deck.length);

    // No need to sleep — matches aren't required for the accusation sheet
    // to list candidates. Navigate directly to Journal.
    await tapHomeIndicator(page);
    await page.getByTestId("parody-app-journal").click();

    // Open the sheet and select the DECOY.
    await page.getByText("Accuse A Suspect").first().click();
    const decoyRow = page.getByTestId(decoyRowTestId);
    await expect(decoyRow).toBeVisible({ timeout: 5_000 });
    await decoyRow.click();

    // File Accusation with the decoy selected.
    const fileBtn = page.getByText("File Accusation").first();
    await expect(fileBtn).toBeVisible();
    await fileBtn.click();

    // EndOfRunCard shows "wrong call".
    const endCard = page.getByTestId("end-of-run-card");
    await expect(endCard).toBeVisible({ timeout: 10_000 });
    await expect(endCard.getByText(/wrong call/i)).toBeVisible();

    // Two-portrait layout: "you named" (decoy) + "it was" (killer).
    const cardText = await endCard.innerText();
    expect(cardText.toLowerCase()).toContain("you named");
    expect(cardText.toLowerCase()).toContain("it was");
    // Both names should appear somewhere on the card.
    expect(cardText.toLowerCase()).toContain(decoyCandidate!.displayName.toLowerCase());
    expect(cardText.toLowerCase()).toContain(killerCandidate!.displayName.toLowerCase());

    // Verify the two action buttons are present.
    await expect(endCard.getByText("Start New Case").first()).toBeVisible();
    await expect(endCard.getByText("Back To Title").first()).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Scenario 3 — Zero-facts accusation (no facts filed before accusing)
  // -------------------------------------------------------------------------
  test("accusing without filed facts still resolves to 'case closed' for the killer", async () => {
    await bootIntoFreshRun(page);
    const run = await readActiveRun(page);

    const killerCandidate = run.deck.find((c) => c.isKillerCandidate);
    expect(killerCandidate).toBeDefined();
    const killerRowTestId = `accuse-row-${killerCandidate!.id}`;

    // Right-swipe every candidate so the killer appears on the sheet.
    await page.getByTestId("parody-app-lotsOfFish").click();
    const enter = page.getByTestId("parody-lotsofish-open");
    if (await enter.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await enter.click();
    }
    await swipeAllCandidates(page, run.deck.length);

    // Navigate to Journal — NO facts filed, no chat opened.
    await tapHomeIndicator(page);
    await page.getByTestId("parody-app-journal").click();

    // AccusationSheet should open; all rows show "no facts filed".
    await page.getByText("Accuse A Suspect").first().click();
    const sheet = page.getByText("file an accusation");
    await expect(sheet).toBeVisible({ timeout: 5_000 });

    // Each row's meta text should say "no facts filed".
    const noFactsLabel = page.getByText(/no facts filed/i).first();
    await expect(noFactsLabel).toBeVisible({ timeout: 3_000 });

    // Select the killer and file.
    const killerRow = page.getByTestId(killerRowTestId);
    await killerRow.click();
    const fileBtn = page.getByText("File Accusation").first();
    await fileBtn.click();

    // Even with zero facts the killer should still resolve to "case closed".
    const endCard = page.getByTestId("end-of-run-card");
    await expect(endCard).toBeVisible({ timeout: 10_000 });
    await expect(endCard.getByText(/case closed/i)).toBeVisible();

    // Verify "the truth" section names the killer.
    const cardText = await endCard.innerText();
    expect(cardText.toLowerCase()).toContain("the truth");
    expect(cardText.toLowerCase()).toContain(killerCandidate!.displayName.toLowerCase());
  });

  // -------------------------------------------------------------------------
  // Scenario 4 — Sleep to Day 7, face-to-face auto-resolution
  // NOTE: Day 7 triggering is non-deterministic in an E2E context (deck
  // size + swipe count affect how quickly days advance). The companion
  // suite `z-legacy-day7-closed-run.spec.ts` covers this path by seeding
  // a pre-closed run directly into localStorage, which is the reliable way
  // to test the face-to-face ending and its recovery panel. This test is
  // skipped to avoid flakiness.
  // -------------------------------------------------------------------------
  test.skip("sleeping through Day 7 without accusing triggers 'face to face' ending", async () => {
    await bootIntoFreshRun(page);
    const run = await readActiveRun(page);

    const killerCandidate = run.deck.find((c) => c.isKillerCandidate);
    expect(killerCandidate).toBeDefined();

    // Swipe a few profiles (not everyone — just enough to have something
    // in the deck when we sleep). Three is enough for the sheet to list them.
    await page.getByTestId("parody-app-lotsOfFish").click();
    const enter = page.getByTestId("parody-lotsofish-open");
    if (await enter.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await enter.click();
    }

    for (let i = 0; i < Math.min(3, run.deck.length); i++) {
      const likeBtn = page.getByText("♥ Like").first();
      if (await likeBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await likeBtn.click();
        await page.waitForTimeout(150);
      }
    }

    // Sleep repeatedly until Day 7 fires the face-to-face auto-resolution.
    // The deck is small; after a few sleeps it empties and we're in the
    // "deck is dry" state where the Sleep button is visible.
    const sleepBtn = page.getByText("Sleep — End Day").first();
    const maxSleeps = 8;
    for (let i = 0; i < maxSleeps; i++) {
      // Check if end-of-run card already appeared (Day 7 auto-triggered).
      const endCard = page.getByTestId("end-of-run-card");
      if (await endCard.isVisible({ timeout: 500 }).catch(() => false)) {
        break;
      }
      if (await sleepBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await sleepBtn.click();
        await page.waitForTimeout(500);
      } else {
        // Deck not yet dry — keep swiping.
        const like = page.getByText("♥ Like").first();
        if (await like.isVisible({ timeout: 2_000 }).catch(() => false)) {
          await like.click();
          await page.waitForTimeout(150);
        }
      }
    }

    // After exhausting sleeps, the EndOfRunCard should show "face to face".
    const endCard = page.getByTestId("end-of-run-card");
    await expect(endCard).toBeVisible({ timeout: 15_000 });
    await expect(endCard.getByText(/face to face/i)).toBeVisible();

    // The card should name the killer in the truth block.
    const cardText = await endCard.innerText();
    expect(cardText.toLowerCase()).toContain(killerCandidate!.displayName.toLowerCase());

    // Verify both navigation buttons are accessible.
    await expect(endCard.getByText("Start New Case").first()).toBeVisible();
    await expect(endCard.getByText("Back To Title").first()).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Sanity — no uncaught console errors
  // -------------------------------------------------------------------------
  test("no uncaught console errors during alternative-path flows", async () => {
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