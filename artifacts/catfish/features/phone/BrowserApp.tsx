/**
 * BrowserApp — investigation web search.
 *
 * Phase 9 surface: a pixel-noir "web browser" that lets the player
 * search for investigation keywords and surface pre-authored evidence
 * results. Each search commits the associated fact to the journal if
 * the player hasn't already discovered it.
 *
 * Search content is keyed by keyword strings. Results are day-gated
 * (some results only appear after certain days). Searching a keyword
 * the player has already found produces a "you already know about X"
 * message rather than duplicating the fact.
 */
import { useState } from "react";
import { FlatList, Pressable, StyleSheet, TextInput, View } from "react-native";

import { PixelText, ScanlineOverlay } from "@/components/PixelChrome";
import { cfPalette } from "@/constants/colors";
import { useGameState } from "@/core/gameStore";

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

/** Pre-authored search results keyed by the keyword the player types. */
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

function matchResult(query: string, day: number): SearchResult | null {
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

function ResultRow({
  result,
  alreadyKnown,
  onTap,
}: {
  result: SearchResult;
  alreadyKnown: boolean;
  onTap: () => void;
}) {
  return (
    <Pressable
      onPress={onTap}
      style={({ pressed }) => [
        styles.resultRow,
        pressed && { opacity: 0.7 },
        alreadyKnown && { opacity: 0.55 },
      ]}
    >
      <View style={styles.resultHeader}>
        <PixelText size={7} color={cfPalette.cyan} style={{ flex: 1 }}>
          {result.headline}
        </PixelText>
        {alreadyKnown && (
          <PixelText size={5} color={cfPalette.ash} style={{ marginLeft: 6 }}>
            saved
          </PixelText>
        )}
      </View>
      <PixelText size={6} color={cfPalette.fog}  style={{ marginTop: 4 }}>
        {result.excerpt}
      </PixelText>
      {alreadyKnown ? null : (
        <PixelText size={5} color={cfPalette.greenBright} style={{ marginTop: 6 }}>
          evidence saved to journal
        </PixelText>
      )}
    </Pressable>
  );
}

function EmptyState({ query }: { query: string }) {
  const isRH = isRedHerring(query);
  return (
    <View style={styles.emptyState}>
      <PixelText size={8} color={cfPalette.ash} align="center">
        {isRH ? "no results found" : `no results for "${query}"`}
      </PixelText>
      <PixelText size={6} color={cfPalette.fog} align="center" style={{ marginTop: 6 }}>
        {isRH
          ? "check the spelling or try a different term"
          : "try searching for evidence-related keywords"}
      </PixelText>
    </View>
  );
}

export function BrowserApp() {
  const run = useGameState((s) => s.run);
  const commitFact = useGameState((s) => s.commitFact);
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState<SearchHistoryEntry[]>([]);
  const [currentResult, setCurrentResult] = useState<SearchResult | null>(null);
  const [noResult, setNoResult] = useState(false);

  const day = run?.day ?? 1;
  const knownFactIds = new Set<string>((run?.facts ?? []).map((f) => f.authoringKey));

  function handleSearch() {
    const trimmed = query.trim();
    if (!trimmed) return;

    const result = matchResult(trimmed, day);
    setNoResult(!result && !isRedHerring(trimmed));

    if (result) {
      const alreadyKnown = knownFactIds.has(result.linkedFactId);
      setCurrentResult(result);
      setSearched((prev) => [
        { query: trimmed, resultId: result.id, day },
        ...prev.filter((e) => e.query !== trimmed),
      ]);
      if (!alreadyKnown) {
        void commitFact({
          candidateId: result.aboutCharacter ?? "miles",
          quote: `[Browser] ${result.headline}: ${result.excerpt}`,
        });
      }
    } else {
      setCurrentResult(null);
      setSearched((prev) => [
        { query: trimmed, resultId: null, day },
        ...prev.filter((e) => e.query !== trimmed),
      ]);
    }
  }

  function handleHistoryTap(entry: SearchHistoryEntry) {
    if (!entry.resultId) return;
    const result = SEARCH_DATABASE.find((r) => r.id === entry.resultId);
    if (result && result.day <= day) {
      setCurrentResult(result);
      setNoResult(false);
      setQuery(entry.query);
    } else {
      setQuery(entry.query);
      setCurrentResult(null);
      setNoResult(true);
    }
  }

  function handleBack() {
    setCurrentResult(null);
    setNoResult(false);
  }

  if (currentResult) {
    const alreadyKnown = knownFactIds.has(currentResult.linkedFactId);
    return (
      <View style={styles.root}>
        <ScanlineOverlay />
        <View style={styles.header}>
          <Pressable onPress={handleBack} style={styles.backBtn}>
            <PixelText size={8} color={cfPalette.cyan}>
              ← back
            </PixelText>
          </Pressable>
          <PixelText size={9} color={cfPalette.bone} style={{ flex: 1, textAlign: "center" }}>
            browser
          </PixelText>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.resultDetail}>
          <PixelText size={10} color={cfPalette.bone} style={{ marginBottom: 8 }}>
            {currentResult.headline}
          </PixelText>
          <PixelText size={7} color={cfPalette.fog} style={{ marginBottom: 16 }}>
            day {currentResult.day} · "{currentResult.keyword}"
          </PixelText>
          <PixelText size={7} color={cfPalette.ash} style={{ lineHeight: 13 }}>
            {currentResult.excerpt}
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

  return (
    <View style={styles.root}>
      <ScanlineOverlay />
      <View style={styles.header}>
        <PixelText size={11} color={cfPalette.bone}>
          browser
        </PixelText>
      </View>

      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={handleSearch}
          placeholder="search..."
          placeholderTextColor={cfPalette.ash}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable onPress={handleSearch} style={styles.searchBtn}>
          <PixelText size={7} color={cfPalette.navyDeep}>
            go
          </PixelText>
        </Pressable>
      </View>

      {noResult && (
        <View style={styles.noResultBanner}>
          <PixelText size={6} color={cfPalette.fog}>
            nothing found for "{query}" — try different keywords
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
        {["canal warehouse fire", "trail camera", "IG reflection", "marina logs", "badge swipes"].map(
          (hint) => (
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
          ),
        )}
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
  backBtn: {
    width: 40,
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
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
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