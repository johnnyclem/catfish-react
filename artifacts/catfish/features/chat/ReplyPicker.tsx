/**
 * ReplyPicker — 2–3 canned replies the player picks between.
 *
 * Disabled while a reply is in-flight to prevent double-sends from re-taps
 * during the AsyncStorage write. Empty `options` collapses the picker —
 * the parent ThreadView shows an "out of replies for now" hint instead.
 */

import { StyleSheet, View } from "react-native";

import { NeonButton, PixelText } from "@/components/PixelChrome";
import { cfPalette } from "@/constants/colors";

interface ReplyPickerProps {
  options: string[];
  pending: boolean;
  onPick: (option: string) => void;
}

export function ReplyPicker({ options, pending, onPick }: ReplyPickerProps) {
  if (options.length === 0) return null;

  return (
    <View style={styles.root}>
      <PixelText size={6} color={cfPalette.ash} uppercase style={styles.label}>
        pick a reply
      </PixelText>
      <View style={styles.list}>
        {options.map((opt, idx) => (
          <NeonButton
            key={`${idx}-${opt}`}
            label={opt}
            variant={idx === 0 ? "primary" : "ghost"}
            size="sm"
            fullWidth
            disabled={pending}
            onPress={() => onPick(opt)}
            style={{ marginBottom: 8 }}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingTop: 12,
    paddingHorizontal: 12,
  },
  label: {
    marginBottom: 8,
    letterSpacing: 1,
  },
  list: {
    gap: 0,
  },
});
