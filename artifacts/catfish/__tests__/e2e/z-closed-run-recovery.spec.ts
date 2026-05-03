/**
 * End-to-end Playwright suite for Task #68 — the post-accusation
 * Journal dead-end.
 *
 * The bug: after a player accused, dismissed the EndOfRunCard via
 * "Back To Title", and re-entered the Journal from the parody home
 * grid, the Journal rendered an empty evidence locker with no
 * "Accuse A Suspect" button (correctly hidden because run.closed)
 * and no in-screen way back to the case recap. The only escape was
 * the bone home-indicator pill at the bottom of the screen — a
 * non-discoverable affordance the user reported as a soft lock.
 *
 * The fix this spec pins down:
 *   - Journal renders a "case sealed" recovery panel when run.closed,
 *     with explicit "View Case Recap" + "Start New Case" buttons.
 *   - "View Case Recap" re-mounts the EndOfRunCard for the same
 *     ending the player previously dismissed (the run keeps its
 *     `ending` payload + flips an `endingDismissed` flag instead of
 *     nulling the result).
 *   - "Start New Case" wipes the closed run and lands the player on
 *     a fresh Lots 'o Fish deck.
 *   - The HomeIndicator pill carries a discoverable "home" caption
 *     above the bar so the back-to-grid affordance reads as one.
 *
 * Filename note: prefixed with `z-` so it sorts after the parody
 * suite for the same reason `z-accusation-happy-path.spec.ts` does
 * (see that file's header).
 */

import { expect, test, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Helpers (mirrored from z-accusation-happy-path.spec.ts — kept local so
// the two specs can evolve independently without coupling)
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
  ending?: { ending: string } | null;
  deck: PersistedCandidate[];
  deckCursor: number;
  matches?: PersistedMatch[];
}

async function bootIntoFreshRun(page: Page): Promise<void> {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    try {
      window.localStorage.clear();
    } catch {
      /* private mode / quota — best effort */
    }
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
      } catch {
        /* keep polling */
      }
    }
    await page.waitForTimeout(150);
  }
  throw new Error(`Active run never appeared under "${ACTIVE_RUN_KEY}"`);
}

/**
 * Drive the player from a fresh run all the way to a closed,
 * dismissed-EndOfRunCard state — i.e. the exact starting point the
 * Task #68 dead-end reproed from.
 */
async function reachClosedDismissedRun(page: Page): Promise<void> {
  await bootIntoFreshRun(page);

  const run = await readActiveRun(page);
  const killerCandidate = run.deck.find((c) => c.isKillerCandidate);
  expect(killerCandidate).toBeDefined();
  const killerRowTestId = `accuse-row-${killerCandidate!.id}`;

  // Right-swipe every deck candidate so the killer shows up on the
  // AccusationSheet (sheet only lists `seen = deck.slice(0, cursor)`).
  await page.getByTestId("parody-app-lotsOfFish").click();
  const enter = page.getByTestId("parody-lotsofish-open");
  if (await enter.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await enter.click();
  }

  const deckSize = run.deck.length;
  const swipeDeadline = Date.now() + 15_000;
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
      await page.waitForTimeout(150);
      continue;
    }
    await likeBtn.click();
    await page.waitForTimeout(50);
  }

  // No need to file a fact for this spec — the AccusationSheet works
  // with zero captured evidence; the recap shown is just a wrongful-
  // accusation/caughtThem outcome rather than a full deduction chain.

  // Open the Journal (skip Sleep — accusation flow doesn't require
  // matches, just a swiped-on candidate roster).
  await page.getByTestId("parody-home-indicator").click();
  await page.getByTestId("parody-app-journal").click();

  // File against the killer.
  await page.getByText("Accuse A Suspect").first().click();
  await page.getByTestId(killerRowTestId).click();
  await page.getByText("File Accusation").first().click();

  // EndOfRunCard appears, then dismiss via "Back To Title". That
  // routes to "/" (title screen) and (Task #68) keeps the run's
  // `ending` populated so the Journal can re-open it.
  const endCard = page.getByTestId("end-of-run-card");
  await expect(endCard).toBeVisible({ timeout: 10_000 });
  await endCard.getByText("Back To Title").first().click();
  await expect(endCard).toBeHidden({ timeout: 10_000 });

  // Confirm the persisted run is the dead-end shape: closed,
  // dismissed, but ending preserved so the Journal can re-mount it.
  await page.waitForFunction(
    (key) => {
      const blob = window.localStorage.getItem(key);
      if (!blob) return false;
      try {
        const r = JSON.parse(blob) as PersistedRun;
        return !!r.closed && !!r.endingDismissed && !!r.ending;
      } catch {
        return false;
      }
    },
    ACTIVE_RUN_KEY,
    { timeout: 5_000 },
  );
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe("closed-run Journal recovery — no soft-lock after accusing", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 400, height: 900 },
    });
    page = await ctx.newPage();
  });

  test.afterAll(async () => {
    if (page) {
      await page.evaluate(() => window.localStorage.clear()).catch(() => {});
      await page.context().close();
    }
  });

  test.setTimeout(180_000);

  test("Journal recovers from the post-accusation dead-end with View Case Recap + Start New Case", async () => {
    await reachClosedDismissedRun(page);

    // Title-screen footnote should already explain the closed state
    // ("last case closed on day N — start a new one to play again").
    await expect(
      page.getByText(/last case closed on day/i).first(),
    ).toBeVisible({ timeout: 5_000 });

    // The user repro for Task #68 was "re-entering Journal from home
    // grid". The title screen has no Continue path for a closed run,
    // so the player gets there by deep-linking back to /home (the
    // shell URL is the same path Start New Case routes to). This
    // simulates the dead-end entry point.
    await page.goto("/home", { waitUntil: "domcontentloaded" });

    // Land on the parody phone home grid.
    await expect(page.getByTestId("parody-app-journal")).toBeVisible({
      timeout: 30_000,
    });

    // Open Journal — pre-fix this was the soft-lock screen.
    await page.getByTestId("parody-app-journal").click();

    // Recovery panel appears with both routes out.
    const panel = page.getByTestId("journal-closed-run-panel");
    await expect(panel).toBeVisible({ timeout: 10_000 });
    await expect(panel.getByText(/case sealed/i)).toBeVisible();

    // The pre-fix Accuse button must NOT render once the case has
    // closed (the Accuse flow no-ops on closed runs in the store).
    await expect(page.getByText("Accuse A Suspect")).toHaveCount(0);

    // ----- HomeIndicator discoverability ----------------------------
    // Bone-pill back-to-grid affordance should now carry an explicit
    // "home" caption so it reads as a button, not chrome.
    const indicator = page.getByTestId("parody-home-indicator");
    await expect(indicator).toBeVisible();
    await expect(indicator.getByText(/^home$/i)).toBeVisible();

    // ----- Path A: View Case Recap re-mounts EndOfRunCard -----------
    const viewRecap = panel.getByText("View Case Recap").first();
    await expect(viewRecap).toBeVisible();
    await viewRecap.click();

    const endCard = page.getByTestId("end-of-run-card");
    await expect(endCard).toBeVisible({ timeout: 10_000 });
    // Card shows the same outcome verbiage from the original
    // accusation (case closed / wrong call / etc.); we just assert
    // it has any of the four ending titles.
    await expect(
      endCard.getByText(/case closed|wrong call|face to face|they got away/i),
    ).toBeVisible();

    // Persisted endingDismissed should be back to false.
    const reopenedFlag = await page.evaluate((key) => {
      const blob = window.localStorage.getItem(key);
      if (!blob) return null;
      try {
        return (JSON.parse(blob) as PersistedRun).endingDismissed ?? false;
      } catch {
        return null;
      }
    }, ACTIVE_RUN_KEY);
    expect(reopenedFlag).toBe(false);

    // Dismiss again so the Journal panel returns and we can exercise
    // Path B (Start New Case) from the same surface.
    await endCard.getByText("Back To Title").first().click();
    await expect(endCard).toBeHidden({ timeout: 10_000 });

    // ----- Path B: Start New Case wipes the closed run -------------
    await page.goto("/home", { waitUntil: "domcontentloaded" });
    await page.getByTestId("parody-app-journal").click();
    const panelAgain = page.getByTestId("journal-closed-run-panel");
    await expect(panelAgain).toBeVisible({ timeout: 10_000 });

    await panelAgain.getByText("Start New Case").first().click();

    // Lands on the parody phone HOME GRID with a fresh run — the
    // ClosedRunPanel "Start New Case" handler mirrors the EndOfRunCard
    // path (goHome() + setLotsOfFishView("splash") + router.replace
    // ("/home")), so the player sees the home tile, NOT the splash.
    await expect(page.getByTestId("parody-app-lotsOfFish")).toBeVisible({
      timeout: 30_000,
    });
    const fresh = await readActiveRun(page);
    expect(fresh.closed ?? false).toBe(false);
    expect(fresh.deckCursor).toBe(0);
    expect(fresh.deck.length).toBeGreaterThan(0);
  });
});
