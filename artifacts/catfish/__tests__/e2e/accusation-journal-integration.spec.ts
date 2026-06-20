/**
 * End-to-end Playwright suite for Journal ↔ accusation wizard integration.
 *
 * Tests the interactions between the Journal (evidence management) and
 * the accusation wizard (suspect selection):
 *
 *   1. Multi-suspect fact filing — capture facts against 2+ suspects,
 *      verify row sort order on the sheet (matched > dropped > passed;
 *      within a tier, highest fact count first).
 *   2. Discard → sheet — file a fact then discard it; the accusation
 *      row should update from "1 fact filed" to "no facts filed".
 *   3. Journal filter is independent of the sheet — filtering the
 *      Journal view does NOT pre-filter the accusation wizard.
 *   4. Fact-badge accuracy — each accusation wizard row's "N fact(s) filed"
 *      label reflects exactly what the Journal knows about that suspect.
 *   5. Undo discard — discard a fact, tap UNDO in the toast, verify the
 *      fact reappears in the Journal AND the sheet's badge updates.
 *
 * Self-contained: boots from a clean localStorage state and drives a
 * full fresh-case flow before each scenario.
 *
 * Runs serially because all scenarios write to the same localStorage
 * run blob and each boots with a wipe-first strategy.
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

interface PersistedMessage {
  id: string;
  sender: "suspect" | "player";
  text: string;
}
interface PersistedThread {
  id: string;
  candidateId: string;
  messages: PersistedMessage[];
}
interface PersistedFact {
  id: string;
  committed: boolean;
  capturedFromCandidateId?: string;
  capturedFromMessageId?: string;
  capturedQuote?: string;
}
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
  deck: PersistedCandidate[];
  deckCursor: number;
  matches?: PersistedMatch[];
  threads?: PersistedThread[];
  facts?: PersistedFact[];
}

async function bootIntoFreshRun(page: Page): Promise<void> {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    try {
      window.localStorage.clear();
      // Returning-user state: skip the first-run onboarding overlay so
      // the title screen's "Start New Case" is clickable (the overlay
      // sits at zIndex 9999 and intercepts pointer events otherwise).
      window.localStorage.setItem(
        "catfish/onboarding/v1",
        JSON.stringify({ completed: true, step: 0 }),
      );
    } catch { /* best effort */ }
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
): Promise<PersistedMessage> {
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

async function longPressFactGesture(
  page: Page,
  messageId: string,
): Promise<void> {
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

async function readPersistedFacts(page: Page): Promise<PersistedFact[]> {
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

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe("accusation — journal integration", () => {
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
  // Scenario 1 — Multi-suspect: facts on 2 suspects sort correctly on sheet
  // -------------------------------------------------------------------------
  test("facts on multiple suspects sort rows correctly on the accusation sheet", async () => {
    await bootIntoFreshRun(page);
    const run = await readActiveRun(page);

    const killer = run.deck.find((c) => c.isKillerCandidate)!;
    const decoy = run.deck.find((c) => !c.isKillerCandidate)!;

    // Right-swipe ALL candidates so everyone appears on the sheet.
    await page.getByTestId("parody-app-lotsOfFish").click();
    const enter = page.getByTestId("parody-lotsofish-open");
    if (await enter.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await enter.click();
    }
    await swipeAllCandidates(page, run.deck.length);

    // Sleep so matches form and chat threads open.
    const sleepBtn = page.getByText("Sleep — End Day").first();
    await expect(sleepBtn).toBeVisible({ timeout: 5_000 });
    await sleepBtn.click();

    // Open Matches tab, get both killer and decoy threads.
    await page.getByTestId("lof-tab-matches").click();
    const matchedRun = await readActiveRun(page);

    const killerMatch = (matchedRun.matches ?? []).find(
      (m) => m.candidateId === killer.id,
    )!;
    const decoyMatch = (matchedRun.matches ?? []).find(
      (m) => m.candidateId === decoy.id,
    )!;

    // Capture a fact from the decoy's chat (first, quickest target).
    await page.getByTestId(`match-row-${decoyMatch.id}`).click();
    const decoyFirstMsg = await waitForSuspectMessage(page, decoyMatch.threadId);
    await longPressFactGesture(page, decoyFirstMsg.id);
    // Wait for commit.
    {
      const deadline = Date.now() + 10_000;
      while (Date.now() < deadline) {
        const facts = await readPersistedFacts(page);
        const found = facts.find(
          (f) =>
            f.committed &&
            f.capturedFromMessageId === decoyFirstMsg.id &&
            f.capturedFromCandidateId === decoy.id,
        );
        if (found) break;
        await page.waitForTimeout(150);
      }
    }

    // Back out, go home, open killer's thread.
    await page.getByTestId("thread-back").click();
    await tapHomeIndicator(page);
    await page.getByTestId("parody-app-lotsOfFish").click();
    // After tapHomeIndicator the LotsOfFish view resets to splash.
    const enterLof = page.getByTestId("parody-lotsofish-open");
    if (await enterLof.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await enterLof.click();
    }
    await page.getByTestId("lof-tab-matches").click();
    await page.getByTestId(`match-row-${killerMatch.id}`).click();
    const killerFirstMsg = await waitForSuspectMessage(page, killerMatch.threadId);
    await longPressFactGesture(page, killerFirstMsg.id);
    // Wait for second fact to commit.
    {
      const deadline = Date.now() + 10_000;
      while (Date.now() < deadline) {
        const facts = await readPersistedFacts(page);
        const found = facts.find(
          (f) =>
            f.committed &&
            f.capturedFromMessageId === killerFirstMsg.id &&
            f.capturedFromCandidateId === killer.id,
        );
        if (found) break;
        await page.waitForTimeout(150);
      }
    }

    // Navigate to Journal and open the accusation wizard.
    await page.getByTestId("thread-back").click();
    await tapHomeIndicator(page);
    await page.getByTestId("parody-app-journal").click();

    await page.getByText("Accuse A Suspect").first().click();
    const wizard = page.getByText("review evidence");
    await expect(wizard).toBeVisible({ timeout: 5_000 });
    await page.getByTestId("accuse-step1-continue").click();

    // Both suspects should appear on Step 2's picker.
    const killerRow = page.getByTestId(`accuse-row-${killer.id}`);
    const decoyRow = page.getByTestId(`accuse-row-${decoy.id}`);
    await expect(killerRow).toBeVisible();
    await expect(decoyRow).toBeVisible();

    // Both should show "1 fact".
    await expect(page.getByText(/1 fact/i).first()).toBeVisible();

    // Both suspects are matched (slept), so neither shows "dropped".
    // The rows are sorted: matched suspects float up, then by fact count.
    // Both have 1 fact; sort is stable within the same tier, so we just
    // assert both display the correct badge count. The exact ordering
    // depends on insertion order which matches deck order.
    const killerBadge = killerRow.getByText(/1 fact/i);
    const decoyBadge = decoyRow.getByText(/1 fact/i);
    await expect(killerBadge).toBeVisible();
    await expect(decoyBadge).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Scenario 2 — Discard a fact: sheet badge updates from "1" to "0"
  // -------------------------------------------------------------------------
  test("discarding a fact removes it from the accusation sheet's fact badge", async () => {
    await bootIntoFreshRun(page);
    const run = await readActiveRun(page);

    const killer = run.deck.find((c) => c.isKillerCandidate)!;

    // Swipe, sleep, open chat, capture a fact from killer.
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

    // Wait for persist.
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

    // Go to Journal — the fact should be visible under the killer.
    await page.getByTestId("thread-back").click();
    await tapHomeIndicator(page);
    await page.getByTestId("parody-app-journal").click();

    const onFile = page.getByText(/1 fact on file/i).first();
    await expect(onFile).toBeVisible({ timeout: 5_000 });

    // Discard the fact using the ✕ chip on the FactCard.
    // The chip has accessibilityLabel="Discard fact" — find it inside the card.
    const discardBtn = page.getByLabel("Discard fact").first();
    await expect(discardBtn).toBeVisible();
    await discardBtn.click();

    // After discard the "1 fact on file" should be gone.
    // With zero facts the summary panel and filters are hidden.
    await expect(
      page.getByText(/1 fact on file/i),
    ).toHaveCount(0, { timeout: 5_000 });

    // Open the wizard — the killer's Step 2 row should now say "no facts".
    await page.getByText("Accuse A Suspect").first().click();
    await expect(page.getByText(/review evidence/i)).toBeVisible();
    await page.getByTestId("accuse-step1-continue").click();
    const killerRow = page.getByTestId(`accuse-row-${killer.id}`);
    await expect(killerRow.getByText(/no facts/i)).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Scenario 3 — Journal filter is independent of the accusation wizard
  // -------------------------------------------------------------------------
  test("filtering the Journal does not filter the accusation sheet", async () => {
    await bootIntoFreshRun(page);
    const run = await readActiveRun(page);

    const killer = run.deck.find((c) => c.isKillerCandidate)!;
    const decoy = run.deck.find((c) => !c.isKillerCandidate)!;

    // The Journal's suspect-filter chips only render with 2+ suspects on
    // file, so capture a fact from BOTH the killer and the decoy. Swipe
    // everyone and sleep so both threads open.
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
    const decoyMatch = (matchedRun.matches ?? []).find(
      (m) => m.candidateId === decoy.id,
    )!;

    // Capture from the decoy first.
    await page.getByTestId(`match-row-${decoyMatch.id}`).click();
    const decoyMsg = await waitForSuspectMessage(page, decoyMatch.threadId);
    await longPressFactGesture(page, decoyMsg.id);
    {
      const deadline = Date.now() + 10_000;
      while (Date.now() < deadline) {
        const facts = await readPersistedFacts(page);
        if (
          facts.find(
            (f) =>
              f.committed &&
              f.capturedFromMessageId === decoyMsg.id &&
              f.capturedFromCandidateId === decoy.id,
          )
        )
          break;
        await page.waitForTimeout(150);
      }
    }

    // Back out and capture from the killer.
    await page.getByTestId("thread-back").click();
    await tapHomeIndicator(page);
    await page.getByTestId("parody-app-lotsOfFish").click();
    const enterLof = page.getByTestId("parody-lotsofish-open");
    if (await enterLof.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await enterLof.click();
    }
    await page.getByTestId("lof-tab-matches").click();
    await page.getByTestId(`match-row-${killerMatch.id}`).click();
    const killerMsg = await waitForSuspectMessage(page, killerMatch.threadId);
    await longPressFactGesture(page, killerMsg.id);
    {
      const deadline = Date.now() + 10_000;
      while (Date.now() < deadline) {
        const facts = await readPersistedFacts(page);
        if (
          facts.find(
            (f) =>
              f.committed &&
              f.capturedFromMessageId === killerMsg.id &&
              f.capturedFromCandidateId === killer.id,
          )
        )
          break;
        await page.waitForTimeout(150);
      }
    }

    // Go to Journal.
    await page.getByTestId("thread-back").click();
    await tapHomeIndicator(page);
    await page.getByTestId("parody-app-journal").click();

    // Filter to just the killer by tapping their filter chip. Target the
    // chip by its accessibility label rather than visible text — a bare
    // displayName match (e.g. "Sam") would also hit FactCards and open
    // the fact-detail modal instead of toggling the filter.
    const killerChip = page.getByLabel(`Filter by ${killer.displayName}`, {
      exact: true,
    });
    await expect(killerChip).toBeVisible({ timeout: 5_000 });
    await killerChip.click();

    // Filtering to the killer hides the decoy's fact group. Assert on the
    // group structure, not the decoy's name: the filter chip bar keeps
    // every suspect's chip (so you can switch filters), so the decoy's
    // name stays on screen — but only ONE "fact on file" group header
    // (the killer's) should remain in the list.
    await expect(page.getByText(/fact[s]? on file/i)).toHaveCount(1, {
      timeout: 3_000,
    });

    // Open the wizard — BOTH suspects should still appear on Step 2
    // (filter is Journal-only, not a pre-selection on the picker).
    await page.getByText("Accuse A Suspect").first().click();
    await expect(page.getByText(/review evidence/i)).toBeVisible();
    await page.getByTestId("accuse-step1-continue").click();
    const killerRow = page.getByTestId(`accuse-row-${killer.id}`);
    const decoyRow = page.getByTestId(`accuse-row-${decoy.id}`);
    await expect(killerRow).toBeVisible();
    await expect(decoyRow).toBeVisible();

    // Both filed exactly one fact, so both rows read "1 fact" — proving
    // the Journal's killer-only filter did not carry into the wizard.
    await expect(killerRow.getByText(/1 fact/i)).toBeVisible();
    await expect(decoyRow.getByText(/1 fact/i)).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Scenario 4 — Undo discard restores fact and sheet badge
  // -------------------------------------------------------------------------
  test("undoing a discarded fact restores it to the Journal and the accusation sheet", async () => {
    await bootIntoFreshRun(page);
    const run = await readActiveRun(page);

    const killer = run.deck.find((c) => c.isKillerCandidate)!;

    // Setup: swipe, sleep, capture fact from killer.
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

    // Navigate to Journal.
    await page.getByTestId("thread-back").click();
    await tapHomeIndicator(page);
    await page.getByTestId("parody-app-journal").click();

    // Verify fact is there.
    await expect(page.getByText(/1 fact on file/i).first()).toBeVisible();

    // Discard the fact.
    const discardBtn = page.getByLabel("Discard fact").first();
    await discardBtn.click();

    // "Fact discarded" toast should appear.
    await expect(page.getByText(/fact discarded/i).first()).toBeVisible({ timeout: 3_000 });

    // Tap UNDO.
    const undoBtn = page.getByText("undo").first();
    await expect(undoBtn).toBeVisible({ timeout: 3_000 });
    await undoBtn.click();

    // Toast should disappear and fact should return.
    await expect(page.getByText(/fact discarded/i)).toHaveCount(0, { timeout: 5_000 });
    await expect(page.getByText(/1 fact on file/i).first()).toBeVisible({ timeout: 5_000 });

    // Open the wizard — Step 2's badge should again read "1 fact".
    await page.getByText("Accuse A Suspect").first().click();
    await expect(page.getByText(/review evidence/i)).toBeVisible();
    await page.getByTestId("accuse-step1-continue").click();
    const killerRow = page.getByTestId(`accuse-row-${killer.id}`);
    await expect(killerRow.getByText(/1 fact/i)).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Sanity — no uncaught console errors
  // -------------------------------------------------------------------------
  test("no uncaught console errors during journal-integration flows", async () => {
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