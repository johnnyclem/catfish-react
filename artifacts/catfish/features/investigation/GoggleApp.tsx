/**
 * GoggleApp — investigation search.
 *
 * The detective's web-search surface. Two result sources, served from a
 * single search bar:
 *
 *   1. Evidence keywords (canal warehouse fire, trail camera, …) —
 *      pre-authored news/forensics blurbs keyed by query string. This
 *      is the original Browser app's keyword database; results are
 *      day-gated and commit a fact to the journal on first open.
 *
 *   2. Match names (Miles, Lola, Tessa, …) — per-candidate "Google
 *      yourself" hits authored in `core/onlineFootprint.ts`. Innocents
 *      have rich day-gated footprints; the killer's footprint is
 *      almost empty until the player captures specific facts that
 *      pull the thread.
 *
 * GoggleApp also reads `usePhoneShell.pendingGoggleCandidate` on mount —
 * the chat header's "background check" button deep-links into this
 * app prefilled with a candidate's displayName, fires the search once,
 * and clears the slot.
 */
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";

import { PixelText, ScanlineOverlay } from "@/components/PixelChrome";
import { cfPalette } from "@/constants/colors";
import { useGameState } from "@/core/gameStore";
import {
  type GoggleHit,
  getGoggleHitsFor,
  hasFootprint,
} from "@/core/onlineFootprint";
import { usePhoneShell } from "@/features/parody/phoneShellState";

interface SearchResult {
  id: string;
  keyword: string;
  headline: string;
  excerpt: string;
  day: number;
  linkedFactId: string;
  aboutCharacter?: string;
}

interface SearchHistoryEntry {
  query: string;
  resultId: string | null;
  day: number;
}

/** Pre-authored evidence-keyword results (the legacy Browser database). */
const SEARCH_DATABASE: SearchResult[] = [
  {
    id: "sr_canal_warehouse",
    keyword: "canal warehouse fire",
    headline: "Eastside Warehouse Fire Under Investigation",
    excerpt:
      "Authorities are investigating a fire that broke out at the old canal warehouse district. Witnesses report flames visible from the bridge around 11 PM Tuesday.",
    day: 1,
    linkedFactId: "canal_warehouse_fire",
    aboutCharacter: "miles",
  },
  {
    id: "sr_trail_camera",
    keyword: "trail camera",
    headline: "Parks Dept. Expands Camera Network Along Gorge Trail",
    excerpt:
      "Following several reported incidents, the parks department has installed three new trail cameras along the gorge approach. Officials say footage is reviewed weekly.",
    day: 2,
    linkedFactId: "trail_camera_gorge",
    aboutCharacter: "river",
  },
  {
    id: "sr_medical_cart",
    keyword: "medical cart",
    headline: "Hospital Procurement Records Released",
    excerpt:
      "The city's hospital system published its quarterly procurement records. Several medical cart rentals to residential addresses were flagged in the report.",
    day: 2,
    linkedFactId: "medical_cart_rental",
    aboutCharacter: "tessa",
  },
  {
    id: "sr_ig_reflection",
    keyword: "IG reflection",
    headline: "Social Media Forensics: What Your Photos Reveal",
    excerpt:
      "A popular true-crime blog walks through how reflections and background details in Instagram posts can corroborate or contradict alibi claims.",
    day: 2,
    linkedFactId: "ig_reflection_forensics",
    aboutCharacter: "miles",
  },
  {
    id: "sr_bar_staff_schedule",
    keyword: "bar staff schedule",
    headline: "Late-Night Bar Schedules Under Scrutiny After Incident",
    excerpt:
      "Several downtown bars have been asked to submit staff schedules for last Tuesday. One bar manager told reporters the request came 'out of nowhere.'",
    day: 3,
    linkedFactId: "bar_staff_tuesday",
    aboutCharacter: "jules",
  },
  {
    id: "sr_marina_logs",
    keyword: "marina logs",
    headline: "Waterway Access Logs Raise Questions About Dawn Departures",
    excerpt:
      "Public marina access logs show vessel departures well before the advertised 4:30 AM time posted on several boaters' profiles. Inspectors are reviewing the discrepancy.",
    day: 3,
    linkedFactId: "marina_logs_early",
    aboutCharacter: "ren",
  },
  {
    id: "sr_transit_lot",
    keyword: "transit lot",
    headline: "Transit Lot Fencing Project Delays Continue",
    excerpt:
      "The long-stalled transit lot renovation project remains fenced off. City inspectors issued a stop-work order last month citing permit issues.",
    day: 3,
    linkedFactId: "transit_lot_fenced",
    aboutCharacter: "kai",
  },
  {
    id: "sr_parfume_receipts",
    keyword: "parfume receipts",
    headline: "Small Business Compliance Sweep Includes Perfume Shop",
    excerpt:
      "The city's small-business audit sweep included a boutique perfumery on the quiet end of downtown. Receipt timestamps are being reviewed against owner statements.",
    day: 4,
    linkedFactId: "parfume_shop_receipts",
    aboutCharacter: "delphine",
  },
  {
    id: "sr_gorge_hiker",
    keyword: "gorge hiker",
    headline: "Witness Describes Two Figures at Trailhead Before Dark",
    excerpt:
      "A hiker reaching the gorge trailhead last Sunday reported seeing two figures near the parking area. 'They seemed to know each other,' the witness said. 'Not a casual meeting.'",
    day: 4,
    linkedFactId: "gorge_trailhead_two",
    aboutCharacter: "river",
  },
  {
    id: "sr_badge_swipes",
    keyword: "badge swipes",
    headline: "City Workers' Badge Access Data Released Under FOIA",
    excerpt:
      "A public records request uncovered off-site badge swipes for several city workers during their claimed shift hours. The data covers a two-week window.",
    day: 4,
    linkedFactId: "badge_swipes_offsite",
    aboutCharacter: "sam",
  },
  {
    id: "sr_canal_phone",
    keyword: "canal phone",
    headline: "Burned Phone Found at Warehouse Scene Examined",
    excerpt:
      "Investigators recovered a burned mobile phone near the canal warehouse fire scene. The device is being forensically examined to determine ownership.",
    day: 5,
    linkedFactId: "burned_phone_recovered",
    aboutCharacter: "miles",
  },
  {
    id: "sr_paint_fumes",
    keyword: "paint fumes",
    headline: "Artisanal Paint Studio Fire Risk Under Review",
    excerpt:
      "A city fire marshal inspection report flagged a local artist's studio for improper paint-stripping ventilation. The report predates the warehouse fire.",
    day: 5,
    linkedFactId: "paint_studio_ventilation",
    aboutCharacter: "kai",
  },
  {
    id: "sr_dawn_logs",
    keyword: "dawn logs",
    headline: "Dawn Patrol: When Boaters Actually Leave the Marina",
    excerpt:
      "A review of marina departure logs from the past month shows a significant gap between the posted 4:30 AM departure time and what the digital records show.",
    day: 5,
    linkedFactId: "dawn_departure_log",
    aboutCharacter: "ren",
  },
];

/** Red herrings — searches that return no results. */
const RED_HERRINGS = [
  "coffee shop camera",
  "bicycle rental log",
  "laundromat receipt",
  "late-night food delivery",
  "subway pass scan",
  "motel registration",
];

function normalizeQuery(q: string): string {
  return q.toLowerCase().trim();
}

function matchEvidenceResult(query: string): SearchResult | null {
  const norm = normalizeQuery(query);
  return (
    SEARCH_DATABASE.find(
      (r) =>
        r.keyword === norm ||
        r.keyword.includes(norm) ||
        norm.includes(r.keyword),
    ) ?? null
  );
}

function isRedHerring(query: string): boolean {
  return RED_HERRINGS.some((rh) => normalizeQuery(rh) === normalizeQuery(query));
}

/** Does the query match a known background-check name? Returns the
    raw query string trimmed (used as the lookup key). */
function detectNameQuery(query: string): string | null {
  const norm = normalizeQuery(query);
  if (!norm) return null;
  // Try the whole query first (handles "Miles Carver"), then first token
  // (handles "Miles"). Lookup is by first token because Candidate.displayName
  // is the short name; "Miles Carver" hits via the first-token fallback.
  if (hasFootprint(norm)) return norm;
  const first = norm.split(/\s+/)[0];
  if (first && hasFootprint(first)) return first;
  return null;
}

function ResultDetail({
  result,
  alreadyKnown,
  onBack,
}: {
  result: SearchResult;
  alreadyKnown: boolean;
  onBack: () => void;
}) {
  return (
    <View style={styles.root}>
      <ScanlineOverlay />
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backBtn}>
          <PixelText size={8} color={cfPalette.cyan}>← back</PixelText>
        </Pressable>
        <PixelText size={9} color={cfPalette.bone} style={{ flex: 1, textAlign: "center" }}>
          goggle
        </PixelText>
        <View style={{ width: 40 }} />
      </View>
      <View style={styles.resultDetail}>
        <PixelText size={10} color={cfPalette.bone} style={{ marginBottom: 8 }}>
          {result.headline}
        </PixelText>
        <PixelText size={7} color={cfPalette.fog} style={{ marginBottom: 16 }}>
          day {result.day} · "{result.keyword}"
        </PixelText>
        <PixelText size={7} color={cfPalette.ash} style={{ lineHeight: 13 }}>
          {result.excerpt}
        </PixelText>
        {alreadyKnown ? (
          <PixelText size={6} color={cfPalette.ash} style={{ marginTop: 20 }}>
            (already in journal)
          </PixelText>
        ) : (
          <PixelText size={7} color={cfPalette.greenBright} style={{ marginTop: 20 }}>
            ✓ evidence committed to journal
          </PixelText>
        )}
      </View>
    </View>
  );
}

function NameHitsView({
  name,
  hits,
  onHitTap,
  onBack,
}: {
  name: string;
  hits: GoggleHit[];
  onHitTap: (hit: GoggleHit) => void;
  onBack: () => void;
}) {
  return (
    <View style={styles.root}>
      <ScanlineOverlay />
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backBtn}>
          <PixelText size={8} color={cfPalette.cyan}>← back</PixelText>
        </Pressable>
        <PixelText size={9} color={cfPalette.bone} style={{ flex: 1, textAlign: "center" }}>
          goggle
        </PixelText>
        <View style={{ width: 40 }} />
      </View>
      <View style={styles.nameHeader}>
        <PixelText size={11} color={cfPalette.bone}>
          "{name}"
        </PixelText>
        <PixelText size={6} color={cfPalette.ash} style={{ marginTop: 4 }}>
          {hits.length === 0 ? "no results" : `${hits.length} result${hits.length === 1 ? "" : "s"}`}
        </PixelText>
      </View>
      {hits.length === 0 ? (
        <View style={styles.emptyState}>
          <PixelText size={8} color={cfPalette.ash} align="center">
            not much online for this one yet
          </PixelText>
          <PixelText size={6} color={cfPalette.fog} align="center" style={{ marginTop: 8, paddingHorizontal: 24, lineHeight: 11 }}>
            keep digging — a lead from chat, the journal, or another app might surface results that aren't here yet
          </PixelText>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }}>
          {hits.map((hit) => (
            <Pressable
              key={hit.id}
              onPress={() => onHitTap(hit)}
              style={({ pressed }) => [styles.resultRow, pressed && { opacity: 0.6 }]}
            >
              <View style={styles.kindPill}>
                <PixelText size={5} color={cfPalette.navyDeep}>
                  {hit.kind}
                </PixelText>
              </View>
              <PixelText size={7} color={cfPalette.cyan} style={{ marginTop: 6 }}>
                {hit.headline}
              </PixelText>
              <PixelText size={6} color={cfPalette.fog} style={{ marginTop: 4, lineHeight: 11 }}>
                {hit.excerpt}
              </PixelText>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

export function GoggleApp() {
  const run = useGameState((s) => s.run);
  const commitFact = useGameState((s) => s.commitFact);
  const pendingGoggleCandidate = usePhoneShell((s) => s.pendingGoggleCandidate);
  const consumePendingGoggleCandidate = usePhoneShell((s) => s.consumePendingGoggleCandidate);
  const clearBackgroundCheck = usePhoneShell((s) => s.clearBackgroundCheck);

  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState<SearchHistoryEntry[]>([]);
  const [currentResult, setCurrentResult] = useState<SearchResult | null>(null);
  const [currentName, setCurrentName] = useState<string | null>(null);
  const [noResult, setNoResult] = useState(false);

  const day = run?.day ?? 1;
  const knownFactIds = new Set<string>((run?.facts ?? []).map((f) => f.authoringKey));

  // Consume any deep-link from the chat header on mount. Prefills the
  // query with the candidate's displayName, fires the search once,
  // and clears the pending slot so a second mount doesn't re-fire.
  useEffect(() => {
    if (!pendingGoggleCandidate) return;
    const candidate = run?.deck.find((c) => c.id === pendingGoggleCandidate);
    if (!candidate) {
      consumePendingGoggleCandidate();
      return;
    }
    const name = candidate.displayName;
    setQuery(name);
    runSearch(name);
    clearBackgroundCheck(candidate.id);
    consumePendingGoggleCandidate();
    // We intentionally omit `run` from deps — re-running on every run
    // mutation would clobber an in-progress search. The effect should
    // fire exactly once per deep-link.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingGoggleCandidate]);

  function runSearch(rawQuery: string) {
    const trimmed = rawQuery.trim();
    if (!trimmed) return;

    // 1. Name-search takes precedence — if the query matches a known
    //    candidate's footprint key, render the per-name results view.
    const nameKey = detectNameQuery(trimmed);
    if (nameKey) {
      setCurrentName(trimmed);
      setCurrentResult(null);
      setNoResult(false);
      setSearched((prev) => [
        { query: trimmed, resultId: null, day },
        ...prev.filter((e) => e.query !== trimmed),
      ]);
      return;
    }

    // 2. Otherwise fall back to the evidence-keyword database.
    const result = matchEvidenceResult(trimmed);
    setNoResult(!result && !isRedHerring(trimmed));

    if (result) {
      const alreadyKnown = knownFactIds.has(result.linkedFactId);
      setCurrentResult(result);
      setCurrentName(null);
      setSearched((prev) => [
        { query: trimmed, resultId: result.id, day },
        ...prev.filter((e) => e.query !== trimmed),
      ]);
      if (!alreadyKnown) {
        void commitFact({
          candidateId: result.aboutCharacter ?? "miles",
          quote: `[Goggle] ${result.headline}: ${result.excerpt}`,
        });
      }
    } else {
      setCurrentResult(null);
      setCurrentName(null);
      setSearched((prev) => [
        { query: trimmed, resultId: null, day },
        ...prev.filter((e) => e.query !== trimmed),
      ]);
    }
  }

  function handleSearch() {
    runSearch(query);
  }

  function handleHistoryTap(entry: SearchHistoryEntry) {
    setQuery(entry.query);
    runSearch(entry.query);
  }

  function handleBack() {
    setCurrentResult(null);
    setCurrentName(null);
    setNoResult(false);
  }

  function handleNameHitTap(hit: GoggleHit) {
    if (!hit.linkedFactId) return;
    if (knownFactIds.has(hit.linkedFactId)) return;
    void commitFact({
      candidateId: currentName ?? "miles",
      quote: `[Goggle] ${hit.headline}: ${hit.excerpt}`,
    });
  }

  if (currentResult) {
    const alreadyKnown = knownFactIds.has(currentResult.linkedFactId);
    return <ResultDetail result={currentResult} alreadyKnown={alreadyKnown} onBack={handleBack} />;
  }

  if (currentName) {
    const hits = getGoggleHitsFor(currentName, run);
    return <NameHitsView name={currentName} hits={hits} onHitTap={handleNameHitTap} onBack={handleBack} />;
  }

  return (
    <View style={styles.root}>
      <ScanlineOverlay />
      <View style={styles.header}>
        <PixelText size={11} color={cfPalette.bone}>
          goggle
        </PixelText>
      </View>

      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={handleSearch}
          placeholder="search a name or a clue..."
          placeholderTextColor={cfPalette.ash}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          testID="goggle-search-input"
        />
        <Pressable onPress={handleSearch} style={styles.searchBtn} testID="goggle-search-go">
          <PixelText size={7} color={cfPalette.navyDeep}>
            go
          </PixelText>
        </Pressable>
      </View>

      {noResult && (
        <View style={styles.noResultBanner}>
          <PixelText size={6} color={cfPalette.fog}>
            nothing found for "{query}" — try a different keyword or a match's name
          </PixelText>
        </View>
      )}

      {searched.length > 0 ? (
        <View style={styles.historySection}>
          <PixelText size={6} color={cfPalette.ash} style={styles.historyLabel}>
            history
          </PixelText>
          {searched.map((entry, i) => (
            <Pressable
              key={`${entry.query}-${i}`}
              onPress={() => handleHistoryTap(entry)}
              style={styles.historyRow}
            >
              <PixelText size={7} color={cfPalette.fog}  style={{ flex: 1 }}>
                {entry.query}
              </PixelText>
              <PixelText size={5} color={cfPalette.ash}>
                day {entry.day}
              </PixelText>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.hintSection}>
        <PixelText size={6} color={cfPalette.ash} style={styles.historyLabel}>
          try searching
        </PixelText>
        {["a match's name", "canal warehouse fire", "trail camera", "marina logs", "badge swipes"].map((hint) => (
          <Pressable
            key={hint}
            onPress={() => {
              setQuery(hint);
            }}
            style={styles.hintPill}
          >
            <PixelText size={5} color={cfPalette.fog}>
              {hint}
            </PixelText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: cfPalette.navyDeep,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: cfPalette.iron,
  },
  backBtn: { width: 40 },
  nameHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: cfPalette.iron,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    margin: 12,
    backgroundColor: cfPalette.void,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: cfPalette.iron,
    paddingHorizontal: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 11,
    color: cfPalette.bone,
    paddingVertical: 10,
  },
  searchBtn: {
    backgroundColor: cfPalette.cyan,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    marginLeft: 8,
  },
  noResultBanner: {
    marginHorizontal: 12,
    padding: 10,
    backgroundColor: cfPalette.iron,
    borderRadius: 4,
  },
  resultRow: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: cfPalette.iron,
  },
  kindPill: {
    alignSelf: "flex-start",
    backgroundColor: cfPalette.cyan,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  resultDetail: {
    flex: 1,
    padding: 16,
  },
  historySection: {
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  historyLabel: {
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
    gap: 8,
  },
  hintSection: {
    paddingHorizontal: 12,
    paddingTop: 16,
  },
  hintPill: {
    alignSelf: "flex-start",
    backgroundColor: cfPalette.iron,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    marginBottom: 6,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
});
