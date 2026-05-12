/**
 * FactDetailView — full-screen expanded view of a single committed Fact.
 *
 * PRD 10.6 — surfaces all metadata for a fact the player wants to
 * study closely or annotate with a deduction note.
 *
 * Contents:
 *   - Fact text / captured quote (prominent, centered)
 *   - Source badge + kind badge + day stamp
 *   - Image viewer (if `payload.imageAssetID` is set)
 *   - Linked facts — bidirectional, derived from evidence chains
 *   - Player note field — editable inline, persisted to `Fact.playerNote`
 *   - Related facts — same aboutCharacter OR same source.kind OR same chain
 *
 * Dismisses via backdrop press or ✕ button.
 */

import { useMemo, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import { AssetImage } from "@/components/AssetImage";
import {
  NeonButton,
  PixelPanel,
  PixelText,
  ScanlineOverlay,
} from "@/components/PixelChrome";
import { cfPalette } from "@/constants/colors";
import { useGameState } from "@/core/gameStore";
import { Fact, FactId } from "@/core/models";
import { getIdentityModule } from "@/core/identities";

interface FactDetailViewProps {
  fact: Fact;
  onClose: () => void;
}

const KIND_LABELS: Record<string, string> = {
  static: "authored · static",
  variable: "authored · variable",
  conditional: "authored · conditional",
  captured: "captured",
};

const SOURCE_COLORS: Record<string, string> = {
  bio: cfPalette.cyan,
  instagram: cfPalette.cyanHot,
  portrait: cfPalette.purple,
  devText: cfPalette.pinkHot,
  friendText: cfPalette.cyan,
  chatMessage: cfPalette.fog,
  narratorBeat: cfPalette.fog,
};

function SourceLabel({ source }: { source: Fact["source"] }): React.ReactElement {
  let label: string;
  switch (source.kind) {
    case "bio": label = "bio"; break;
    case "instagram": label = "IG"; break;
    case "portrait": label = source.expression; break;
    case "devText": label = "dev"; break;
    case "friendText": label = source.friend; break;
    case "chatMessage": label = "chat"; break;
    case "narratorBeat": label = "narration"; break;
    default: label = "fact";
  }
  const color = SOURCE_COLORS[source.kind] ?? cfPalette.ash;
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <PixelText size={5} color={color} uppercase>
        {label}
      </PixelText>
    </View>
  );
}

export function FactDetailView({ fact, onClose }: FactDetailViewProps) {
  const run = useGameState((s) => s.run);
  const updateFactNote = useGameState((s) => s.updateFactNote);

  const [noteText, setNoteText] = useState(fact.playerNote ?? "");
  const [saving, setSaving] = useState(false);

  const isCaptured = fact.kind === "captured";
  const day = isCaptured ? fact.capturedOnDay ?? 0 : fact.day;
  const quote = isCaptured ? fact.capturedQuote : fact.payload.text;

  const linkedFacts = useMemo<Fact[]>(() => {
    if (!run) return [];
    const chains = run.evidenceChains ?? [];
    const linked: Fact[] = [];
    for (const chain of chains) {
      if (chain.factIdA === fact.id && chain.factIdB !== fact.id) {
        const found = run.facts.find((f) => f.id === chain.factIdB);
        if (found) linked.push(found);
      } else if (chain.factIdB === fact.id && chain.factIdA !== fact.id) {
        const found = run.facts.find((f) => f.id === chain.factIdA);
        if (found) linked.push(found);
      }
    }
    return linked;
  }, [run, fact.id]);

  const relatedFacts = useMemo<Fact[]>(() => {
    if (!run) return [];
    const candidateId = isCaptured ? fact.capturedFromCandidateId : undefined;
    const aboutChar = fact.aboutCharacter;
    const sourceKind = fact.source.kind;

    return run.facts
      .filter((f) => {
        if (f.id === fact.id) return false;
        if (!f.committed) return false;
        const sameChar = aboutChar && f.aboutCharacter === aboutChar;
        const sameSource = f.source.kind === sourceKind;
        const sameChain = linkedFacts.some((lf) => lf.id === f.id);
        return sameChar || sameSource || sameChain;
      })
      .slice(0, 6);
  }, [run, fact.id, isCaptured, fact.aboutCharacter, fact.source.kind, linkedFacts]);

  async function handleSaveNote() {
    if (saving) return;
    setSaving(true);
    try {
      await updateFactNote(fact.id, noteText);
    } finally {
      setSaving(false);
    }
  }

  const aboutName = fact.aboutCharacter
    ? (fact.aboutCharacter === "player" || fact.aboutCharacter === "dev" || fact.aboutCharacter === "nia"
      ? fact.aboutCharacter
      : getIdentityModule(fact.aboutCharacter as any).displayName)
    : null;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.wrap} pointerEvents="box-none">
          <PixelPanel variant="raised" style={styles.panel}>
            <ScanlineOverlay intensity={0.04} step={4} />

            {/* Header row */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <PixelText size={6} color={cfPalette.ash} uppercase>
                  day {day}
                </PixelText>
                <SourceLabel source={fact.source} />
              </View>
              <Pressable onPress={onClose} hitSlop={10}>
                <PixelText size={9} color={cfPalette.ash} uppercase>
                  ✕
                </PixelText>
              </Pressable>
            </View>

            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Kind badge */}
              <View style={styles.kindRow}>
                <View style={[styles.badge, { borderColor: cfPalette.purple }]}>
                  <PixelText size={5} color={cfPalette.purple} uppercase>
                    {KIND_LABELS[fact.kind] ?? fact.kind}
                  </PixelText>
                </View>
                {aboutName && (
                  <View style={[styles.badge, { borderColor: cfPalette.pinkHot }]}>
                    <PixelText size={5} color={cfPalette.pinkHot} uppercase>
                      about: {aboutName}
                    </PixelText>
                  </View>
                )}
              </View>

              {/* Main fact text */}
              <PixelPanel variant="raised" style={styles.quotePanel}>
                <PixelText size={11} color={cfPalette.purpleHot} style={styles.quoteGlyph}>
                  "
                </PixelText>
                <PixelText size={10} color={cfPalette.bone} style={styles.quoteText}>
                  {quote}
                </PixelText>
              </PixelPanel>

              {/* Image viewer */}
              {fact.payload.imageAssetID && (
                <View style={styles.imageSection}>
                  <PixelText
                    size={6}
                    color={cfPalette.ash}
                    uppercase
                    style={{ marginBottom: 8 }}
                  >
                    evidence image
                  </PixelText>
                  <AssetImage
                    id={fact.payload.imageAssetID}
                    style={styles.image}
                    containerStyle={styles.image}
                    resizeMode="contain"
                  />
                </View>
              )}

              {/* Linked facts */}
              {linkedFacts.length > 0 && (
                <View style={styles.section}>
                  <PixelText
                    size={7}
                    color={cfPalette.cyan}
                    uppercase
                    style={{ marginBottom: 8 }}
                  >
                    linked facts
                  </PixelText>
                  <View style={styles.linkedList}>
                    {linkedFacts.map((lf) => (
                      <PixelPanel key={lf.id} variant="default" style={styles.linkedCard}>
                        <PixelText size={7} color={cfPalette.ash} uppercase>
                          day {lf.day}
                        </PixelText>
                        <PixelText
                          size={8}
                          color={cfPalette.bone}
                          style={{ marginTop: 4 }}
                        >
                          {lf.kind === "captured"
                            ? lf.capturedQuote ?? ""
                            : lf.payload.text ?? ""}
                        </PixelText>
                      </PixelPanel>
                    ))}
                  </View>
                </View>
              )}

              {/* Player note */}
              <View style={styles.section}>
                <PixelText
                  size={7}
                  color={cfPalette.pinkHot}
                  uppercase
                  style={{ marginBottom: 8 }}
                >
                  your note
                </PixelText>
                <PixelPanel variant="default" style={styles.notePanel}>
                  <TextInput
                    value={noteText}
                    onChangeText={setNoteText}
                    placeholder="Write your deduction note here…"
                    placeholderTextColor={cfPalette.iron}
                    multiline
                    style={styles.noteInput}
                  />
                </PixelPanel>
                {noteText !== (fact.playerNote ?? "") && (
                  <NeonButton
                    label={saving ? "Saving…" : "Save Note"}
                    variant="primary"
                    size="sm"
                    disabled={saving}
                    onPress={() => { void handleSaveNote(); }}
                    style={{ marginTop: 8 }}
                  />
                )}
              </View>

              {/* Related facts */}
              {relatedFacts.length > 0 && (
                <View style={styles.section}>
                  <PixelText
                    size={7}
                    color={cfPalette.purple}
                    uppercase
                    style={{ marginBottom: 8 }}
                  >
                    related facts
                  </PixelText>
                  <View style={styles.relatedList}>
                    {relatedFacts.map((rf) => {
                      const rfAbout = rf.aboutCharacter
                        ? (rf.aboutCharacter === "player" || rf.aboutCharacter === "dev" || rf.aboutCharacter === "nia"
                          ? rf.aboutCharacter
                          : getIdentityModule(rf.aboutCharacter as any).displayName)
                        : null;
                      return (
                        <View key={rf.id} style={styles.relatedCard}>
                          <View style={styles.relatedHeader}>
                            <PixelText size={5} color={cfPalette.ash} uppercase>
                              day {rf.day}
                            </PixelText>
                            {rfAbout && (
                              <PixelText size={5} color={cfPalette.purpleHot} uppercase>
                                → {rfAbout}
                              </PixelText>
                            )}
                          </View>
                          <PixelText
                            size={7}
                            color={cfPalette.bone}
                            style={{ marginTop: 2 }}
                          >
                            {rf.kind === "captured"
                              ? rf.capturedQuote ?? ""
                              : rf.payload.text ?? ""}
                          </PixelText>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}
            </ScrollView>
          </PixelPanel>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(3,1,10,0.88)",
    justifyContent: "center",
    alignItems: "stretch",
    padding: Platform.OS === "web" ? 24 : 16,
  },
  wrap: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
  },
  panel: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    maxHeight: "90%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  body: {
    maxHeight: 520,
  },
  bodyContent: {
    gap: 16,
    paddingBottom: 4,
  },
  kindRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  badge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
  },
  quotePanel: {
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  quoteGlyph: {
    marginBottom: 4,
    lineHeight: 12,
  },
  quoteText: {
    lineHeight: 15,
  },
  imageSection: {
    marginTop: 4,
  },
  image: {
    width: "100%",
    aspectRatio: 1,
    borderWidth: 2,
    borderColor: cfPalette.purple,
    borderRadius: 4,
  },
  section: {
    marginTop: 4,
  },
  linkedList: {
    gap: 6,
  },
  linkedCard: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 3,
  },
  notePanel: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    minHeight: 80,
  },
  noteInput: {
    color: cfPalette.bone,
    fontSize: 10,
    lineHeight: 15,
    flex: 1,
    textAlignVertical: "top",
  },
  relatedList: {
    gap: 6,
  },
  relatedCard: {
    borderWidth: 1,
    borderColor: cfPalette.fog,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: cfPalette.panel,
  },
  relatedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});