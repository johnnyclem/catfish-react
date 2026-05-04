/**
 * Playwright spec for Task #72 — pin closed-run recovery against
 * a legacy save left behind by the Day 7 face-to-face timer.
 *
 * Companion to `z-legacy-closed-run.spec.ts` (Task #69), which covers
 * the case where `ending` is `null`. This spec covers the *other*
 * legacy edge case: the `advanceDay` auto-close stamped a valid
 * `ending` payload (`metKillerStub`), but the player quit the app
 * before the EndOfRunCard rendered, so `endingDismissed` was never
 * written to disk.
 *
 * After hydration the store's `migrateRun` coerces absent
 * `endingDismissed` to `false` in memory (the on-disk blob keeps the
 * field absent until a store action explicitly writes it). This means:
 *   - The EndOfRunCard auto-mounts (its gate is
 *     `if (!run.ending || run.endingDismissed) return null`; the
 *     in-memory `false` is falsy, so the card renders).
 *   - Once dismissed via "Back To Title", `dismissAccusation`
 *     persists `endingDismissed: true` — hiding the card.
 *   - The Journal's ClosedRunPanel shows both "View Case Recap"
 *     (because `canViewRecap = !!run.ending`) and "Start New Case".
 *   - "View Case Recap" calls `reopenEnding`, which flips
 *     `endingDismissed` back to `false` and the EndOfRunCard
 *     re-mounts.
 *
 * The spec pins all four of these behaviors so a future refactor
 * can't silently break the Day 7 recovery path.
 */

import { expect, test, type Page } from "@playwright/test";

const ACTIVE_RUN_KEY = "catfish/active_run/v1";

interface PersistedRun {
  id: string;
  closed?: boolean;
  ending?: { ending: string } | null;
  endingDismissed?: boolean;
}

function readPersistedRun(page: Page): Promise<PersistedRun | null> {
  return page.evaluate((key) => {
    const blob = window.localStorage.getItem(key);
    if (!blob) return null;
    try {
      return JSON.parse(blob) as PersistedRun;
    } catch {
      return null;
    }
  }, ACTIVE_RUN_KEY);
}

function buildDay7LegacySave() {
  return {
    id: "run_day7_legacy_001",
    killer: "miles" as const,
    startedAt: new Date().toISOString(),
    day: 7,
    deck: [
      {
        id: "cand_d7_killer",
        identity: "miles",
        displayName: "Miles",
        age: 28,
        tagline: "Photographer with a secret.",
        bio: "Day 7 test candidate.",
        prompts: ["What's your favorite lens?"],
        isKillerCandidate: true,
        isStoryCandidate: true,
      },
      {
        id: "cand_d7_decoy",
        displayName: "Decoy Dan",
        age: 30,
        tagline: "Just a regular person.",
        bio: "Day 7 test decoy.",
        prompts: ["What's your hobby?"],
        isKillerCandidate: false,
        isStoryCandidate: false,
      },
    ],
    deckCursor: 2,
    swipes: [],
    matches: [],
    threads: [],
    facts: [],
    pendingLikes: [],
    pendingMatchAnnouncements: [],
    closed: true,
    ending: {
      correct: true,
      matchedDeduction: null,
      ending: "metKillerStub",
      narrativeBeat:
        "Across the table, the smile didn't fade. They knew you knew. They wanted you to know.",
    },
    usedInnocentScriptIds: [],
  };
}

test.describe("legacy Day 7 face-to-face save — ending populated, endingDismissed absent", () => {
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

  test.setTimeout(120_000);

  test("EndOfRunCard auto-mounts after migration coerces endingDismissed to false", async () => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      try {
        window.localStorage.clear();
      } catch {
        /* best effort */
      }
    });

    const save = buildDay7LegacySave();
    await page.evaluate(
      ({ key, blob }) => {
        window.localStorage.setItem(key, JSON.stringify(blob));
      },
      { key: ACTIVE_RUN_KEY, blob: save },
    );

    await page.reload({ waitUntil: "domcontentloaded" });

    const endCard = page.getByTestId("end-of-run-card");
    await expect(endCard).toBeVisible({ timeout: 30_000 });
    await expect(
      endCard.getByText(/face to face/i),
    ).toBeVisible();

    const run = await readPersistedRun(page);
    expect(run).not.toBeNull();
    expect(run!.id).toBe("run_day7_legacy_001");
    expect(run!.closed).toBe(true);
    expect(run!.ending).not.toBeNull();
    expect(run!.ending!.ending).toBe("metKillerStub");
    expect(run!.endingDismissed).toBeUndefined();
  });

  test("recovery panel shows both View Case Recap and Start New Case after dismissing EndOfRunCard", async () => {
    const endCard = page.getByTestId("end-of-run-card");
    await expect(endCard).toBeVisible();
    await endCard.getByText("Back To Title").first().click();
    await expect(endCard).toBeHidden({ timeout: 10_000 });

    const runAfterDismiss = await readPersistedRun(page);
    expect(runAfterDismiss).not.toBeNull();
    expect(runAfterDismiss!.endingDismissed).toBe(true);

    await page.goto("/home", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("parody-app-journal")).toBeVisible({
      timeout: 30_000,
    });
    await page.getByTestId("parody-app-journal").click();

    const panel = page.getByTestId("journal-closed-run-panel");
    await expect(panel).toBeVisible({ timeout: 10_000 });

    await expect(panel.getByText("Start New Case")).toBeVisible();
    await expect(panel.getByText("View Case Recap")).toBeVisible();

    await expect(panel.getByText(/case sealed/i)).toBeVisible();
    await expect(panel.getByText(/face to face/i)).toBeVisible();
  });

  test("View Case Recap successfully re-mounts the EndOfRunCard", async () => {
    const panel = page.getByTestId("journal-closed-run-panel");
    await expect(panel).toBeVisible();

    await panel.getByText("View Case Recap").first().click();

    const endCard = page.getByTestId("end-of-run-card");
    await expect(endCard).toBeVisible({ timeout: 10_000 });
    await expect(
      endCard.getByText(/face to face/i),
    ).toBeVisible();

    const run = await readPersistedRun(page);
    expect(run).not.toBeNull();
    expect(run!.endingDismissed).toBe(false);
    expect(run!.ending).not.toBeNull();
    expect(run!.ending!.ending).toBe("metKillerStub");
    expect(run!.closed).toBe(true);
  });
});
