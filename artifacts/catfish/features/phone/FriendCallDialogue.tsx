/**
 * FriendCallDialogue — outgoing call interaction with a friend (Dev or Nia).
 *
 * Phase 9. The player taps "call" on a friend's contact card, spending
 * one phone credit. A dialogue tree plays out where the friend responds
 * to the player's chosen question about a suspect. The response may
 * include a linked fact.
 */
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { PixelPanel, PixelText, ScanlineOverlay } from "@/components/PixelChrome";
import { cfPalette } from "@/constants/colors";
import { useGameState } from "@/core/gameStore";
import type { FriendID } from "@/core/models";

import { PhoneIcon } from "./PhoneIcon";

interface Props {
  friend: FriendID;
  runId: string;
  onClose: () => void;
}

const SUSPECTS = ["kai", "miles", "river", "jules", "sam", "tessa", "ren", "delphine"] as const;

const QUESTIONS = [
  "what do you think about {name}?",
  "heard anything about {name}?",
  "is {name} hiding something?",
] as const;

const DEV_RESPONSES: Record<string, string> = {
  default:
    "honestly? i don't know much. but something felt off when we last talked.",
  kai: "kai seems chill. paints all day, talks about sunsets. maybe too relaxed?",
  miles: "miles is intense. works late, always on his laptop. i've seen him around.",
  river: "river's outdoorsy. hiking, climbing. seems genuine but who knows.",
  jules: "jules is in his own world. art stuff, late nights. artistic types, you know?",
  sam: "sam's sweet. works at the hospital, always tired. seems normal.",
};

const NIA_RESPONSES: Record<string, string> = {
  default:
    "i haven't talked to them much lately. maybe check what they're posting?",
  kai: "kai slides into everyone's DMs. charming but... i don't know. feels rehearsed.",
  miles: "miles is organized. too organized? always knows where everything is.",
  river: "river's solid. we met on a hike once. hasn't mentioned anything weird.",
  jules: "jules is intense. art, music, late nights. pretty sure he doesn't sleep.",
  sam: "sam's quiet. keeps to herself mostly. works a lot.",
};

function pickResponse(friend: FriendID, suspect: string): string {
  const map = friend === "nia" ? NIA_RESPONSES : DEV_RESPONSES;
  const key = SUSPECTS.includes(suspect as typeof SUSPECTS[number]) ? suspect : "default";
  return map[key] ?? map["default"];
}

const FRIEND_NAMES: Record<FriendID, string> = {
  dev: "Dev",
  nia: "Nia",
  alex: "Alex",
  morgan: "Morgan",
};

export function FriendCallDialogue({ friend, onClose }: Props) {
  const run = useGameState((s) => s.run);
  const [phase, setPhase] = useState<"question" | "response" | "done">("question");
  const [selectedSuspect, setSelectedSuspect] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");

  function handleAsk(suspect: string) {
    setSelectedSuspect(suspect);
    setResponseText(pickResponse(friend, suspect));
    setPhase("response");
  }

  function handleDone() {
    onClose();
  }

  const friendName = FRIEND_NAMES[friend];

  return (
    <View style={styles.root}>
      <ScanlineOverlay />
      <View style={styles.header}>
        <PhoneIcon size={20} />
        <PixelText size={9} color={cfPalette.bone} uppercase style={{ marginLeft: 8 }}>
          calling {friendName}…
        </PixelText>
      </View>

      <View style={styles.callVisual}>
        <View style={styles.avatar}>
          <PixelText size={18} color={cfPalette.bone} uppercase>
            {friendName.slice(0, 2)}
          </PixelText>
        </View>
        <View style={styles.voiceBars}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View
              key={i}
              style={[
                styles.voiceBar,
                { height: 8 + i * 3 },
              ]}
            />
          ))}
        </View>
      </View>

      <View style={styles.body}>
        {phase === "question" && (
          <PixelPanel variant="raised" style={styles.panel}>
            <PixelText size={8} color={cfPalette.pinkHot} uppercase style={{ marginBottom: 12 }}>
              ask {friendName} about…
            </PixelText>
            <ScrollView>
              {SUSPECTS.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => handleAsk(s)}
                  style={({ pressed }) => [
                    styles.questionRow,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <PixelText size={8} color={cfPalette.cyan}>
                    {s}
                  </PixelText>
                </Pressable>
              ))}
            </ScrollView>
          </PixelPanel>
        )}

        {phase === "response" && selectedSuspect && (
          <PixelPanel variant="raised" style={styles.panel}>
            <PixelText size={8} color={cfPalette.purpleHot} uppercase style={{ marginBottom: 8 }}>
              {friendName} on {selectedSuspect}:
            </PixelText>
            <PixelText size={9} color={cfPalette.bone} style={{ lineHeight: 15 }}>
              "{responseText}"
            </PixelText>
            <Pressable
              onPress={handleDone}
              style={({ pressed }) => [
                styles.doneBtn,
                { marginTop: 16 },
                pressed && { opacity: 0.7 },
              ]}
            >
              <PixelText size={8} color={cfPalette.void} uppercase>
                end call
              </PixelText>
            </Pressable>
          </PixelPanel>
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
  callVisual: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 16,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: cfPalette.purple,
    alignItems: "center",
    justifyContent: "center",
  },
  voiceBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
    height: 24,
  },
  voiceBar: {
    width: 4,
    backgroundColor: cfPalette.cyan,
    borderRadius: 2,
  },
  body: {
    flex: 1,
    padding: 16,
  },
  panel: {
    padding: 16,
  },
  questionRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: cfPalette.iron,
  },
  doneBtn: {
    backgroundColor: cfPalette.cyan,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignSelf: "center",
    borderRadius: 4,
  },
});