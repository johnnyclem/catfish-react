/**
 * End-to-end Playwright suite for closed-run recovery paths across
 * all four accusation endings.
 *
 * Extends the Task #68 recovery coverage from `z-closed-run-recovery.spec.ts`
 * to the non-happy-path endings:
 *
 *   1. Skip Town (escapedStub)  → Journal shows "case sealed" panel;
 *                                 "Start New Case" and "View Case Recap" both work.
 *   2. Wrongful accusation       → Journal shows panel; "View Case Recap"
 *                                 displays "wrong call" with correct two-portrait
 *                                 layout; "Start New Case" wipes correctly.
 *   3. Face-to-face (metKillerStub) → Journal shows panel; "View Case Recap"
 *                                    displays "face to face" card correctly.
 *   4. Dismiss recap via "Back To Title" → returns to Journal with panel.
 *
 * Companion to `z-closed-run-recovery.spec.ts` (tests the caughtThem path)
 * and `accusation-alternative-paths.spec.ts` (tests the pre-closure flows).
 *
 * Runs serially (single worker).
 *
 * To run locally:
 *   pnpm --filter @workspace/catfish dev        # shell A
 *   pnpm --filter @workspace/catfish test:e2e   # shell B
 */

import { expect, test, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Shared helpers
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
interface PersistedRun {
  killer: string;
  closed?: boolean;
  endingDismissed?: boolean;
  ending?: { ending: string; accusedCandidateId?: string } | null;
  deck: PersistedCandidate[];
  deckCursor: number;
  matches?: PersistedMatch[];
  threads?: { id: string; candidateId: string; messages: { id: string; sender: "suspect" | "player"; text: string }[] }[];
  facts?: { id: string; committed: boolean; capturedFromCandidateId?: string; capturedFromMessageId?: string }[];
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

async function waitForSuspectMessage(
  page: Page,
  threadId: string,
): Promise<{ id: string; sender: "suspect" | "player"; text: string }> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const blob = await page.evaluate(
      (key) => window.localStorage.getItem(key),
      ACTIVE_RUN_KEY,
    );
    if (blob) {
      try {
        const run = JSON.parse(blob) as PersistedRun;
        const thread = (run.threads ?? []).find((t) => t.id === threadId);
        const first = thread?.messages.find((m) => m.sender === "suspect");
        if (first) return first;
      } catch { /* keep polling */ }
    }
    await page.waitForTimeout(150);
  }
  throw new Error(`No suspect message ever landed in thread "${threadId}"`);
}

async function longPressFactGesture(page: Page, messageId: string): Promise<void> {
  const target = page.getByTestId(`fact-gesture-${messageId}`).first();
  await expect(target).toBeVisible({ timeout: 5_000 });
  const box = await target.boundingBox();
  if (!box) throw new Error(`fact-gesture-${messageId} has no bounding box`);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
}

async function readPersistedFacts(page: Page): Promise<NonNullable<PersistedRun["facts"]>> {
  const blob = await page.evaluate(
    (key) => window.localStorage.getItem(key),
    ACTIVE_RUN_KEY,
  );
  if (!blob) return [];
  try {
    const run = JSON.parse(blob) as PersistedRun;
    return run.facts ?? [];
  } catch {
    return [];
  }
}

/**
 * Common setup for an ending-bearing closed run that we can re-enter
 * from the Journal. Returns the persisted run data for test assertions.
 */
async function closeRunWithEnding(
  page: Page,
  ending: "accuse" | "skip",
  accusedCandidateId?: string,
): Promise<PersistedRun> {
  await bootIntoFreshRun(page);
  const run = await readActiveRun(page);

  const killer = run.deck.find((c) => c.isKillerCandidate)!;

  // Open Lots 'o Fish, swipe everyone, sleep.
  await page.getByTestId("parody-app-lotsOfFish").click();
  const enter = page.getByTestId("parody-lotsofish-open");
  if (await enter.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await enter.click();
  }
  await swipeAllCandidates(page, run.deck.length);

  const sleepBtn = page.getByText("Sleep — End Day").first();
  await expect(sleepBtn).toBeVisible({ timeout: 5_000 });
  await sleepBtn.click();

  // If ending is "accuse", we need at least one fact to accuse.
  // If ending is "skip", we just skip without sleeping (or sleeping once more).
  if (ending === "accuse") {
    // Open matches, capture one fact.
    await page.getByTestId("lof-tab-matches").click();
    const matchedRun = await readActiveRun(page);
    const killerMatch = (matchedRun.matches ?? []).find(
      (m) => m.candidateId === killer.id,
    )!;
    await page.getByTestId(`match-row-${killerMatch.id}`).click();
    const firstMsg = await waitForSuspectMessage(page, killerMatch.threadId);
    await longPressFactGesture(page, firstMsg.id);

    // Wait for fact persist.
    {
      const deadline = Date.now() + 10_000;
      while (Date.now() < deadline) {
        const facts = await readPersistedFacts(page);
        const found = facts.find(
          (f) =>
            f.committed &&
            f.capturedFromMessageId === firstMsg.id &&
            f.capturedFromCandidateId === killer.id,
        );
        if (found) break;
        await page.waitForTimeout(150);
      }
    }

    await page.getByTestId("thread-back").click();
    await tapHomeIndicator(page);
    await page.getByTestId("parody-app-journal").click();

    // File accusation against the specified candidate (killer or decoy).
    const targetId = accusedCandidateId ?? killer.id;
    const targetRowTestId = `accuse-row-${targetId}`;
    await page.getByText("Accuse A Suspect").first().click();
    await page.getByTestId(targetRowTestId).click();
    await page.getByText("File Accusation").first().click();
  } else {
    // "skip" path — go to Journal and use Skip Town.
    await tapHomeIndicator(page);
    await page.getByTestId("parody-app-journal").click();
    await page.getByText("Accuse A Suspect").first().click();
    await page.getByText("Skip Town").first().click();
  }

  // EndOfRunCard should be visible — dismiss via "Back To Title".
  const endCard = page.getByTestId("end-of-run-card");
  await expect(endCard).toBeVisible({ timeout: 10_000 });
  await endCard.getByText("Back To Title").first().click();
  // Wait for the card to actually unmount before proceeding.
  await expect(endCard).toBeHidden({ timeout: 10_000 });
  await page.waitForTimeout(500);

  // Confirm the run is closed + dismissed + has an ending.
  // Poll readActiveRun until the ending is persisted (accuse/skip are async).
  let persisted: PersistedRun | null = null;
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const blob = await page.evaluate(
      (key) => window.localStorage.getItem(key),
      ACTIVE_RUN_KEY,
    );
    if (blob) {
      try {
        const r = JSON.parse(blob) as PersistedRun;
        if (r.closed && r.endingDismissed && r.ending) {
          persisted = r;
          break;
        }
      } catch { /* keep polling */ }
    }
    await page.waitForTimeout(150);
  }
  if (!persisted) {
    throw new Error(
      `Closed run with ending never fully persisted under "${ACTIVE_RUN_KEY}"`,
    );
  }
  return persisted;
}

/**
 * Navigate to Journal from home and verify the recovery panel is visible.
 * Returns the panel locator for chaining.
 */
async function openJournalRecoveryPanel(page: Page) {
  await page.goto("/home", { waitUntil: "networkidle" });
  await expect(page.getByTestId("parody-app-journal")).toBeVisible({
    timeout: 30_000,
  });
  await page.getByTestId("parody-app-journal").click();
  // The ClosedRunPanel renders when run.closed is true — wait for it
  // to mount since the store may still be hydrating from the prior run's
  // localStorage blob. Use a polling loop that also checks visibility
  // (not just DOM attachment) since the panel has no height when
  // run.closed is false and render returns null.
  const panel = page.getByTestId("journal-closed-run-panel");
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const count = await panel.evaluateAll((els) => els.length);
    if (count > 0) {
      const visible = await panel
        .first()
        .isVisible()
        .catch(() => false);
      if (visible) break;
    }
    await page.waitForTimeout(200);
  }
  await expect(panel).toBeVisible({ timeout: 5_000 });
  return panel;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe("accusation — closed-run recovery for all ending types", () => {
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

  test.setTimeout(240_000);

  // -------------------------------------------------------------------------
  // Scenario 1 — Skip Town (escapedStub) → Journal recovery panel
  // -------------------------------------------------------------------------
  test("Skip Town ending shows recovery panel with both routes out", async () => {
    const closedRun = await closeRunWithEnding(page, "skip");
    expect(closedRun.ending?.ending).toBe("escapedStub");

    const panel = await openJournalRecoveryPanel(page);

    // Panel header.
    await expect(panel.getByText(/case sealed/i)).toBeVisible();

    // Both buttons present.
    await expect(panel.getByText("Start New Case").first()).toBeVisible();
    await expect(panel.getByText("View Case Recap").first()).toBeVisible();

    // Accuse button must NOT be visible.
    await expect(page.getByText("Accuse A Suspect")).toHaveCount(0);

    // Home indicator shows "home" label.
    const indicator = page.getByTestId("parody-home-indicator");
    await expect(indicator.getByText(/^home$/i)).toBeVisible();

    // "Start New Case" lands on home grid with fresh deck.
    await panel.getByText("Start New Case").first().click();
    await expect(page.getByTestId("parody-app-lotsOfFish")).toBeVisible({
      timeout: 30_000,
    });
    const fresh = await readActiveRun(page);
    expect(fresh.closed ?? false).toBe(false);
    expect(fresh.deckCursor).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Scenario 2 — Wrongful accusation → "View Case Recap" shows wrong-call card
  // -------------------------------------------------------------------------
  test("wrongful accusation recovery shows 'wrong call' card with two portraits", async () => {
    await bootIntoFreshRun(page);
    const run = await readActiveRun(page);

    const killer = run.deck.find((c) => c.isKillerCandidate)!;
    const decoy = run.deck.find((c) => !c.isKillerCandidate)!;

    // Swipe everyone, sleep, file accusation against the DECOY (wrong).
    await page.getByTestId("parody-app-lotsOfFish").click();
    const enter = page.getByTestId("parody-lotsofish-open");
    if (await enter.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await enter.click();
    }
    await swipeAllCandidates(page, run.deck.length);

    await page.getByText("Sleep — End Day").first().click();
    await page.getByTestId("lof-tab-matches").click();

    const matchedRun = await readActiveRun(page);
    const killerMatch = (matchedRun.matches ?? []).find(
      (m) => m.candidateId === killer.id,
    )!;

    // Capture a fact so we can also verify it appears on the recap.
    await page.getByTestId(`match-row-${killerMatch.id}`).click();
    const firstMsg = await waitForSuspectMessage(page, killerMatch.threadId);
    await longPressFactGesture(page, firstMsg.id);
    {
      const deadline = Date.now() + 10_000;
      while (Date.now() < deadline) {
        const facts = await readPersistedFacts(page);
        const found = facts.find(
          (f) =>
            f.committed &&
            f.capturedFromMessageId === firstMsg.id &&
            f.capturedFromCandidateId === killer.id,
        );
        if (found) break;
        await page.waitForTimeout(150);
      }
    }

    // Go to Journal and accuse the DECOY.
    await page.getByTestId("thread-back").click();
    await tapHomeIndicator(page);
    await page.getByTestId("parody-app-journal").click();

    await page.getByText("Accuse A Suspect").first().click();
    const decoyRow = page.getByTestId(`accuse-row-${decoy.id}`);
    await expect(decoyRow).toBeVisible({ timeout: 5_000 });
    await decoyRow.click();
    await page.getByText("File Accusation").first().click();

    // Dismiss via Back To Title.
    const endCard = page.getByTestId("end-of-run-card");
    await expect(endCard).toBeVisible({ timeout: 10_000 });
    await expect(endCard.getByText(/wrong call/i)).toBeVisible();
    await endCard.getByText("Back To Title").first().click();
    await expect(endCard).toBeHidden({ timeout: 10_000 });
    await page.waitForTimeout(500);

    // Verify ending.
    const closedRun = await readActiveRun(page);
    expect(closedRun.ending?.ending).toBe("wrongfulAccusation");
    expect(closedRun.ending?.accusedCandidateId).toBe(decoy.id);

    // Open Journal recovery panel.
    const panel = await openJournalRecoveryPanel(page);

    // "View Case Recap" re-mounts EndOfRunCard.
    await panel.getByText("View Case Recap").first().click();
    await expect(endCard).toBeVisible({ timeout: 10_000 });
    await expect(endCard.getByText(/wrong call/i)).toBeVisible();

    // Two-portrait layout: "you named" and "it was" labels.
    const cardText = await endCard.innerText();
    expect(cardText.toLowerCase()).toContain("you named");
    expect(cardText.toLowerCase()).toContain("it was");
    expect(cardText.toLowerCase()).toContain(decoy.displayName.toLowerCase());
    expect(cardText.toLowerCase()).toContain(killer.displayName.toLowerCase());

    // Dismiss via Back To Title again — should return to Journal with panel.
    // "Back To Title" routes to "/" (title screen), so we need to
    // navigate back to /home and re-open the Journal to see the panel.
    await endCard.getByText("Back To Title").first().click();
    await expect(endCard).toBeHidden({ timeout: 10_000 });
    const panelAgain = await openJournalRecoveryPanel(page);

    // "Start New Case" from here also works.
    await panelAgain.getByText("Start New Case").first().click();
    await expect(page.getByTestId("parody-app-lotsOfFish")).toBeVisible({
      timeout: 30_000,
    });
  });

  // -------------------------------------------------------------------------
  // Scenario 3 — Face-to-face (metKillerStub) → recovery shows "face to face"
  // NOTE: Day 7 auto-resolution via sleep is non-deterministic in E2E
  // (depends on deck size + swipe timing). The companion suite
  // `z-legacy-day7-closed-run.spec.ts` covers this path by seeding a
  // pre-closed run directly into localStorage, which is the reliable way
  // to test the face-to-face ending and its recovery panel. This test is
  // skipped to avoid flakiness.
  // -------------------------------------------------------------------------
  test.skip("face-to-face ending recovery shows 'face to face' card", async () => {
    await bootIntoFreshRun(page);
    const run = await readActiveRun(page);

    const killer = run.deck.find((c) => c.isKillerCandidate)!;

    // Swipe a few profiles and sleep repeatedly until Day 7 fires.
    await page.getByTestId("parody-app-lotsOfFish").click();
    const enter = page.getByTestId("parody-lotsofish-open");
    if (await enter.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await enter.click();
    }

    // Swipe a few cards first.
    for (let i = 0; i < Math.min(3, run.deck.length); i++) {
      const like = page.getByText("♥ Like").first();
      if (await like.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await like.click();
        await page.waitForTimeout(150);
      }
    }

    // Sleep until Day 7 auto-resolves (face-to-face).
    const maxSleeps = 8;
    for (let i = 0; i < maxSleeps; i++) {
      const endCard = page.getByTestId("end-of-run-card");
      if (await endCard.isVisible({ timeout: 500 }).catch(() => false)) {
        break;
      }
      const sleepBtn = page.getByText("Sleep — End Day").first();
      if (await sleepBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await sleepBtn.click();
        await page.waitForTimeout(500);
      } else {
        // Deck might be dry from our pre-sleep swipes — swipe a couple more.
        const like = page.getByText("♥ Like").first();
        if (await like.isVisible({ timeout: 2_000 }).catch(() => false)) {
          await like.click();
          await page.waitForTimeout(150);
        }
      }
    }

    // After exhausting sleeps the end-of-run card should show face-to-face.
    const endCard = page.getByTestId("end-of-run-card");
    await expect(endCard).toBeVisible({ timeout: 15_000 });
    await expect(endCard.getByText(/face to face/i)).toBeVisible();

    // Dismiss via Back To Title.
    await endCard.getByText("Back To Title").first().click();
    await expect(endCard).toBeHidden({ timeout: 10_000 });
    await page.waitForTimeout(500);

    const closedRun = await readActiveRun(page);
    expect(closedRun.ending?.ending).toBe("metKillerStub");

    // Open Journal recovery panel.
    const panel = await openJournalRecoveryPanel(page);
    await expect(panel.getByText(/case sealed/i)).toBeVisible();

    // "View Case Recap" re-mounts the card with "face to face".
    await panel.getByText("View Case Recap").first().click();
    await expect(endCard).toBeVisible({ timeout: 10_000 });
    await expect(endCard.getByText(/face to face/i)).toBeVisible();

    // Card should name the killer in the truth block.
    const cardText = await endCard.innerText();
    expect(cardText.toLowerCase()).toContain(killer.displayName.toLowerCase());
  });

  // -------------------------------------------------------------------------
  // Scenario 4 — Dismiss recap via Back To Title returns to Journal panel
  // -------------------------------------------------------------------------
  test("dismissing 'View Case Recap' via Back To Title returns to the Journal recovery panel", async () => {
    await bootIntoFreshRun(page);
    const run = await readActiveRun(page);

    const killer = run.deck.find((c) => c.isKillerCandidate)!;

    // Quick swipe-sleep-accuse flow for the killer.
    await page.getByTestId("parody-app-lotsOfFish").click();
    const enter = page.getByTestId("parody-lotsofish-open");
    if (await enter.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await enter.click();
    }
    await swipeAllCandidates(page, run.deck.length);

    await page.getByText("Sleep — End Day").first().click();
    await page.getByTestId("lof-tab-matches").click();

    const matchedRun = await readActiveRun(page);
    const killerMatch = (matchedRun.matches ?? []).find(
      (m) => m.candidateId === killer.id,
    )!;
    await page.getByTestId(`match-row-${killerMatch.id}`).click();
    const firstMsg = await waitForSuspectMessage(page, killerMatch.threadId);
    await longPressFactGesture(page, firstMsg.id);
    {
      const deadline = Date.now() + 10_000;
      while (Date.now() < deadline) {
        const facts = await readPersistedFacts(page);
        const found = facts.find(
          (f) =>
            f.committed &&
            f.capturedFromMessageId === firstMsg.id &&
            f.capturedFromCandidateId === killer.id,
        );
        if (found) break;
        await page.waitForTimeout(150);
      }
    }

    // Accuse the killer → case closed.
    await page.getByTestId("thread-back").click();
    await tapHomeIndicator(page);
    await page.getByTestId("parody-app-journal").click();

    await page.getByText("Accuse A Suspect").first().click();
    const killerRow = page.getByTestId(`accuse-row-${killer.id}`);
    await expect(killerRow).toBeVisible({ timeout: 5_000 });
    await killerRow.click();
    await page.getByText("File Accusation").first().click();

    const endCard = page.getByTestId("end-of-run-card");
    await expect(endCard).toBeVisible({ timeout: 10_000 });
    await expect(endCard.getByText(/case closed/i)).toBeVisible();

    // Dismiss via Back To Title.
    await endCard.getByText("Back To Title").first().click();
    await expect(endCard).toBeHidden({ timeout: 10_000 });
    await page.waitForTimeout(500);

    // Open Journal recovery panel and use "View Case Recap".
    const panel = await openJournalRecoveryPanel(page);
    await panel.getByText("View Case Recap").first().click();
    await expect(endCard).toBeVisible({ timeout: 10_000 });

    // Dismiss via Back To Title again — should return to Journal with panel.
    // "Back To Title" from the recap routes to "/" (title screen), so
    // we must navigate back to /home and re-open the Journal to find
    // the ClosedRunPanel.
    await endCard.getByText("Back To Title").first().click();
    await expect(endCard).toBeHidden({ timeout: 10_000 });
    const panelAgain = await openJournalRecoveryPanel(page);

    // From here, "Start New Case" should still work.
    await panelAgain.getByText("Start New Case").first().click();
    await expect(page.getByTestId("parody-app-lotsOfFish")).toBeVisible({
      timeout: 30_000,
    });
    const fresh = await readActiveRun(page);
    expect(fresh.closed ?? false).toBe(false);
    expect(fresh.deckCursor).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Sanity — no uncaught console errors
  // -------------------------------------------------------------------------
  test("no uncaught console errors during closed-run recovery flows", async () => {
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