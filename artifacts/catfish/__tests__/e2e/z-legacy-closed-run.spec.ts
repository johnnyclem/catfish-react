/**
 * Playwright spec for Task #69 — pin closed-run recovery against
 * legacy save files.
 *
 * Players who closed a case before Task #68 shipped have a saved run
 * on disk where `run.ending` is `null` but `run.closed` is `true`
 * (the old `dismissAccusation` used to null `ending`). The Journal's
 * recovery panel handles this gracefully: it hides "View Case Recap"
 * and shows only "Start New Case". This spec pins that behavior so a
 * future refactor can't silently reintroduce the dead-end.
 *
 * The `reopenEnding` no-op is verified indirectly: the test confirms
 * that the persisted run's `ending` stays `null` and no
 * `endingDismissed` flag is injected after the store hydrates and the
 * Journal renders — which are the exact preconditions that make
 * `reopenEnding` early-return (`if (!prev.ending) return`). Combined
 * with the UI assertion that the "View Case Recap" button (the only
 * caller of `reopenEnding`) is absent, both the data guard and the
 * UI guard are pinned.
 *
 * Companion to `z-closed-run-recovery.spec.ts` which exercises the
 * normal (post-#68) closed-run recovery path where `ending` is still
 * populated.
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

/**
 * Minimal synthetic legacy save — the exact shape a pre-Task#68
 * player would have on disk after closing a case and dismissing the
 * end-of-run card (which nulled `ending`).
 *
 * Only the fields the Journal recovery panel reads are populated;
 * everything else is stubbed to the smallest valid shape so the
 * store's `migrateRun` doesn't choke on missing arrays.
 */
function buildLegacySave() {
  return {
    id: "run_legacy_test_001",
    killer: "miles" as const,
    startedAt: new Date().toISOString(),
    day: 5,
    deck: [
      {
        id: "cand_legacy_killer",
        identity: "miles",
        displayName: "Miles",
        age: 28,
        tagline: "Photographer with a secret.",
        bio: "Legacy test candidate.",
        prompts: ["What's your favorite lens?"],
        isKillerCandidate: true,
        isStoryCandidate: true,
      },
      {
        id: "cand_legacy_decoy",
        displayName: "Decoy Dan",
        age: 30,
        tagline: "Just a regular person.",
        bio: "Legacy test decoy.",
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
    ending: null,
    usedInnocentScriptIds: [],
  };
}

test.describe("legacy closed-run save — ending=null, endingDismissed absent", () => {
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

  test("recovery panel shows Start New Case but NOT View Case Recap for a legacy save", async () => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      try {
        window.localStorage.clear();
      } catch {
        /* best effort */
      }
    });

    const legacySave = buildLegacySave();
    await page.evaluate(
      ({ key, blob }) => {
        window.localStorage.setItem(key, JSON.stringify(blob));
      },
      { key: ACTIVE_RUN_KEY, blob: legacySave },
    );

    await page.reload({ waitUntil: "domcontentloaded" });

    await page.goto("/home", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("parody-app-journal")).toBeVisible({
      timeout: 30_000,
    });
    await page.getByTestId("parody-app-journal").click();

    const panel = page.getByTestId("journal-closed-run-panel");
    await expect(panel).toBeVisible({ timeout: 10_000 });

    await expect(panel.getByText("Start New Case")).toBeVisible();

    await expect(panel.getByText("View Case Recap")).toHaveCount(0);

    await expect(panel.getByText(/case closed/i)).toBeVisible();
    await expect(
      panel.getByText(/this case is over/i),
    ).toBeVisible();
  });

  test("reopenEnding is a no-op when the legacy save has no ending payload", async () => {
    const run = await readPersistedRun(page);

    expect(run).not.toBeNull();
    expect(run!.id).toBe("run_legacy_test_001");
    expect(run!.closed).toBe(true);
    expect(run!.ending).toBeNull();
    expect(run!.endingDismissed).toBeUndefined();

    const panel = page.getByTestId("journal-closed-run-panel");
    await expect(panel).toBeVisible();
    await expect(panel.getByText("View Case Recap")).toHaveCount(0);

    const runAfter = await readPersistedRun(page);
    expect(runAfter).not.toBeNull();
    expect(runAfter!.ending).toBeNull();
    expect(runAfter!.endingDismissed).toBeUndefined();
    expect(runAfter!.closed).toBe(true);
    expect(runAfter!.id).toBe(run!.id);
  });
});
