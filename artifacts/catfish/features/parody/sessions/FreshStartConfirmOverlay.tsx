/**
 * Shared FRESH-START confirm overlay for parody mini-games — Task #56.
 *
 * Renders the END SAVED RUN? card with a START FRESH (primary) and
 * KEEP SAVED RUN (secondary) button. The testIDs follow the
 * `${game}-fresh-confirm` / `${game}-fresh-cancel` convention the
 * Task #49 / #52 / #53 regression tests already pin against, so
 * the existing behavioural mirrors keep working without churn.
 *
 * The visual design is intentionally identical across all three
 * mini-games: a future copy-paste from one game to another will
 * land on the same overlay shape, the same labels, and the same
 * testIDs — there's no per-game divergence left to drift.
 *
 * Three knobs the games actually need:
 *
 *   - `game` — drives the testID prefix (one of `safespot` |
 *     `egotrip` | `sugarcoat`). New parody mini-games extend this
 *     literal type (NOT a free-form string) so the type checker
 *     refuses an unknown game name and the matching regression
 *     test prompts to be added in the same change.
 *   - `accentColor` — the primary action button's background. Each
 *     parody mini-game has its own accent (SafeSpot orange, EgoTrip
 *     white, SugarCoat pink). Keeping this configurable means the
 *     overlay still feels native to each game without forking the
 *     layout.
 *   - `message` — body copy the per-game caller composes from its
 *     own snapshot (e.g. "This will wipe your saved wave 4
 *     progress." vs "This will wipe your saved Ego 17.").
 */
import { Feather } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

/** Allow-list of parody mini-games whose FRESH START flow uses this
 *  overlay. Adding a fourth entry is the structural prompt to add a
 *  matching mirror test in `scripts/test-parody-fresh-start.mts`. */
export type FreshStartGameId = "safespot" | "egotrip" | "sugarcoat";

export interface FreshStartConfirmOverlayProps {
  /** Identifies the game for testID stability. */
  game: FreshStartGameId;
  /** Whether the overlay is currently rendered. */
  visible: boolean;
  /** Body text shown under the END SAVED RUN? headline. */
  message: string;
  /** Wipe handler — wire to `useFreshStartConfirm.confirmFreshStart`. */
  onConfirm: () => void;
  /** Dismiss handler — wire to `useFreshStartConfirm.cancelFreshStart`. */
  onCancel: () => void;
  /** Primary button background. Defaults to white if omitted. */
  accentColor?: string;
}

export function FreshStartConfirmOverlay({
  game,
  visible,
  message,
  onConfirm,
  onCancel,
  accentColor,
}: FreshStartConfirmOverlayProps) {
  if (!visible) return null;
  const primaryBg = accentColor ?? "white";
  // Black text reads on white/orange/pink primaries; if a future
  // game ships a dark accent, the overlay can be extended with a
  // primaryLabelColor prop. For the current three this is enough.
  return (
    <Pressable
      style={styles.overlay}
      // Swallow taps that miss the buttons so a stray tap doesn't
      // fall through to the field underneath (relevant for EgoTrip,
      // whose root is a Pressable that flaps the bird on tap).
      onPress={(e) => e.stopPropagation?.()}
    >
      <View style={styles.card}>
        <Feather name="alert-triangle" size={36} color={primaryBg} />
        <Text style={styles.title}>END SAVED RUN?</Text>
        <Text style={styles.body}>{message}</Text>
        <Pressable
          testID={`${game}-fresh-confirm`}
          onPress={(e) => {
            e.stopPropagation?.();
            onConfirm();
          }}
          style={({ pressed }) => [
            styles.primaryBtn,
            { backgroundColor: primaryBg },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={styles.primaryBtnLabel}>START FRESH</Text>
        </Pressable>
        <Pressable
          testID={`${game}-fresh-cancel`}
          onPress={(e) => {
            e.stopPropagation?.();
            onCancel();
          }}
          style={({ pressed }) => [
            styles.secondaryBtn,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={styles.secondaryBtnLabel}>KEEP SAVED RUN</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    zIndex: 20,
  },
  card: {
    width: "100%",
    backgroundColor: "#18181b",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#27272a",
    padding: 28,
    alignItems: "center",
    gap: 10,
  },
  title: {
    color: "white",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  body: {
    color: "#a1a1aa",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    textAlign: "center",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  primaryBtn: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 8,
  },
  primaryBtnLabel: {
    color: "black",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 2,
  },
  secondaryBtn: {
    width: "100%",
    backgroundColor: "#27272a",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  secondaryBtnLabel: {
    color: "#a1a1aa",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 2,
  },
});
