/**
 * End-to-end Playwright suite for the Catfish accusation happy-path
 * loop — Task #65's required acceptance test.
 *
 * Filename note: prefixed with `z-` so it sorts AFTER
 * `parody-games.spec.ts` in Playwright's default test discovery order.
 * The parody suite's `bootIntoApp` helper uses no-timeout
 * `isVisible()` checks against the title CTAs, which race against
 * React hydration in a way that's much more likely to lose when this
 * spec ran first and warmed the bundler's compile cache. Running
 * parody first keeps that suite stable.
 *
 * Drives the full UI loop a real player walks through:
 *
 *   title → Start New Case
 *      → parody home grid
 *      → Lots 'o Fish app → right-swipe every candidate
 *      → end-of-deck "Sleep — End Day" (likes reciprocate, matches form)
 *      → Matches tab → open the killer's chat thread
 *      → long-press the suspect's opening line → fact filed
 *      → home indicator → Journal app → captured fact is visible
 *      → "Accuse A Suspect" → AccusationSheet
 *      → tap THE KILLER row → "File Accusation"
 *      → EndOfRunCard with "case closed" / killer reveal
 *      → "Start New Case" lands back in Lots 'o Fish with a fresh deck
 *
 * The test deterministically picks the killer-candidate by reading the
 * persisted run blob out of localStorage (the web AsyncStorage adapter
 * mirrors `catfish/active_run/v1` straight onto window.localStorage).
 * That avoids "tap every row until one wins" loops, which would each
 * end the run and force a re-bootstrap.
 *
 * Bugs this test pins down (the audit Task #65 fixed):
 *
 *   - AccusationSheet selection used to highlight ALL rows at once
 *     because every decoy carried the killer's `identity` slot. We
 *     verify single-row selection by tapping two suspects in sequence
 *     and asserting the visible ✓ checkmark moves rather than stacks.
 *
 *   - `accuse()` used to resolve any pick as "case closed" because the
 *     resolver compared `accused === run.killer` and every row was
 *     stamped with that identity. We verify that picking the actual
 *     killer-candidate (not a decoy) is what produces "case closed".
 *
 *   - The EndOfRunCard's bottom action buttons used to slip under the
 *     home indicator on phones with a notch / safe-area inset. We
 *     verify both "Start New Case" and "Back To Title" are reachable
 *     and clickable on a 400×900 viewport.
 *
 * Companion to `scripts/test-accuse-by-candidate-id.mts` — that script
 * exercises the store-level logic in isolation; this one drives the
 * real UI and asserts the player-visible outcome.
 *
 * To run locally:
 *   pnpm --filter @workspace/catfish dev                  # in shell A
 *   pnpm --filter @workspace/catfish test:e2e:install     # one-time
 *   pnpm --filter @workspace/catfish test:e2e             # in shell B
 */

import { expect, test, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * AsyncStorage on web is just localStorage; the active run blob lives
 * under this key (see `core/repository.ts`).
 */
const ACTIVE_RUN_KEY = "catfish/active_run/v1";

/** Minimal shape we care about — we only read these fields. */
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
interface PersistedRun {
  killer: string;
  deck: PersistedCandidate[];
  deckCursor: number;
  matches?: PersistedMatch[];
  threads?: PersistedThread[];
  facts?: PersistedFact[];
}

/**
 * Boot the page into a known-good "fresh case" state. If a previous
 * run is hanging around in localStorage we hit "New Case (Reset)"
 * first; otherwise we go straight to "Start New Case".
 */
async function bootIntoFreshRun(page: Page): Promise<void> {
  // Clear localStorage BEFORE the first navigation so any
  // active_run/prefs/parody-session blobs left behind by a prior
  // spec (parody-games leaves a few) cannot poison the title-screen
  // CTA layout. We can't call localStorage.clear() before goto()
  // because the document hasn't loaded — so we land on the page
  // first, wipe storage, then reload to re-render the title against
  // a clean slate.
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    try {
      window.localStorage.clear();
    } catch {
      /* private mode / quota — best effort */
    }
  });
  await page.reload({ waitUntil: "domcontentloaded" });

  // After the wipe + reload the title CTA is unambiguously
  // "Start New Case" — a stale "New Case (Reset)" shouldn't be
  // possible. Keep the reset fallback as a defensive net in case
  // something else races in.
  const reset = page.getByText("New Case (Reset)").first();
  if (await reset.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await reset.click();
  }
  const start = page.getByText("Start New Case").first();
  await expect(start).toBeVisible({ timeout: 30_000 });
  await start.click();

  // Land on the parody phone home grid — the Lots 'o Fish tile is
  // unique to it and has a stable test ID.
  await expect(page.getByTestId("parody-app-lotsOfFish")).toBeVisible({
    timeout: 30_000,
  });
}

/**
 * Read the persisted active run from localStorage. Polled because the
 * store's first persist write happens a tick after `startNewRun`.
 */
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
      } catch {
        /* keep polling — a half-written blob is rare but possible */
      }
    }
    await page.waitForTimeout(150);
  }
  throw new Error(
    `Active run never appeared in localStorage under "${ACTIVE_RUN_KEY}"`,
  );
}

/** Tap the home indicator at the bottom of any in-app screen. */
async function tapHomeIndicator(page: Page): Promise<void> {
  await page.getByTestId("parody-home-indicator").click();
}

/**
 * Right-swipe (Like) the top card on the Lots 'o Fish deck. We use
 * the rendered "♥ Like" button rather than synthesizing a pointer
 * gesture — the button path is the same code that the swipe gesture
 * commits to, and it's deterministic across viewports.
 */
async function likeTopCard(page: Page): Promise<void> {
  await page.getByText("♥ Like").first().click();
  // Brief settle so the next card animates in before the next click.
  await page.waitForTimeout(120);
}

/**
 * Wait for the killer's chat thread to have at least one suspect
 * message. `openThread()` lazily pushes the opening salvo on first
 * mount of `ThreadView`, so by the time we land on the chat screen
 * the first suspect line should appear within a beat. Polled because
 * the persist-to-localStorage write happens a tick after the store
 * mutation.
 */
async function waitForFirstSuspectMessage(
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
      } catch {
        /* keep polling */
      }
    }
    await page.waitForTimeout(150);
  }
  throw new Error(
    `No suspect message ever landed in thread "${threadId}" within 15s`,
  );
}

/**
 * Long-press a chat bubble via synthesized mouse events. Catfish wraps
 * each suspect bubble in a `MessageFactGesture` that listens for a 450ms
 * `react-native-gesture-handler` LongPress; on web that fires off a
 * pointerdown timer. We center the cursor on the bubble, hold the
 * primary button for 700ms, and release — long enough to clear the
 * 450ms `LONG_PRESS_MS` threshold with comfortable headroom.
 */
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
  // 700ms ≫ LONG_PRESS_MS (450) so the gesture-handler timer fires
  // even on a slow CI box. Slightly longer is safer than slightly
  // shorter.
  await page.waitForTimeout(700);
  await page.mouse.up();
}

/** Read the persisted run's `facts` array, defaulting to []. */
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

test.describe("accusation happy path — file against the killer", () => {
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
    // Wipe localStorage before tearing down the context so any
    // subsequent spec in the same run boots from a clean slate. This
    // matters because the title screen renders different CTAs based
    // on whether an active run is present, and the parody suite's
    // boot helper races on a no-timeout `isVisible()` check that
    // assumes the cold-start CTA layout.
    if (page) {
      await page.evaluate(() => window.localStorage.clear()).catch(() => {});
      await page.context().close();
    }
  });

  // The full loop — title boot, swipe-everyone, sleep, journal, accuse,
  // end-of-run, fresh-deck — runs longer than the suite default. Bump
  // the per-test timeout so the boot delay (heavy first paint of the
  // Expo web bundle) plus the per-card swipe settle don't push us over
  // the cliff.
  test.setTimeout(180_000);

  test("title → Lots 'o Fish → Journal → accuse killer → case closed → fresh deck", async () => {
    // 1. Title screen → fresh case → parody home grid.
    await bootIntoFreshRun(page);

    // Read the run so we know which deck candidate IS the killer.
    // The killer slot has `isKillerCandidate: true`; everyone else is
    // a decoy. Captured into a closure for use after right-swiping.
    const run = await readActiveRun(page);
    const killerCandidate = run.deck.find((c) => c.isKillerCandidate);
    expect(
      killerCandidate,
      "Run deck should always contain exactly one killer candidate",
    ).toBeDefined();
    const killerRowTestId = `accuse-row-${killerCandidate!.id}`;
    const killerName = killerCandidate!.displayName;

    // 2. Open Lots 'o Fish from the home grid.
    await page.getByTestId("parody-app-lotsOfFish").click();
    // Splash card → enter the deck.
    const enter = page.getByTestId("parody-lotsofish-open");
    if (await enter.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await enter.click();
    }

    // 3. Right-swipe every candidate in the deck so the killer is
    //    guaranteed to appear on the AccusationSheet (the sheet only
    //    lists candidates the player has surfaced — `seen = deck.slice(0,
    //    deckCursor)`). Drive the loop off the persisted deckCursor
    //    rather than a visibility probe so we don't terminate early
    //    when a slow shared-suite render misses the next "♥ Like"
    //    button paint.
    const deckSize = run.deck.length;
    const swipeDeadline = Date.now() + 30_000;
    while (Date.now() < swipeDeadline) {
      const cursor = await page.evaluate((key) => {
        const blob = window.localStorage.getItem(key);
        if (!blob) return -1;
        try {
          return (JSON.parse(blob) as { deckCursor?: number }).deckCursor ?? 0;
        } catch {
          return -1;
        }
      }, ACTIVE_RUN_KEY);
      if (cursor >= deckSize) break;
      const likeBtn = page.getByText("♥ Like").first();
      if (!(await likeBtn.isVisible({ timeout: 2_000 }).catch(() => false))) {
        // Empty-deck panel rendered before the cursor caught up to
        // deckSize — happens if a like animation defers the
        // setState by a frame. Re-poll the cursor next iteration.
        await page.waitForTimeout(150);
        continue;
      }
      await likeTopCard(page);
    }

    // 4. End-of-deck panel — tap "Sleep — End Day" so the overnight
    //    resolver fires. Story-candidate likes (which include the
    //    killer) reciprocate during `advanceDay()`, so the killer's
    //    `MatchRelationship` only exists *after* this step. Without
    //    sleeping, run.matches is empty and there's no chat thread to
    //    open.
    const sleepBtn = page.getByText("Sleep — End Day").first();
    await expect(sleepBtn).toBeVisible({ timeout: 5_000 });
    await sleepBtn.click();

    // 5. Switch to the Matches tab and open the killer's chat thread.
    //    Sleep dropped us back on the Swipe view of a refilled deck;
    //    the bottom tab bar is mounted, so `lof-tab-matches` is one
    //    tap away.
    await page.getByTestId("lof-tab-matches").click();

    // Re-read the persisted run; the overnight resolver wrote a
    // `MatchRelationship` for every reciprocated like. Find the
    // killer's match by its candidateId.
    const matchedRun = await readActiveRun(page);
    const killerMatch = (matchedRun.matches ?? []).find(
      (m) => m.candidateId === killerCandidate!.id,
    );
    expect(
      killerMatch,
      "Killer should be in run.matches after Sleep resolves the overnight likes",
    ).toBeDefined();

    const killerMatchRow = page.getByTestId(`match-row-${killerMatch!.id}`);
    await expect(killerMatchRow).toBeVisible({ timeout: 5_000 });
    await killerMatchRow.click();

    // 6. Wait for the suspect's opening line to land in the persisted
    //    thread (ThreadView's mount effect calls openThread() which
    //    pushes the firstLine), then long-press it to file as a Fact.
    const firstSuspect = await waitForFirstSuspectMessage(
      page,
      killerMatch!.threadId,
    );
    await longPressFactGesture(page, firstSuspect.id);

    // Capture is async (commitFact awaits the persist). Poll the
    // persisted facts until our long-press's fact appears, with a
    // generous deadline so a slow CI box can still finish the
    // 450ms-LongPress → setState → save round-trip.
    let captured: PersistedFact | undefined;
    {
      const deadline = Date.now() + 10_000;
      while (Date.now() < deadline) {
        const facts = await readPersistedFacts(page);
        captured = facts.find(
          (f) =>
            f.committed &&
            f.capturedFromMessageId === firstSuspect.id &&
            f.capturedFromCandidateId === killerCandidate!.id,
        );
        if (captured) break;
        await page.waitForTimeout(150);
      }
    }
    expect(
      captured,
      "Long-press on the killer's first chat bubble should commit a captured Fact",
    ).toBeDefined();

    // The bubble should also show the "filed" badge confirming the
    // capture lit up the UI, not just the store.
    await expect(
      page.getByTestId(`fact-gesture-${firstSuspect.id}`).getByText("filed"),
    ).toBeVisible({ timeout: 3_000 });

    // 7. Back out of the chat → home indicator → Journal. Verify our
    //    captured fact is visible BEFORE we open the AccusationSheet —
    //    that's the chain the player walks (capture → review →
    //    accuse) and the architect's required acceptance criterion
    //    for this happy-path test.
    const threadBack = page.getByTestId("thread-back");
    if (await threadBack.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await threadBack.click();
    }
    await tapHomeIndicator(page);
    await page.getByTestId("parody-app-journal").click();

    // The Journal renders one SuspectGroup per candidate-with-facts;
    // after our single capture there should be exactly "1 fact on
    // file" under the killer's group.
    const onFileText = page.getByText(/fact[s]? on file/i).first();
    await expect(onFileText).toBeVisible({ timeout: 5_000 });
    const journalText = await onFileText.innerText();
    expect(
      journalText.toLowerCase(),
      `Journal should report at least one fact on file. Saw: "${journalText}"`,
    ).toMatch(/^\s*\d+\s+fact[s]? on file/);

    // The captured quote text should also appear somewhere in the
    // journal screen — FactCard renders the quote verbatim, so a
    // short prefix substring is robust to any ellipsis truncation.
    const quoteText = firstSuspect.text ?? "";
    const quoteSnippet = quoteText.trim().slice(0, Math.min(16, quoteText.length));
    if (quoteSnippet.length > 0) {
      await expect(
        page.getByText(quoteSnippet, { exact: false }).first(),
      ).toBeVisible({ timeout: 5_000 });
    }

    // 8. "Accuse A Suspect" → AccusationSheet appears with one row
    //    per met candidate.
    await page.getByText("Accuse A Suspect").first().click();
    const killerRow = page.getByTestId(killerRowTestId);
    await expect(killerRow).toBeVisible({ timeout: 5_000 });

    // ----- Single-row selection regression check ---------------------
    // The bug: every row used to highlight at once. Tap a
    // non-killer row first, then the killer row, and assert the ✓
    // checkmark is visible on exactly ONE row at a time.
    const decoyCandidate = run.deck.find((c) => !c.isKillerCandidate);
    expect(decoyCandidate).toBeDefined();
    const decoyRowTestId = `accuse-row-${decoyCandidate!.id}`;
    const decoyRow = page.getByTestId(decoyRowTestId);

    await decoyRow.click();
    // Decoy row carries the ✓; killer row does not.
    await expect(decoyRow.getByText("✓")).toBeVisible({ timeout: 3_000 });
    await expect(killerRow.getByText("✓")).toHaveCount(0);

    // Switch selection to the killer — decoy ✓ disappears, killer ✓ appears.
    await killerRow.click();
    await expect(killerRow.getByText("✓")).toBeVisible({ timeout: 3_000 });
    await expect(decoyRow.getByText("✓")).toHaveCount(0);

    // 7. File Accusation.
    const fileBtn = page.getByText("File Accusation").first();
    await expect(fileBtn).toBeVisible();
    await fileBtn.click();

    // 8. EndOfRunCard appears. With the killer correctly selected, the
    //    verdict header reads "case closed" (NOT "wrong call" or "face
    //    to face"). The pre-fix bug made every accusation auto-resolve
    //    to "case closed" because every row collapsed onto the killer
    //    slot — but the inverse — selecting the killer-row and STILL
    //    not getting case closed — would now indicate the candidate-id
    //    plumbing is wrong, so this assertion is meaningful.
    //
    //    We also verify the killer is named in the "the truth" block.
    //    The deck candidate's `displayName` is the first name only
    //    ("Tessa"), while the identity module renders the full name
    //    ("Tessa Lin") — the deck name is a prefix substring of the
    //    full name, so an .innerText() contains-check is robust to
    //    either rendering.
    const endCard = page.getByTestId("end-of-run-card");
    await expect(endCard).toBeVisible({ timeout: 10_000 });
    await expect(endCard.getByText(/case closed/i)).toBeVisible();
    const cardText = await endCard.innerText();
    expect(
      cardText.toLowerCase(),
      `End-of-run card should mention killer "${killerName}". Card text: ${cardText}`,
    ).toContain(killerName.toLowerCase());

    // ----- Safe-area regression check --------------------------------
    // Both action buttons must be reachable on the 400×900 viewport;
    // the bug was the bottom button slipping under the home indicator.
    const startNewBtn = endCard.getByText("Start New Case").first();
    const backToTitleBtn = endCard.getByText("Back To Title").first();
    await expect(startNewBtn).toBeVisible();
    await expect(backToTitleBtn).toBeVisible();
    const startBox = await startNewBtn.boundingBox();
    const backBox = await backToTitleBtn.boundingBox();
    expect(startBox, "Start New Case has no bounding box").not.toBeNull();
    expect(backBox, "Back To Title has no bounding box").not.toBeNull();
    // Bottom edge of the lower button must clear the bottom of the
    // 900px viewport with at least a little breathing room.
    expect(backBox!.y + backBox!.height).toBeLessThanOrEqual(900);

    // 9. "Start New Case" should clear the run, return to the home
    //    grid, and queue up a brand-new deck.
    await startNewBtn.click();
    await expect(endCard).toBeHidden({ timeout: 10_000 });
    await expect(page.getByTestId("parody-app-lotsOfFish")).toBeVisible({
      timeout: 30_000,
    });

    // Fresh-deck assertion: the new run's killer slot should differ
    // from (or at least be a freshly-rolled copy of) the previous
    // run's deck. We assert that the deckCursor reset to 0 — a clean
    // proof that startNewRun() actually wiped the prior progress.
    const newRun = await readActiveRun(page);
    expect(newRun.deckCursor).toBe(0);
    expect(newRun.deck.length).toBeGreaterThan(0);
  });

  test("no uncaught console errors during the accusation flow", async () => {
    // Mirror the parody suite's tolerance for dev-mode noise; flag
    // anything that looks like a real product error.
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
